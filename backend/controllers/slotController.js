const Doctor = require('../models/Doctor');
const Schedule = require('../models/Schedule');
const Slot = require('../models/Slot');
const OpdAppointment = require('../models/OpdAppointment');
const Appointment = require('../models/Appointment');
const { localDate } = require('../models/receptionistFields');
const { today } = require('../utils/opdQueue');
const { clockLabel, isValidObjectId } = require('../utils/opdAppointment');

const ACTIVE_STATUSES = OpdAppointment.ACTIVE_STATUSES;

// How far ahead patients may book.
const BOOKING_HORIZON_DAYS = 14;

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function horizonKeys(fromKey) {
  return Array.from({ length: BOOKING_HORIZON_DAYS + 1 }, (_, offset) => addDays(fromKey, offset));
}

function isWithinHorizon(dateKey, fromKey) {
  return dateKey >= fromKey && dateKey <= addDays(fromKey, BOOKING_HORIZON_DAYS);
}

async function scheduleIds(doctorId) {
  const schedules = await Schedule.find({ doctor: doctorId, status: 'scheduled' })
    .select('_id')
    .lean();
  return schedules.map((schedule) => schedule._id);
}

/**
 * How many patients hold each "date|HH:mm" slot, so capacity can be honoured.
 *
 * A Slot row can carry `capacity > 1`, meaning the doctor will see several
 * patients back to back in that slot. Returns a Map of key -> bookings so far;
 * the caller compares against the slot's own capacity.
 */
async function bookedCounts(doctorId, dateKeys) {
  const [appointments, recAppointments] = await Promise.all([
    OpdAppointment.find({
      doctor: doctorId,
      date: { $in: dateKeys },
      status: { $in: ACTIVE_STATUSES },
    })
      .select('date slotTime')
      .lean(),
    Appointment.find({
      doctor: doctorId,
      date: { $in: dateKeys },
      status: { $nin: ['cancelled', 'no_show'] },
    })
      .select('date slotTime')
      .lean(),
  ]);

  const counts = new Map();
  for (const appointment of appointments) {
    const key = `${appointment.date}|${appointment.slotTime}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  for (const appointment of recAppointments) {
    const key = `${appointment.date}|${appointment.slotTime}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function isFull(counts, date, time, capacity) {
  return (counts.get(`${date}|${time}`) || 0) >= (Number(capacity) || 1);
}

async function validateDoctor(res, doctorId) {
  if (!isValidObjectId(doctorId)) {
    res.status(400).json({ message: 'Invalid doctor id' });
    return null;
  }
  const doctor = await Doctor.findById(doctorId).lean();
  if (!doctor) {
    res.status(404).json({ message: 'Doctor not found' });
    return null;
  }
  return doctor;
}

// @desc    Bookable days for a doctor
// @route   GET /api/v1/bookings/doctors/:id/days
// @access  Private/Patient
const listDoctorDays = async (req, res, next) => {
  try {
    const doctor = await validateDoctor(res, req.params.id);
    if (!doctor) return undefined;

    const fromKey = today();
    const keys = horizonKeys(fromKey);

    const schedules = await Schedule.find({ doctor: doctor._id, status: 'scheduled' })
      .select('_id')
      .lean();
    const slots = await Slot.find({
      schedule: { $in: schedules.map((schedule) => schedule._id) },
      startsAt: { $gte: new Date() },
      status: 'available',
    })
      .sort({ startsAt: 1 })
      .lean();

    const taken = await bookedCounts(doctor._id, keys);
    const byDay = new Map();

    for (const slot of slots) {
      const key = localDate(slot.startsAt);
      const time = clockLabel(slot.startsAt);
      if (!key || !time) continue;
      if (isFull(taken, key, time, slot.capacity)) continue;
      byDay.set(key, (byDay.get(key) || 0) + 1);
    }

    const days = keys
      .filter((key) => byDay.has(key))
      .map((key) => ({ date: key, slotsRemaining: byDay.get(key) }));

    return res.json({
      days,
      horizonDays: BOOKING_HORIZON_DAYS,
      scheduleConfigured: schedules.length > 0,
    });
  } catch (error) {
    return next(error);
  }
};

// @desc    Bookable slots for a doctor on one day
// @route   GET /api/v1/bookings/doctors/:id/slots?date=YYYY-MM-DD
// @access  Private/Patient
const listDoctorSlots = async (req, res, next) => {
  try {
    const doctor = await validateDoctor(res, req.params.id);
    if (!doctor) return undefined;

    const date = String(req.query.date || '');
    const fromKey = today();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: 'A valid date query is required (YYYY-MM-DD)' });
    }
    if (date < fromKey) {
      return res.status(400).json({ message: 'That date has already passed' });
    }
    if (!isWithinHorizon(date, fromKey)) {
      return res.status(400).json({ message: 'That date is too far ahead to book' });
    }

    const slots = await Slot.find({
      schedule: { $in: await scheduleIds(doctor._id) },
      startsAt: { $gte: new Date() },
      status: 'available',
    })
      .sort({ startsAt: 1 })
      .lean();

    const taken = await bookedCounts(doctor._id, [date]);

    const daySlots = slots
      .filter((slot) => localDate(slot.startsAt) === date)
      .map((slot) => {
        const time = clockLabel(slot.startsAt);
        const capacity = Number(slot.capacity) || 1;
        const booked = taken.get(`${date}|${time}`) || 0;
        return {
          id: String(slot._id),
          time,
          endsAt: slot.endsAt ? slot.endsAt.toISOString() : null,
          capacity,
          remaining: Math.max(0, capacity - booked),
          available: Boolean(time) && booked < capacity,
        };
      })
      .filter((slot) => slot.time);

    return res.json({ date, slots: daySlots });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listDoctorDays,
  listDoctorSlots,
  scheduleIds,
  bookedCounts,
  isFull,
  addDays,
  horizonKeys,
  isWithinHorizon,
  BOOKING_HORIZON_DAYS,
  ACTIVE_STATUSES,
};
