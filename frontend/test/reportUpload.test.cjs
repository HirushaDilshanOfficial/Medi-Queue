const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const express = require('../../backend/node_modules/express');
const { reportUpload } = require('../../backend/middleware/reportUpload');

function load(relativePath, requireModule = () => { throw new Error('Unexpected import'); }) {
  const context = { exports: {}, Blob, TextEncoder, Uint8Array, require: requireModule };
  const source = fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return context.exports;
}

// Exercise SDK 57's actual multipart serializer and FormData patch. Only the
// device file read is substituted, since Windows cannot load the iOS module.
const { installFormDataPatch } = load('../node_modules/expo/src/winter/FormData.ts');
class NativeFormData { constructor() { this._parts = []; } }
installFormDataPatch(NativeFormData);
const { convertFormDataAsync } = load('../node_modules/expo/src/winter/fetch/convertFormData.ts', () => ({
  blobToArrayBufferAsync: blob => blob.arrayBuffer(),
}));

function uploader(bytes, type) {
  let reads = 0;
  class DeviceFile {
    constructor(uri) {
      assert.equal(uri, 'file:///cache/medical%20report.pdf');
      this.size = bytes.length;
      this.type = type;
      this.name = 'cached-report';
      reads++;
    }
    slice(start, end, mimeType) { return new Blob([bytes.subarray(start, end)], { type: mimeType }); }
  }
  const { appendReportFile } = load('../src/utils/appendReportFile.ts', name => {
    assert.equal(name, 'expo-file-system');
    return { File: DeviceFile };
  });
  return { appendReportFile, reads: () => reads };
}

test('SDK 57 rejects the old native URI attachment before sending the request', async () => {
  const form = new NativeFormData();
  form.append('file', { uri: 'file:///cache/report.pdf', name: 'report.pdf', type: 'application/pdf' });
  await assert.rejects(convertFormDataAsync(form), /Unsupported FormDataPart implementation/);
});

test('web retains the exact browser File without reading native storage', () => {
  const api = uploader(Buffer.from('unused'), 'application/pdf');
  const browserFile = new Blob(['browser contents'], { type: 'application/pdf' });
  browserFile.name = 'web-report.pdf';
  const form = new NativeFormData();
  api.appendReportFile(form, { file: browserFile, name: 'web-report.pdf' });
  assert.equal(form.get('file'), browserFile);
  assert.equal(api.reads(), 0);
});

test('native PDF and images reach the existing backend with correct bytes, MIME and booking metadata', async t => {
  const app = express();
  app.post('/reports', reportUpload.single('file'), (req, res) => {
    res.json({ mime: req.file.mimetype, bytes: [...req.file.buffer], name: req.file.originalname,
      title: req.body.title, appointmentId: req.body.appointmentId });
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  for (const mime of ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']) {
    const bytes = Buffer.from([0, 1, 2, 128, 255, 13, 10]);
    const api = uploader(bytes, mime);
    const form = new NativeFormData();
    form.append('title', 'Medical document');
    form.append('appointmentId', 'confirmed-booking');
    api.appendReportFile(form, { uri: 'file:///cache/medical%20report.pdf', name: 'report.pdf', mimeType: mime });
    const serialized = await convertFormDataAsync(form, 'test-upload-boundary');
    const response = await fetch(`http://127.0.0.1:${server.address().port}/reports`, {
      method: 'POST', body: serialized.body,
      headers: { 'Content-Type': `multipart/form-data; boundary=${serialized.boundary}` },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { mime, bytes: [...bytes], name: 'report.pdf',
      title: 'Medical document', appointmentId: 'confirmed-booking' });
  }
});

test('the cached file MIME type is used when the mobile picker omits it', async () => {
  const api = uploader(Buffer.from('%PDF'), 'application/pdf');
  const form = new NativeFormData();
  api.appendReportFile(form, { uri: 'file:///cache/medical%20report.pdf', name: 'report.pdf' });
  assert.equal(form.get('file').type, 'application/pdf');
  await convertFormDataAsync(form, 'test-upload-boundary');
});
