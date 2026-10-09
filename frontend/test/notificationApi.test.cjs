const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function setup() {
  let token = 'token-a', owner = 'patient-a';
  const storage = new Map();
  const items = [{ _id: 'notification-a', title: 'Appointment', message: 'Your appointment', createdAt: '2026-10-08T09:00:00Z' }];
  const response = () => ({ ok: true, status: 200, headers: { get: () => owner }, json: async () => items });
  let fetcher = async () => response();
  class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
  const context = {
    exports: {}, AbortController, setTimeout, clearTimeout,
    fetch: (...args) => fetcher(...args),
    require: name => {
      if (name.includes('async-storage')) return { __esModule: true, default: { getItem: async key => storage.get(key) || null, setItem: async (key, value) => storage.set(key, value) } };
      if (name === '../config') return { API_URL: 'http://example.test/api/v1' };
      if (name === './http') return { HttpError, getAuthToken: async () => token };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  };
  const source = fs.readFileSync(path.join(__dirname, '../src/services/notificationApi.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  return { api: context.exports.notificationApi, storage, response,
    token: next => { token = next; }, owner: next => { owner = next; }, fetch: next => { fetcher = next; } };
}

test('read markers and unread counts are isolated per logged-in account', async () => {
  const app = setup();
  assert.equal(await app.api.unreadCount(), 1);
  await app.api.markRead(await app.api.list());
  assert.equal(await app.api.unreadCount(), 0);
  assert.ok(app.storage.has('notification_read_time:patient-a'));
  assert.ok(!app.storage.has('last_notification_read_time'));
  app.token('token-b'); app.owner('patient-b');
  assert.equal(await app.api.unreadCount(), 1);
});

test('a response arriving after account switching is rejected', async () => {
  const app = setup();
  let finish;
  app.fetch(() => new Promise(resolve => { finish = resolve; }));
  const pending = app.api.list();
  await new Promise(setImmediate);
  app.token('token-b');
  finish(app.response());
  await assert.rejects(pending, error => error.status === 401);
});

test('an old unscoped server feed and signed-out session are rejected', async () => {
  const app = setup();
  app.owner(null);
  await assert.rejects(app.api.list(), error => error.status === 401);
  app.token(null);
  await assert.rejects(app.api.list(), error => error.status === 401);
});

test('a previous account cannot update the current account’s read state', async () => {
  const app = setup();
  const oldInbox = await app.api.list();
  app.token('token-b'); app.owner('patient-b');
  await app.api.markRead(oldInbox);
  assert.equal(app.storage.size, 0);
});
