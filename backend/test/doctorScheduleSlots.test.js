const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const QueueToken = require('../models/QueueToken');
const DoctorSchedule = require('../models/DoctorSchedule');
const OpdAppointment = require('../models/OpdAppointment');
const Counter = require('../models/Counter');
const walkInRoutes = require('../routes/walkInRoutes');
const { errorHandler } = require('../utils/errorHandler');

const receptionistId = new mongoose.Types.ObjectId().toString();
const doctorId = new mongoose.Types.ObjectId().toString();
const patientId = new mongoose.Types.ObjectId().toString();

const users = {
  [receptionistId]: { _id: receptionistId, role: 'receptionist', name: 'Desk Staff' },
};

const doctorData = {
  _id: doctorId,
  name: 'Dr. Aruna Perera',
  room: 'Room 3B',
  department: 'Orthopedic',
  status: 'active',
  workingHours: { start: '08:00', end: '16:30' },
};

const patientData = {
  _id: patientId,
  fullName: 'Kasun Mendis',
  nic: '199418201234',
  phone: '0771234561',
  age: 32,
  gender: 'male',
};

let mockSchedule = null;
let mockAppointments = [];

async function buildTestApp(t) {
  t.mock.method(User, 'findById', (id) => ({
    select: async () => users[String(id)] || null,
  }));

  t.mock.method(Doctor, 'findById', (id) => {
    if (String(id) === String(doctorId)) {
      return {
        ...doctorData,
        avgConsultMinutes: 10,
        select: () => ({ lean: async () => ({ avgConsultMinutes: 10 }) }),
        lean: async () => ({ ...doctorData }),
      };
    }
    return {
      select: () => ({ lean: async () => null }),
      lean: async () => null,
    };
  });

  t.mock.method(DoctorSchedule, 'findOne', () => ({
    lean: async () => mockSchedule,
  }));

  t.mock.method(Appointment, 'find', () => ({
    select: () => ({
      lean: async () => mockAppointments,
    }),
  }));

  t.mock.method(OpdAppointment, 'find', () => ({
    select: () => ({
      lean: async () => [],
    }),
  }));

  t.mock.method(Counter, 'findOneAndUpdate', async () => ({
    seq: 1,
  }));

  t.mock.method(Appointment, 'findOne', () => ({
    lean: async () => null,
  }));

  t.mock.method(OpdAppointment, 'findOne', () => ({
    lean: async () => null,
  }));

  t.mock.method(QueueToken, 'countDocuments', async () => 0);

  const tokenGenerator = require('../utils/tokenGenerator');
  t.mock.method(tokenGenerator, 'getNextToken', async () => ({
    tokenNumber: 1,
    tokenLabel: 'OPD-001',
  }));

  const waitTimeService = require('../services/waitTimeService');
  t.mock.method(waitTimeService, 'estimateWaitMinutes', async () => ({
    patientsAhead: 0,
    estimatedWaitMinutes: 0,
  }));

  const notifier = require('../utils/notifier');
  t.mock.method(notifier, 'sendPatientRegistrationSms', async () => true);

  t.mock.method(Patient, 'findById', async () => patientData);
  t.mock.method(Patient, 'findOne', async () => patientData);

  t.mock.method(Appointment, 'create', async (data) => {
    const item = Array.isArray(data) ? data[0] : data;
    return {
      _id: new mongoose.Types.ObjectId().toString(),
      ...item,
      save: async function () { return this; },
    };
  });

  t.mock.method(QueueToken, 'create', async (data) => {
    const item = Array.isArray(data) ? data[0] : data;
    return {
      _id: new mongoose.Types.ObjectId().toString(),
      ...item,
      save: async function () { return this; },
    };
  });

  const app = express();
  app.use(express.json());
  app.use('/api/reception', walkInRoutes);
  app.use(errorHandler);

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  }));

  const port = server.address().port;
  return async ({ method = 'GET', path = '', body }) => {
    const token = jwt.sign({ id: receptionistId }, process.env.JWT_SECRET || 'fallback_secret');
    return fetch(`http://127.0.0.1:${port}/api/reception${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  };
}

test('GET /api/reception/slots: returns empty slots and clear message when no schedule or on leave', async (t) => {
  const req = await buildTestApp(t);

  // Case 1: No schedule exists
  mockSchedule = null;
  const resNoSchedule = await req({
    method: 'GET',
    path: `/slots?doctorId=${doctorId}&date=2026-10-20`,
  });
  assert.equal(resNoSchedule.status, 200);
  const dataNoSchedule = await resNoSchedule.json();
  assert.deepEqual(dataNoSchedule.slots, []);
  assert.equal(dataNoSchedule.earliestAvailable, null);
  assert.match(dataNoSchedule.message, /no schedule/i);

  // Case 2: Schedule status is "leave"
  mockSchedule = {
    doctor: doctorId,
    date: '2026-10-20',
    startTime: '08:00',
    endTime: '12:00',
    slotMinutes: 15,
    status: 'leave',
  };
  const resLeave = await req({
    method: 'GET',
    path: `/slots?doctorId=${doctorId}&date=2026-10-20`,
  });
  assert.equal(resLeave.status, 200);
  const dataLeave = await resLeave.json();
  assert.deepEqual(dataLeave.slots, []);
  assert.equal(dataLeave.earliestAvailable, null);
  assert.match(dataLeave.message, /leave/i);
});

test('GET /api/reception/slots: builds slots using DoctorSchedule times and slotMinutes', async (t) => {
  const req = await buildTestApp(t);

  mockSchedule = {
    doctor: doctorId,
    date: '2026-10-20',
    startTime: '09:00',
    endTime: '10:30',
    slotMinutes: 30,
    status: 'available',
  };
  mockAppointments = [
    { slotTime: '09:30' },
  ];

  const res = await req({
    method: 'GET',
    path: `/slots?doctorId=${doctorId}&date=2026-10-20`,
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.slots.length, 3);
  assert.deepEqual(data.slots.map((s) => s.time), ['09:00', '09:30', '10:00']);

  // Check statuses: 09:00 available, 09:30 booked, 10:00 available
  assert.equal(data.slots[0].status, 'available');
  assert.equal(data.slots[1].status, 'booked');
  assert.equal(data.slots[2].status, 'available');
  assert.equal(data.earliestAvailable, '09:00');
});

test('POST /api/reception/walk-in: rejects doctors with no schedule that day with 400', async (t) => {
  const req = await buildTestApp(t);

  // 1. No schedule -> 400
  mockSchedule = null;
  const resNoSchedule = await req({
    method: 'POST',
    path: '/walk-in',
    body: {
      department: 'Orthopedic',
      doctorId,
      date: '2026-10-20',
      slotTime: '09:00',
      existingPatientId: patientId,
    },
  });
  assert.equal(resNoSchedule.status, 400);
  const errNoSchedule = await resNoSchedule.json();
  assert.match(errNoSchedule.message, /schedule/i);

  // 2. Doctor on leave -> 400
  mockSchedule = {
    doctor: doctorId,
    date: '2026-10-20',
    startTime: '08:00',
    endTime: '12:00',
    status: 'leave',
  };
  const resLeave = await req({
    method: 'POST',
    path: '/walk-in',
    body: {
      department: 'Orthopedic',
      doctorId,
      date: '2026-10-20',
      slotTime: '09:00',
      existingPatientId: patientId,
    },
  });
  assert.equal(resLeave.status, 400);
  const errLeave = await resLeave.json();
  assert.match(errLeave.message, /leave/i);

  // 3. Doctor scheduled and available -> 201
  mockSchedule = {
    doctor: doctorId,
    date: '2026-10-20',
    startTime: '08:00',
    endTime: '12:00',
    slotMinutes: 15,
    status: 'available',
  };
  const resSuccess = await req({
    method: 'POST',
    path: '/walk-in',
    body: {
      department: 'Orthopedic',
      doctorId,
      date: '2026-10-20',
      slotTime: '09:00',
      existingPatientId: patientId,
    },
  });
  assert.equal(resSuccess.status, 201);
  const successData = await resSuccess.json();
  assert.equal(successData.token.tokenLabel, 'OPD-001');
});
