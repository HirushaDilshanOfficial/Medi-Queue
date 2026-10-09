const assert = require('assert');

const BASE_URL = process.env.API_URL || 'http://localhost:5001';

async function runTests() {
  console.log('====================================================');
  console.log('Medi-Queue Schedule Workflow End-to-End Test');
  console.log(`Connecting to: ${BASE_URL}`);
  console.log('====================================================\n');

  // 1. Authenticate as Receptionist
  console.log('1. Authenticating as Receptionist...');
  let token = null;

  try {
    const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'reception@mediqueue.lk',
        password: 'Test@1234',
      }),
    });
    if (loginRes.ok) {
      const loginData = await loginRes.json();
      token = loginData.token;
    }
  } catch {}

  if (!token) {
    const jwt = require('jsonwebtoken');
    const User = require('../models/User');
    require('../config/db')();
    const recUser = await User.findOne({ role: 'receptionist' });
    assert.ok(recUser, 'Receptionist user must exist in database');
    token = jwt.sign(
      { id: recUser._id, role: recUser.role },
      process.env.JWT_SECRET || 'mediqueue_dev_secret_key_2026',
      { expiresIn: '1d' }
    );
  }
  assert.ok(token, 'JWT token must be present');
  console.log('✓ Receptionist authenticated successfully.\n');

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 2. Fetch doctors to get a test doctor
  console.log('2. Fetching available doctors...');
  const docsRes = await fetch(`${BASE_URL}/api/reception/doctors`, { headers });
  assert.strictEqual(docsRes.status, 200, `Get doctors failed: ${docsRes.status}`);
  const docs = await docsRes.json();
  assert.ok(Array.isArray(docs) && docs.length > 0, 'Must have at least 1 doctor');
  const testDoctor = docs[0];
  const doctorId = testDoctor._id || testDoctor.id;
  console.log(`✓ Using doctor: ${testDoctor.name} (ID: ${doctorId})\n`);

  // Target a test date far enough in the future to not collide with seeds
  const testDate = '2026-10-25';

  // Cleanup any leftover test schedules on testDate first
  const existingRes = await fetch(`${BASE_URL}/api/reception/schedules?date=${testDate}&doctorId=${doctorId}`, { headers });
  const existingData = await existingRes.json();
  if (existingData.data && existingData.data.length > 0) {
    for (const s of existingData.data) {
      await fetch(`${BASE_URL}/api/reception/schedules/${s._id}`, { method: 'DELETE', headers });
    }
  }

  // TEST CASE 1: Add a schedule
  console.log('--- TEST 1: Add a Schedule (createSchedule) ---');
  const addRes = await fetch(`${BASE_URL}/api/reception/schedules`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      doctor: doctorId,
      date: testDate,
      startTime: '09:00',
      endTime: '12:00',
      slotMinutes: 15,
      maxPatients: 20,
      status: 'available',
      notes: 'Initial test schedule',
    }),
  });
  assert.strictEqual(addRes.status, 201, `Create schedule failed with status: ${addRes.status}`);
  const addData = await addRes.json();
  assert.strictEqual(addData.success, true);
  const createdSchedule = addData.data;
  assert.ok(createdSchedule._id, 'Schedule must have _id');
  assert.strictEqual(createdSchedule.startTime, '09:00');
  assert.strictEqual(createdSchedule.endTime, '12:00');
  assert.strictEqual(createdSchedule.status, 'available');
  console.log(`✓ Schedule created successfully! ID: ${createdSchedule._id}\n`);

  // TEST CASE 2: Overlap is rejected
  console.log('--- TEST 2: Overlapping Schedule is Rejected (409 Conflict) ---');
  const overlapRes = await fetch(`${BASE_URL}/api/reception/schedules`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      doctor: doctorId,
      date: testDate,
      startTime: '10:00', // Overlaps with 09:00-12:00
      endTime: '13:00',
      slotMinutes: 15,
      maxPatients: 15,
      status: 'available',
    }),
  });
  assert.strictEqual(overlapRes.status, 409, `Expected 409 for overlapping schedule, got: ${overlapRes.status}`);
  const overlapData = await overlapRes.json();
  console.log(`✓ Overlap correctly rejected with 409 Conflict: "${overlapData.message}"\n`);

  // TEST CASE 3: Edit it
  console.log('--- TEST 3: Edit Schedule (updateSchedule) ---');
  const editRes = await fetch(`${BASE_URL}/api/reception/schedules/${createdSchedule._id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      startTime: '09:00',
      endTime: '11:00',
      slotMinutes: 20,
      maxPatients: 25,
      notes: 'Updated clinic hours and slot duration',
    }),
  });
  assert.strictEqual(editRes.status, 200, `Update schedule failed with status: ${editRes.status}`);
  const editData = await editRes.json();
  assert.strictEqual(editData.data.endTime, '11:00');
  assert.strictEqual(editData.data.slotMinutes, 20);
  assert.strictEqual(editData.data.maxPatients, 25);
  console.log('✓ Schedule edited successfully! End time is 11:00, slotMinutes is 20.\n');

  // TEST CASE 4: Set it to leave (slots disappear on Register)
  console.log('--- TEST 4: Set to Leave & Verify Slots Disappear on Register ---');
  // First, verify slots are present when available
  const availableSlotsRes = await fetch(`${BASE_URL}/api/reception/slots?doctorId=${doctorId}&date=${testDate}`, { headers });
  assert.strictEqual(availableSlotsRes.status, 200);
  const availableSlotsData = await availableSlotsRes.json();
  assert.ok(availableSlotsData.slots.length > 0, 'Available schedule must generate slots');
  console.log(`  - When Available: Generated ${availableSlotsData.slots.length} slots (e.g. ${availableSlotsData.slots.map(s => s.time).join(', ')})`);

  // Now update status to 'leave'
  const leaveRes = await fetch(`${BASE_URL}/api/reception/schedules/${createdSchedule._id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      status: 'leave',
      notes: 'Doctor on emergency medical leave',
    }),
  });
  assert.strictEqual(leaveRes.status, 200);
  const leaveData = await leaveRes.json();
  assert.strictEqual(leaveData.data.status, 'leave');

  // Verify slots now disappear on Register (/api/reception/slots)
  const leaveSlotsRes = await fetch(`${BASE_URL}/api/reception/slots?doctorId=${doctorId}&date=${testDate}`, { headers });
  assert.strictEqual(leaveSlotsRes.status, 200);
  const leaveSlotsData = await leaveSlotsRes.json();
  assert.strictEqual(leaveSlotsData.slots.length, 0, 'Slots must be empty when doctor is on leave');
  console.log(`✓ When Leave: Slots count is 0. Message: "${leaveSlotsData.message}"\n`);

  // Set back to available so we can test appointment protection
  await fetch(`${BASE_URL}/api/reception/schedules/${createdSchedule._id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ status: 'available' }),
  });

  // TEST CASE 5: Deleting one with appointments is blocked
  console.log('--- TEST 5: Deleting Schedule with Appointments is Blocked (409) ---');
  // Create an active appointment within the schedule range
  const Appointment = require('../models/Appointment');
  const Patient = require('../models/Patient');
  const mongoose = require('mongoose');
  require('../config/db')();

  // Find or create test patient
  let testPatient = await Patient.findOne({ isDeleted: false });
  if (!testPatient) {
    testPatient = await Patient.create({
      fullName: 'Test Schedule Patient',
      phone: '0771234567',
      registeredVia: 'reception',
    });
  }

  const testAppt = await Appointment.create({
    patient: testPatient._id,
    doctor: doctorId,
    department: testDoctor.department || 'OPD',
    date: testDate,
    slotTime: '09:20',
    type: 'walk_in',
    status: 'booked',
    isActive: true,
  });

  // Attempt to delete schedule - MUST BE BLOCKED WITH 409
  const deleteBlockedRes = await fetch(`${BASE_URL}/api/reception/schedules/${createdSchedule._id}`, {
    method: 'DELETE',
    headers,
  });
  assert.strictEqual(deleteBlockedRes.status, 409, `Expected 409 when deleting schedule with appointments, got: ${deleteBlockedRes.status}`);
  const deleteBlockedData = await deleteBlockedRes.json();
  assert.strictEqual(deleteBlockedData.message, 'Appointments exist for this schedule');
  console.log(`✓ Delete blocked with 409: "${deleteBlockedData.message}"\n`);

  // TEST CASE 6: Delete it after appointments cleared
  console.log('--- TEST 6: Delete Schedule When No Active Appointments ---');
  // Clean up the appointment
  await Appointment.findByIdAndDelete(testAppt._id);

  // Attempt delete again - MUST SUCCEED WITH 200
  const deleteSuccessRes = await fetch(`${BASE_URL}/api/reception/schedules/${createdSchedule._id}`, {
    method: 'DELETE',
    headers,
  });
  assert.strictEqual(deleteSuccessRes.status, 200, `Expected 200 for deletion, got: ${deleteSuccessRes.status}`);
  const deleteSuccessData = await deleteSuccessRes.json();
  assert.strictEqual(deleteSuccessData.success, true);
  console.log(`✓ Schedule deleted successfully: "${deleteSuccessData.message}"\n`);

  // Verify schedule no longer exists
  const verifyRes = await fetch(`${BASE_URL}/api/reception/schedules/${createdSchedule._id}`, { headers });
  assert.strictEqual(verifyRes.status, 404);
  console.log('✓ Verified schedule is completely removed.\n');

  console.log('====================================================');
  console.log('ALL 6 SCHEDULE WORKFLOW TESTS PASSED PERFECTLY!');
  console.log('====================================================');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
