const test = require('node:test');
const assert = require('node:assert/strict');

const OpdAppointment = require('../models/OpdAppointment');
const OpdQueueEntry = require('../models/OpdQueueEntry');
const OpdQueueCounter = require('../models/OpdQueueCounter');
const { generatePassCode, passQrValue } = require('../controllers/queueController');
const { isFull, isWithinHorizon, addDays, horizonKeys } = require('../controllers/slotController');
const { relativeDate, humanDate, clockLabel } = require('../utils/opdAppointment');

function validate(Model, doc) {
  const result = new Model(doc).validateSync();
  return result ? result.message : null;
}

test('pass code meets the schema minimum length', () => {
  // The schema requires minlength 24; a shorter generator would fail every
  // check-in at runtime rather than at test time.
  const code = generatePassCode();
  assert.equal(code.length, 24);
  assert.equal(validate(OpdQueueEntry, validEntry(code)), null);
});

test('pass codes use an unambiguous alphabet and do not collide', () => {
  const codes = new Set();
  for (let i = 0; i < 5000; i += 1) {
    const code = generatePassCode();
    assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{24}$/);
    codes.add(code);
  }
  assert.equal(codes.size, 5000);
});

test('queue entry rejects a token that is not a whole number', () => {
  assert.match(validate(OpdQueueEntry, validEntry(generatePassCode(), 1.5)), /whole number/);
  assert.match(validate(OpdQueueEntry, validEntry(generatePassCode(), 0)), /0/);
  assert.equal(validate(OpdQueueEntry, validEntry(generatePassCode(), 1)), null);
});

test('queue entry rejects an impossible queue date', () => {
  const message = validate(OpdQueueEntry, { ...validEntry(generatePassCode()), queueDate: '2026-02-31' });
  assert.match(message, /real YYYY-MM-DD/);
});

test('queue counter rejects an impossible day', () => {
  const message = validate(OpdQueueCounter, { department: 'Cardiology', queueDate: '2026-13-01' });
  assert.match(message, /real YYYY-MM-DD/);
});

test('one active pass per appointment, and one token per patient per slot', () => {
  const entryIndex = Object.values(OpdQueueEntry.schema.indexes()).find(
    (index) => index[1] && index[1].unique && index[0].department === 1 && index[0].queueDate === 1,
  );
  assert.ok(entryIndex, 'expected a unique { department, queueDate, tokenNumber } index');

  const passCodeUnique = Object.values(OpdQueueEntry.schema.indexes()).find(
    (index) => index[1] && index[1].unique && index[0].passCode === 1,
  );
  assert.ok(passCodeUnique, 'expected passCode to be unique');

  const bookingIndex = Object.values(OpdAppointment.schema.indexes()).find(
    (index) => index[1] && index[1].partialFilterExpression && index[1].partialFilterExpression.isActive,
  );
  assert.ok(bookingIndex, 'expected a partial unique index guarded on isActive');
  assert.deepEqual(Object.keys(bookingIndex[0]), ['profile', 'doctor', 'date', 'slotTime']);
});

test('appointment status is constrained and defaults to active', () => {
  const doc = new OpdAppointment(validAppointment());
  assert.equal(doc.status, 'booked');
  assert.equal(doc.isActive, true);
  assert.match(validate(OpdAppointment, { ...validAppointment(), status: 'teleported' }), /status/);
});

test('slot capacity decides availability, not a blanket full check', () => {
  const counts = new Map();
  // One booking so far against a slot that seats three.
  counts.set('2026-10-01|09:00', 1);
  assert.equal(isFull(counts, '2026-10-01', '09:00', 3), false);
  counts.set('2026-10-01', 1);
  assert.equal(isFull(counts, '2026-10-01', '09:00', 1), true);
  // An unbooked slot is never full.
  assert.equal(isFull(new Map(), '2026-10-01', '11:20', 1), false);
  // A missing capacity value falls back to one seat.
  assert.equal(isFull(new Map([['2026-10-01|09:00', 1]]), '2026-10-01', '09:00', undefined), true);
});

test('booking window is today through the horizon', () => {
  const today = '2026-10-01';
  assert.equal(isWithinHorizon(today, today), true);
  assert.equal(isWithinHorizon(addDays(today, 14), today), true);
  assert.equal(isWithinHorizon(addDays(today, 15), today), false);
  assert.equal(isWithinHorizon('2026-09-30', today), false);
  assert.equal(horizonKeys(today).length, 15);
  assert.equal(horizonKeys(today)[0], today);
});

test('pass labels read Today and Tomorrow rather than raw dates', () => {
  assert.equal(relativeDate('2026-10-01', '2026-10-01'), 'Today');
  assert.equal(relativeDate('2026-10-02', '2026-10-01'), 'Tomorrow');
  // A distant date stays compact so it does not crowd out the token number.
  assert.equal(relativeDate('2026-10-05', '2026-10-01'), 'Mon 5 Oct');
  assert.equal(humanDate('2026-10-01'), 'Thursday, 1 October 2026');
});

test('clock label is zero padded and rejects junk', () => {
  assert.equal(clockLabel(new Date(Date.UTC(2026, 9, 1, 3, 30))), '09:00');
  assert.equal(clockLabel('not a date'), null);
});

test('the QR value carries only the opaque code when no public URL is configured', () => {
  const originalPublicUrl = process.env.PUBLIC_WEB_URL;
  delete process.env.PUBLIC_WEB_URL;
  const value = passQrValue({ passCode: 'ABCDEFGHJKLMNPQRSTUVWXYZ' });
  assert.equal(value, 'http://10.240.7.66:5001/api/v1/public/queue-pass/ABCDEFGHJKLMNPQRSTUVWXYZ');
  if (originalPublicUrl === undefined) delete process.env.PUBLIC_WEB_URL;
  else process.env.PUBLIC_WEB_URL = originalPublicUrl;
});

test('the QR value uses the configured public URL when provided', () => {
  const originalPublicUrl = process.env.PUBLIC_WEB_URL;
  process.env.PUBLIC_WEB_URL = 'https://queue.example.test/';
  const value = passQrValue({ passCode: 'ABCDEFGHJKLMNPQRSTUVWXYZ' });
  assert.equal(value, 'https://queue.example.test/pass/ABCDEFGHJKLMNPQRSTUVWXYZ');
  if (originalPublicUrl === undefined) delete process.env.PUBLIC_WEB_URL;
  else process.env.PUBLIC_WEB_URL = originalPublicUrl;
});

function validEntry(passCode, tokenNumber = 1) {
  return {
    appointment: '507f1f77bcf86cd799439011',
    profile: '507f1f77bcf86cd799439012',
    department: 'Cardiology',
    queueDate: '2026-10-01',
    tokenNumber,
    passCode,
  };
}

function validAppointment() {
  return {
    profile: '507f1f77bcf86cd799439012',
    doctor: '507f1f77bcf86cd799439011',
    doctorName: 'Dr. Nimali Perera',
    department: 'Cardiology',
    date: '2026-10-01',
    slotTime: '09:00',
  };
}
