const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const QueueToken = require('../models/QueueToken');
const Shift = require('../models/Shift');
const { getShiftSummary } = require('../services/shiftService');

const BASE_URL = 'http://localhost:5001';

async function runShiftTests() {
  console.log('--- STARTING SHIFT ENDPOINT & SERVICE TESTS ---');
  await mongoose.connect(process.env.MONGO_URI);

  // 1. Login as receptionist & patient
  const recRes = await fetch(`${BASE_URL}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'receptionist@mediqueue.lk', password: 'password123' }),
  });
  const recData = await recRes.json();
  const recToken = recData.token;
  if (!recToken) throw new Error('Failed to login as receptionist: ' + JSON.stringify(recData));

  const patRes = await fetch(`${BASE_URL}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'patient.test@mediqueue.lk', password: 'password123' }),
  });
  const patData = await patRes.json();
  const patToken = patData.token;
  if (!patToken) throw new Error('Failed to login as patient: ' + JSON.stringify(patData));

  console.log('✓ Login successful for receptionist and patient');

  // 2. Auth checks (401, 403)
  const unauthRes = await fetch(`${BASE_URL}/api/reception/shift/summary`);
  if (unauthRes.status !== 401) {
    throw new Error(`Expected 401 for unauthenticated GET /shift/summary, got ${unauthRes.status}`);
  }
  console.log('✓ Unauthenticated request to /shift/summary returns 401');

  const patAuthRes = await fetch(`${BASE_URL}/api/reception/shift/summary`, {
    headers: { Authorization: `Bearer ${patToken}` },
  });
  if (patAuthRes.status !== 403) {
    throw new Error(`Expected 403 for patient role on /shift/summary, got ${patAuthRes.status}`);
  }
  console.log('✓ Patient role request to /shift/summary returns 403');

  // 3. Test empty date (Avoid divide-by-zero)
  const emptyDate = '2099-01-01';
  await Appointment.deleteMany({ date: emptyDate });
  await QueueToken.deleteMany({ date: emptyDate });

  const emptySummary = await getShiftSummary(emptyDate);
  if (emptySummary.totalRegistered !== 0 || emptySummary.attended !== 0 || emptySummary.noShows !== 0 || emptySummary.cancelled !== 0) {
    throw new Error(`Expected 0 counts for empty date: ${JSON.stringify(emptySummary)}`);
  }
  if (emptySummary.avgHandlingMinutes !== 0) {
    throw new Error(`Expected avgHandlingMinutes=0 when no handled tokens, got ${emptySummary.avgHandlingMinutes}`);
  }
  if (emptySummary.throughputPercent !== 0) {
    throw new Error(`Expected throughputPercent=0 when no activity, got ${emptySummary.throughputPercent}`);
  }
  if (!Array.isArray(emptySummary.doctors)) {
    throw new Error('Expected doctors array in emptySummary');
  }
  console.log('✓ Empty date test avoids divide-by-zero: avgHandlingMinutes=0, throughputPercent=0');

  // 4. Prepare test data for specific test date
  const testDate = '2026-10-06';
  await QueueToken.deleteMany({ date: testDate });
  await Appointment.deleteMany({ date: testDate });
  await Doctor.deleteMany({ name: /^Dr\. ShiftTest/ });
  await Patient.deleteMany({ fullName: /^PT ShiftTest/ });

  // Doctors
  const doc1 = await Doctor.create({
    name: 'Dr. ShiftTest Alpha',
    specialization: 'General',
    department: 'OPD',
    room: 'Room 601',
    status: 'active',
    dailyCapacity: 20,
    avgConsultMinutes: 10,
  });

  const doc2 = await Doctor.create({
    name: 'Dr. ShiftTest Beta',
    specialization: 'ENT',
    department: 'ENT',
    room: 'Room 602',
    status: 'on_break',
    dailyCapacity: 15,
    avgConsultMinutes: 12,
  });

  // Create patients
  const patients = [];
  for (let i = 1; i <= 9; i++) {
    const pt = await Patient.create({
      fullName: `PT ShiftTest ${i}`,
      phone: `077666000${i}`,
      nic: `19850000000${i}`,
      status: 'Active',
    });
    patients.push(pt);
  }

  // 4 Attended tokens (3 for doc1, 1 for doc2)
  // Token 1: 10 min handling (10:00 -> 10:10)
  const a1 = await Appointment.create({
    patient: patients[0]._id,
    doctor: doc1._id,
    department: 'OPD',
    date: testDate,
    slotTime: '10:00',
    type: 'walk_in',
    status: 'completed',
    tokenNumber: 1,
    notes: 'shift-test',
  });
  await QueueToken.create({
    appointment: a1._id,
    patient: patients[0]._id,
    department: 'OPD',
    date: testDate,
    tokenNumber: 1,
    tokenLabel: 'OPD-001',
    status: 'done',
    assignedDoctor: doc1._id,
    calledAt: new Date(`${testDate}T10:00:00Z`),
    servedAt: new Date(`${testDate}T10:10:00Z`),
  });

  // Token 2: 20 min handling (10:15 -> 10:35)
  const a2 = await Appointment.create({
    patient: patients[1]._id,
    doctor: doc1._id,
    department: 'OPD',
    date: testDate,
    slotTime: '10:15',
    type: 'walk_in',
    status: 'completed',
    tokenNumber: 2,
    notes: 'shift-test',
  });
  await QueueToken.create({
    appointment: a2._id,
    patient: patients[1]._id,
    department: 'OPD',
    date: testDate,
    tokenNumber: 2,
    tokenLabel: 'OPD-002',
    status: 'done',
    assignedDoctor: doc1._id,
    calledAt: new Date(`${testDate}T10:15:00Z`),
    servedAt: new Date(`${testDate}T10:35:00Z`),
  });

  // Token 3: 15 min handling (11:00 -> 11:15) for doc2
  const a3 = await Appointment.create({
    patient: patients[2]._id,
    doctor: doc2._id,
    department: 'ENT',
    date: testDate,
    slotTime: '11:00',
    type: 'pre_booked',
    status: 'completed',
    tokenNumber: 3,
    notes: 'shift-test',
  });
  await QueueToken.create({
    appointment: a3._id,
    patient: patients[2]._id,
    department: 'ENT',
    date: testDate,
    tokenNumber: 3,
    tokenLabel: 'ENT-003',
    status: 'done',
    assignedDoctor: doc2._id,
    calledAt: new Date(`${testDate}T11:00:00Z`),
    servedAt: new Date(`${testDate}T11:15:00Z`),
  });

  // Token 4: 15 min handling (11:30 -> 11:45) for doc1
  const a4 = await Appointment.create({
    patient: patients[3]._id,
    doctor: doc1._id,
    department: 'OPD',
    date: testDate,
    slotTime: '11:30',
    type: 'walk_in',
    status: 'completed',
    tokenNumber: 4,
    notes: 'shift-test',
  });
  await QueueToken.create({
    appointment: a4._id,
    patient: patients[3]._id,
    department: 'OPD',
    date: testDate,
    tokenNumber: 4,
    tokenLabel: 'OPD-004',
    status: 'done',
    assignedDoctor: doc1._id,
    calledAt: new Date(`${testDate}T11:30:00Z`),
    servedAt: new Date(`${testDate}T11:45:00Z`),
  });
  // Average handling = (10 + 20 + 15 + 15) / 4 = 60 / 4 = 15.0 minutes

  // 2 No-shows
  const a5 = await Appointment.create({
    patient: patients[4]._id,
    doctor: doc1._id,
    department: 'OPD',
    date: testDate,
    slotTime: '12:00',
    type: 'walk_in',
    status: 'no_show',
    tokenNumber: 5,
    notes: 'shift-test',
  });
  await QueueToken.create({
    appointment: a5._id,
    patient: patients[4]._id,
    department: 'OPD',
    date: testDate,
    tokenNumber: 5,
    tokenLabel: 'OPD-005',
    status: 'no_show',
    assignedDoctor: doc1._id,
  });

  const a6 = await Appointment.create({
    patient: patients[5]._id,
    doctor: doc2._id,
    department: 'ENT',
    date: testDate,
    slotTime: '12:15',
    type: 'pre_booked',
    status: 'no_show',
    tokenNumber: 6,
    notes: 'shift-test',
  });
  await QueueToken.create({
    appointment: a6._id,
    patient: patients[5]._id,
    department: 'ENT',
    date: testDate,
    tokenNumber: 6,
    tokenLabel: 'ENT-006',
    status: 'no_show',
    assignedDoctor: doc2._id,
  });

  // 1 Cancelled
  await Appointment.create({
    patient: patients[6]._id,
    doctor: doc1._id,
    department: 'OPD',
    date: testDate,
    slotTime: '12:30',
    type: 'pre_booked',
    status: 'cancelled',
    tokenNumber: 7,
    notes: 'shift-test',
  });

  // 2 Still Waiting
  const a8 = await Appointment.create({
    patient: patients[7]._id,
    doctor: doc1._id,
    department: 'OPD',
    date: testDate,
    slotTime: '12:45',
    type: 'walk_in',
    status: 'checked_in',
    tokenNumber: 8,
    notes: 'shift-test',
  });
  await QueueToken.create({
    appointment: a8._id,
    patient: patients[7]._id,
    department: 'OPD',
    date: testDate,
    tokenNumber: 8,
    tokenLabel: 'OPD-008',
    status: 'waiting',
    assignedDoctor: doc1._id,
  });

  const a9 = await Appointment.create({
    patient: patients[8]._id,
    doctor: doc2._id,
    department: 'ENT',
    date: testDate,
    slotTime: '13:00',
    type: 'pre_booked',
    status: 'in_consultation',
    tokenNumber: 9,
    notes: 'shift-test',
  });
  await QueueToken.create({
    appointment: a9._id,
    patient: patients[8]._id,
    department: 'ENT',
    date: testDate,
    tokenNumber: 9,
    tokenLabel: 'ENT-009',
    status: 'called',
    assignedDoctor: doc2._id,
  });

  // Total registered = 4 attended + 2 no_shows + 1 cancelled + 2 waiting = 9
  // Throughput = attended / (attended + noShows + stillWaiting) * 100 = 4 / (4 + 2 + 2) * 100 = 4 / 8 * 100 = 50.0%

  // 5. Call API: GET /api/reception/shift/summary?date=...
  console.log('\n--- Testing GET /api/reception/shift/summary ---');
  const shiftRes = await fetch(`${BASE_URL}/api/reception/shift/summary?date=${testDate}`, {
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (shiftRes.status !== 200) {
    const errText = await shiftRes.text();
    throw new Error(`Expected 200 for GET /shift/summary, got ${shiftRes.status}: ${errText}`);
  }
  const summary = await shiftRes.json();
  console.log('Shift Summary Response:', JSON.stringify(summary, null, 2));

  // Assertions
  if (summary.totalRegistered !== 9) {
    throw new Error(`Expected totalRegistered=9, got ${summary.totalRegistered}`);
  }
  if (summary.attended !== 4) {
    throw new Error(`Expected attended=4, got ${summary.attended}`);
  }
  if (summary.noShows !== 2) {
    throw new Error(`Expected noShows=2, got ${summary.noShows}`);
  }
  if (summary.cancelled !== 1) {
    throw new Error(`Expected cancelled=1, got ${summary.cancelled}`);
  }
  if (summary.avgHandlingMinutes !== 15) {
    throw new Error(`Expected avgHandlingMinutes=15, got ${summary.avgHandlingMinutes}`);
  }
  if (summary.throughputPercent !== 50) {
    throw new Error(`Expected throughputPercent=50, got ${summary.throughputPercent}`);
  }
  console.log('✓ Metrics verified: totalRegistered=9, attended=4, noShows=2, cancelled=1, avgHandlingMinutes=15, throughputPercent=50%');

  // Verify doctors array
  if (!Array.isArray(summary.doctors) || summary.doctors.length < 2) {
    throw new Error('Expected doctors array with at least 2 doctors');
  }
  const d1InList = summary.doctors.find((d) => d.name === 'Dr. ShiftTest Alpha');
  const d2InList = summary.doctors.find((d) => d.name === 'Dr. ShiftTest Beta');

  if (!d1InList) throw new Error('Dr. ShiftTest Alpha not found in doctors list');
  if (!d2InList) throw new Error('Dr. ShiftTest Beta not found in doctors list');

  if (d1InList.room !== 'Room 601' || d1InList.status !== 'active' || d1InList.attended !== 3 || d1InList.capacity !== 20) {
    throw new Error(`Doctor 1 figures mismatch: ${JSON.stringify(d1InList)}`);
  }
  if (d2InList.room !== 'Room 602' || d2InList.status !== 'on_break' || d2InList.attended !== 1 || d2InList.capacity !== 15) {
    throw new Error(`Doctor 2 figures mismatch: ${JSON.stringify(d2InList)}`);
  }
  console.log('✓ Per-doctor breakdown verified: name, room, status, attended, capacity');

  // 6. Test invalid date format returns 400
  const invRes = await fetch(`${BASE_URL}/api/reception/shift/summary?date=invalid-date`, {
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (invRes.status !== 400) {
    throw new Error(`Expected 400 for invalid date, got ${invRes.status}`);
  }
  console.log('✓ Invalid date returns 400 Bad Request');

  // 7. Test POST /api/reception/shift/close
  console.log('\n--- Testing POST /api/reception/shift/close ---');
  // (a) Auth checks
  const unauthCloseRes = await fetch(`${BASE_URL}/api/reception/shift/close`, {
    method: 'POST',
  });
  if (unauthCloseRes.status !== 401) {
    throw new Error(`Expected 401 for unauthenticated POST /shift/close, got ${unauthCloseRes.status}`);
  }
  console.log('✓ Unauthenticated request to /shift/close returns 401');

  const patCloseRes = await fetch(`${BASE_URL}/api/reception/shift/close`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${patToken}` },
  });
  if (patCloseRes.status !== 403) {
    throw new Error(`Expected 403 for patient role on /shift/close, got ${patCloseRes.status}`);
  }
  console.log('✓ Patient role request to /shift/close returns 403');

  // (b) Find receptionist user id
  const recUser = await User.findOne({ email: 'receptionist@mediqueue.lk' });
  if (!recUser) throw new Error('Receptionist user not found');

  // Clean any shift records for today for this receptionist
  const todayDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  await Shift.deleteMany({ receptionist: recUser._id, date: todayDateStr });

  // (c) Close shift when none exists yet today -> creates one, saves snapshot, sets closed
  const closeRes1 = await fetch(`${BASE_URL}/api/reception/shift/close`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (closeRes1.status !== 200) {
    const errText = await closeRes1.text();
    throw new Error(`Expected 200 for POST /shift/close (first time), got ${closeRes1.status}: ${errText}`);
  }
  const closedData1 = await closeRes1.json();
  if (closedData1.status !== 'closed') {
    throw new Error(`Expected shift status "closed", got ${closedData1.status}`);
  }
  if (!closedData1.endTime) {
    throw new Error('Expected shift endTime to be set');
  }
  if (!closedData1.summary || typeof closedData1.summary.totalRegistered !== 'number') {
    throw new Error(`Expected summary snapshot on closed shift: ${JSON.stringify(closedData1.summary)}`);
  }
  console.log('✓ POST /shift/close creates shift if none exists, saves summary snapshot, sets endTime and status="closed"');

  // (d) Calling close again today when already closed returns 409 Conflict
  const closeRes2 = await fetch(`${BASE_URL}/api/reception/shift/close`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (closeRes2.status !== 409) {
    throw new Error(`Expected 409 Conflict when shift is already closed today, got ${closeRes2.status}`);
  }
  console.log('✓ POST /shift/close returns 409 Conflict if shift is already closed for today');

  // (e) Test with existing open shift on testDate
  await Shift.deleteMany({ receptionist: recUser._id, date: testDate });
  const openShift = await Shift.create({
    receptionist: recUser._id,
    date: testDate,
    startTime: new Date(`${testDate}T08:00:00Z`),
    status: 'open',
  });

  const closeOpenRes = await fetch(`${BASE_URL}/api/reception/shift/close`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${recToken}`,
    },
    body: JSON.stringify({ date: testDate }),
  });
  if (closeOpenRes.status !== 200) {
    const errTxt = await closeOpenRes.text();
    throw new Error(`Expected 200 for closing open shift, got ${closeOpenRes.status}: ${errTxt}`);
  }
  const closedOpenData = await closeOpenRes.json();
  if (closedOpenData._id.toString() !== openShift._id.toString()) {
    throw new Error('Expected to close the existing open shift');
  }
  if (closedOpenData.status !== 'closed' || !closedOpenData.endTime) {
    throw new Error('Expected status="closed" and endTime set');
  }
  if (closedOpenData.summary.totalRegistered !== 9 || closedOpenData.summary.attended !== 4) {
    throw new Error(`Summary snapshot mismatch on testDate: ${JSON.stringify(closedOpenData.summary)}`);
  }
  console.log('✓ POST /shift/close finds and closes existing open shift with accurate testDate summary snapshot');

  // (f) Calling close again on testDate returns 409 Conflict
  const closeRepeatRes = await fetch(`${BASE_URL}/api/reception/shift/close`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${recToken}`,
    },
    body: JSON.stringify({ date: testDate }),
  });
  if (closeRepeatRes.status !== 409) {
    throw new Error(`Expected 409 on repeat close for testDate, got ${closeRepeatRes.status}`);
  }
  console.log('✓ POST /shift/close returns 409 Conflict on repeat close');

  // 8. Cleanup
  await Shift.deleteMany({ receptionist: recUser._id });
  await QueueToken.deleteMany({ date: testDate });
  await Appointment.deleteMany({ date: testDate });
  await Doctor.deleteMany({ name: /^Dr\. ShiftTest/ });
  await Patient.deleteMany({ fullName: /^PT ShiftTest/ });

  await mongoose.disconnect();
  console.log('\n--- ALL SHIFT ENDPOINT & SERVICE TESTS PASSED SUCCESSFULLY ---');
}

runShiftTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
