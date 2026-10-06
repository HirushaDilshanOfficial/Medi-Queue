/**
 * Seeds a demo OPD clinic so the booking and queue flows have something to show.
 *
 * This is development data only. It upserts doctors by name, so running it twice
 * does not create duplicates, and `--reset` removes only the doctors listed below
 * (never any doctor a real MOH user created).
 *
 *   node scripts/seedDemoClinic.js
 *   node scripts/seedDemoClinic.js --reset
 *
 * Usage: DEMO_SEED=1 guards the write, so an accidental run against a shared
 * database is a no-op unless the flag is set.
 */
require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Doctor = require('../models/Doctor');
const Schedule = require('../models/Schedule');
const Slot = require('../models/Slot');
const { localDate } = require('../models/receptionistFields');

const SLOT_MINUTES = 20;
const DAYS_AHEAD = 14;
const CLINIC_START = '08:00';
const CLINIC_END = '12:00';

const DEMO_DOCTORS = [
  { name: 'Dr. Nimali Perera', specialization: 'Cardiology', department: 'Cardiology', room: 'Room 304', avgConsultMinutes: 10 },
  { name: 'Dr. Ruwan Jayasinghe', specialization: 'Orthopaedics', department: 'Orthopaedics', room: 'Room 212', avgConsultMinutes: 15 },
  { name: 'Dr. Hasini Fernando', specialization: 'Gynaecology', department: 'Gynaecology', room: 'Room 118', avgConsultMinutes: 12 },
  { name: 'Dr. Arjun Dissanayake', specialization: 'Paediatrics', department: 'Paediatrics', room: 'Room 105', avgConsultMinutes: 10 },
  { name: 'Dr. Farhan Ismail', specialization: 'Neurology', department: 'Neurology', room: 'Room 401', avgConsultMinutes: 20 },
  { name: 'Dr. Chathuri Silva', specialization: 'Dermatology', department: 'Dermatology', room: 'Room 220', avgConsultMinutes: 8 },
];

// Slots are generated in Colombo time but stored as UTC instants, which is how
// Slot.startsAt is compared everywhere else.
function slotInstant(dateKey, hhmm) {
  // Colombo is UTC+5:30 with no daylight saving.
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 5, minute - 30, 0, 0));
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function isClinicDay(date) {
  // Sunday is the hospital's rest day.
  return date.getUTCDay() !== 0;
}

async function resetDemo() {
  const doctors = await Doctor.find({ name: { $in: DEMO_DOCTORS.map((d) => d.name) } }).select('_id');
  const ids = doctors.map((d) => d._id);

  const schedules = await Schedule.find({ doctor: { $in: ids } }).select('_id');
  await Slot.deleteMany({ schedule: { $in: schedules.map((s) => s._id) } });
  await Schedule.deleteMany({ doctor: { $in: ids } });
  await Doctor.deleteMany({ _id: { $in: ids } });

  console.log(`Removed ${ids.length} demo doctor(s) and their schedules/slots.`);
}

async function seed() {
  const startKey = localDate(new Date());
  let doctorCount = 0;
  let slotCount = 0;

  for (const spec of DEMO_DOCTORS) {
    let doctor = await Doctor.findOne({ name: spec.name, department: spec.department });

    if (!doctor) {
      doctor = await Doctor.create({
        name: spec.name,
        specialization: spec.specialization,
        department: spec.department,
        room: spec.room,
        status: 'active',
        dailyCapacity: 12,
        avgConsultMinutes: spec.avgConsultMinutes,
        workingHours: { start: CLINIC_START, end: CLINIC_END },
      });
      doctorCount += 1;
    }

    for (let offset = 0; offset < DAYS_AHEAD; offset += 1) {
      const dayStart = slotInstant(startKey, CLINIC_START);
      dayStart.setUTCDate(dayStart.getUTCDate() + offset);
      if (!isClinicDay(dayStart)) continue;

      const dateKey = localDate(dayStart);
      const dayEnd = slotInstant(dateKey, CLINIC_END);

      const existing = await Schedule.findOne({
        doctor: doctor._id,
        department: spec.department,
        startsAt: dayStart,
        endsAt: dayEnd,
      });

      const schedule = existing || (await Schedule.create({
        doctor: doctor._id,
        department: spec.department,
        room: spec.room,
        startsAt: dayStart,
        endsAt: dayEnd,
        status: 'scheduled',
      }));

      for (let time = new Date(dayStart); time < dayEnd; time = addMinutes(time, SLOT_MINUTES)) {
        const slotStart = new Date(time);
        const exists = await Slot.exists({ schedule: schedule._id, startsAt: slotStart });
        if (exists) continue;

        await Slot.create({
          schedule: schedule._id,
          startsAt: slotStart,
          endsAt: addMinutes(slotStart, SLOT_MINUTES),
          capacity: 1,
          status: 'available',
        });
        slotCount += 1;
      }
    }
  }

  console.log(`Seeded ${doctorCount} new doctor(s) and ${slotCount} new slot(s) across ${DAYS_AHEAD} days.`);
  console.log(`Total doctors in database: ${await Doctor.countDocuments({})}`);
}

async function main() {
  if (process.env.DEMO_SEED !== '1') {
    console.log('Refusing to write. Set DEMO_SEED=1 to run this against the configured database.');
    process.exit(1);
  }

  const reset = process.argv.includes('--reset');

  await connectDB();

  try {
    if (reset) await resetDemo();
    else await seed();
  } finally {
    await mongoose.connection.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
