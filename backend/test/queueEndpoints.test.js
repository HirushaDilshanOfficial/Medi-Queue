const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

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

  // 9. Test POST /api/reception/queue/call-next
  console.log('\n--- TESTING POST /call-next ---');

  // 9a. Auth checks for POST /call-next
  const noAuthCallRes = await fetch(`${BASE_URL}/api/reception/queue/call-next`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (noAuthCallRes.status !== 401) {
    throw new Error(`Expected 401 for unauthenticated POST /call-next, got ${noAuthCallRes.status}`);
  }
  console.log('✓ Unauthenticated POST /call-next returns 401');

  const patCallRes = await fetch(`${BASE_URL}/api/reception/queue/call-next`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${patToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (patCallRes.status !== 403) {
    throw new Error(`Expected 403 for patient role on POST /call-next, got ${patCallRes.status}`);
  }
  console.log('✓ Patient role on POST /call-next returns 403');

  // 9b. Reset tokens & appointments for call-next testing:
  // Token 4: 'serving' (consultation in progress)
  // Token 1: 'waiting', priority 'normal'
  // Token 2: 'waiting', priority 'urgent'
  // Token 3: 'waiting', priority 'senior'
  await QueueToken.updateOne({ tokenNumber: 4, date: testDate }, { status: 'serving', servedAt: null });
  await Appointment.updateOne({ tokenNumber: 4, date: testDate }, { status: 'in_consultation' });

  await QueueToken.updateOne({ tokenNumber: 1, date: testDate }, { status: 'waiting', calledAt: null, servedAt: null });
  await Appointment.updateOne({ tokenNumber: 1, date: testDate }, { status: 'checked_in' });

  await QueueToken.updateOne({ tokenNumber: 2, date: testDate }, { status: 'waiting', calledAt: null, servedAt: null });
  await Appointment.updateOne({ tokenNumber: 2, date: testDate }, { status: 'checked_in' });

  await QueueToken.updateOne({ tokenNumber: 3, date: testDate }, { status: 'waiting', calledAt: null, servedAt: null });
  await Appointment.updateOne({ tokenNumber: 3, date: testDate }, { status: 'checked_in' });

  // 9c. First call-next:
  // - Previous serving token 4 -> status "done", servedAt = now, Appointment -> "completed"
  // - Atomically picks first waiting in order (Urgent: Token 2 / OPD-002)
  // - Sets Token 2 status "called", calledAt = now, Appointment -> "in_consultation"
  // - Returns { patient, tokenLabel, room, doctor }
  const callRes1 = await fetch(`${BASE_URL}/api/reception/queue/call-next?date=${testDate}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${recToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ doctorId: doctor._id }),
  });

  if (callRes1.status !== 200) {
    const errBody = await callRes1.text();
    throw new Error(`Expected 200 for POST /call-next, got ${callRes1.status}: ${errBody}`);
  }

  const callData1 = await callRes1.json();
  console.log('POST /call-next #1 response:', JSON.stringify({
    tokenLabel: callData1.tokenLabel,
    room: callData1.room,
    doctorName: callData1.doctor?.name || callData1.doctor,
    patientName: callData1.patient?.fullName,
  }));

  if (callData1.tokenLabel !== 'OPD-002') {
    throw new Error(`Expected tokenLabel OPD-002 (urgent), got ${callData1.tokenLabel}`);
  }
  if (callData1.room !== 'Room 101') {
    throw new Error(`Expected room 'Room 101', got ${callData1.room}`);
  }
  if (!callData1.patient || callData1.patient.fullName !== 'Patient Urgent') {
    throw new Error(`Expected patient 'Patient Urgent', got ${JSON.stringify(callData1.patient)}`);
  }
  const doctorName1 = callData1.doctor?.name || callData1.doctor;
  if (doctorName1 !== 'Dr. Palitha Perera') {
    throw new Error(`Expected doctor 'Dr. Palitha Perera', got ${doctorName1}`);
  }
  console.log('✓ Response contains correct { patient, tokenLabel, room, doctor } for urgent token OPD-002');

  // Verify DB state for previous serving token (token 4)
  const prevServingToken = await QueueToken.findOne({ tokenNumber: 4, date: testDate });
  const prevServingAppt = await Appointment.findOne({ tokenNumber: 4, date: testDate });
  if (prevServingToken.status !== 'done' || !prevServingToken.servedAt) {
    throw new Error(`Expected previous serving token to be 'done' with servedAt set, got status=${prevServingToken.status}`);
  }
  if (prevServingAppt.status !== 'completed' || prevServingAppt.isActive !== false) {
    throw new Error(`Expected previous appointment to be 'completed' with isActive=false, got status=${prevServingAppt.status}`);
  }
  console.log('✓ Previous serving token marked done (servedAt set) and Appointment marked completed');

  // Verify DB state for newly called token (token 2)
  const calledToken2 = await QueueToken.findOne({ tokenNumber: 2, date: testDate });
  const calledAppt2 = await Appointment.findOne({ tokenNumber: 2, date: testDate });
  if (calledToken2.status !== 'called' || !calledToken2.calledAt) {
    throw new Error(`Expected called token 2 to be 'called' with calledAt set, got status=${calledToken2.status}`);
  }
  if (calledAppt2.status !== 'in_consultation') {
    throw new Error(`Expected appointment 2 to be 'in_consultation', got status=${calledAppt2.status}`);
  }
  console.log('✓ Token 2 status is "called" (calledAt set) and Appointment is "in_consultation"');

  // 9d. Advance token 2 to serving, call next again -> should pick Senior (token 3)
  await QueueToken.updateOne({ tokenNumber: 2, date: testDate }, { status: 'serving' });

  const callRes2 = await fetch(`${BASE_URL}/api/reception/queue/call-next?date=${testDate}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${recToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ doctorId: doctor._id }),
  });
  const callData2 = await callRes2.json();
  if (callData2.tokenLabel !== 'OPD-003') {
    throw new Error(`Expected second call to pick OPD-003 (senior), got ${callData2.tokenLabel}`);
  }
  if (callData2.patient.fullName !== 'Patient Senior') {
    throw new Error(`Expected patient 'Patient Senior', got ${callData2.patient.fullName}`);
  }

  // Token 2 must now be 'done'
  const doneToken2 = await QueueToken.findOne({ tokenNumber: 2, date: testDate });
  if (doneToken2.status !== 'done') {
    throw new Error(`Expected token 2 to be marked done, got ${doneToken2.status}`);
  }
  console.log('✓ Second POST /call-next picked senior token OPD-003 and marked previous token done');

  // 9e. Advance token 3 to serving, call next again -> should pick Normal (token 1)
  await QueueToken.updateOne({ tokenNumber: 3, date: testDate }, { status: 'serving' });

  const callRes3 = await fetch(`${BASE_URL}/api/reception/queue/call-next?date=${testDate}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${recToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ doctorId: doctor._id }),
  });
  const callData3 = await callRes3.json();
  if (callData3.tokenLabel !== 'OPD-001') {
    throw new Error(`Expected third call to pick OPD-001 (normal), got ${callData3.tokenLabel}`);
  }
  console.log('✓ Third POST /call-next picked normal token OPD-001');

  // 9f. Call next when queue is empty -> 404 "Queue is empty"
  // Set token 1 to 'done' so no waiting tokens remain
  await QueueToken.updateOne({ tokenNumber: 1, date: testDate }, { status: 'done' });

  const callEmptyRes = await fetch(`${BASE_URL}/api/reception/queue/call-next?date=${testDate}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${recToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ doctorId: doctor._id }),
  });
  if (callEmptyRes.status !== 404) {
    throw new Error(`Expected 404 when queue is empty, got ${callEmptyRes.status}`);
  }
  const emptyBody = await callEmptyRes.json();
  if (!emptyBody.message || !emptyBody.message.includes('Queue is empty')) {
    throw new Error(`Expected message 'Queue is empty', got ${JSON.stringify(emptyBody)}`);
  }
  console.log('✓ POST /call-next returned 404 "Queue is empty" when no waiting tokens exist');

  // 9g. Test alias endpoint POST /api/reception/call-next
  await QueueToken.updateOne({ tokenNumber: 1, date: testDate }, { status: 'waiting' });
  const aliasRes = await fetch(`${BASE_URL}/api/reception/call-next?date=${testDate}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${recToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (aliasRes.status !== 200) {
    throw new Error(`Expected 200 for alias POST /api/reception/call-next, got ${aliasRes.status}`);
  }
  const aliasData = await aliasRes.json();
  if (aliasData.tokenLabel !== 'OPD-001') {
    throw new Error(`Expected alias to return OPD-001, got ${aliasData.tokenLabel}`);
  }
  console.log('✓ Alias POST /api/reception/call-next also works correctly');

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
