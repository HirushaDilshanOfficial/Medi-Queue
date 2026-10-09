const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const QueueToken = require('../models/QueueToken');
const Settings = require('../models/Settings');

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

  // 10. Test POST /api/reception/queue/:id/recall
  console.log('\n--- TESTING POST /:id/recall ---');

  // 10a. Auth checks
  const testRecallToken = await QueueToken.findOne({ tokenNumber: 2, date: testDate });
  const noAuthRecall = await fetch(`${BASE_URL}/api/reception/queue/${testRecallToken._id}/recall`, {
    method: 'POST',
  });
  if (noAuthRecall.status !== 401) {
    throw new Error(`Expected 401 for unauthenticated recall, got ${noAuthRecall.status}`);
  }
  console.log('✓ Unauthenticated POST /:id/recall returns 401');

  const patAuthRecall = await fetch(`${BASE_URL}/api/reception/queue/${testRecallToken._id}/recall`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${patToken}` },
  });
  if (patAuthRecall.status !== 403) {
    throw new Error(`Expected 403 for patient recall, got ${patAuthRecall.status}`);
  }
  console.log('✓ Patient role on POST /:id/recall returns 403');

  // 10b. Rejection when token is not found -> 404
  const nonExistentId = new mongoose.Types.ObjectId();
  const notFoundRecall = await fetch(`${BASE_URL}/api/reception/queue/${nonExistentId}/recall`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (notFoundRecall.status !== 404) {
    throw new Error(`Expected 404 for non-existent token recall, got ${notFoundRecall.status}`);
  }
  console.log('✓ Non-existent token recall returns 404');

  // 10c. Rejection when token status is NOT "called" -> 400
  await QueueToken.updateOne({ _id: testRecallToken._id }, { status: 'waiting' });
  const badStatusRecall = await fetch(`${BASE_URL}/api/reception/queue/${testRecallToken._id}/recall`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (badStatusRecall.status !== 400) {
    throw new Error(`Expected 400 when recalling non-called token, got ${badStatusRecall.status}`);
  }
  const badStatusData = await badStatusRecall.json();
  if (!badStatusData.message || !badStatusData.message.includes('called')) {
    throw new Error(`Expected error message about 'called' status, got ${JSON.stringify(badStatusData)}`);
  }
  console.log('✓ Recall rejected with 400 when token status is not "called"');

  // 10d. Success when token status IS "called"
  const pastTime = new Date(Date.now() - 60000);
  await QueueToken.updateOne({ _id: testRecallToken._id }, { status: 'called', calledAt: pastTime });

  const successRecall = await fetch(`${BASE_URL}/api/reception/queue/${testRecallToken._id}/recall`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (successRecall.status !== 200) {
    const errText = await successRecall.text();
    throw new Error(`Expected 200 for successful recall, got ${successRecall.status}: ${errText}`);
  }
  const recallData = await successRecall.json();
  console.log('POST /:id/recall response:', JSON.stringify(recallData));

  if (recallData.tokenLabel !== 'OPD-002') {
    throw new Error(`Expected tokenLabel OPD-002, got ${recallData.tokenLabel}`);
  }
  if (recallData.room !== 'Room 101') {
    throw new Error(`Expected room 'Room 101', got ${recallData.room}`);
  }

  const updatedRecalledToken = await QueueToken.findById(testRecallToken._id);
  if (!updatedRecalledToken.calledAt || new Date(updatedRecalledToken.calledAt).getTime() <= pastTime.getTime()) {
    throw new Error(`Expected calledAt to be updated to a newer timestamp`);
  }
  console.log('✓ Successful recall updated calledAt and returned tokenLabel and room');

  // 11. Test POST /api/reception/queue/:id/no-show
  console.log('\n--- TESTING POST /:id/no-show ---');

  // 11a. Auth checks
  const noAuthNoShow = await fetch(`${BASE_URL}/api/reception/queue/${testRecallToken._id}/no-show`, {
    method: 'POST',
  });
  if (noAuthNoShow.status !== 401) {
    throw new Error(`Expected 401 for unauthenticated no-show, got ${noAuthNoShow.status}`);
  }
  console.log('✓ Unauthenticated POST /:id/no-show returns 401');

  const patAuthNoShow = await fetch(`${BASE_URL}/api/reception/queue/${testRecallToken._id}/no-show`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${patToken}` },
  });
  if (patAuthNoShow.status !== 403) {
    throw new Error(`Expected 403 for patient no-show, got ${patAuthNoShow.status}`);
  }
  console.log('✓ Patient role on POST /:id/no-show returns 403');

  // 11b. Rejection when token is not found -> 404
  const notFoundNoShow = await fetch(`${BASE_URL}/api/reception/queue/${nonExistentId}/no-show`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (notFoundNoShow.status !== 404) {
    throw new Error(`Expected 404 for non-existent token no-show, got ${notFoundNoShow.status}`);
  }
  console.log('✓ Non-existent token no-show returns 404');

  // 11c. Rejection when already "done" -> 400
  await QueueToken.updateOne({ _id: testRecallToken._id }, { status: 'done' });
  const alreadyDoneNoShow = await fetch(`${BASE_URL}/api/reception/queue/${testRecallToken._id}/no-show`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (alreadyDoneNoShow.status !== 400) {
    throw new Error(`Expected 400 when marking done token as no-show, got ${alreadyDoneNoShow.status}`);
  }
  const alreadyDoneData = await alreadyDoneNoShow.json();
  if (!alreadyDoneData.message || !alreadyDoneData.message.includes('already done')) {
    throw new Error(`Expected message about already done, got ${JSON.stringify(alreadyDoneData)}`);
  }
  console.log('✓ Rejected with 400 when trying to mark "done" token as no-show');

  // 11d. Successful no-show transition
  await QueueToken.updateOne({ _id: testRecallToken._id }, { status: 'called' });
  await Appointment.updateOne({ tokenNumber: 2, date: testDate }, { status: 'in_consultation', isActive: true });

  const successNoShow = await fetch(`${BASE_URL}/api/reception/queue/${testRecallToken._id}/no-show`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (successNoShow.status !== 200) {
    const errText = await successNoShow.text();
    throw new Error(`Expected 200 for successful no-show, got ${successNoShow.status}: ${errText}`);
  }
  const noShowData = await successNoShow.json();
  if (noShowData.status !== 'no_show') {
    throw new Error(`Expected status 'no_show', got ${noShowData.status}`);
  }
  console.log('POST /:id/no-show response:', JSON.stringify(noShowData));

  // Verify DB updates for both QueueToken and Appointment
  const noShowTokenInDB = await QueueToken.findById(testRecallToken._id);
  const noShowApptInDB = await Appointment.findOne({ tokenNumber: 2, date: testDate });
  if (noShowTokenInDB.status !== 'no_show') {
    throw new Error(`Expected QueueToken in DB to have status 'no_show', got ${noShowTokenInDB.status}`);
  }
  if (noShowApptInDB.status !== 'no_show' || noShowApptInDB.isActive !== false) {
    throw new Error(`Expected Appointment in DB to have status 'no_show' and isActive=false, got status=${noShowApptInDB.status}, isActive=${noShowApptInDB.isActive}`);
  }
  console.log('✓ QueueToken and Appointment successfully marked "no_show" in database');

  // 12. Test POST /api/reception/queue/:id/move-back
  console.log('\n--- TESTING POST /:id/move-back ---');

  // 12a. Auth checks
  const noAuthMove = await fetch(`${BASE_URL}/api/reception/queue/${testRecallToken._id}/move-back`, {
    method: 'POST',
  });
  if (noAuthMove.status !== 401) {
    throw new Error(`Expected 401 for unauthenticated move-back, got ${noAuthMove.status}`);
  }
  console.log('✓ Unauthenticated POST /:id/move-back returns 401');

  const patAuthMove = await fetch(`${BASE_URL}/api/reception/queue/${testRecallToken._id}/move-back`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${patToken}` },
  });
  if (patAuthMove.status !== 403) {
    throw new Error(`Expected 403 for patient move-back, got ${patAuthMove.status}`);
  }
  console.log('✓ Patient role on POST /:id/move-back returns 403');

  // 12b. Rejection when token is not found -> 404
  const notFoundMove = await fetch(`${BASE_URL}/api/reception/queue/${nonExistentId}/move-back`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (notFoundMove.status !== 404) {
    throw new Error(`Expected 404 for non-existent token move-back, got ${notFoundMove.status}`);
  }
  console.log('✓ Non-existent token move-back returns 404');

  // 12c. Rejection when token status is NOT "waiting" -> 400
  await QueueToken.updateOne({ _id: testRecallToken._id }, { status: 'called' });
  const badStatusMove = await fetch(`${BASE_URL}/api/reception/queue/${testRecallToken._id}/move-back`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (badStatusMove.status !== 400) {
    throw new Error(`Expected 400 when moving non-waiting token, got ${badStatusMove.status}`);
  }
  const badStatusMoveData = await badStatusMove.json();
  if (!badStatusMoveData.message || !badStatusMoveData.message.includes('waiting')) {
    throw new Error(`Expected message about waiting status, got ${JSON.stringify(badStatusMoveData)}`);
  }
  console.log('✓ Rejection with 400 when token is not in "waiting" status');

  // 12d. Rejection when token has priority "urgent" -> 400 ("Do not let urgent tokens be moved")
  await QueueToken.updateOne({ _id: testRecallToken._id }, { status: 'waiting', priority: 'urgent' });
  const urgentMove = await fetch(`${BASE_URL}/api/reception/queue/${testRecallToken._id}/move-back`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (urgentMove.status !== 400) {
    throw new Error(`Expected 400 when moving urgent token, got ${urgentMove.status}`);
  }
  const urgentMoveData = await urgentMove.json();
  if (!urgentMoveData.message || !urgentMoveData.message.includes('Urgent')) {
    throw new Error(`Expected message about urgent tokens, got ${JSON.stringify(urgentMoveData)}`);
  }
  console.log('✓ Urgent token move-back rejected with 400 ("Do not let urgent tokens be moved")');

  // 12e. Successful move-back of a waiting token 3 positions back
  // Set up 5 waiting tokens for this doctor and date:
  // Patient 1 (Token 10, normal)
  // Patient 2 (Token 20, normal)
  // Patient 3 (Token 30, normal)
  // Patient 4 (Token 40, normal)
  // Patient 5 (Token 50, normal)
  const patient5 = await Patient.create({
    fullName: 'Patient MoveBack Test',
    phone: '0770000005',
    nic: '199000000005',
    age: 22,
    gender: 'male',
  });

  const appt5 = await Appointment.create({
    patient: patient5._id,
    doctor: doctor._id,
    department: doctor.department || 'General OPD',
    date: testDate,
    slotTime: '11:00',
    type: 'walk_in',
    status: 'checked_in',
    tokenNumber: 50,
    priority: 'normal',
  });

  const token5 = await QueueToken.create({
    tokenNumber: 50,
    tokenLabel: 'OPD-050',
    patient: patient5._id,
    assignedDoctor: doctor._id,
    appointment: appt5._id,
    date: testDate,
    priority: 'normal',
    status: 'waiting',
  });

  await QueueToken.updateOne({ _id: (await QueueToken.findOne({ tokenNumber: 1, date: testDate }))?._id }, { tokenNumber: 10, tokenLabel: 'OPD-010', status: 'waiting', priority: 'normal', moveBackCount: 0 });
  await QueueToken.updateOne({ _id: testRecallToken._id }, { tokenNumber: 20, tokenLabel: 'OPD-020', status: 'waiting', priority: 'normal', moveBackCount: 0 });
  await QueueToken.updateOne({ _id: (await QueueToken.findOne({ tokenNumber: 3, date: testDate }))?._id }, { tokenNumber: 30, tokenLabel: 'OPD-030', status: 'waiting', priority: 'normal', moveBackCount: 0 });
  await QueueToken.updateOne({ _id: (await QueueToken.findOne({ tokenNumber: 4, date: testDate }))?._id }, { tokenNumber: 40, tokenLabel: 'OPD-040', status: 'waiting', priority: 'normal', moveBackCount: 0 });

  const moveTargetToken = await QueueToken.findOne({ tokenLabel: 'OPD-010', date: testDate });

  // Move OPD-010 (pos 1) 3 positions back -> should land at position 4 (behind OPD-040, before OPD-050)
  const moveRes = await fetch(`${BASE_URL}/api/reception/queue/${moveTargetToken._id}/move-back`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (moveRes.status !== 200) {
    const errText = await moveRes.text();
    throw new Error(`Expected 200 for move-back, got ${moveRes.status}: ${errText}`);
  }
  const moveData = await moveRes.json();
  console.log('POST /:id/move-back response:', JSON.stringify(moveData));

  if (moveData.position !== 4 && moveData.newPosition !== 4) {
    throw new Error(`Expected new position 4, got ${moveData.position || moveData.newPosition}`);
  }
  if (moveData.moveBackCount !== 1) {
    throw new Error(`Expected moveBackCount 1, got ${moveData.moveBackCount}`);
  }

  // Verify queue order via GET /api/reception/queue
  const queueAfterMoveRes = await fetch(`${BASE_URL}/api/reception/queue?date=${testDate}`, {
    headers: { Authorization: `Bearer ${recToken}` },
  });
  const queueAfterMoveData = await queueAfterMoveRes.json();
  const queueLabels = queueAfterMoveData.queue.map(q => q.tokenLabel);
  console.log('Queue order after move-back:', queueLabels);

  if (queueLabels[0] !== 'OPD-020' || queueLabels[1] !== 'OPD-030' || queueLabels[2] !== 'OPD-040' || queueLabels[3] !== 'OPD-010' || queueLabels[4] !== 'OPD-050') {
    throw new Error(`Expected [OPD-020, OPD-030, OPD-040, OPD-010, OPD-050], got ${JSON.stringify(queueLabels)}`);
  }
  console.log('✓ Token successfully moved 3 positions back from pos 1 to pos 4 in the ordered queue');

  // 12f. Move token near the end of the queue (pos 4 out of 5, 4+3=7 clamped to 5)
  const moveEndToken = await QueueToken.findOne({ tokenLabel: 'OPD-010', date: testDate });
  const moveEndRes = await fetch(`${BASE_URL}/api/reception/queue/${moveEndToken._id}/move-back`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${recToken}` },
  });
  const moveEndData = await moveEndRes.json();
  if (moveEndData.position !== 5 && moveEndData.newPosition !== 5) {
    throw new Error(`Expected position clamped to 5, got ${moveEndData.position || moveEndData.newPosition}`);
  }
  if (moveEndData.moveBackCount !== 2) {
    throw new Error(`Expected moveBackCount 2, got ${moveEndData.moveBackCount}`);
  }
  console.log('✓ Clamped correctly to last position (pos 5) and incremented moveBackCount to 2');

  // 12g. Test alias endpoint POST /api/reception/:id/move-back
  const aliasMoveRes = await fetch(`${BASE_URL}/api/reception/${moveEndToken._id}/move-back`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (aliasMoveRes.status !== 200) {
    throw new Error(`Expected 200 for alias POST /api/reception/:id/move-back, got ${aliasMoveRes.status}`);
  }
  console.log('✓ Alias POST /api/reception/:id/move-back works correctly');

  // ==========================================
  // 13. PATCH /:id/assign-doctor tests
  // ==========================================
  console.log('\n--- Testing PATCH /:id/assign-doctor ---');

  // 13a. Auth checks
  const unauthAssign = await fetch(`${BASE_URL}/api/reception/queue/${moveEndToken._id}/assign-doctor`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doctorId: doctor._id.toString() }),
  });
  if (unauthAssign.status !== 401) {
    throw new Error(`Expected 401 for unauthenticated assign-doctor, got ${unauthAssign.status}`);
  }
  console.log('✓ Unauthenticated assign-doctor returns 401');

  const patAssign = await fetch(`${BASE_URL}/api/reception/queue/${moveEndToken._id}/assign-doctor`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${patToken}`,
    },
    body: JSON.stringify({ doctorId: doctor._id.toString() }),
  });
  if (patAssign.status !== 403) {
    throw new Error(`Expected 403 for patient role assign-doctor, got ${patAssign.status}`);
  }
  console.log('✓ Patient role assign-doctor returns 403');

  // 13b. Missing doctorId or invalid format
  const missingDocRes = await fetch(`${BASE_URL}/api/reception/queue/${moveEndToken._id}/assign-doctor`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${recToken}`,
    },
    body: JSON.stringify({}),
  });
  if (missingDocRes.status !== 400) {
    throw new Error(`Expected 400 for missing doctorId, got ${missingDocRes.status}`);
  }
  console.log('✓ Missing doctorId returns 400');

  // 13c. Inactive doctor check
  let offlineDoctor = await Doctor.findOne({ name: 'Dr. Test Offline' });
  if (!offlineDoctor) {
    offlineDoctor = await Doctor.create({
      name: 'Dr. Test Offline',
      specialization: 'General Practice',
      department: 'OPD',
      room: 'Room 99',
      status: 'offline',
    });
  } else {
    offlineDoctor.status = 'offline';
    await offlineDoctor.save();
  }

  const inactiveDocRes = await fetch(`${BASE_URL}/api/reception/queue/${moveEndToken._id}/assign-doctor`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${recToken}`,
    },
    body: JSON.stringify({ doctorId: offlineDoctor._id.toString() }),
  });
  if (inactiveDocRes.status !== 400) {
    throw new Error(`Expected 400 for inactive doctor, got ${inactiveDocRes.status}`);
  }
  const inactiveDocData = await inactiveDocRes.json();
  if (!inactiveDocData.message?.includes('not active')) {
    throw new Error(`Expected message stating doctor is not active, got: ${inactiveDocData.message}`);
  }
  console.log('✓ Inactive doctor correctly rejected with 400');

  // 13d. Successful doctor assignment to an active doctor
  let activeDoctor2 = await Doctor.findOne({ name: 'Dr. Sarath Silva' });
  if (!activeDoctor2) {
    activeDoctor2 = await Doctor.create({
      name: 'Dr. Sarath Silva',
      specialization: 'Internal Medicine',
      department: 'OPD',
      room: 'Room 102',
      status: 'active',
      dailyCapacity: 25,
      avgConsultMinutes: 12,
    });
  } else {
    activeDoctor2.status = 'active';
    await activeDoctor2.save();
  }

  const assignRes = await fetch(`${BASE_URL}/api/reception/queue/${moveEndToken._id}/assign-doctor`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${recToken}`,
    },
    body: JSON.stringify({ doctorId: activeDoctor2._id.toString() }),
  });
  if (assignRes.status !== 200) {
    const errText = await assignRes.text();
    throw new Error(`Expected 200 for assign-doctor, got ${assignRes.status}: ${errText}`);
  }
  const assignData = await assignRes.json();
  console.log('PATCH /:id/assign-doctor response:', JSON.stringify(assignData));

  // Verify in MongoDB database that QueueToken and Appointment were updated
  const updatedTokenInDB = await QueueToken.findById(moveEndToken._id);
  if (updatedTokenInDB.assignedDoctor.toString() !== activeDoctor2._id.toString()) {
    throw new Error(`Expected QueueToken.assignedDoctor to be ${activeDoctor2._id}, got ${updatedTokenInDB.assignedDoctor}`);
  }
  const updatedApptInDB = await Appointment.findById(moveEndToken.appointment);
  if (updatedApptInDB.doctor.toString() !== activeDoctor2._id.toString()) {
    throw new Error(`Expected Appointment.doctor to be ${activeDoctor2._id}, got ${updatedApptInDB.doctor}`);
  }
  console.log('✓ QueueToken.assignedDoctor and Appointment.doctor successfully updated in DB');

  // 13e. Test alias PATCH /api/reception/:id/assign-doctor (reassigning back to doctor)
  const aliasAssignRes = await fetch(`${BASE_URL}/api/reception/${moveEndToken._id}/assign-doctor`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${recToken}`,
    },
    body: JSON.stringify({ doctorId: doctor._id.toString() }),
  });
  if (aliasAssignRes.status !== 200) {
    throw new Error(`Expected 200 for alias PATCH /api/reception/:id/assign-doctor, got ${aliasAssignRes.status}`);
  }
  const reUpdatedToken = await QueueToken.findById(moveEndToken._id);
  if (reUpdatedToken.assignedDoctor.toString() !== doctor._id.toString()) {
    throw new Error(`Expected QueueToken.assignedDoctor reverted back to ${doctor._id}`);
  }
  console.log('✓ Alias PATCH /api/reception/:id/assign-doctor works correctly');

  // ==========================================
  // 14. GET & PATCH /auto-advance tests
  // ==========================================
  console.log('\n--- Testing GET & PATCH /auto-advance ---');

  // 14a. Auth checks
  const unauthGetAdv = await fetch(`${BASE_URL}/api/reception/queue/auto-advance`);
  if (unauthGetAdv.status !== 401) {
    throw new Error(`Expected 401 for unauth GET /auto-advance, got ${unauthGetAdv.status}`);
  }
  const patGetAdv = await fetch(`${BASE_URL}/api/reception/queue/auto-advance`, {
    headers: { Authorization: `Bearer ${patToken}` },
  });
  if (patGetAdv.status !== 403) {
    throw new Error(`Expected 403 for patient GET /auto-advance, got ${patGetAdv.status}`);
  }
  console.log('✓ Auth checks passed for /auto-advance');

  // 14b. Body validation for PATCH /auto-advance
  const badBodyRes = await fetch(`${BASE_URL}/api/reception/queue/auto-advance`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${recToken}`,
    },
    body: JSON.stringify({ enabled: 'invalid-string' }),
  });
  if (badBodyRes.status !== 400) {
    throw new Error(`Expected 400 for non-boolean enabled, got ${badBodyRes.status}`);
  }
  console.log('✓ Invalid body rejected with 400');

  // 14c. PATCH /auto-advance { enabled: true }
  const patchAdvRes = await fetch(`${BASE_URL}/api/reception/queue/auto-advance`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${recToken}`,
    },
    body: JSON.stringify({ enabled: true }),
  });
  if (patchAdvRes.status !== 200) {
    const errText = await patchAdvRes.text();
    throw new Error(`Expected 200 for PATCH /auto-advance, got ${patchAdvRes.status}: ${errText}`);
  }
  const patchAdvData = await patchAdvRes.json();
  if (patchAdvData.enabled !== true) {
    throw new Error(`Expected enabled: true, got ${patchAdvData.enabled}`);
  }
  console.log('✓ PATCH /auto-advance { enabled: true } returned enabled: true');

  // Verify in MongoDB Settings collection
  const settingInDB = await Settings.findOne({ key: 'auto_advance' });
  if (!settingInDB || settingInDB.value !== true) {
    throw new Error(`Expected Settings document with key auto_advance and value true, got ${JSON.stringify(settingInDB)}`);
  }
  console.log('✓ Settings model verified in DB: key="auto_advance", value=true');

  // 14d. GET /auto-advance reads enabled: true
  const getAdvRes = await fetch(`${BASE_URL}/api/reception/queue/auto-advance`, {
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (getAdvRes.status !== 200) {
    throw new Error(`Expected 200 for GET /auto-advance, got ${getAdvRes.status}`);
  }
  const getAdvData = await getAdvRes.json();
  if (getAdvData.enabled !== true) {
    throw new Error(`Expected GET /auto-advance to return enabled: true, got ${getAdvData.enabled}`);
  }
  console.log('✓ GET /auto-advance correctly read enabled: true');

  // 14e. Alias PATCH & GET /api/reception/auto-advance with { enabled: false }
  const aliasPatchAdv = await fetch(`${BASE_URL}/api/reception/auto-advance`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${recToken}`,
    },
    body: JSON.stringify({ enabled: false }),
  });
  if (aliasPatchAdv.status !== 200) {
    throw new Error(`Expected 200 for alias PATCH /api/reception/auto-advance, got ${aliasPatchAdv.status}`);
  }
  const aliasPatchData = await aliasPatchAdv.json();
  if (aliasPatchData.enabled !== false) {
    throw new Error(`Expected enabled: false, got ${aliasPatchData.enabled}`);
  }

  const aliasGetAdv = await fetch(`${BASE_URL}/api/reception/auto-advance`, {
    headers: { Authorization: `Bearer ${recToken}` },
  });
  const aliasGetData = await aliasGetAdv.json();
  if (aliasGetData.enabled !== false) {
    throw new Error(`Expected enabled: false from alias GET, got ${aliasGetData.enabled}`);
  }
  console.log('✓ Alias PATCH & GET /api/reception/auto-advance work correctly');

  // Clean up extra patient 5 & token 5
  await QueueToken.deleteOne({ _id: token5._id });
  await Appointment.deleteOne({ _id: appt5._id });
  await Patient.deleteOne({ _id: patient5._id });

  // Clean up doctors & settings created during test
  if (offlineDoctor) await Doctor.deleteOne({ _id: offlineDoctor._id });
  if (activeDoctor2) await Doctor.deleteOne({ _id: activeDoctor2._id });

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
