const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');

const BASE_URL = 'http://localhost:5001';

async function runDoctorTests() {
  console.log('--- STARTING DOCTOR ENDPOINT TESTS ---');
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
  const unauthRes = await fetch(`${BASE_URL}/api/reception/doctors`);
  if (unauthRes.status !== 401) {
    throw new Error(`Expected 401 for unauthenticated GET /doctors, got ${unauthRes.status}`);
  }
  console.log('✓ Unauthenticated request to /doctors returns 401');

  const patAuthRes = await fetch(`${BASE_URL}/api/reception/doctors`, {
    headers: { Authorization: `Bearer ${patToken}` },
  });
  if (patAuthRes.status !== 403) {
    throw new Error(`Expected 403 for patient role on /doctors, got ${patAuthRes.status}`);
  }
  console.log('✓ Patient role request to /doctors returns 403');

  // 3. Prepare test doctors, patients and appointments
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(yesterdayDate);

  // Clean test records
  await Doctor.deleteMany({ name: /^Dr\. DocTest/ });
  await Patient.deleteMany({ fullName: /^PT DocTest/ });
  await Appointment.deleteMany({ notes: 'doctor-test-suite' });

  // Doctor 1: Department Cardiology
  const docCardio = await Doctor.create({
    name: 'Dr. DocTest Cardio',
    specialization: 'Cardiologist',
    department: 'Cardiology',
    room: 'Room 501',
    status: 'active',
    dailyCapacity: 25,
    avgConsultMinutes: 15,
  });

  // Doctor 2: Department Dermatology
  const docDerma = await Doctor.create({
    name: 'Dr. DocTest Derma',
    specialization: 'Dermatologist',
    department: 'Dermatology',
    room: 'Room 502',
    status: 'on_break',
    dailyCapacity: 20,
    avgConsultMinutes: 12,
  });

  // Patients
  const pt1 = await Patient.create({
    fullName: 'PT DocTest 1',
    phone: '0775551111',
    nic: '198811111111',
    status: 'Active',
  });
  const pt2 = await Patient.create({
    fullName: 'PT DocTest 2',
    phone: '0775552222',
    nic: '198822222222',
    status: 'Active',
  });
  const pt3 = await Patient.create({
    fullName: 'PT DocTest 3',
    phone: '0775553333',
    nic: '198833333333',
    status: 'Active',
  });

  // Appointments for docCardio:
  // - 2 active today (checked_in, in_consultation)
  // - 1 completed today (NOT active)
  // - 1 cancelled today (NOT active)
  // - 1 active yesterday (NOT today)
  await Appointment.create({
    patient: pt1._id,
    doctor: docCardio._id,
    department: 'Cardiology',
    date: today,
    slotTime: '09:00',
    type: 'walk_in',
    status: 'checked_in',
    tokenNumber: 1,
    notes: 'doctor-test-suite',
  });
  await Appointment.create({
    patient: pt2._id,
    doctor: docCardio._id,
    department: 'Cardiology',
    date: today,
    slotTime: '09:30',
    type: 'pre_booked',
    status: 'in_consultation',
    tokenNumber: 2,
    notes: 'doctor-test-suite',
  });
  await Appointment.create({
    patient: pt3._id,
    doctor: docCardio._id,
    department: 'Cardiology',
    date: today,
    slotTime: '10:00',
    type: 'walk_in',
    status: 'completed',
    tokenNumber: 3,
    notes: 'doctor-test-suite',
  });
  await Appointment.create({
    patient: pt1._id,
    doctor: docCardio._id,
    department: 'Cardiology',
    date: today,
    slotTime: '10:30',
    type: 'walk_in',
    status: 'cancelled',
    tokenNumber: 4,
    notes: 'doctor-test-suite',
  });
  await Appointment.create({
    patient: pt2._id,
    doctor: docCardio._id,
    department: 'Cardiology',
    date: yesterday,
    slotTime: '09:00',
    type: 'walk_in',
    status: 'checked_in',
    tokenNumber: 5,
    notes: 'doctor-test-suite',
  });

  // docDerma has 0 appointments today

  // 4. Test GET /api/reception/doctors without filter
  console.log('\n--- Testing GET /api/reception/doctors ---');
  const allRes = await fetch(`${BASE_URL}/api/reception/doctors`, {
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (allRes.status !== 200) {
    const errText = await allRes.text();
    throw new Error(`Expected 200 for GET /doctors, got ${allRes.status}: ${errText}`);
  }
  const allDoctors = await allRes.json();
  if (!Array.isArray(allDoctors)) {
    throw new Error(`Expected array of doctors, got ${typeof allDoctors}`);
  }

  // Find test doctors
  const cardioInList = allDoctors.find((d) => d._id.toString() === docCardio._id.toString());
  const dermaInList = allDoctors.find((d) => d._id.toString() === docDerma._id.toString());

  if (!cardioInList) throw new Error('Dr. DocTest Cardio not found in /doctors response');
  if (!dermaInList) throw new Error('Dr. DocTest Derma not found in /doctors response');

  // Verify all required fields
  const requiredFields = ['name', 'specialization', 'department', 'room', 'status', 'dailyCapacity', 'todayPatients'];
  for (const field of requiredFields) {
    if (cardioInList[field] === undefined) {
      throw new Error(`Doctor missing required field: ${field}`);
    }
  }

  if (cardioInList.name !== 'Dr. DocTest Cardio') throw new Error(`name mismatch: ${cardioInList.name}`);
  if (cardioInList.specialization !== 'Cardiologist') throw new Error(`specialization mismatch: ${cardioInList.specialization}`);
  if (cardioInList.department !== 'Cardiology') throw new Error(`department mismatch: ${cardioInList.department}`);
  if (cardioInList.room !== 'Room 501') throw new Error(`room mismatch: ${cardioInList.room}`);
  if (cardioInList.status !== 'active') throw new Error(`status mismatch: ${cardioInList.status}`);
  if (cardioInList.dailyCapacity !== 25) throw new Error(`dailyCapacity mismatch: ${cardioInList.dailyCapacity}`);
  if (cardioInList.todayPatients !== 2) {
    throw new Error(`Expected todayPatients=2 for Cardio (checked_in + in_consultation), got ${cardioInList.todayPatients}`);
  }

  if (dermaInList.todayPatients !== 0) {
    throw new Error(`Expected todayPatients=0 for Derma, got ${dermaInList.todayPatients}`);
  }
  console.log('✓ GET /doctors returns each doctor with name, specialization, department, room, status, dailyCapacity, and accurate todayPatients count');

  // 5. Test department filter: ?department=Cardiology
  console.log('\n--- Testing GET /api/reception/doctors?department=Cardiology ---');
  const cardioFilterRes = await fetch(`${BASE_URL}/api/reception/doctors?department=Cardiology`, {
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (cardioFilterRes.status !== 200) {
    throw new Error(`Expected 200 for ?department=Cardiology, got ${cardioFilterRes.status}`);
  }
  const cardioList = await cardioFilterRes.json();
  const hasCardio = cardioList.some((d) => d._id.toString() === docCardio._id.toString());
  const hasDerma = cardioList.some((d) => d._id.toString() === docDerma._id.toString());

  if (!hasCardio) throw new Error('Expected Cardio doctor in filtered results');
  if (hasDerma) throw new Error('Derma doctor should NOT be in Cardiology results');
  for (const doc of cardioList) {
    if (doc.department.toLowerCase() !== 'cardiology') {
      throw new Error(`Unexpected non-cardiology doctor in filtered results: ${doc.department}`);
    }
  }
  console.log('✓ Filter ?department=Cardiology returns only Cardiology doctors');

  // 6. Test case-insensitive department filter: ?department=dermatology
  console.log('\n--- Testing GET /api/reception/doctors?department=dermatology ---');
  const dermaFilterRes = await fetch(`${BASE_URL}/api/reception/doctors?department=dermatology`, {
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (dermaFilterRes.status !== 200) {
    throw new Error(`Expected 200 for ?department=dermatology, got ${dermaFilterRes.status}`);
  }
  const dermaList = await dermaFilterRes.json();
  const hasDermaLower = dermaList.some((d) => d._id.toString() === docDerma._id.toString());
  if (!hasDermaLower) throw new Error('Expected Derma doctor in case-insensitive department query');
  console.log('✓ Case-insensitive department query matches properly');

  // 7. Test non-existent department returns empty array
  console.log('\n--- Testing GET /api/reception/doctors?department=NonExistentDept ---');
  const emptyFilterRes = await fetch(`${BASE_URL}/api/reception/doctors?department=NonExistentDept`, {
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (emptyFilterRes.status !== 200) throw new Error(`Expected 200, got ${emptyFilterRes.status}`);
  const emptyList = await emptyFilterRes.json();
  if (!Array.isArray(emptyList) || emptyList.length !== 0) {
    throw new Error(`Expected empty array for non-existent department, got length ${emptyList.length}`);
  }
  console.log('✓ Non-existent department returns empty array');

  // 8. Cleanup test data
  await Doctor.deleteMany({ name: /^Dr\. DocTest/ });
  await Patient.deleteMany({ fullName: /^PT DocTest/ });
  await Appointment.deleteMany({ notes: 'doctor-test-suite' });

  await mongoose.disconnect();
  console.log('\n--- ALL DOCTOR ENDPOINT TESTS PASSED SUCCESSFULLY ---');
}

runDoctorTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
