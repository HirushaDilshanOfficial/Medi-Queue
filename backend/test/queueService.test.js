const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const QueueToken = require('../models/QueueToken');
const { getOrderedQueue } = require('../services/queueService');

const TEST_DATE = '2026-10-04';

test.before(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }
});

test.after(async () => {
  // Clean up test records
  await QueueToken.deleteMany({ date: TEST_DATE, department: 'Unit Test Dept' });
  await Appointment.deleteMany({ date: TEST_DATE, department: 'Unit Test Dept' });
  await Doctor.deleteMany({ department: 'Unit Test Dept' });
  await Patient.deleteMany({ fullName: /^Test Queue Patient/ });
  await mongoose.disconnect();
});

test('queueService.getOrderedQueue: filters, population, and priority sort', async () => {
  // 1. Create a Doctor
  const doctor = await Doctor.create({
    name: 'Dr. Queue Test',
    specialization: 'Test Specialist',
    department: 'Unit Test Dept',
    status: 'active',
  });

  // 2. Create Patients
  const patientNormal = await Patient.create({
    fullName: 'Test Queue Patient Normal',
    phone: '0770000001',
  });
  const patientSenior = await Patient.create({
    fullName: 'Test Queue Patient Senior',
    phone: '0770000002',
  });
  const patientUrgent = await Patient.create({
    fullName: 'Test Queue Patient Urgent',
    phone: '0770000003',
  });

  // 3. Create Appointments (walk_in vs pre_booked)
  const apptWalkIn1 = await Appointment.create({
    patient: patientNormal._id,
    doctor: doctor._id,
    department: 'Unit Test Dept',
    date: TEST_DATE,
    slotTime: '10:00',
    type: 'walk_in',
    status: 'checked_in',
  });

  const apptWalkIn2 = await Appointment.create({
    patient: patientSenior._id,
    doctor: doctor._id,
    department: 'Unit Test Dept',
    date: TEST_DATE,
    slotTime: '10:15',
    type: 'walk_in',
    status: 'checked_in',
  });

  const apptPreBooked = await Appointment.create({
    patient: patientUrgent._id,
    doctor: doctor._id,
    department: 'Unit Test Dept',
    date: TEST_DATE,
    slotTime: '10:30',
    type: 'pre_booked',
    status: 'checked_in',
  });

  // 4. Create Queue Tokens in non-sorted arrival order
  // Token 1: normal, waiting, walk_in
  const token1 = await QueueToken.create({
    appointment: apptWalkIn1._id,
    patient: patientNormal._id,
    department: 'Unit Test Dept',
    date: TEST_DATE,
    tokenNumber: 101,
    tokenLabel: 'OPD-101',
    status: 'waiting',
    priority: 'normal',
    assignedDoctor: doctor._id,
  });

  // Token 2: senior, called, walk_in
  const token2 = await QueueToken.create({
    appointment: apptWalkIn2._id,
    patient: patientSenior._id,
    department: 'Unit Test Dept',
    date: TEST_DATE,
    tokenNumber: 102,
    tokenLabel: 'OPD-102',
    status: 'called',
    priority: 'senior',
    assignedDoctor: doctor._id,
  });

  // Token 3: urgent, waiting, pre_booked
  const token3 = await QueueToken.create({
    appointment: apptPreBooked._id,
    patient: patientUrgent._id,
    department: 'Unit Test Dept',
    date: TEST_DATE,
    tokenNumber: 103,
    tokenLabel: 'OPD-103',
    status: 'waiting',
    priority: 'urgent',
    assignedDoctor: doctor._id,
  });

  // Token 4: normal, done (should be excluded by default status filter)
  const token4 = await QueueToken.create({
    appointment: apptWalkIn1._id,
    patient: patientNormal._id,
    department: 'Unit Test Dept',
    date: TEST_DATE,
    tokenNumber: 100,
    tokenLabel: 'OPD-100',
    status: 'done',
    priority: 'normal',
    assignedDoctor: doctor._id,
  });

  // ── Test 1: Priority sorting (urgent > senior > normal) & default status filter ──
  const queue = await getOrderedQueue(TEST_DATE, { department: 'Unit Test Dept' });

  // Only tokens 1, 2, 3 should be returned (token 4 is 'done' so excluded)
  assert.equal(queue.length, 3);

  // 1st must be urgent (token 103)
  assert.equal(queue[0].priority, 'urgent');
  assert.equal(queue[0].tokenNumber, 103);
  // 2nd must be senior (token 102)
  assert.equal(queue[1].priority, 'senior');
  assert.equal(queue[1].tokenNumber, 102);
  // 3rd must be normal (token 101)
  assert.equal(queue[2].priority, 'normal');
  assert.equal(queue[2].tokenNumber, 101);

  // Check populated fields
  assert.ok(queue[0].patient);
  assert.equal(queue[0].patient.fullName, 'Test Queue Patient Urgent');
  assert.ok(queue[0].assignedDoctor);
  assert.equal(queue[0].assignedDoctor.name, 'Dr. Queue Test');

  // ── Test 2: Filter by type (walk_in only) ──
  const walkInQueue = await getOrderedQueue(TEST_DATE, {
    department: 'Unit Test Dept',
    type: 'walk_in',
  });
  // Token 1 (normal) and Token 2 (senior) are walk_in
  assert.equal(walkInQueue.length, 2);
  assert.equal(walkInQueue[0].tokenNumber, 102); // senior first
  assert.equal(walkInQueue[1].tokenNumber, 101); // normal second

  // ── Test 3: Filter by type (pre_booked only) ──
  const preBookedQueue = await getOrderedQueue(TEST_DATE, {
    department: 'Unit Test Dept',
    type: 'pre_booked',
  });
  assert.equal(preBookedQueue.length, 1);
  assert.equal(preBookedQueue[0].tokenNumber, 103);

  // ── Test 4: Custom status filter (status: 'done') ──
  const doneQueue = await getOrderedQueue(TEST_DATE, {
    department: 'Unit Test Dept',
    status: 'done',
  });
  assert.equal(doneQueue.length, 1);
  assert.equal(doneQueue[0].tokenNumber, 100);
});
