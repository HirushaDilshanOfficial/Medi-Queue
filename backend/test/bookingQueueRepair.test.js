const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(file, modules) {
  const context = { module: { exports: {} }, console, require: name => {
    assert.ok(name in modules, `Unexpected dependency: ${name}`);
    return modules[name];
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context);
  return context.module.exports;
}

const query = value => ({ sort() { return this; }, select() { return this; }, lean: async () => value });

function fixture() {
  const entries = [];
  const appointments = [];
  const counters = new Map();
  let codes = 0;
  const match = (row, filter) => Object.entries(filter).every(([key, value]) => String(row[key]) === String(value));
  const duplicate = () => Object.assign(new Error('duplicate key'), { code: 11000 });
  const Entry = {
    findOne: async filter => entries.find(row => match(row, filter)) || null,
    create: async data => {
      if (entries.some(row => row.appointment === data.appointment ||
        (row.department === data.department && row.queueDate === data.queueDate && row.tokenNumber === data.tokenNumber))) throw duplicate();
      const entry = { ...data, _id: `entry-${entries.length}`, save: async () => {} };
      entries.push(entry);
      return entry;
    },
    findOneAndUpdate: async (filter, update) => {
      const entry = entries.find(row => match(row, filter));
      const next = { ...entry, ...update.$set };
      if (entries.some(row => row !== entry && row.department === next.department && row.queueDate === next.queueDate && row.tokenNumber === next.tokenNumber)) throw duplicate();
      Object.assign(entry, update.$set);
      return entry;
    },
  };
  const Appointment = {
    ACTIVE_STATUSES: ['booked', 'checked_in', 'in_consultation'],
    updateOne: async (filter, update) => Object.assign(appointments.find(row => match(row, filter)), update.$set),
    findOne: filter => filter._id?.$ne ? query(null) : Promise.resolve(appointments.find(row => match(row, filter))),
  };
  const helper = load('../utils/ensureBookingQueueEntry.js', {
    '../models/OpdQueueEntry': Entry, '../models/OpdAppointment': Appointment,
    '../models/Policy': { findOne: () => query(null) },
    '../models/OpdQueueCounter': { nextTokenNumber: async (department, date) => {
      const highest = Math.max(0, ...entries.filter(row => row.department === department && row.queueDate === date).map(row => row.tokenNumber));
      const key = `${department}|${date}`;
      const next = Math.max(highest, counters.get(key) || 0) + 1;
      counters.set(key, next);
      return next;
    } },
    './queuePass': { generatePassCode: () => `pass-${++codes}` },
  });
  function booking(data = {}) {
    const row = { _id: `booking-${appointments.length}`, profile: 'profile', doctor: 'doctor',
      doctorName: 'Test Doctor', department: 'General OPD', date: '2026-10-12',
      slotTime: '09:00', status: 'booked', tokenNumber: 1, save: async () => {}, ...data };
    appointments.push(row);
    return row;
  }
  return { entries, appointments, Entry, Appointment, helper, booking };
}

test('legacy duplicate booking tokens are repaired; simultaneous booking/pass reads converge', async () => {
  const f = fixture();
  const first = f.booking();
  const second = f.booking();
  await f.helper.ensureBookingQueueEntry(first);
  const [a, b] = await Promise.all([f.helper.ensureBookingQueueEntry(second), f.helper.ensureBookingQueueEntry(second)]);
  assert.equal(a._id, b._id);
  assert.equal(f.entries.length, 2);
  assert.equal(second.tokenNumber, 2);
  assert.equal(second.queueEntry, a._id);
});

test('cancelled and completed bookings are never recreated as waiting passes', async () => {
  const f = fixture();
  assert.equal(await f.helper.ensureBookingQueueEntry(f.booking({ status: 'cancelled' })), null);
  assert.equal(await f.helper.ensureBookingQueueEntry(f.booking({ status: 'completed' })), null);
  assert.equal(f.entries.length, 0);
});

test('an old-date cancelled pass is moved, with a fresh token and QR, rather than returned', async () => {
  const f = fixture();
  const row = f.booking();
  const original = await f.helper.ensureBookingQueueEntry(row);
  const oldCode = original.passCode;
  original.status = 'cancelled';
  row.date = '2026-10-13';
  await f.helper.ensureBookingQueueEntry(f.booking({ date: row.date }));
  const moved = await f.helper.ensureBookingQueueEntry(row);
  assert.equal(moved._id, original._id);
  assert.equal(moved.queueDate, row.date);
  assert.equal(moved.tokenNumber, 2);
  assert.equal(moved.status, 'waiting');
  assert.notEqual(moved.passCode, oldCode);
});

function rescheduler(f, { full = false } = {}) {
  return load('../controllers/bookingController.js', {
    '../models/Doctor': {}, '../models/OpdAppointment': f.Appointment, '../models/OpdQueueEntry': f.Entry,
    '../models/Slot': { find: () => query([{ schedule: 'schedule', startsAt: new Date(), capacity: 1 }]) },
    '../models/Schedule': { findById: () => query({ room: 'Room 2' }) },
    '../models/Appointment': {}, '../models/QueueToken': {},
    '../utils/patientSync': { ensurePatientForProfile: async () => null },
    '../models/OpdQueueCounter': {}, '../utils/ensureBookingQueueEntry': f.helper,
    '../utils/queuePass': {}, '../models/receptionistFields': { localDate: () => '2026-10-13' },
    '../utils/opdQueue': { today: () => '2026-10-11' },
    '../utils/opdAppointment': { isValidObjectId: () => true, clockLabel: () => '10:00', mapAppointment: row => ({ ...row }) },
    './slotController': { scheduleIds: async () => [], bookedCounts: async () => new Map(), isFull: () => full, isWithinHorizon: () => true },
  }).rescheduleBooking;
}

async function move(f, row, options) {
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await rescheduler(f, options)({ params: { id: row._id }, patientProfile: { _id: row.profile },
    body: { date: '2026-10-13', slotTime: '10:00' } }, res, error => { throw error; });
  return res;
}

test('rescheduling to a different day updates the appointment and its one queue pass', async () => {
  const f = fixture();
  const row = f.booking({ status: 'checked_in' });
  const entry = await f.helper.ensureBookingQueueEntry(row);
  const response = await move(f, row);
  assert.equal(response.body.appointment.date, '2026-10-13');
  assert.equal(response.body.appointment.slotTime, '10:00');
  assert.equal(response.body.appointment.status, 'booked');
  assert.equal(response.body.tokenPreserved, false);
  assert.equal(entry.queueDate, '2026-10-13');
  assert.equal(entry.room, 'Room 2');
  assert.equal(f.entries.length, 1);
});

test('a same-day reschedule preserves the token and QR', async () => {
  const f = fixture();
  const row = f.booking({ date: '2026-10-13' });
  const entry = await f.helper.ensureBookingQueueEntry(row);
  const code = entry.passCode;
  const response = await move(f, row);
  assert.equal(response.body.tokenPreserved, true);
  assert.equal(entry.passCode, code);
  assert.equal(row.tokenNumber, entry.tokenNumber);
});

test('full slots and patients already called cannot be rescheduled', async () => {
  for (const called of [false, true]) {
    const f = fixture();
    const row = f.booking();
    const entry = await f.helper.ensureBookingQueueEntry(row);
    if (called) entry.status = 'called';
    const response = await move(f, row, { full: !called });
    assert.equal(response.code, called ? 400 : 409);
    assert.equal(row.date, '2026-10-12');
    assert.equal(entry.queueDate, row.date);
  }
});

test('token allocation recovers a stale counter and cancellation cannot reuse reserved numbers', async t => {
  const Counter = require('../models/OpdQueueCounter');
  const Entry = require('../models/OpdQueueEntry');
  const Token = require('../models/QueueToken');
  const Appointment = require('../models/OpdAppointment');
  let lastToken = 0;
  t.mock.method(Entry, 'findOne', () => query({ tokenNumber: 7, status: 'cancelled' }));
  t.mock.method(Token, 'findOne', () => query({ tokenNumber: 9 }));
  t.mock.method(Appointment, 'findOne', () => query({ tokenNumber: 3 }));
  t.mock.method(Counter, 'updateOne', async (filter, update) => {
    assert.ok(update.$max, 'must not decrement a reserved token');
    lastToken = Math.max(lastToken, update.$max.lastToken);
  });
  t.mock.method(Counter, 'findOneAndUpdate', () => query({ lastToken: ++lastToken }));
  assert.equal(await Counter.nextTokenNumber('General OPD', '2026-10-12'), 10);
  await Counter.releaseTokenNumber('General OPD', '2026-10-12', 10);
  assert.equal(await Counter.nextTokenNumber('General OPD', '2026-10-12'), 11);
});
