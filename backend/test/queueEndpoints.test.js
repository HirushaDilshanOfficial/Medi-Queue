require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const QueueToken = require('../models/QueueToken');

const BASE_URL = 'http://localhost:5001';

async function runTests() {
  console.log('--- STARTING QUEUE ENDPOINT TESTS ---');
  await mongoose.connect(process.env.MONGO_URI);

  // 1. Get tokens for receptionist and patient
  const recRes = await fetch(`${BASE_URL}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'receptionist@mediqueue.lk', password: 'password123' })
  });
  const recData = await recRes.json();
  const recToken = recData.token;
  if (!recToken) throw new Error('Failed to login as receptionist: ' + JSON.stringify(recData));

  const patRes = await fetch(`${BASE_URL}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'patient.test@mediqueue.lk', password: 'password123' })
  });
  const patData = await patRes.json();
  const patToken = patData.token;
  if (!patToken) throw new Error('Failed to login as patient: ' + JSON.stringify(patData));

  console.log('✓ Receptionist and Patient login successful');

  // 2. Auth checks
  const noAuthRes = await fetch(`${BASE_URL}/api/reception/queue`);
  if (noAuthRes.status !== 401) {
    throw new Error(`Expected 401 for unauthenticated request, got ${noAuthRes.status}`);
  }
  console.log('✓ Unauthenticated request returns 401');

  const patAuthRes = await fetch(`${BASE_URL}/api/reception/queue`, {
    headers: { Authorization: `Bearer ${patToken}` }
  });
  if (patAuthRes.status !== 403) {
    throw new Error(`Expected 403 for patient role request, got ${patAuthRes.status}`);
  }
  console.log('✓ Patient role request returns 403');

  // 3. Prepare test doctor, patients, appointments, and tokens
  const testDate = '2026-10-04';
  let doctor = await Doctor.findOne({ name: 'Dr. Palitha Perera' });
  if (!doctor) {
    doctor = await Doctor.create({
      name: 'Dr. Palitha Perera',
      specialization: 'General Physician',
      department: 'General OPD',
      room: 'Room 101',
      status: 'active',
      avgConsultMinutes: 15,
      workingHours: { start: '08:00', end: '20:00' }
    });
  } else {
    doctor.avgConsultMinutes = 15;
    await doctor.save();
  }

  // Clear previous test tokens for this test date & doctor
  const testNics = ['199000000001', '199000000002', '199000000003', '199000000004'];
  await Patient.deleteMany({ nic: { $in: testNics } });
  await QueueToken.deleteMany({ date: testDate, assignedDoctor: doctor._id });
  await Appointment.deleteMany({ date: testDate, doctor: doctor._id });

  const patient1 = await Patient.create({
    nic: '199000000001',
    fullName: 'Patient Normal',
    phone: '0770000001',
    age: 30,
    gender: 'male'
  });
  const patient2 = await Patient.create({
    nic: '199000000002',
    fullName: 'Patient Urgent',
    phone: '0770000002',
    age: 35,
    gender: 'female'
  });
  const patient3 = await Patient.create({
    nic: '199000000003',
    fullName: 'Patient Senior',
    phone: '0770000003',
    age: 68,
    gender: 'male'
  });
  const patient4 = await Patient.create({
    nic: '199000000004',
    fullName: 'Patient Completed',
    phone: '0770000004',
    age: 40,
    gender: 'female'
  });

  const appt1 = await Appointment.create({
    patient: patient1._id,
    doctor: doctor._id,
    department: doctor.department || 'General OPD',
    date: testDate,
    slotTime: '09:00',
    type: 'pre_booked',
    status: 'checked_in',
    tokenNumber: 1,
    priority: 'normal'
  });
  const appt2 = await Appointment.create({
    patient: patient2._id,
    doctor: doctor._id,
    department: doctor.department || 'General OPD',
    date: testDate,
    slotTime: '09:15',
    type: 'walk_in',
    status: 'checked_in',
    tokenNumber: 2,
    priority: 'urgent'
  });
  const appt3 = await Appointment.create({
    patient: patient3._id,
    doctor: doctor._id,
    department: doctor.department || 'General OPD',
    date: testDate,
    slotTime: '09:30',
    type: 'walk_in',
    status: 'checked_in',
    tokenNumber: 3,
    priority: 'senior'
  });
  const appt4 = await Appointment.create({
    patient: patient4._id,
    doctor: doctor._id,
    department: doctor.department || 'General OPD',
    date: testDate,
    slotTime: '09:45',
    type: 'walk_in',
    status: 'completed',
    tokenNumber: 4,
    priority: 'normal'
  });

  await QueueToken.create({
    tokenNumber: 1,
    tokenLabel: 'OPD-001',
    patient: patient1._id,
    assignedDoctor: doctor._id,
    appointment: appt1._id,
    date: testDate,
    priority: 'normal',
    status: 'waiting'
  });

  await QueueToken.create({
    tokenNumber: 2,
    tokenLabel: 'OPD-002',
    patient: patient2._id,
    assignedDoctor: doctor._id,
    appointment: appt2._id,
    date: testDate,
    priority: 'urgent',
    status: 'waiting'
  });

  await QueueToken.create({
    tokenNumber: 3,
    tokenLabel: 'OPD-003',
    patient: patient3._id,
    assignedDoctor: doctor._id,
    appointment: appt3._id,
    date: testDate,
    priority: 'senior',
    status: 'waiting'
  });

  await QueueToken.create({
    tokenNumber: 4,
    tokenLabel: 'OPD-004',
    patient: patient4._id,
    assignedDoctor: doctor._id,
    appointment: appt4._id,
    date: testDate,
    priority: 'normal',
    status: 'done'
  });

  // 4. Test GET /api/reception/queue?date=2026-10-04
  const queueRes = await fetch(`${BASE_URL}/api/reception/queue?date=${testDate}`, {
    headers: { Authorization: `Bearer ${recToken}` }
  });
  if (queueRes.status !== 200) {
    throw new Error(`Expected 200 for GET /queue, got ${queueRes.status}`);
  }
  const queueData = await queueRes.json();
  console.log('GET /api/reception/queue result:', JSON.stringify(queueData.totals), 'tokens count:', queueData.queue.length);

  if (queueData.queue.length !== 3) {
    throw new Error(`Expected 3 waiting/serving tokens, got ${queueData.queue.length}`);
  }
  // Check sorting: urgent (OPD-002) > senior (OPD-003) > normal (OPD-001)
  if (
    queueData.queue[0].tokenLabel !== 'OPD-002' ||
    queueData.queue[1].tokenLabel !== 'OPD-003' ||
    queueData.queue[2].tokenLabel !== 'OPD-001'
  ) {
    throw new Error(
      `Incorrect order! Expected [OPD-002, OPD-003, OPD-001], got ${queueData.queue.map(q => q.tokenLabel).join(', ')}`
    );
  }
  console.log('✓ Queue correctly sorted by urgent > senior > normal');

  // Check totals
  if (
    queueData.totals.inQueue !== 3 ||
    queueData.totals.walkIns !== 2 ||
    queueData.totals.preBooked !== 1 ||
    typeof queueData.totals.avgWaitMinutes !== 'number'
  ) {
    throw new Error(`Totals incorrect: ${JSON.stringify(queueData.totals)}`);
  }
  console.log('✓ Totals verified: inQueue=3, walkIns=2, preBooked=1, avgWaitMinutes=' + queueData.totals.avgWaitMinutes);

  // Check lastUpdated
  if (!queueData.lastUpdated || isNaN(Date.parse(queueData.lastUpdated))) {
    throw new Error(`Invalid lastUpdated timestamp: ${queueData.lastUpdated}`);
  }
  console.log('✓ lastUpdated ISO timestamp present: ' + queueData.lastUpdated);

  // 5. Test filter ?type=walk_in
  const walkInRes = await fetch(`${BASE_URL}/api/reception/queue?date=${testDate}&type=walk_in`, {
    headers: { Authorization: `Bearer ${recToken}` }
  });
  const walkInData = await walkInRes.json();
  if (walkInData.queue.length !== 2 || walkInData.totals.walkIns !== 2 || walkInData.totals.preBooked !== 0) {
    throw new Error(`walk_in filter failed: ${JSON.stringify(walkInData.totals)}`);
  }
  console.log('✓ ?type=walk_in filter verified');

  // 6. Test filter ?type=pre_booked
  const preBookedRes = await fetch(`${BASE_URL}/api/reception/queue?date=${testDate}&type=pre_booked`, {
    headers: { Authorization: `Bearer ${recToken}` }
  });
  const preBookedData = await preBookedRes.json();
  if (preBookedData.queue.length !== 1 || preBookedData.totals.preBooked !== 1 || preBookedData.totals.walkIns !== 0) {
    throw new Error(`pre_booked filter failed: ${JSON.stringify(preBookedData.totals)}`);
  }
  console.log('✓ ?type=pre_booked filter verified');

  // 7. Test GET /api/reception/queue/next
  const nextRes = await fetch(`${BASE_URL}/api/reception/queue/next?date=${testDate}`, {
    headers: { Authorization: `Bearer ${recToken}` }
  });
  if (nextRes.status !== 200) {
    throw new Error(`Expected 200 for GET /next, got ${nextRes.status}`);
  }
  const nextToken = await nextRes.json();
  if (!nextToken || nextToken.tokenLabel !== 'OPD-002') {
    throw new Error(`Expected first waiting token OPD-002, got ${nextToken ? nextToken.tokenLabel : 'null'}`);
  }
  console.log('✓ GET /next returned highest priority waiting token (OPD-002)');

  // 8. Test GET /api/reception/queue/next when all tokens served/completed
  await QueueToken.updateMany({ date: testDate }, { status: 'done' });
  const nextEmptyRes = await fetch(`${BASE_URL}/api/reception/queue/next?date=${testDate}`, {
    headers: { Authorization: `Bearer ${recToken}` }
  });
  const nextEmptyData = await nextEmptyRes.json();
  if (nextEmptyData !== null) {
    throw new Error(`Expected null when no tokens waiting, got ${JSON.stringify(nextEmptyData)}`);
  }
  console.log('✓ GET /next returned null when no waiting tokens remain');

  // Clean up test data
  await QueueToken.deleteMany({ date: testDate, assignedDoctor: doctor._id });
  await Appointment.deleteMany({ date: testDate, doctor: doctor._id });
  await Patient.deleteMany({ _id: { $in: [patient1._id, patient2._id, patient3._id, patient4._id] } });

  await mongoose.disconnect();
  console.log('--- ALL QUEUE ENDPOINT TESTS PASSED SUCCESSFULLY ---');
}

runTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
