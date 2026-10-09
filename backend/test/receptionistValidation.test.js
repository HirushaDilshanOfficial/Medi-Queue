const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Schedule = require('../models/Schedule');
const Slot = require('../models/Slot');
const Appointment = require('../models/Appointment');
const QueueEntry = require('../models/QueueEntry');
const { validateReceptionistDocument, forwardReceptionistError } = require('../validation/receptionistValidation');
const { errorHandler } = require('../utils/errorHandler');

const id = () => new mongoose.Types.ObjectId();
const ids = { user: id(), staff: id(), doctorUser: id(), patient: id(), doctor: id(), schedule: id(), slot: id(), appointment: id() };
const start = new Date('2026-09-29T03:00:00Z');
const end = new Date('2026-09-29T07:00:00Z');
const fixtures = {
  Patient: () => ({ user: ids.user, fullName: 'Test Patient', nic: '901234567v', dateOfBirth: '1990-01-01', gender: 'female', phone: '0771234567' }),
  Doctor: () => ({ user: ids.doctorUser, registrationNumber: 'slmc-123', specialty: 'General medicine', department: 'General OPD' }),
  Schedule: () => ({ doctor: ids.doctor, department: 'General OPD', room: '01', startsAt: start, endsAt: end }),
  Slot: () => ({ schedule: ids.schedule, startsAt: start, endsAt: new Date('2026-09-29T03:15:00Z') }),
  Appointment: () => ({ patient: ids.patient, doctor: ids.doctor, slot: ids.slot, visitDate: '2026-09-29', source: 'online', createdBy: ids.user }),
  QueueEntry: () => ({ appointment: ids.appointment, assignedDoctor: ids.doctor, department: 'General OPD', queueDate: '2026-09-29', tokenNumber: 35, checkedInAt: start }),
};
const models = { Patient, Doctor, Schedule, Slot, Appointment, QueueEntry };
function repositories() {
  const records = {
    User: [
      { _id: ids.user, role: 'patient' }, { _id: ids.staff, role: 'receptionist' }, { _id: ids.doctorUser, role: 'doctor' },
    ],
    Patient: [{ _id: ids.patient, ...fixtures.Patient() }],
    Doctor: [{ _id: ids.doctor, ...fixtures.Doctor(), isActive: true }],
    Schedule: [{ _id: ids.schedule, ...fixtures.Schedule(), status: 'scheduled' }],
    Slot: [{ _id: ids.slot, ...fixtures.Slot(), status: 'available' }],
    Appointment: [{ _id: ids.appointment, ...fixtures.Appointment(), status: 'booked' }],
  };
  const lookup = Object.fromEntries(Object.entries(records).map(([name, rows]) => [name, {
    findById: async value => rows.find(row => String(row._id) === String(value)) || null,
  }]));
  return { records, lookup };
}
async function invalid(Model, fields, path) {
  const doc = new Model({ ...fixtures[Model.modelName](), ...fields });
  await assert.rejects(doc.validate(), error => error instanceof mongoose.Error.ValidationError && !!error.errors[path]);
}
for (const [name, Model] of Object.entries(models)) {
  test(name + ': accepts a valid document and valid relationships', async () => {
    const doc = new Model(fixtures[name]());
    await doc.validate();
    assert.equal(await validateReceptionistDocument(doc, repositories().lookup), doc);
  });
  test(name + ': rejects unknown fields', () => {
    assert.throws(() => new Model({ ...fixtures[name](), accidentalField: 'bad' }), mongoose.Error.StrictModeError);
  });
}
test('User: existing roles still work and receptionist uses the same User model', async () => {
  for (const role of ['patient', 'doctor', 'admin', 'receptionist']) {
    await new User({ name: 'Staff', email: 'staff@example.test', password: 'unchanged-auth', role }).validate();
  }
  assert.equal(new User().role, 'patient');
});
test('Patient: normalizes legacy NIC; phone supports +94', async () => {
  const patient = new Patient({ ...fixtures.Patient(), phone: '+94771234567' });
  await patient.validate();
  assert.equal(patient.nic, '901234567V');
});
test('Patient: permits a child/walk-in without NIC or login account', async () => {
  const { nic, user, ...fields } = fixtures.Patient();
  await new Patient(fields).validate();
  assert.equal(nic, '901234567v'); assert.ok(user);
});
for (const [fields,path] of [
  [{ fullName: ' ' },'fullName'], [{ nic: 'invalid' },'nic'], [{ phone: '123' },'phone'],
  [{ dateOfBirth: '2999-01-01' },'dateOfBirth'], [{ dateOfBirth: '1899-12-31' },'dateOfBirth'],
  [{ dateOfBirth: 'not-a-date' },'dateOfBirth'], [{ gender: 'invalid' },'gender'], [{ user: 'not-an-id' },'user'],
]) test('Patient: rejects ' + path + ' ' + JSON.stringify(fields), () => invalid(Patient, fields, path));
test('Doctor: requires User and registration number', async () => {
  await invalid(Doctor, { user: undefined }, 'user');
  await invalid(Doctor, { registrationNumber: ' ' }, 'registrationNumber');
});
for (const Model of [Schedule, Slot]) {
  test(Model.modelName + ': rejects zero-length or reversed interval', async () => {
    await invalid(Model, { endsAt: start }, 'endsAt');
    await invalid(Model, { endsAt: new Date('2026-09-28T03:00:00Z') }, 'endsAt');
  });
}
for (const capacity of [0, -1, 1.5, 101]) test('Slot: rejects capacity ' + capacity, () => invalid(Slot, { capacity }, 'capacity'));
test('Appointment: source is explicit and limited to online / walk_in', async () => {
  await invalid(Appointment, { source: undefined }, 'source');
  await invalid(Appointment, { source: 'phone' }, 'source');
  assert.equal(Appointment.schema.path('source').options.immutable, true);
});
test('Appointment: online requires doctor and slot', async () => {
  await invalid(Appointment, { slot: undefined }, 'slot');
  await invalid(Appointment, { doctor: undefined }, 'doctor');
});
test('Appointment: walk-in can await a doctor and slot', async () => {
  await validateReceptionistDocument(new Appointment({ ...fixtures.Appointment(), source: 'walk_in', doctor: undefined, slot: undefined, createdBy: ids.staff }), repositories().lookup);
});
test('Appointment: rejects impossible calendar dates and statuses', async () => {
  await invalid(Appointment, { visitDate: '2026-02-30' }, 'visitDate');
  await invalid(Appointment, { status: 'unknown' }, 'status');
});
for (const tokenNumber of [0, -1, 1.5]) test('QueueEntry: rejects token ' + tokenNumber, () => invalid(QueueEntry, { tokenNumber }, 'tokenNumber'));
test('QueueEntry: validates status, priority, and required call/completion times', async () => {
  await invalid(QueueEntry, { priority: 'vip' }, 'priority');
  await invalid(QueueEntry, { status: 'invalid' }, 'status');
  await invalid(QueueEntry, { status: 'called' }, 'calledAt');
  await invalid(QueueEntry, { status: 'completed', calledAt: start }, 'completedAt');
});
test('QueueEntry: rejects reversed timestamps and accepts a completed timeline', async () => {
  await invalid(QueueEntry, { calledAt: new Date('2026-09-28T00:00:00Z') }, 'calledAt');
  await invalid(QueueEntry, { calledAt: start, completedAt: new Date('2026-09-28T00:00:00Z') }, 'completedAt');
  await new QueueEntry({ ...fixtures.QueueEntry(), status: 'completed', calledAt: start, completedAt: new Date('2026-09-29T03:30:00Z') }).validate();
});

