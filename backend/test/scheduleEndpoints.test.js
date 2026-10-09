const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const DoctorSchedule = require('../models/DoctorSchedule');
const scheduleRoutes = require('../routes/scheduleRoutes');
const { errorHandler } = require('../utils/errorHandler');

const receptionistId = new mongoose.Types.ObjectId().toString();
const patientId = new mongoose.Types.ObjectId().toString();
const doctorId = new mongoose.Types.ObjectId().toString();

const users = {
  [receptionistId]: { _id: receptionistId, role: 'receptionist', name: 'Desk Receptionist' },
  [patientId]: { _id: patientId, role: 'patient', name: 'Patient One' },
};

const doctorData = {
  _id: doctorId,
  name: 'Dr. Chathura Perera',
  room: 'Room 2B',
  department: 'General OPD',
  specialization: 'Physician',
};

// In-memory schedules store for mock testing
let mockSchedules = [];
let mockAppointments = [];

async function buildTestApp(t) {
  // Mock User.findById for auth
  t.mock.method(User, 'findById', (id) => ({
    select: async () => users[String(id)] || null,
  }));

  // Mock Doctor.findById
  t.mock.method(Doctor, 'findById', async (id) => {
    if (String(id) === String(doctorId)) {
      return doctorData;
    }
    return null;
  });

  // Mock DoctorSchedule methods
  t.mock.method(DoctorSchedule, 'create', async (data) => {
    const doc = {
      _id: new mongoose.Types.ObjectId().toString(),
      ...data,
      populate: async function (path, select) {
        if (path === 'doctor') {
          this.doctor = doctorData;
        }
        return this;
      },
    };
    mockSchedules.push(doc);
    return doc;
  });

  t.mock.method(DoctorSchedule, 'findOne', async (query) => {
    return mockSchedules.find((s) => {
      const docId = s.doctor?._id ? String(s.doctor._id) : String(s.doctor);
      if (query.doctor && docId !== String(query.doctor)) return false;
      if (query.date && s.date !== query.date) return false;
      if (query._id && query._id.$ne && String(s._id) === String(query._id.$ne)) return false;
      if (query.startTime && query.startTime.$lt && !(s.startTime < query.startTime.$lt)) return false;
      if (query.endTime && query.endTime.$gt && !(s.endTime > query.endTime.$gt)) return false;
      return true;
    }) || null;
  });

  t.mock.method(DoctorSchedule, 'find', (query = {}) => {
    const filtered = mockSchedules.filter((s) => {
      if (query.doctor && String(s.doctor) !== String(query.doctor)) return false;
      if (query.date && s.date !== query.date) return false;
      return true;
    }).map((s) => ({
      ...s,
      doctor: doctorData,
    }));

    return {
      populate: function () {
        return {
          sort: async () => filtered,
        };
      },
      sort: async () => filtered,
    };
  });

  t.mock.method(DoctorSchedule, 'findById', async (id) => {
    const found = mockSchedules.find((s) => String(s._id) === String(id));
    if (!found) return null;
    return {
      ...found,
      populate: async function () {
        this.doctor = doctorData;
        return this;
      },
      save: async function () {
        const idx = mockSchedules.findIndex((s) => String(s._id) === String(id));
        if (idx !== -1) mockSchedules[idx] = { ...this };
        return this;
      },
    };
  });

  t.mock.method(DoctorSchedule, 'findByIdAndDelete', async (id) => {
    mockSchedules = mockSchedules.filter((s) => String(s._id) !== String(id));
    return true;
  });

  // Mock Appointment.findOne
  t.mock.method(Appointment, 'findOne', async (query) => {
    return mockAppointments.find((a) => {
      if (query.doctor && String(a.doctor) !== String(query.doctor)) return false;
      if (query.date && a.date !== query.date) return false;
      if (query.slotTime && query.slotTime.$gte && !(a.slotTime >= query.slotTime.$gte)) return false;
      if (query.slotTime && query.slotTime.$lte && !(a.slotTime <= query.slotTime.$lte)) return false;
      return true;
    }) || null;
  });

  const app = express();
  app.use(express.json());
  app.use('/api/reception/schedules', scheduleRoutes);
  app.use(errorHandler);

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  }));

  const port = server.address().port;
  return async ({ userId, method = 'GET', path = '', body }) => {
    const headers = { 'Content-Type': 'application/json' };
    if (userId) {
      const token = jwt.sign({ id: userId }, process.env.JWT_SECRET || 'fallback_secret');
      headers.Authorization = `Bearer ${token}`;
    }
    return fetch(`http://127.0.0.1:${port}/api/reception/schedules${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  };
}

test('Schedules API: Authentication and Role-based authorization', async (t) => {
  const req = await buildTestApp(t);

  // 1. Unauthenticated -> 401
  const unauthRes = await req({ method: 'GET' });
  assert.equal(unauthRes.status, 401);

  // 2. Patient role -> 403
  const forbiddenRes = await req({ userId: patientId, method: 'GET' });
  assert.equal(forbiddenRes.status, 403);
});

test('Schedules API: POST / validation rules', async (t) => {
  mockSchedules = [];
  mockAppointments = [];
  const req = await buildTestApp(t);

  // 1. Missing doctor or non-existent doctor -> 404
  const resNoDoc = await req({
    userId: receptionistId,
    method: 'POST',
    body: {
      doctor: new mongoose.Types.ObjectId().toString(),
      date: '2026-10-15',
      startTime: '08:30',
      endTime: '12:00',
    },
  });
  assert.equal(resNoDoc.status, 404);

  // 2. Date in the past -> 400
  const resPastDate = await req({
    userId: receptionistId,
    method: 'POST',
    body: {
      doctor: doctorId,
      date: '2020-01-01',
      startTime: '08:30',
      endTime: '12:00',
    },
  });
  assert.equal(resPastDate.status, 400);
  const pastData = await resPastDate.json();
  assert.match(pastData.message, /past/i);

  // 3. Invalid times / End time before start time -> 400
  const resInvalidTime = await req({
    userId: receptionistId,
    method: 'POST',
    body: {
      doctor: doctorId,
      date: '2026-10-15',
      startTime: '12:00',
      endTime: '09:00',
    },
  });
  assert.equal(resInvalidTime.status, 400);

  // 4. Create successfully -> 201
  const resCreate = await req({
    userId: receptionistId,
    method: 'POST',
    body: {
      doctor: doctorId,
      date: '2026-10-15',
      startTime: '08:00',
      endTime: '12:00',
      notes: 'Morning OPD consultation',
    },
  });
  assert.equal(resCreate.status, 201);
  const created = (await resCreate.json()).data;
  assert.equal(created.doctor.name, 'Dr. Chathura Perera');
  assert.equal(created.doctor.room, 'Room 2B');
  assert.equal(created.slotMinutes, 15);
  assert.equal(created.maxPatients, 30);
  assert.equal(created.status, 'available');

  // 5. Overlapping schedule on same doctor and date -> 409
  const resOverlap = await req({
    userId: receptionistId,
    method: 'POST',
    body: {
      doctor: doctorId,
      date: '2026-10-15',
      startTime: '10:00',
      endTime: '14:00',
    },
  });
  assert.equal(resOverlap.status, 409);
});

test('Schedules API: GET list with populated doctor name and room', async (t) => {
  mockSchedules = [
    {
      _id: 'sched-1',
      doctor: doctorId,
      date: '2026-10-15',
      startTime: '08:00',
      endTime: '12:00',
      slotMinutes: 15,
      maxPatients: 30,
      status: 'available',
    },
  ];
  const req = await buildTestApp(t);

  const res = await req({
    userId: receptionistId,
    method: 'GET',
    path: `?date=2026-10-15&doctorId=${doctorId}`,
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.count, 1);
  assert.equal(json.data[0].doctor.name, 'Dr. Chathura Perera');
  assert.equal(json.data[0].doctor.room, 'Room 2B');
});

test('Schedules API: PUT /:id update times and details', async (t) => {
  mockSchedules = [
    {
      _id: 'sched-edit',
      doctor: doctorId,
      date: '2026-10-15',
      startTime: '08:00',
      endTime: '12:00',
      slotMinutes: 15,
      maxPatients: 30,
      status: 'available',
    },
  ];
  const req = await buildTestApp(t);

  const res = await req({
    userId: receptionistId,
    method: 'PUT',
    path: '/sched-edit',
    body: {
      startTime: '08:30',
      endTime: '12:30',
      maxPatients: 35,
      status: 'leave',
      notes: 'Doctor on leave after 12',
    },
  });
  assert.equal(res.status, 200);
  const updated = (await res.json()).data;
  assert.equal(updated.startTime, '08:30');
  assert.equal(updated.endTime, '12:30');
  assert.equal(updated.maxPatients, 35);
  assert.equal(updated.status, 'leave');
});

test('Schedules API: DELETE /:id protects active appointments with 409', async (t) => {
  mockSchedules = [
    {
      _id: 'sched-del',
      doctor: doctorId,
      date: '2026-10-15',
      startTime: '08:00',
      endTime: '12:00',
    },
  ];
  mockAppointments = [
    {
      doctor: doctorId,
      date: '2026-10-15',
      slotTime: '09:00',
      status: 'booked',
      isActive: true,
    },
  ];
  const req = await buildTestApp(t);

  // 1. Has active appointment -> 409
  const resConflict = await req({
    userId: receptionistId,
    method: 'DELETE',
    path: '/sched-del',
  });
  assert.equal(resConflict.status, 409);
  const errData = await resConflict.json();
  assert.equal(errData.message, 'Appointments exist for this schedule');

  // 2. Clear appointment -> 200
  mockAppointments = [];
  const resSuccess = await req({
    userId: receptionistId,
    method: 'DELETE',
    path: '/sched-del',
  });
  assert.equal(resSuccess.status, 200);
  assert.equal(mockSchedules.length, 0);
});
