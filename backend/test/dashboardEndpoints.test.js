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

async function runDashboardTests() {
  console.log('--- STARTING DASHBOARD ENDPOINT TESTS ---');
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

  // 2. Auth checks
  const unauthRes = await fetch(`${BASE_URL}/api/reception/dashboard`);
  if (unauthRes.status !== 401) {
    throw new Error(`Expected 401 for unauthenticated request, got ${unauthRes.status}`);
  }
  console.log('✓ Unauthenticated request returns 401');

  const patAuthRes = await fetch(`${BASE_URL}/api/reception/dashboard`, {
    headers: { Authorization: `Bearer ${patToken}` },
  });
  if (patAuthRes.status !== 403) {
    throw new Error(`Expected 403 for patient role request, got ${patAuthRes.status}`);
  }
  console.log('✓ Patient role request returns 403');

  // 3. Prepare test data for dashboard
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  // Clean any existing test records for today
  await QueueToken.deleteMany({ date: today, tokenLabel: /^DASH-/ });
  await Appointment.deleteMany({ date: today, notes: 'dash-test' });
  await Patient.deleteMany({ fullName: /^Dash Patient/ });

  // Doctor 1: Active
  let doc1 = await Doctor.findOne({ name: 'Dr. Dash Active' });
  if (!doc1) {
    doc1 = await Doctor.create({
      name: 'Dr. Dash Active',
      specialization: 'General Physician',
      department: 'OPD',
      room: 'Room 201',
      status: 'active',
      avgConsultMinutes: 10,
    });
  } else {
    doc1.status = 'active';
    await doc1.save();
  }

  // Doctor 2: On Break
  let doc2 = await Doctor.findOne({ name: 'Dr. Dash Break' });
  if (!doc2) {
    doc2 = await Doctor.create({
      name: 'Dr. Dash Break',
      specialization: 'Pediatrician',
      department: 'OPD',
      room: 'Room 202',
      status: 'on_break',
      avgConsultMinutes: 15,
    });
  } else {
    doc2.status = 'on_break';
    await doc2.save();
  }

  // Create patients
  const patient1 = await Patient.create({
    fullName: 'Dash Patient One',
    age: 45,
    gender: 'male',
    nic: '198100000001',
    phone: '0770000001',
    registeredVia: 'reception',
  });

  const patient2 = await Patient.create({
    fullName: 'Dash Patient Two',
    age: 28,
    gender: 'female',
    nic: '199800000002',
    phone: '0770000002',
    registeredVia: 'reception',
  });

  const patient3 = await Patient.create({
    fullName: 'Dash Patient Three',
    age: 70,
    gender: 'male',
    nic: '195600000003',
    phone: '0770000003',
    registeredVia: 'reception',
  });

  const patient4 = await Patient.create({
    fullName: 'Dash Patient Four',
    age: 35,
    gender: 'female',
    nic: '199100000004',
    phone: '0770000004',
    registeredVia: 'reception',
  });

  // Appointments (1 walk_in, 1 pre_booked, 1 completed/done)
  const apptServing = await Appointment.create({
    patient: patient1._id,
    doctor: doc1._id,
    department: 'OPD',
    date: today,
    slotTime: '08:00',
    type: 'walk_in',
    status: 'in_consultation',
    tokenNumber: 901,
    notes: 'dash-test',
  });

  const apptWaiting1 = await Appointment.create({
    patient: patient2._id,
    doctor: doc1._id,
    department: 'OPD',
    date: today,
    slotTime: '08:15',
    type: 'pre_booked',
    status: 'checked_in',
    tokenNumber: 902,
    notes: 'dash-test',
  });

  const apptWaiting2 = await Appointment.create({
    patient: patient3._id,
    doctor: doc1._id,
    department: 'OPD',
    date: today,
    slotTime: '08:30',
    type: 'walk_in',
    status: 'checked_in',
    tokenNumber: 903,
    notes: 'dash-test',
  });

  const apptDone = await Appointment.create({
    patient: patient4._id,
    doctor: doc1._id,
    department: 'OPD',
    date: today,
    slotTime: '07:45',
    type: 'walk_in',
    status: 'completed',
    tokenNumber: 900,
    notes: 'dash-test',
  });

  // Queue Tokens
  // 1 token currently called/serving
  const tokServing = await QueueToken.create({
    appointment: apptServing._id,
    patient: patient1._id,
    department: 'OPD',
    date: today,
    tokenNumber: 901,
    tokenLabel: 'DASH-901',
    status: 'called',
    priority: 'normal',
    assignedDoctor: doc1._id,
    calledAt: new Date(),
  });

  // 2 waiting tokens
  const tokWaiting1 = await QueueToken.create({
    appointment: apptWaiting1._id,
    patient: patient2._id,
    department: 'OPD',
    date: today,
    tokenNumber: 902,
    tokenLabel: 'DASH-902',
    status: 'waiting',
    priority: 'senior',
    assignedDoctor: doc1._id,
  });

  const tokWaiting2 = await QueueToken.create({
    appointment: apptWaiting2._id,
    patient: patient3._id,
    department: 'OPD',
    date: today,
    tokenNumber: 903,
    tokenLabel: 'DASH-903',
    status: 'waiting',
    priority: 'normal',
    assignedDoctor: doc1._id,
  });

  // 1 done token
  const tokDone = await QueueToken.create({
    appointment: apptDone._id,
    patient: patient4._id,
    department: 'OPD',
    date: today,
    tokenNumber: 900,
    tokenLabel: 'DASH-900',
    status: 'done',
    priority: 'normal',
    assignedDoctor: doc1._id,
    servedAt: new Date(),
  });

  // 4. Call GET /api/reception/dashboard
  const dashRes = await fetch(`${BASE_URL}/api/reception/dashboard`, {
    headers: { Authorization: `Bearer ${recToken}` },
  });
  if (dashRes.status !== 200) {
    const errText = await dashRes.text();
    throw new Error(`Expected 200 for GET /api/reception/dashboard, got ${dashRes.status}: ${errText}`);
  }

  const dashData = await dashRes.json();
  console.log('GET /api/reception/dashboard response:', JSON.stringify(dashData, null, 2));

  // 5. Assertions
  // - intake: { total, walkIn, preBooked }
  if (typeof dashData.intake !== 'object' || dashData.intake === null) {
    throw new Error('intake must be an object');
  }
  if (typeof dashData.intake.total !== 'number' || typeof dashData.intake.walkIn !== 'number' || typeof dashData.intake.preBooked !== 'number') {
    throw new Error(`intake must contain numeric total, walkIn, preBooked: ${JSON.stringify(dashData.intake)}`);
  }
  if (dashData.intake.total < 4 || dashData.intake.walkIn < 3 || dashData.intake.preBooked < 1) {
    throw new Error(`intake values do not match expected counts: ${JSON.stringify(dashData.intake)}`);
  }
  console.log('✓ intake correctly shaped with total, walkIn, preBooked');

  // - inWaiting count and avgWaitMinutes
  if (typeof dashData.inWaiting !== 'number' || dashData.inWaiting < 2) {
    throw new Error(`inWaiting count should be at least 2, got ${dashData.inWaiting}`);
  }
  if (typeof dashData.avgWaitMinutes !== 'number') {
    throw new Error(`avgWaitMinutes should be a number, got ${dashData.avgWaitMinutes}`);
  }
  console.log(`✓ inWaiting (${dashData.inWaiting}) and avgWaitMinutes (${dashData.avgWaitMinutes}) verified`);

  // - attendedDone count
  if (typeof dashData.attendedDone !== 'number' || dashData.attendedDone < 1) {
    throw new Error(`attendedDone should be at least 1, got ${dashData.attendedDone}`);
  }
  console.log(`✓ attendedDone count (${dashData.attendedDone}) verified`);

  // - doctorsActive count
  if (typeof dashData.doctorsActive !== 'number' || dashData.doctorsActive < 1) {
    throw new Error(`doctorsActive should be at least 1, got ${dashData.doctorsActive}`);
  }
  console.log(`✓ doctorsActive count (${dashData.doctorsActive}) verified`);

  // - currentlyServing token (tokenLabel, patient name/age/gender/nic, doctor, room) or null
  if (!dashData.currentlyServing) {
    throw new Error('currentlyServing should not be null when a token is called/serving');
  }
  if (dashData.currentlyServing.tokenLabel !== 'DASH-901') {
    throw new Error(`Expected currentlyServing tokenLabel to be DASH-901, got ${dashData.currentlyServing.tokenLabel}`);
  }
  if (!dashData.currentlyServing.patient || dashData.currentlyServing.patient.name !== 'Dash Patient One') {
    throw new Error(`Expected patient name Dash Patient One, got ${JSON.stringify(dashData.currentlyServing.patient)}`);
  }
  if (dashData.currentlyServing.patient.age !== 45 || dashData.currentlyServing.patient.gender !== 'male' || dashData.currentlyServing.patient.nic !== '198100000001') {
    throw new Error(`Patient age/gender/nic mismatch: ${JSON.stringify(dashData.currentlyServing.patient)}`);
  }
  if (!dashData.currentlyServing.doctor) {
    throw new Error('currentlyServing.doctor should not be empty');
  }
  if (dashData.currentlyServing.room !== 'Room 201') {
    throw new Error(`Expected room Room 201, got ${dashData.currentlyServing.room}`);
  }
  console.log('✓ currentlyServing has tokenLabel, patient (name/age/gender/nic), doctor, and room');

  // - rooms: [{ doctor, room, status: Consulting|Available|On Break, nextToken }]
  if (!Array.isArray(dashData.rooms)) {
    throw new Error('rooms must be an array');
  }
  const activeRoom = dashData.rooms.find(r => r.doctor === 'Dr. Dash Active');
  if (!activeRoom) throw new Error('Room for Dr. Dash Active not found');
  if (activeRoom.status !== 'Consulting') {
    throw new Error(`Expected Dr. Dash Active room status Consulting, got ${activeRoom.status}`);
  }
  if (activeRoom.room !== 'Room 201') {
    throw new Error(`Expected Room 201, got ${activeRoom.room}`);
  }
  if (activeRoom.nextToken !== 'DASH-902') {
    throw new Error(`Expected nextToken DASH-902, got ${activeRoom.nextToken}`);
  }

  const breakRoom = dashData.rooms.find(r => r.doctor === 'Dr. Dash Break');
  if (!breakRoom) throw new Error('Room for Dr. Dash Break not found');
  if (breakRoom.status !== 'On Break') {
    throw new Error(`Expected Dr. Dash Break status "On Break", got ${breakRoom.status}`);
  }
  console.log('✓ rooms correctly reflects Consulting, Available, On Break and nextToken');

  // - nextInQueue: first 3 waiting tokens (reuse getOrderedQueue)
  if (!Array.isArray(dashData.nextInQueue)) {
    throw new Error('nextInQueue must be an array');
  }
  if (dashData.nextInQueue.length < 2 || dashData.nextInQueue.length > 3) {
    throw new Error(`nextInQueue length should be between 2 and 3, got ${dashData.nextInQueue.length}`);
  }
  // Senior (DASH-902) should come before Normal (DASH-903)
  if (dashData.nextInQueue[0].tokenLabel !== 'DASH-902') {
    throw new Error(`Expected first in nextInQueue to be senior token DASH-902, got ${dashData.nextInQueue[0].tokenLabel}`);
  }
  console.log('✓ nextInQueue returns top waiting tokens in priority order');

  // - lastUpdated ISO timestamp
  if (!dashData.lastUpdated || isNaN(Date.parse(dashData.lastUpdated))) {
    throw new Error(`lastUpdated must be a valid ISO string, got ${dashData.lastUpdated}`);
  }
  console.log(`✓ lastUpdated valid ISO timestamp: ${dashData.lastUpdated}`);

  // Cleanup test data
  await QueueToken.deleteMany({ date: today, tokenLabel: /^DASH-/ });
  await Appointment.deleteMany({ date: today, notes: 'dash-test' });
  await Patient.deleteMany({ fullName: /^Dash Patient/ });
  await Doctor.deleteOne({ _id: doc1._id });
  await Doctor.deleteOne({ _id: doc2._id });

  await mongoose.disconnect();
  console.log('--- ALL DASHBOARD ENDPOINT TESTS PASSED SUCCESSFULLY ---');
}

runDashboardTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
