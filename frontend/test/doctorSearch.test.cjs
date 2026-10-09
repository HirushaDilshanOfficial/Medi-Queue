const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file) {
  const context = { exports: {}, require: relative => load(path.resolve(path.dirname(file), relative + '.ts')) };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  return context.exports;
}
const { filterDoctorDirectory } = load(path.resolve(__dirname, '../src/utils/doctorSearch.ts'));
const { translate } = load(path.resolve(__dirname, '../src/i18n/translations.ts'));
const doctors = Object.freeze([
  Object.freeze({ id: 'aruna', name: 'Dr. Aruna Perera', displayName: 'Dr. Aruna Perera', specialization: 'Orthopedic Surgeon', department: 'Orthopaedic' }),
  Object.freeze({ id: 'dilani', name: 'Dr. Dilani Jayasuriya', displayName: 'Dr. Dilani Jayasuriya', specialization: 'Pediatrician', department: 'Pediatrics' }),
]);
const ids = (query, language = 'en') => Array.from(filterDoctorDirectory(doctors, query, text => translate(language, text)), doctor => doctor.id);

test('doctor search matches partial names and multiple words across display fields', () => {
  assert.deepEqual(ids('  PERERA   aruna '), ['aruna']);
  assert.deepEqual(ids('arun orthopedic'), ['aruna']);
  assert.deepEqual(ids('Pediatric'), ['dilani']);
  assert.deepEqual(ids('.*'), []);
  assert.deepEqual(ids('absent'), []);
  assert.deepEqual(ids('  '), ['aruna', 'dilani']);
});

test('Sinhala and Tamil specialty searches preserve names and stored departments', () => {
  for (const language of ['si', 'ta']) {
    assert.deepEqual(ids(translate(language, 'Orthopaedic'), language), ['aruna']);
    assert.deepEqual(ids(translate(language, 'Pediatrics'), language), ['dilani']);
    assert.deepEqual(ids('Aruna', language), ['aruna']);
  }
  assert.equal(doctors[0].department, 'Orthopaedic');
  assert.equal(doctors[0].name, 'Dr. Aruna Perera');
});

test('clearing or broadening a query immediately restores matching loaded doctors', () => {
  assert.deepEqual(ids('perera'), ['aruna']);
  assert.deepEqual(ids('Dr.'), ['aruna', 'dilani']);
  assert.deepEqual(ids(''), ['aruna', 'dilani']);
  assert.equal(filterDoctorDirectory(doctors, '', text => text), doctors);
});
