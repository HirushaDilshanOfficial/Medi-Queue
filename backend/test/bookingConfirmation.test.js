const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the real controller response with database operations isolated.
function bookingController({ full = false, publicUrl } = {}) {
  const date = '2026-10-08';
  let allocations = 0;
  const lean = value => ({ lean: async () => value });
  const doctor = { _id: 'doctor-id', name: 'Dr. Perera', department: 'Cardiology', room: '304' };
  const queueEntry = {
    _id: 'queue-id', appointment: 'appointment-id', doctor: doctor._id,
    doctorName: doctor.name, department: doctor.department, room: doctor.room,
    queueDate: date, tokenNumber: 7, passCode: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
    priority: 'normal', status: 'waiting', checkedInAt: null,
  };
  const modules = {
    '../models/Doctor': { findById: () => lean(doctor) },
    '../models/Slot': { find: () => ({ sort: () => lean([{ schedule: 'schedule-id', startsAt: new Date(), capacity: 1 }]) }) },
    '../models/Schedule': { findById: () => lean({ room: doctor.room }) },
    '../models/OpdAppointment': {
      ACTIVE_STATUSES: ['booked', 'checked_in'], findOne: () => lean(null),
      create: async data => ({ ...data, _id: 'appointment-id', save: async () => {} }),
    },
    '../models/OpdQueueEntry': {},
    '../models/QueueToken': {},
    '../utils/patientSync': { ensurePatientForProfile: async () => null },
    '../models/Appointment': { findOne: () => lean(null) },
    '../models/OpdQueueCounter': { nextTokenNumber: async () => { allocations++; return 7; } },
    '../utils/ensureBookingQueueEntry': { ensureBookingQueueEntry: async () => queueEntry },
    '../models/receptionistFields': { localDate: () => date },
    '../utils/opdQueue': { today: () => date },
    '../utils/opdAppointment': {
      isValidObjectId: () => true, clockLabel: () => '09:00',
      mapAppointment: entry => ({ id: entry._id, tokenNumber: entry.tokenNumber, date: entry.date, slotTime: entry.slotTime }),
    },
    './slotController': { scheduleIds: async () => ['schedule-id'], bookedCounts: async () => new Map(), isFull: () => full, isWithinHorizon: () => true },
  };
  const queuePassContext = { module: { exports: {} }, process: { env: publicUrl ? { PUBLIC_API_URL: publicUrl } : {} }, URL, require };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../utils/queuePass.js'), 'utf8'), queuePassContext);
  modules['../utils/queuePass'] = queuePassContext.module.exports;
  const context = {
    module: { exports: {} },
    require: name => { assert.ok(name in modules, `Unexpected dependency: ${name}`); return modules[name]; },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../controllers/bookingController.js'), 'utf8'), context);
  return { create: context.module.exports.createBooking, allocations: () => allocations, date };
}

async function createBooking(controller) {
  const response = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await controller.create({ protocol: 'http', get: () => '172.20.10.4:5001', body: { doctorId: 'doctor-id', date: controller.date, slotTime: '09:00' }, patientProfile: { _id: 'profile-id' } }, response, error => { throw error; });
  return response;
}

test('booking confirmation includes the issued token and scannable pass in one response', async () => {
  const controller = bookingController();
  const { code, body } = await createBooking(controller);
  assert.equal(code, 201);
  assert.equal(controller.allocations(), 1);
  assert.equal(body.pass.tokenNumber, body.appointment.tokenNumber);
  assert.equal(body.pass.tokenNumber, body.queueNumber);
  assert.equal(body.pass.tokenLabel, body.tokenLabel);
  assert.equal(body.pass.appointmentId, body.appointment.id);
  assert.equal(body.pass.id, body.queueEntryId);
  assert.equal(body.pass.qrValue, `http://172.20.10.4:5001/api/v1/public/queue-pass/${body.pass.passCode}`);
  assert.ok(!body.pass.qrValue.includes('profile-id'));
});

test('booking QR opens the configured public pass page', async () => {
  const { body } = await createBooking(bookingController({ publicUrl: 'https://queue.example.test/' }));
  assert.equal(body.pass.qrValue, `https://queue.example.test/api/v1/public/queue-pass/${body.pass.passCode}`);
});

test('an unavailable slot never allocates a token or returns a success pass', async () => {
  const controller = bookingController({ full: true });
  const { code, body } = await createBooking(controller);
  assert.equal(code, 409);
  assert.equal(controller.allocations(), 0);
  assert.equal(body.pass, undefined);
});
