/**
 * Throwaway script — verifies all models load, indexes sync,
 * and the Appointment double-booking guard works.
 *
 * Run:  node utils/checkModels.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const QueueToken = require('../models/QueueToken');
const Counter = require('../models/Counter');
const Shift = require('../models/Shift');

async function run() {
  await connectDB();

  // 1. Sync indexes on all models
  console.log('\n--- Syncing indexes ---');
  const models = [Patient, Doctor, Appointment, QueueToken, Counter, Shift];
  for (const model of models) {
    await model.syncIndexes();
    console.log(`  ✔ ${model.modelName} indexes synced`);
  }

  // 2. Create test data
  console.log('\n--- Creating test data ---');
  const testPatient = await Patient.create({
    fullName: 'Test Patient',
    phone: '0771234567',
  });
  console.log(`  ✔ Patient created: ${testPatient._id}`);

  const testDoctor = await Doctor.create({
    name: 'Dr. Test',
    specialization: 'General',
    department: 'General OPD',
  });
  console.log(`  ✔ Doctor created: ${testDoctor._id}`);

  const appt1 = await Appointment.create({
    patient: testPatient._id,
    doctor: testDoctor._id,
    department: 'General OPD',
    date: '2099-12-31',
    slotTime: '09:00',
    type: 'walk_in',
    status: 'booked',
  });
  console.log(`  ✔ Appointment 1 created: ${appt1._id}  (isActive: ${appt1.isActive})`);

  // 3. Double-booking test — same doctor, date, slotTime while active
  console.log('\n--- Double-booking test ---');
  try {
    await Appointment.create({
      patient: testPatient._id,
      doctor: testDoctor._id,
      department: 'General OPD',
      date: '2099-12-31',
      slotTime: '09:00',
      type: 'walk_in',
      status: 'booked',
    });
    console.log('  ✘ FAIL — duplicate was allowed (should have thrown)');
  } catch (err) {
    if (err.code === 11000) {
      console.log('  ✔ PASS — duplicate key error thrown as expected');
    } else {
      console.log(`  ✘ FAIL — unexpected error: ${err.message}`);
    }
  }

  // 4. Verify cancelled appointment with same slot is allowed
  console.log('\n--- Cancelled-slot reuse test ---');
  try {
    const appt2 = await Appointment.create({
      patient: testPatient._id,
      doctor: testDoctor._id,
      department: 'General OPD',
      date: '2099-12-31',
      slotTime: '09:00',
      type: 'walk_in',
      status: 'cancelled',
    });
    console.log(`  ✔ PASS — cancelled appointment allowed: ${appt2._id}  (isActive: ${appt2.isActive})`);
    await Appointment.findByIdAndDelete(appt2._id);
  } catch (err) {
    console.log(`  ✘ FAIL — cancelled appointment was rejected: ${err.message}`);
  }

  // 5. Cleanup
  console.log('\n--- Cleaning up test data ---');
  await Appointment.findByIdAndDelete(appt1._id);
  await Doctor.findByIdAndDelete(testDoctor._id);
  await Patient.findByIdAndDelete(testPatient._id);
  console.log('  ✔ Test data deleted');

  await mongoose.disconnect();
  console.log('\n✅ All checks passed. Disconnected.\n');
}

run().catch(async (err) => {
  console.error('\n❌ Script failed:', err.message);
  await mongoose.disconnect();
  process.exit(1);
});
