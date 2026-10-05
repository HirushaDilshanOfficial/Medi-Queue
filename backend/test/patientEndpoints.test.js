const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');

const BASE_URL = 'http://localhost:5001';

async function runPatientTests() {
  console.log('--- STARTING PATIENT ENDPOINT TESTS ---');
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
  const unauthRes = await fetch(`${BASE_URL}/api/reception/patients`);
  if (unauthRes.status !== 401) {
    throw new Error(`Expected 401 for unauthenticated GET /patients, got ${unauthRes.status}`);
  }
  console.log('✓ Unauthenticated request to /patients returns 401');

  const patAuthRes = await fetch(`${BASE_URL}/api/reception/patients`, {
    headers: { Authorization: `Bearer ${patToken}` },
  });
  if (patAuthRes.status !== 403) {
    throw new Error(`Expected 403 for patient role on /patients, got ${patAuthRes.status}`);
  }
  console.log('✓ Patient role request to /patients returns 403');

  // 3. Prepare test doctors and patients
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const d10DaysAgo = new Date();
  d10DaysAgo.setDate(d10DaysAgo.getDate() - 10);
  const tenDaysAgo = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d10DaysAgo);

  const d45DaysAgo = new Date();
  d45DaysAgo.setDate(d45DaysAgo.getDate() - 45);
  const fortyFiveDaysAgo = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d45DaysAgo);

  // Clean test patients and appointments
  await Patient.deleteMany({ fullName: /^PT Test/ });
  await Appointment.deleteMany({ notes: 'patient-test-suite' });

  // Doctor
  let doc = await Doctor.findOne({ name: 'Dr. Test PatientDoc' });
  if (!doc) {
    doc = await Doctor.create({
      name: 'Dr. Test PatientDoc',
      specialization: 'General Practice',
      department: 'OPD',
      room: 'Room 303',
      status: 'active',
      avgConsultMinutes: 10,
    });
  }

  // Patient 1: Visited Today
  const patientToday = await Patient.create({
    fullName: 'PT Test Today',
    nic: '199011111111',
    phone: '0771111111',
    age: 36,
    gender: 'male',
    address: 'Colombo 03',
    registeredVia: 'reception',
    status: 'Active',
  });

  // Patient 2: Visited 10 days ago (Recent)
  const patientRecent = await Patient.create({
    fullName: 'PT Test Recent',
    nic: '199022222222',
    phone: '0772222222',
    age: 26,
    gender: 'female',
    address: 'Kandy',
    registeredVia: 'reception',
    status: 'Active',
  });

  // Patient 3: Visited 45 days ago (Old, not recent)
  const patientOld = await Patient.create({
    fullName: 'PT Test Old',
    nic: '199033333333',
    phone: '0773333333',
    age: 50,
    gender: 'male',
    address: 'Galle',
    registeredVia: 'reception',
    status: 'Active',
  });

  // Appointments
  // PatientToday appointment today
  const apptToday = await Appointment.create({
    patient: patientToday._id,
    doctor: doc._id,
    department: 'OPD',
    date: today,
    slotTime: '09:00',
    type: 'walk_in',
    status: 'completed',
    tokenNumber: 101,
    notes: 'patient-test-suite',
  });

  // PatientRecent appointment 10 days ago
  const apptRecent = await Appointment.create({
    patient: patientRecent._id,
    doctor: doc._id,
    department: 'OPD',
    date: tenDaysAgo,
    slotTime: '10:00',
    type: 'pre_booked',
    status: 'completed',
    tokenNumber: 102,
    notes: 'patient-test-suite',
  });

  // PatientOld appointment 45 days ago
  const apptOld = await Appointment.create({
    patient: patientOld._id,
    doctor: doc._id,
    department: 'OPD',
    date: fortyFiveDaysAgo,
    slotTime: '11:00',
    type: 'pre_booked',
    status: 'completed',
    tokenNumber: 103,
    notes: 'patient-test-suite',
  });

  // PatientToday second appointment (check history order)
  const apptTodayOlder = await Appointment.create({
    patient: patientToday._id,
    doctor: doc._id,
    department: 'OPD',
    date: tenDaysAgo,
    slotTime: '08:30',
    type: 'walk_in',
    status: 'completed',
    tokenNumber: 99,
    notes: 'patient-test-suite',
  });

  // 4. Test: /patients/search works and is NOT intercepted by /:id
  console.log('\n--- Testing /patients/search ---');
  const searchRes = await fetch(`${BASE_URL}/api/reception/patients/search?q=199011111111`, {
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (searchRes.status !== 200) {
    const txt = await searchRes.text();
    throw new Error(`Expected 200 for /patients/search, got ${searchRes.status}: ${txt}`);
  }
  const searchData = await searchRes.json();
  if (!searchData.found || !Array.isArray(searchData.patients)) {
    throw new Error(`/patients/search response unexpected: ${JSON.stringify(searchData)}`);
  }
  const foundPt = searchData.patients.find((p) => p.nic === '199011111111');
  if (!foundPt || foundPt.fullName !== 'PT Test Today') {
    throw new Error(`Expected PT Test Today in search results, got: ${JSON.stringify(searchData)}`);
  }
  console.log('✓ /patients/search works and precedes /patients/:id successfully');

  // 5. Test: GET /patients?filter=visited_today
  console.log('\n--- Testing GET /patients?filter=visited_today ---');
  const todayRes = await fetch(`${BASE_URL}/api/reception/patients?filter=visited_today`, {
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (todayRes.status !== 200) {
    throw new Error(`Expected 200 for filter=visited_today, got ${todayRes.status}`);
  }
  const todayList = await todayRes.json();
  if (!Array.isArray(todayList)) {
    throw new Error(`Expected array for filter=visited_today, got ${typeof todayList}`);
  }
  const hasTodayPt = todayList.some((p) => p._id.toString() === patientToday._id.toString());
  const hasRecentPt = todayList.some((p) => p._id.toString() === patientRecent._id.toString());
  const hasOldPt = todayList.some((p) => p._id.toString() === patientOld._id.toString());

  if (!hasTodayPt) {
    throw new Error('filter=visited_today must include patient who visited today');
  }
  if (hasRecentPt || hasOldPt) {
    throw new Error('filter=visited_today must NOT include patients who only visited in the past');
  }
  console.log(`✓ filter=visited_today returns ${todayList.length} patient(s) correctly`);

  // 6. Test: GET /patients?filter=recent
  console.log('\n--- Testing GET /patients?filter=recent ---');
  const recentRes = await fetch(`${BASE_URL}/api/reception/patients?filter=recent`, {
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (recentRes.status !== 200) {
    throw new Error(`Expected 200 for filter=recent, got ${recentRes.status}`);
  }
  const recentList = await recentRes.json();
  if (!Array.isArray(recentList)) {
    throw new Error(`Expected array for filter=recent, got ${typeof recentList}`);
  }
  const recentHasToday = recentList.some((p) => p._id.toString() === patientToday._id.toString());
  const recentHas10Days = recentList.some((p) => p._id.toString() === patientRecent._id.toString());
  const recentHas45Days = recentList.some((p) => p._id.toString() === patientOld._id.toString());

  if (!recentHasToday) {
    throw new Error('filter=recent must include patient who visited today');
  }
  if (!recentHas10Days) {
    throw new Error('filter=recent must include patient who visited 10 days ago (< 30 days)');
  }
  if (recentHas45Days) {
    throw new Error('filter=recent must NOT include patient who visited 45 days ago (> 30 days)');
  }
  console.log(`✓ filter=recent returns patients within 30 days, excludes older visits`);

  // 7. Test: GET /patients?filter=all & default filter
  console.log('\n--- Testing GET /patients?filter=all & default ---');
  const allRes = await fetch(`${BASE_URL}/api/reception/patients?filter=all`, {
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (allRes.status !== 200) throw new Error(`Expected 200 for filter=all, got ${allRes.status}`);
  const allList = await allRes.json();
  if (!Array.isArray(allList) || allList.length === 0 || allList.length > 20) {
    throw new Error(`filter=all must return array with max 20 results, got length ${allList.length}`);
  }

  const defRes = await fetch(`${BASE_URL}/api/reception/patients`, {
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (defRes.status !== 200) throw new Error(`Expected 200 for default GET /patients, got ${defRes.status}`);
  const defList = await defRes.json();
  if (!Array.isArray(defList) || defList.length === 0 || defList.length > 20) {
    throw new Error(`default GET /patients must return array with max 20 results, got length ${defList.length}`);
  }
  console.log(`✓ filter=all and default /patients both return max 20 results, newest first`);

  // 8. Test: Invalid filter returns 400
  console.log('\n--- Testing GET /patients?filter=invalid ---');
  const invRes = await fetch(`${BASE_URL}/api/reception/patients?filter=unknown_filter`, {
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (invRes.status !== 400) {
    throw new Error(`Expected 400 for invalid filter, got ${invRes.status}`);
  }
  console.log('✓ Invalid filter returns 400 Bad Request');

  // 9. Test: GET /patients/:id (profile + visit history)
  console.log('\n--- Testing GET /patients/:id ---');
  const detailRes = await fetch(`${BASE_URL}/api/reception/patients/${patientToday._id}`, {
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (detailRes.status !== 200) {
    throw new Error(`Expected 200 for GET /patients/:id, got ${detailRes.status}`);
  }
  const detailData = await detailRes.json();

  // Profile fields check
  if (detailData.fullName !== 'PT Test Today' || detailData.nic !== '199011111111') {
    throw new Error(`Profile fields mismatch: ${JSON.stringify(detailData)}`);
  }
  if (detailData.phone !== '0771111111' || detailData.age !== 36 || detailData.gender !== 'male') {
    throw new Error(`Profile details mismatch: ${JSON.stringify(detailData)}`);
  }

  // Visit history check
  const history = detailData.visitHistory || detailData.visits;
  if (!Array.isArray(history) || history.length < 2) {
    throw new Error(`Expected visitHistory array with at least 2 visits, got ${JSON.stringify(history)}`);
  }

  // Verify newest first: today comes before 10 days ago
  if (history[0].date !== today || history[1].date !== tenDaysAgo) {
    throw new Error(`Expected visits ordered newest first (today then 10 days ago), got: ${JSON.stringify(history.map(h => h.date))}`);
  }

  // Check required visit fields: doctor name, department, date, status, notes
  for (const visit of history) {
    if (!visit.doctor && !visit.doctorName) {
      throw new Error(`Visit missing doctor name: ${JSON.stringify(visit)}`);
    }
    if (visit.doctor !== 'Dr. Test PatientDoc' && visit.doctorName !== 'Dr. Test PatientDoc') {
      throw new Error(`Doctor name expected Dr. Test PatientDoc, got: ${visit.doctor || visit.doctorName}`);
    }
    if (!visit.department || visit.department !== 'OPD') {
      throw new Error(`Visit missing or wrong department: ${JSON.stringify(visit)}`);
    }
    if (!visit.date) {
      throw new Error(`Visit missing date: ${JSON.stringify(visit)}`);
    }
    if (!visit.status) {
      throw new Error(`Visit missing status: ${JSON.stringify(visit)}`);
    }
    if (visit.notes === undefined) {
      throw new Error(`Visit missing notes: ${JSON.stringify(visit)}`);
    }
  }
  console.log('✓ GET /patients/:id returns full profile and visit history (newest first with doctor, department, date, status, notes)');

  // 10. Test: GET /patients/:id returns 404 if not found
  console.log('\n--- Testing GET /patients/:id 404 ---');
  const fakeId = new mongoose.Types.ObjectId();
  const notFoundRes = await fetch(`${BASE_URL}/api/reception/patients/${fakeId}`, {
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (notFoundRes.status !== 404) {
    throw new Error(`Expected 404 for non-existent patient ID, got ${notFoundRes.status}`);
  }

  const invalidIdRes = await fetch(`${BASE_URL}/api/reception/patients/invalid-object-id`, {
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (invalidIdRes.status !== 404) {
    throw new Error(`Expected 404 for invalid ObjectId, got ${invalidIdRes.status}`);
  }
  console.log('✓ Non-existent or invalid patient ID returns 404');

  // 11. Cleanup test data
  await Patient.deleteMany({ fullName: /^PT Test/ });
  await Appointment.deleteMany({ notes: 'patient-test-suite' });
  await Doctor.deleteOne({ _id: doc._id });

  await mongoose.disconnect();
  console.log('\n--- ALL PATIENT ENDPOINT TESTS PASSED SUCCESSFULLY ---');
}

runPatientTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
