const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const QueueToken = require('../models/QueueToken');
const Counter = require('../models/Counter');
const DoctorSchedule = require('../models/DoctorSchedule');
const { getNextToken } = require('./tokenGenerator');

/**
 * Seed initial receptionist user, active doctors, patients, and today's appointments/tokens.
 * Safe to re-run: deletes ONLY the seed records created by this script.
 */
async function seed() {
  console.log('Starting database seed...');

  // Connect via config/db.js
  await connectDB();

  const getDateOffset = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  };

  const todayString = getDateOffset(0);
  const tomorrowString = getDateOffset(1);
  const dayAfterTomorrowString = getDateOffset(2);

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

  // Clean up any previous seed appointments and tokens tied to existing seed patients before deleting patients
  const existingSeedPatients = await Patient.find({ nic: { $in: SEED_NICS } }).select('_id');
  const existingSeedPatientIds = existingSeedPatients.map((p) => p._id);

  console.log(`Cleaning today's (${todayString}) seeded appointments, tokens, and Counter...`);
  await Counter.deleteOne({ key: `OPD:${todayString}` });

  const existingSeedAppts = await Appointment.find({
    date: todayString,
    $or: [
      { notes: 'Seeded appointment' },
      { bookedBy: receptionist._id },
      { patient: { $in: existingSeedPatientIds } },
    ],
  }).select('_id');
  const existingApptIds = existingSeedAppts.map((a) => a._id);

  await QueueToken.deleteMany({
    $or: [
      { date: todayString },
      { appointment: { $in: existingApptIds } },
      { patient: { $in: existingSeedPatientIds } },
    ],
  });

  await Appointment.deleteMany({
    $or: [
      { date: todayString },
      { _id: { $in: existingApptIds } },
    ],
  });

  console.log(`Cleaning existing seed patients (${SEED_NICS.length} fixed NICs)...`);
  await Patient.deleteMany({ nic: { $in: SEED_NICS } });

  console.log('Creating 10 seed patients...');
  const patients = await Patient.insertMany(patientsData);
  for (const patient of patients) {
    console.log(`✓ Patient created: ${patient.fullName} | NIC: ${patient.nic} | Age: ${patient.age} | Gender: ${patient.gender} | Phone: ${patient.phone}`);
  }

  // 4. Seed 8 Appointments & QueueTokens for today
  console.log(`Creating 8 appointments and queue tokens for today (${todayString})...`);
  const now = new Date();

  // 8 appointments: mix walk_in and pre_booked, different doctors and slots
  // Statuses: 2 done, 1 serving, 5 waiting
  // Priorities: 1 urgent, 1 senior, 6 normal
  const apptConfigs = [
    // 2 done:
    {
      patient: patients[1], // Sunethra Bandara (Female, 62)
      doctor: doctors[1],  // Dr. Chathura Silva (General OPD, Room 2A)
      slotTime: '08:30',
      type: 'walk_in',
      priority: 'normal',
      status: 'done',
      apptStatus: 'completed',
      calledMinutesAgo: 50,
      servedMinutesAgo: 35,
    },
    {
      patient: patients[2], // Sivakumar Tharmalingam (Male, 48)
      doctor: doctors[0],  // Dr. Aruna Perera (Orthopedic, Room 3B)
      slotTime: '08:30',
      type: 'pre_booked',
      priority: 'normal',
      status: 'done',
      apptStatus: 'completed',
      calledMinutesAgo: 40,
      servedMinutesAgo: 25,
    },
    // 1 serving:
    {
      patient: patients[0], // Kasun Mendis (Male, 32)
      doctor: doctors[1],  // Dr. Chathura Silva (General OPD, Room 2A)
      slotTime: '09:00',
      type: 'walk_in',
      priority: 'normal',
      status: 'serving',
      apptStatus: 'in_consultation',
      calledMinutesAgo: 10,
    },
    // 5 waiting (1 urgent, 1 senior, 3 normal):
    {
      patient: patients[4], // Kaveen Jayawardena (Male, 22)
      doctor: doctors[0],  // Dr. Aruna Perera (Orthopedic, Room 3B)
      slotTime: '09:00',
      type: 'walk_in',
      priority: 'urgent',
      status: 'waiting',
      apptStatus: 'checked_in',
    },
    {
      patient: patients[6], // Nimal Gunasekara (Male, 80)
      doctor: doctors[1],  // Dr. Chathura Silva (General OPD, Room 2A)
      slotTime: '09:30',
      type: 'pre_booked',
      priority: 'senior',
      status: 'waiting',
      apptStatus: 'checked_in',
    },
    {
      patient: patients[8], // Tharindu Wickramasinghe (Male, 5)
      doctor: doctors[2],  // Dr. Dilani Jayasuriya (Pediatrics, Room 1C)
      slotTime: '08:30',
      type: 'walk_in',
      priority: 'normal',
      status: 'waiting',
      apptStatus: 'checked_in',
    },
    {
      patient: patients[7], // Dinithi Perera (Female, 14)
      doctor: doctors[2],  // Dr. Dilani Jayasuriya (Pediatrics, Room 1C)
      slotTime: '09:00',
      type: 'pre_booked',
      priority: 'normal',
      status: 'waiting',
      apptStatus: 'checked_in',
    },
    {
      patient: patients[3], // Fathima Mohamed (Female, 27)
      doctor: doctors[0],  // Dr. Aruna Perera (Orthopedic, Room 3B)
      slotTime: '09:30',
      type: 'walk_in',
      priority: 'normal',
      status: 'waiting',
      apptStatus: 'checked_in',
    },
  ];

  const appointments = [];
  const queueTokens = [];

  for (const cfg of apptConfigs) {
    // Atomically increment OPD counter via getNextToken()
    const token = await getNextToken(todayString);

    // Create Appointment consistent with walk-in flow
    const apptData = {
      patient: cfg.patient._id,
      doctor: cfg.doctor._id,
      department: cfg.doctor.department,
      date: todayString,
      slotTime: cfg.slotTime,
      type: cfg.type,
      status: cfg.apptStatus,
      bookedBy: receptionist._id,
      tokenNumber: token.tokenNumber,
      notes: 'Seeded appointment',
    };

    const appointment = await Appointment.create(apptData);

    // Create QueueToken matching Appointment
    const queueTokenData = {
      appointment: appointment._id,
      patient: cfg.patient._id,
      department: cfg.doctor.department,
      date: todayString,
      tokenNumber: token.tokenNumber,
      tokenLabel: token.tokenLabel,
      status: cfg.status,
      priority: cfg.priority,
      assignedDoctor: cfg.doctor._id,
    };

    if (cfg.calledMinutesAgo) {
      queueTokenData.calledAt = new Date(now.getTime() - cfg.calledMinutesAgo * 60 * 1000);
    }
    if (cfg.servedMinutesAgo) {
      queueTokenData.servedAt = new Date(now.getTime() - cfg.servedMinutesAgo * 60 * 1000);
    }

    const queueToken = await QueueToken.create(queueTokenData);

    appointments.push(appointment);
    queueTokens.push(queueToken);

    console.log(
      `✓ Token ${token.tokenLabel} (#${token.tokenNumber}) [${cfg.status.toUpperCase()}, ${cfg.priority}] -> Appt ${appointment._id} (${cfg.type}, ${cfg.slotTime}) | Doctor: ${cfg.doctor.name} (${cfg.doctor.department}) | Patient: ${cfg.patient.fullName}`
    );
  }

  // 5. Seed Doctor Schedules (Today, Tomorrow, and Day After Tomorrow)
  console.log(`\nCleaning and seeding doctor schedules for ${todayString}, ${tomorrowString}, and ${dayAfterTomorrowString}...`);
  const doctorIds = doctors.map((d) => d._id);
  await DoctorSchedule.deleteMany({
    doctor: { $in: doctorIds },
    date: { $in: [todayString, tomorrowString, dayAfterTomorrowString] },
  });

  const schedulesToSeed = [];

  // Today: all 3 doctors available (08:00 - 16:30)
  for (const doc of doctors) {
    schedulesToSeed.push({
      doctor: doc._id,
      date: todayString,
      startTime: '08:00',
      endTime: '16:30',
      slotMinutes: 15,
      maxPatients: doc.dailyCapacity || 30,
      status: 'available',
      notes: 'General OPD Session',
      createdBy: receptionist._id,
    });
  }

  // Tomorrow: all 3 doctors available (08:00 - 16:30)
  for (const doc of doctors) {
    schedulesToSeed.push({
      doctor: doc._id,
      date: tomorrowString,
      startTime: '08:00',
      endTime: '16:30',
      slotMinutes: 15,
      maxPatients: doc.dailyCapacity || 30,
      status: 'available',
      notes: 'General OPD Session',
      createdBy: receptionist._id,
    });
  }

  // Day after tomorrow: one doctor on "leave", remaining doctors available (08:00 - 16:30)
  schedulesToSeed.push({
    doctor: doctors[0]._id, // Dr. Aruna Perera on leave
    date: dayAfterTomorrowString,
    startTime: '08:00',
    endTime: '16:30',
    slotMinutes: 15,
    maxPatients: 30,
    status: 'leave',
    notes: 'Approved Medical Leave',
    createdBy: receptionist._id,
  });

  for (let i = 1; i < doctors.length; i++) {
    schedulesToSeed.push({
      doctor: doctors[i]._id,
      date: dayAfterTomorrowString,
      startTime: '08:00',
      endTime: '16:30',
      slotMinutes: 15,
      maxPatients: doctors[i].dailyCapacity || 30,
      status: 'available',
      notes: 'General OPD Session',
      createdBy: receptionist._id,
    });
  }

  const doctorSchedules = await DoctorSchedule.insertMany(schedulesToSeed);
  for (const s of doctorSchedules) {
    const docName = doctors.find((d) => String(d._id) === String(s.doctor))?.name || 'Doctor';
    console.log(`✓ Schedule created: ${docName} on ${s.date} [${s.startTime}-${s.endTime}, ${s.slotMinutes}m, Status: ${s.status.toUpperCase()}]`);
  }

  console.log('\n✓ Seeding complete.');
  return { receptionist, doctors, patients, appointments, queueTokens, doctorSchedules };
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
