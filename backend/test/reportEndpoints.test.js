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

async function runReportTests() {
  console.log('--- STARTING REPORT ENDPOINT TESTS ---');
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
  const unauthRes = await fetch(`${BASE_URL}/api/reception/reports/daily?format=csv`);
  if (unauthRes.status !== 401) {
    throw new Error(`Expected 401 for unauthenticated GET /reports/daily, got ${unauthRes.status}`);
  }
  console.log('✓ Unauthenticated request to /reports/daily returns 401');

  const patAuthRes = await fetch(`${BASE_URL}/api/reception/reports/daily?format=csv`, {
    headers: { Authorization: `Bearer ${patToken}` },
  });
  if (patAuthRes.status !== 403) {
    throw new Error(`Expected 403 for patient role on /reports/daily, got ${patAuthRes.status}`);
  }
  console.log('✓ Patient role request to /reports/daily returns 403');

  // 3. Format validation checks (must be format=csv)
  const noFormatRes = await fetch(`${BASE_URL}/api/reception/reports/daily`, {
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (noFormatRes.status !== 400) {
    throw new Error(`Expected 400 when format is missing, got ${noFormatRes.status}`);
  }
  console.log('✓ Missing format parameter returns 400 Bad Request');

  const jsonFormatRes = await fetch(`${BASE_URL}/api/reception/reports/daily?format=json`, {
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (jsonFormatRes.status !== 400) {
    throw new Error(`Expected 400 for format=json, got ${jsonFormatRes.status}`);
  }
  console.log('✓ Non-csv format (format=json) returns 400 Bad Request');

  const pdfFormatRes = await fetch(`${BASE_URL}/api/reception/reports/daily?format=pdf`, {
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (pdfFormatRes.status !== 400) {
    throw new Error(`Expected 400 for format=pdf, got ${pdfFormatRes.status}`);
  }
  console.log('✓ Non-csv format (format=pdf) returns 400 Bad Request');

  // 4. Prepare test data for daily report
  const testDate = '2026-10-07';
  await QueueToken.deleteMany({ date: testDate });
  await Appointment.deleteMany({ date: testDate });
  await Doctor.deleteMany({ name: /^Dr\. ReportTest/ });
  await Patient.deleteMany({ fullName: /^PT ReportTest/ });

  // Doctor with comma in name to test CSV escaping
  const doc = await Doctor.create({
    name: 'Dr. ReportTest, MD',
    specialization: 'Physician',
    department: 'Outpatient, General',
    room: 'Room 701',
    status: 'active',
  });

  // Patient 1: normal
  const patient1 = await Patient.create({
    fullName: 'PT ReportTest One',
    nic: '198900000001',
    phone: '0777000001',
    status: 'Active',
  });

  // Patient 2: quotes in name
  const patient2 = await Patient.create({
    fullName: 'PT ReportTest "Junior"',
    nic: '198900000002',
    phone: '0777000002',
    status: 'Active',
  });

  // Appointment 1
  const appt1 = await Appointment.create({
    patient: patient1._id,
    doctor: doc._id,
    department: 'Outpatient, General',
    date: testDate,
    slotTime: '09:00',
    type: 'walk_in',
    status: 'completed',
    tokenNumber: 501,
    notes: 'report-test',
  });

  await QueueToken.create({
    appointment: appt1._id,
    patient: patient1._id,
    department: 'Outpatient, General',
    date: testDate,
    tokenNumber: 501,
    tokenLabel: 'REP-501',
    status: 'done',
    assignedDoctor: doc._id,
  });

  // Appointment 2
  const appt2 = await Appointment.create({
    patient: patient2._id,
    doctor: doc._id,
    department: 'Outpatient, General',
    date: testDate,
    slotTime: '09:30',
    type: 'pre_booked',
    status: 'checked_in',
    tokenNumber: 502,
    notes: 'report-test',
  });

  await QueueToken.create({
    appointment: appt2._id,
    patient: patient2._id,
    department: 'Outpatient, General',
    date: testDate,
    tokenNumber: 502,
    tokenLabel: 'REP-502',
    status: 'waiting',
    assignedDoctor: doc._id,
  });

  // 5. Call GET /api/reception/reports/daily?format=csv&date=...
  console.log('\n--- Testing GET /api/reception/reports/daily?format=csv ---');
  const csvRes = await fetch(`${BASE_URL}/api/reception/reports/daily?format=csv&date=${testDate}`, {
    headers: { Authorization: `Bearer ${recToken}` },
  });

  if (csvRes.status !== 200) {
    const errText = await csvRes.text();
    throw new Error(`Expected 200 for format=csv, got ${csvRes.status}: ${errText}`);
  }

  // Verify Content-Type
  const contentType = csvRes.headers.get('content-type');
  if (!contentType || !contentType.includes('text/csv')) {
    throw new Error(`Expected Content-Type to include text/csv, got: ${contentType}`);
  }
  console.log('✓ Content-Type is text/csv');

  // Verify Content-Disposition header
  const contentDisp = csvRes.headers.get('content-disposition');
  const expectedFilename = `daily-report-${testDate}.csv`;
  if (!contentDisp || !contentDisp.includes(expectedFilename)) {
    throw new Error(`Expected Content-Disposition to include filename "${expectedFilename}", got: ${contentDisp}`);
  }
  console.log(`✓ Content-Disposition filename is ${expectedFilename}`);

  // Verify CSV Body content
  const csvBody = await csvRes.text();
  console.log('CSV Output:\n' + csvBody);

  const lines = csvBody.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 3) {
    throw new Error(`Expected header + at least 2 rows, got ${lines.length} lines`);
  }

  // Header row check: token, patient name, NIC, phone, doctor, department, type, status, slot time
  const header = lines[0];
  const expectedHeader = 'token,patient name,NIC,phone,doctor,department,type,status,slot time';
  if (header !== expectedHeader) {
    throw new Error(`Header mismatch.\nExpected: ${expectedHeader}\nGot:      ${header}`);
  }
  console.log('✓ Header row matches exact columns: token, patient name, NIC, phone, doctor, department, type, status, slot time');

  // Row 1 checks (doctor and department have commas, so they should be wrapped in quotes)
  const row1 = lines[1];
  if (!row1.includes('REP-501')) {
    throw new Error(`Expected row 1 to contain token REP-501, got: ${row1}`);
  }
  if (!row1.includes('PT ReportTest One')) {
    throw new Error(`Expected row 1 to contain patient PT ReportTest One, got: ${row1}`);
  }
  if (!row1.includes('198900000001')) {
    throw new Error(`Expected row 1 to contain NIC 198900000001, got: ${row1}`);
  }
  if (!row1.includes('"Dr. ReportTest, MD"')) {
    throw new Error(`Expected escaped comma in doctor name "Dr. ReportTest, MD", got: ${row1}`);
  }
  if (!row1.includes('"Outpatient, General"')) {
    throw new Error(`Expected escaped comma in department "Outpatient, General", got: ${row1}`);
  }
  console.log('✓ Row 1 properly formatted and comma-containing fields are quoted');

  // Row 2 checks (patient has quotes in name: PT ReportTest "Junior" -> "PT ReportTest ""Junior""")
  const row2 = lines[2];
  if (!row2.includes('REP-502')) {
    throw new Error(`Expected row 2 to contain token REP-502, got: ${row2}`);
  }
  if (!row2.includes('"PT ReportTest ""Junior"""')) {
    throw new Error(`Expected escaped quotes in patient name "PT ReportTest ""Junior""", got: ${row2}`);
  }
  console.log('✓ Row 2 properly escapes double quotes by doubling them (""Junior"") and wrapping in quotes');

  // 6. Test case-insensitive format=CSV
  const upperCsvRes = await fetch(`${BASE_URL}/api/reception/reports/daily?format=CSV&date=${testDate}`, {
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (upperCsvRes.status !== 200) {
    throw new Error(`Expected 200 for uppercase format=CSV, got ${upperCsvRes.status}`);
  }
  console.log('✓ format=CSV case-insensitive accepted');

  // 7. Cleanup
  await QueueToken.deleteMany({ date: testDate });
  await Appointment.deleteMany({ date: testDate });
  await Doctor.deleteMany({ name: /^Dr\. ReportTest/ });
  await Patient.deleteMany({ fullName: /^PT ReportTest/ });

  await mongoose.disconnect();
  console.log('\n--- ALL REPORT ENDPOINT TESTS PASSED SUCCESSFULLY ---');
}

runReportTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
