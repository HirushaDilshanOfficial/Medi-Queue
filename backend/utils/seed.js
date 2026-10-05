const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Doctor = require('../models/Doctor');

/**
 * Seed initial receptionist user and active doctors.
 * Safe to re-run: deletes ONLY the seed records created by this script.
 */
async function seed() {
  console.log('Starting database seed...');

  // Connect via config/db.js
  await connectDB();

  // 1. Seed Receptionist User
  const SEED_EMAIL = 'reception@mediqueue.lk';
  console.log(`Cleaning existing seed user (${SEED_EMAIL})...`);
  await User.deleteOne({ email: SEED_EMAIL });

  console.log(`Creating receptionist user (${SEED_EMAIL})...`);
  // Password hashing is handled automatically by User model pre('save') hook using bcrypt
  const receptionist = await User.create({
    fullName: 'Receptionist Staff',
    email: SEED_EMAIL,
    password: 'Test@1234',
    role: 'receptionist',
  });
  console.log(`✓ Receptionist created: ${receptionist.email} (role: ${receptionist.role}, ID: ${receptionist._id})`);

  // 2. Seed 3 Active Doctors
  console.log('Cleaning existing seed doctors...');
  await Doctor.deleteMany({
    $or: [
      { department: 'Orthopedic', room: 'Room 3B' },
      { department: 'General OPD', room: 'Room 2A' },
      { department: 'Pediatrics', room: 'Room 1C' },
    ],
  });

  const doctorsData = [
    {
      name: 'Dr. Aruna Perera',
      specialization: 'Orthopedic Surgeon',
      department: 'Orthopedic',
      room: 'Room 3B',
      status: 'active',
      dailyCapacity: 30,
      avgConsultMinutes: 10,
      workingHours: { start: '08:00', end: '16:30' },
    },
    {
      name: 'Dr. Chathura Silva',
      specialization: 'General Physician',
      department: 'General OPD',
      room: 'Room 2A',
      status: 'active',
      dailyCapacity: 30,
      avgConsultMinutes: 10,
      workingHours: { start: '08:00', end: '16:30' },
    },
    {
      name: 'Dr. Dilani Jayasuriya',
      specialization: 'Pediatrician',
      department: 'Pediatrics',
      room: 'Room 1C',
      status: 'active',
      dailyCapacity: 30,
      avgConsultMinutes: 10,
      workingHours: { start: '08:00', end: '16:30' },
    },
  ];

  console.log('Creating 3 active doctors...');
  const doctors = await Doctor.insertMany(doctorsData);
  for (const doc of doctors) {
    console.log(`✓ Doctor created: ${doc.name} - ${doc.department} (${doc.room}), status: ${doc.status}, avgConsultMinutes: ${doc.avgConsultMinutes}, hours: ${doc.workingHours.start}-${doc.workingHours.end}`);
  }

  console.log('✓ Seeding complete.');
  return { receptionist, doctors };
}

if (require.main === module) {
  seed()
    .then(async () => {
      await mongoose.disconnect();
      console.log('Database disconnected.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed error:', err);
      process.exit(1);
    });
}

module.exports = seed;