const relationshipCases = [
  ['missing patient', Appointment, {}, db => { db.Patient.length = 0; }, 'patient'],
  ['patient linked to staff user', Patient, { user: ids.staff }, () => {}, 'user'],
  ['doctor linked to patient user', Doctor, { user: ids.user }, () => {}, 'user'],
  ['slot outside schedule', Slot, { endsAt: new Date('2026-09-29T08:00:00Z') }, () => {}, 'startsAt'],
  ['slot doctor mismatch', Appointment, {}, db => { db.Schedule[0].doctor = id(); }, 'doctor'],
  ['slot date mismatch', Appointment, { visitDate: '2026-09-30' }, () => {}, 'visitDate'],
  ['blocked slot', Appointment, {}, db => { db.Slot[0].status = 'blocked'; }, 'slot'],
  ['cancelled schedule', Appointment, {}, db => { db.Schedule[0].status = 'cancelled'; }, 'slot'],
  ['inactive doctor', Appointment, {}, db => { db.Doctor[0].isActive = false; }, 'doctor'],
  ['walk-in created by patient', Appointment, { source: 'walk_in' }, () => {}, 'createdBy'],
  ['online booking for another patient', Appointment, {}, db => { db.Patient[0].user = id(); }, 'patient'],
  ['queue date mismatch', QueueEntry, { queueDate: '2026-09-30' }, () => {}, 'queueDate'],
  ['check-in date mismatch', QueueEntry, { checkedInAt: new Date('2026-09-28T00:00:00Z') }, () => {}, 'checkedInAt'],
  ['cancelled appointment entering queue', QueueEntry, {}, db => { db.Appointment[0].status = 'cancelled'; }, 'appointment'],
  ['queue doctor mismatch', QueueEntry, {}, db => { db.Appointment[0].doctor = id(); }, 'assignedDoctor'],
];
for (const [label, Model, fields, alter, path] of relationshipCases) {
  test('Relationships: rejects ' + label, async () => {
    const { records, lookup } = repositories(); alter(records);
    await assert.rejects(validateReceptionistDocument(new Model({ ...fixtures[Model.modelName](), ...fields }), lookup),
      error => error instanceof mongoose.Error.ValidationError && !!error.errors[path]);
  });
}
test('Relationships: uses Sri Lanka calendar dates at UTC midnight boundaries', async () => {
  const { records, lookup } = repositories();
  records.Slot[0].startsAt = new Date('2026-09-28T20:00:00Z');
  // 01:30 on September 29 in Sri Lanka.
  await validateReceptionistDocument(new Appointment(fixtures.Appointment()), lookup);
});
test('Models declare uniqueness for identifiers, slot starts, queue token and appointment', () => {
  assert.ok(Patient.schema.indexes().some(([keys, options]) => keys.nic && options.unique && options.partialFilterExpression));
  assert.ok(Doctor.schema.indexes().some(([keys, options]) => keys.user && options.unique));
  assert.ok(Slot.schema.indexes().some(([keys, options]) => keys.schedule && keys.startsAt && options.unique));
  assert.ok(QueueEntry.schema.indexes().some(([keys, options]) => keys.department && keys.queueDate && keys.tokenNumber && options.unique));
  assert.ok(QueueEntry.schema.indexes().some(([keys, options]) => keys.appointment && options.unique));
});
function sendThroughExistingHandler(error) {
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  let calls = 0;
  forwardReceptionistError(error, res, forwarded => {
    calls++;
    errorHandler(forwarded, {}, res, () => {});
  });
  assert.equal(calls, 1);
  return res;
}
test('Existing error handler receives validation errors as 400 without rejected values', () => {
  const error = new Patient({ ...fixtures.Patient(), nic: 'PRIVATE_INVALID_VALUE' }).validateSync();
  const res = sendThroughExistingHandler(error);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /nic/);
  assert.ok(!JSON.stringify(res.body).includes('PRIVATE_INVALID_VALUE'));
});
test('Existing error handler receives invalid IDs and unknown fields as 400', () => {
  assert.equal(sendThroughExistingHandler(new mongoose.Error.CastError('ObjectId', 'bad-id', 'patient')).statusCode, 400);
  assert.equal(sendThroughExistingHandler(new mongoose.Error.StrictModeError('unknown')).statusCode, 400);
});
test('Existing error handler receives duplicate keys as 409 and unexpected errors as 500', () => {
  assert.equal(sendThroughExistingHandler(Object.assign(new Error('duplicate'), { code: 11000 })).statusCode, 409);
  assert.equal(sendThroughExistingHandler(new Error('Unexpected failure')).statusCode, 500);
});
test('Unexpected database errors are preserved for the existing handler', async () => {
  const { lookup } = repositories(); const error = new Error('Database unavailable');
  lookup.Patient.findById = async () => { throw error; };
  await assert.rejects(validateReceptionistDocument(new Appointment(fixtures.Appointment()), lookup), value => value === error);
});
