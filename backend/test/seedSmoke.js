require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Counter = require('../models/Counter');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const QueueToken = require('../models/QueueToken');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);

  // 1. Receptionist user
  let rec = await User.findOne({ email: 'receptionist@mediqueue.lk' });
  if (!rec) {
    rec = await User.create({
      name: 'Receptionist User',
      email: 'receptionist@mediqueue.lk',
      password: 'password123',
      role: 'receptionist',
    });
  } else {
    rec.password = 'password123';
    rec.role = 'receptionist';
    await rec.save();
  }

  // 2. Patient user
  let pat = await User.findOne({ email: 'patient.test@mediqueue.lk' });
  if (!pat) {
    pat = await User.create({
      name: 'Test Patient User',
      email: 'patient.test@mediqueue.lk',
      password: 'password123',
      role: 'patient',
    });
  } else {
    pat.password = 'password123';
    pat.role = 'patient';
    await pat.save();
  }

  // 3. Active Doctor
  let doc = await Doctor.findOne({ name: 'Dr. Palitha Perera' });
  if (!doc) {
    doc = await Doctor.create({
      name: 'Dr. Palitha Perera',
      specialization: 'General Physician',
      department: 'General OPD',
      room: 'Room 101',
      status: 'active',
      workingHours: { start: '08:00', end: '20:00' },
    });
  } else {
    doc.status = 'active';
    doc.department = 'General OPD';
    doc.room = 'Room 101';
    doc.workingHours = { start: '08:00', end: '20:00' };
    await doc.save();
  }

  // 4. Clean up test data for smoke tests
  const testNics = ['200012345678', '991234567V', '199512345678'];
  await Patient.deleteMany({ nic: { $in: testNics } });
  await Appointment.deleteMany({ doctor: doc._id });
  await QueueToken.deleteMany({ assignedDoctor: doc._id });
  await Counter.deleteMany({});

  console.log('SETUP_COMPLETE');
  console.log('DOCTOR_ID=' + doc._id);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
