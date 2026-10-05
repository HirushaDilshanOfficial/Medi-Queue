const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');

/**
 * Seed initial receptionist user, active doctors, and patients.
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

  // 3. Seed 10 Patients
  // Realistic Sri Lankan names, valid NICs (mix of old 9-digit+V and new 12-digit),
  // valid phone numbers, ages 5-80, mixed gender, registeredVia "reception".
  // Fixed NICs ensure re-running does not create duplicates.
  const patientsData = [
    {
      fullName: 'Kasun Chamara Mendis',
      nic: '199418201234', // New 12-digit NIC
      phone: '0771234561',
      age: 32,
      dob: new Date('1994-07-01'),
      gender: 'male',
      address: 'No. 45, Temple Road, Maharagama',
      district: 'Colombo',
      bloodGroup: 'O+',
      registeredVia: 'reception',
      status: 'Active',
      createdBy: receptionist._id,
    },
    {
      fullName: 'Sunethra Kumarihamy Bandara',
      nic: '647891234V', // Old 9-digit+V NIC
      phone: '0712345672',
      age: 62,
      dob: new Date('1964-10-15'),
      gender: 'female',
      address: 'No. 12, Peradeniya Road',
      district: 'Kandy',
      bloodGroup: 'B+',
      registeredVia: 'reception',
      status: 'Active',
      createdBy: receptionist._id,
    },
    {
      fullName: 'Sivakumar Tharmalingam',
      nic: '782456789V', // Old 9-digit+V NIC
      phone: '0763456783',
      age: 48,
      dob: new Date('1978-08-20'),
      gender: 'male',
      address: 'No. 88, Hospital Road',
      district: 'Jaffna',
      bloodGroup: 'A+',
      registeredVia: 'reception',
      status: 'Active',
      createdBy: receptionist._id,
    },
    {
      fullName: 'Fathima Rameeza Mohamed',
      nic: '199965401234', // New 12-digit NIC
      phone: '0784567894',
      age: 27,
      dob: new Date('1999-04-12'),
      gender: 'female',
      address: 'No. 23/B, Main Street, Negombo',
      district: 'Gampaha',
      bloodGroup: 'AB+',
      registeredVia: 'reception',
      status: 'Active',
      createdBy: receptionist._id,
    },
    {
      fullName: 'Kaveen Dananjaya Jayawardena',
      nic: '200421501234', // New 12-digit NIC
      phone: '0705678905',
      age: 22,
      dob: new Date('2004-08-03'),
      gender: 'male',
      address: 'No. 5, Galle Road, Wadduwa',
      district: 'Kalutara',
      bloodGroup: 'O-',
      registeredVia: 'reception',
      status: 'Active',
      createdBy: receptionist._id,
    },
    {
      fullName: 'Sanduni Yashodhara Senaratne',
      nic: '916781234V', // Old 9-digit+V NIC
      phone: '0726789016',
      age: 35,
      dob: new Date('1991-05-18'),
      gender: 'female',
      address: 'No. 104, Circular Road',
      district: 'Kurunegala',
      bloodGroup: 'A-',
      registeredVia: 'reception',
      status: 'Active',
      createdBy: receptionist._id,
    },
    {
      fullName: 'Nimal Karunaratne Gunasekara',
      nic: '461234567V', // Old 9-digit+V NIC
      phone: '0757890127',
      age: 80,
      dob: new Date('1946-03-25'),
      gender: 'male',
      address: 'No. 15, Beach Road',
      district: 'Matara',
      bloodGroup: 'B-',
      registeredVia: 'reception',
      status: 'Active',
      createdBy: receptionist._id,
    },
    {
      fullName: 'Dinithi Hansika Perera',
      nic: '201271201234', // New 12-digit NIC
      phone: '0778901238',
      age: 14,
      dob: new Date('2012-07-31'),
      gender: 'female',
      address: 'No. 67, Wakwella Road',
      district: 'Galle',
      bloodGroup: 'O+',
      registeredVia: 'reception',
      status: 'Active',
      createdBy: receptionist._id,
    },
    {
      fullName: 'Tharindu Lakshan Wickramasinghe',
      nic: '202111501234', // New 12-digit NIC
      phone: '0719012349',
      age: 5,
      dob: new Date('2021-04-25'),
      gender: 'male',
      address: 'No. 34, Colombo Road',
      district: 'Ratnapura',
      bloodGroup: 'A+',
      registeredVia: 'reception',
      status: 'Active',
      createdBy: receptionist._id,
    },
    {
      fullName: 'Priyanka Mallika Fernando',
      nic: '558123456V', // Old 9-digit+V NIC
      phone: '0760123450',
      age: 71,
      dob: new Date('1955-11-09'),
      gender: 'female',
      address: 'No. 72, Sea Street',
      district: 'Colombo',
      bloodGroup: 'AB-',
      registeredVia: 'reception',
      status: 'Active',
      createdBy: receptionist._id,
    },
  ];

  const SEED_NICS = patientsData.map((p) => p.nic);
  console.log(`Cleaning existing seed patients (${SEED_NICS.length} fixed NICs)...`);
  await Patient.deleteMany({ nic: { $in: SEED_NICS } });

  console.log('Creating 10 seed patients...');
  const patients = await Patient.insertMany(patientsData);
  for (const patient of patients) {
    console.log(`✓ Patient created: ${patient.fullName} | NIC: ${patient.nic} | Age: ${patient.age} | Gender: ${patient.gender} | Phone: ${patient.phone} | Via: ${patient.registeredVia}`);
  }

  console.log('✓ Seeding complete.');
  return { receptionist, doctors, patients };
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
