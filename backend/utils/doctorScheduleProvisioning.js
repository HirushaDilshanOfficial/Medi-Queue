const Schedule = require('../models/Schedule');
const Slot = require('../models/Slot');
const { localDate } = require('../models/receptionistFields');

const BOOKING_HORIZON_DAYS = 14;
const SLOT_MINUTES = 20;

function dateKeyToInstant(dateKey, hhmm) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = String(hhmm).split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 5, minute - 30));
}

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function validTime(value, fallback) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '')) ? value : fallback;
}

/**
 * Creates missing persisted schedules and slots for a doctor.
 * Sunday is treated as the weekly clinic rest day.
 */
async function provisionDoctorBookingSlots(doctor) {
  const startTime = validTime(doctor.workingHours?.start, '08:00');
  const endTime = validTime(doctor.workingHours?.end, '16:30');
  const startKey = localDate(new Date());
  let schedulesCreated = 0;
  let slotsCreated = 0;

  for (let offset = 0; offset <= BOOKING_HORIZON_DAYS; offset += 1) {
    const dateKey = addDays(startKey, offset);
    const dayStart = dateKeyToInstant(dateKey, startTime);
    if (dayStart.getUTCDay() === 0) continue;

    const dayEnd = dateKeyToInstant(dateKey, endTime);
    if (dayEnd <= dayStart) continue;

    let schedule = await Schedule.findOne({ doctor: doctor._id, startsAt: dayStart });
    if (!schedule) {
      schedule = await Schedule.create({
        doctor: doctor._id,
        department: doctor.department,
        room: doctor.room || '',
        startsAt: dayStart,
        endsAt: dayEnd,
        status: 'scheduled',
      });
      schedulesCreated += 1;
    }

    for (let time = dayStart; time < dayEnd; time = addMinutes(time, SLOT_MINUTES)) {
      const slotEnd = addMinutes(time, SLOT_MINUTES);
      if (slotEnd > dayEnd) break;
      const exists = await Slot.exists({ schedule: schedule._id, startsAt: time });
      if (exists) continue;

      await Slot.create({
        schedule: schedule._id,
        startsAt: time,
        endsAt: slotEnd,
        capacity: 1,
        status: 'available',
      });
      slotsCreated += 1;
    }
  }

  return { schedulesCreated, slotsCreated };
}

module.exports = { provisionDoctorBookingSlots };
