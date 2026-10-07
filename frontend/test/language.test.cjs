const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadCopy(file) {
  const source = fs.readFileSync(file, 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const context = { exports: {}, require: relative => loadCopy(path.resolve(path.dirname(file), relative + '.ts')) };
  vm.runInNewContext(compiled, context);
  return context.exports;
}
const { translate, translations } = loadCopy(path.join(__dirname, '../src/i18n/translations.ts'));

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

test('Authentication and each role have Sinhala and Tamil interface copy', () => {
  for (const text of ['Sign In', 'Call Next', 'National Health Grid', 'Patient Registration', 'Central Health Records']) {
    for (const language of ['si', 'ta']) {
      assert.notEqual(translate(language, text), text, `${language}: ${text}`);
    }
  }
});

test('Displayed backend enums translate without changing English API values', () => {
  for (const value of ['male', 'female', 'URGENT', 'walk_in', 'pre_booked', 'in_consultation', 'on_break', 'no_show']) {
    assert.equal(translate('en', value), value);
    for (const language of ['si', 'ta']) assert.notEqual(translate(language, value), value);
  }
});

test('Multiline confirmations preserve entered names, punctuation and line breaks', () => {
  const key = 'Reason: {value0}\nStatus: {value1}\nTime: {value2}';
  for (const language of ['en', 'si', 'ta']) {
    const text = translate(language, key, { value0: 'Patient note $& {room}', value1: 'Waiting', value2: '10:30' });
    assert.equal(text.split('\n').length, 3);
    assert.ok(text.includes('Patient note $& {room}'));
    assert.ok(text.includes('10:30'));
  }
});

test('Localized dates and waits preserve hospital calendar keys and numbers', () => {
  const dates = loadCopy(path.join(__dirname, '../src/utils/opdDates.ts'));
  const instant = new Date('2026-10-06T20:00:00Z');
  assert.equal(dates.toDateKey(instant), '2026-10-07');
  for (const [language, locale] of [['en', 'en-GB'], ['si', 'si-LK'], ['ta', 'ta-LK']]) {
    assert.equal(dates.dayLabel('2026-10-07', '2026-10-07', locale), translate(language, 'Today'));
    assert.equal(dates.addDaysKey('2026-10-07', 1), '2026-10-08');
    assert.ok(dates.longDayLabel('2026-10-07', locale).includes('2026'));
    assert.equal(dates.shortDayParts('2026-10-07', locale).day, '7');
    assert.ok(dates.waitLabel(75, language).includes('1'));
    assert.ok(dates.waitLabel(75, language).includes('15'));
    if (language !== 'en') assert.notEqual(dates.waitLabel(75, language), dates.waitLabel(75, 'en'));
  }
});
