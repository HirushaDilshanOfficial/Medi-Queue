const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

require('dotenv').config();
const { execSync } = require('child_process');
const mongoose = require('mongoose');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const QueueToken = require('../models/QueueToken');
const Shift = require('../models/Shift');

const BASE_URL = 'http://localhost:5001';

function runCurl(cmd) {
  console.log(`\n> ${cmd}`);
  try {
    const output = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { ok: true, output };
  } catch (err) {
    return { ok: false, status: err.status, output: err.stdout || err.stderr || err.message };
  }
}

async function main() {
  console.log('=== STARTING CURL ENDPOINT VERIFICATION ===');
  await mongoose.connect(process.env.MONGO_URI);

  // 1. Get Receptionist Token and Patient Token
  const recUser = await User.findOne({ email: 'receptionist@mediqueue.lk' });
  const patUser = await User.findOne({ email: 'patient.test@mediqueue.lk' });
  if (!recUser || !patUser) throw new Error('Missing seed users');

  // Obtain tokens via login endpoint
  const recLogin = JSON.parse(
    execSync(
      `curl.exe -s -X POST "${BASE_URL}/api/users/login" -H "Content-Type: application/json" -d "{\\"email\\":\\"receptionist@mediqueue.lk\\",\\"password\\":\\"password123\\"}"`,
      { encoding: 'utf-8' }
    )
  );
  const recToken = recLogin.token;

  const patLogin = JSON.parse(
    execSync(
      `curl.exe -s -X POST "${BASE_URL}/api/users/login" -H "Content-Type: application/json" -d "{\\"email\\":\\"patient.test@mediqueue.lk\\",\\"password\\":\\"password123\\"}"`,
      { encoding: 'utf-8' }
    )
  );
  const patToken = patLogin.token;

  console.log('✓ Successfully retrieved receptionist and patient JWT tokens.');

  // 2. Set up test data for today
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  // Clean previous verification records for today
  await Patient.deleteMany({ fullName: /^Curl Test/ });
  await Appointment.deleteMany({ notes: 'curl-verification' });
  await QueueToken.deleteMany({ date: today, tokenLabel: /^CURL-/ });
  await Shift.deleteMany({ receptionist: recUser._id, date: today });

  let doctor = await Doctor.findOne({ status: 'active' });
  if (!doctor) {
    doctor = await Doctor.create({
      name: 'Dr. Curl Tester',
      specialization: 'General',
      department: 'OPD',
      room: 'Room 101',
      status: 'active',
      dailyCapacity: 30,
    });
  }

  // Create Patient
  const patient = await Patient.create({
    fullName: 'Curl Test Patient',
    nic: '199200000001',
    phone: '0771234567',
    address: 'Original Address',
    district: 'Colombo',
    status: 'Active',
  });

  // Create an appointment and waiting queue token for today
  const apptWaiting = await Appointment.create({
    patient: patient._id,
    doctor: doctor._id,
    department: 'OPD',
    date: today,
    slotTime: '10:00',
    type: 'walk_in',
    status: 'checked_in',
    tokenNumber: 801,
    notes: 'curl-verification',
  });

  const tokWaiting = await QueueToken.create({
    appointment: apptWaiting._id,
    patient: patient._id,
    department: 'OPD',
    date: today,
    tokenNumber: 801,
    tokenLabel: 'CURL-801',
    status: 'waiting',
    priority: 'normal',
    assignedDoctor: doctor._id,
  });

  console.log('✓ Test data prepared for date:', today);

  // --------------------------------------------------------------------------
  // TEST 1: Dashboard numbers match the queue
  // --------------------------------------------------------------------------
  console.log('\n--- 1. Testing Dashboard Numbers Match Queue ---');
  const dashRes = runCurl(
    `curl.exe -i -s -X GET "${BASE_URL}/api/reception/dashboard" -H "Authorization: Bearer ${recToken}"`
  );
  console.log(dashRes.output);

  const queueRes = runCurl(
    `curl.exe -i -s -X GET "${BASE_URL}/api/reception/queue" -H "Authorization: Bearer ${recToken}"`
  );
  console.log(queueRes.output);

  const dashJson = JSON.parse(dashRes.output.slice(dashRes.output.indexOf('{')));
  const queueJson = JSON.parse(queueRes.output.slice(queueRes.output.indexOf('{')));

  console.log(`Dashboard inWaiting: ${dashJson.inWaiting}, Queue totals.inQueue: ${queueJson.totals.inQueue}`);
  if (dashJson.inWaiting !== queueJson.totals.inQueue) {
    throw new Error(`Mismatch between dashboard inWaiting (${dashJson.inWaiting}) and queue inQueue (${queueJson.totals.inQueue})`);
  }
  console.log('CONFIRMED: Dashboard inWaiting matches Queue inQueue count!');

  // --------------------------------------------------------------------------
  // TEST 2: Patient 404 on a bad ID
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Testing Patient 404 on a Bad ID ---');
  const badIdRes = runCurl(
    `curl.exe -i -s -X GET "${BASE_URL}/api/reception/patients/507f1f77bcf86cd799439011" -H "Authorization: Bearer ${recToken}"`
  );
  console.log(badIdRes.output);
  if (!badIdRes.output.includes('404')) {
    throw new Error('Expected 404 for non-existent patient ID');
  }

  const invalidIdRes = runCurl(
    `curl.exe -i -s -X GET "${BASE_URL}/api/reception/patients/invalid-patient-id" -H "Authorization: Bearer ${recToken}"`
  );
  console.log(invalidIdRes.output);
  if (!invalidIdRes.output.includes('404')) {
    throw new Error('Expected 404 for invalid ObjectId format');
  }
  console.log('CONFIRMED: Patient 404 returned on bad/non-existent ID!');

  // --------------------------------------------------------------------------
  // TEST 3: PATCH ignores disallowed fields
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Testing PATCH Ignores Disallowed Fields ---');
  const patchRes = runCurl(
    `curl.exe -i -s -X PATCH "${BASE_URL}/api/reception/patients/${patient._id}" -H "Authorization: Bearer ${recToken}" -H "Content-Type: application/json" -d "{\\"phone\\":\\"0779991122\\",\\"address\\":\\"Updated Valid Address\\",\\"fullName\\":\\"HACKED NAME\\",\\"nic\\":\\"999999999V\\",\\"status\\":\\"Inactive\\"}"`
  );
  console.log(patchRes.output);

  // Verify in database
  const updatedPt = await Patient.findById(patient._id).lean();
  console.log('Patient record after PATCH:', {
    fullName: updatedPt.fullName,
    nic: updatedPt.nic,
    phone: updatedPt.phone,
    address: updatedPt.address,
    status: updatedPt.status,
  });

  if (updatedPt.phone !== '0779991122' || updatedPt.address !== 'Updated Valid Address') {
    throw new Error('Allowed fields were not updated properly');
  }
  if (updatedPt.fullName === 'HACKED NAME' || updatedPt.nic === '999999999V' || updatedPt.status === 'Inactive') {
    throw new Error('Disallowed fields were unexpectedly modified!');
  }
  console.log('CONFIRMED: PATCH allowed phone/address update, but strictly ignored fullName, nic, and status!');

  // --------------------------------------------------------------------------
  // TEST 4: Closing the shift twice returns 409
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Testing Closing Shift Twice Returns 409 ---');
  const close1Res = runCurl(
    `curl.exe -i -s -X POST "${BASE_URL}/api/reception/shift/close" -H "Authorization: Bearer ${recToken}"`
  );
  console.log('First close response:\n' + close1Res.output);
  if (!close1Res.output.includes('200 OK') && !close1Res.output.includes('HTTP/1.1 200')) {
    throw new Error('Expected 200 OK on first shift close');
  }

  const close2Res = runCurl(
    `curl.exe -i -s -X POST "${BASE_URL}/api/reception/shift/close" -H "Authorization: Bearer ${recToken}"`
  );
  console.log('Second close response:\n' + close2Res.output);
  if (!close2Res.output.includes('409 Conflict') && !close2Res.output.includes('HTTP/1.1 409')) {
    throw new Error('Expected 409 Conflict on second shift close');
  }
  console.log('CONFIRMED: First shift close returns 200; closing again returns 409 Conflict!');

  // --------------------------------------------------------------------------
  // TEST 5: CSV downloads
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Testing CSV Downloads ---');
  const csvRes = runCurl(
    `curl.exe -i -s -X GET "${BASE_URL}/api/reception/reports/daily?format=csv" -H "Authorization: Bearer ${recToken}"`
  );
  console.log(csvRes.output);

  if (!csvRes.output.includes('Content-Type: text/csv') && !csvRes.output.includes('content-type: text/csv')) {
    throw new Error('Expected Content-Type: text/csv');
  }
  if (!csvRes.output.includes(`daily-report-${today}.csv`)) {
    throw new Error('Expected Content-Disposition header with daily-report-YYYY-MM-DD.csv');
  }
  if (!csvRes.output.includes('token,patient name,NIC,phone,doctor,department,type,status,slot time')) {
    throw new Error('Missing expected CSV header row');
  }
  console.log('CONFIRMED: CSV downloads with text/csv, correct filename Content-Disposition, and accurate headers/data!');

  // --------------------------------------------------------------------------
  // TEST 6: Patient-role token gets 403 on all reception endpoints
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Testing Patient-Role Token Gets 403 ---');
  const receptionEndpoints = [
    { method: 'GET', url: `${BASE_URL}/api/reception/dashboard` },
    { method: 'GET', url: `${BASE_URL}/api/reception/patients` },
    { method: 'GET', url: `${BASE_URL}/api/reception/doctors` },
    { method: 'GET', url: `${BASE_URL}/api/reception/shift/summary` },
    { method: 'POST', url: `${BASE_URL}/api/reception/shift/close` },
    { method: 'GET', url: `${BASE_URL}/api/reception/reports/daily?format=csv` },
  ];

  for (const ep of receptionEndpoints) {
    const res = runCurl(
      `curl.exe -i -s -X ${ep.method} "${ep.url}" -H "Authorization: Bearer ${patToken}"`
    );
    if (!res.output.includes('403 Forbidden') && !res.output.includes('HTTP/1.1 403')) {
      throw new Error(`Expected 403 for patient role on ${ep.method} ${ep.url}, got:\n${res.output}`);
    }
    console.log(`✓ 403 confirmed for patient on ${ep.method} ${ep.url}`);
  }
  console.log('CONFIRMED: Patient-role token receives 403 Forbidden on all reception endpoints!');

  // --------------------------------------------------------------------------
  // Additional Endpoint Smoke Checks
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Additional Endpoint Checks (Doctors & Patient Detail) ---');
  const docRes = runCurl(
    `curl.exe -i -s -X GET "${BASE_URL}/api/reception/doctors?department=OPD" -H "Authorization: Bearer ${recToken}"`
  );
  if (!docRes.output.includes('200 OK')) throw new Error('Expected 200 for doctors endpoint');
  console.log('✓ GET /api/reception/doctors?department=OPD returns 200 OK');

  const ptDetailRes = runCurl(
    `curl.exe -i -s -X GET "${BASE_URL}/api/reception/patients/${patient._id}" -H "Authorization: Bearer ${recToken}"`
  );
  if (!ptDetailRes.output.includes('200 OK')) throw new Error('Expected 200 for patient detail endpoint');
  console.log('✓ GET /api/reception/patients/:id returns 200 OK');

  // Clean up test data
  await Patient.deleteMany({ fullName: /^Curl Test/ });
  await Appointment.deleteMany({ notes: 'curl-verification' });
  await QueueToken.deleteMany({ date: today, tokenLabel: /^CURL-/ });
  await Shift.deleteMany({ receptionist: recUser._id, date: today });

  await mongoose.disconnect();
  console.log('\n=== ALL CURL VERIFICATIONS COMPLETED SUCCESSFULLY WITH ZERO ERRORS ===');
}

main().catch((err) => {
  console.error('\nFAIL:', err);
  process.exit(1);
});
