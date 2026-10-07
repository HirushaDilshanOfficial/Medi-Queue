const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/i18n/translations.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {} };
vm.runInNewContext(compiled, context);
const { translate, translations } = context.exports;

test('English copy and unknown text stay intact in all languages', () => {
  assert.equal(translate('en', 'Language'), 'Language');
  for (const language of ['en', 'si', 'ta']) {
    assert.equal(translate(language, 'Unlisted clinical note'), 'Unlisted clinical note');
    assert.equal(translate(language, ''), '');
  }
});

test('Sinhala and Tamil dictionaries contain both scripts and preserve placeholders', () => {
  const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const [key, values] of Object.entries(translations)) {
    assert.equal(values.length, 2, key);
    assert.match(values[0], /[\u0d80-\u0dff]/, key);
    assert.match(values[1], /[\u0b80-\u0bff]/, key);
    assert.deepEqual(placeholders(values[0]), placeholders(key), key);
    assert.deepEqual(placeholders(values[1]), placeholders(key), key);
  }
});

test('Dynamic queue copy keeps room names and numbers in the translated sentence', () => {
  for (const language of ['en', 'si', 'ta']) {
    const text = translate(language, 'Current Queue {number} • Your position {position}', { number: 7, position: 12 });
    assert.ok(text.includes('7') && text.includes('12'));
    assert.ok(!text.includes('{'));
    assert.ok(translate(language, 'Please go to {room}', { room: '$& Room 304' }).includes('$& Room 304'));
  }
});

test('Missing interpolation values remain visible rather than becoming undefined', () => {
  assert.equal(translate('en', 'Please go to {room}', {}), 'Please go to {room}');
});
