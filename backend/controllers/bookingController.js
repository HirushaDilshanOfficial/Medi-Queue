const Doctor = require('../models/Doctor');
const Slot = require('../models/Slot');
const Schedule = require('../models/Schedule');
const OpdAppointment = require('../models/OpdAppointment');
const OpdQueueEntry = require('../models/OpdQueueEntry');
const { releaseTokenNumber } = require('../models/OpdQueueCounter');
const { localDate } = require('../models/receptionistFields');
const { today, buildLiveState } = require('../utils/opdQueue');
const { mapAppointment, clockLabel, isValidObjectId } = require('../utils/opdAppointment');
const {
  scheduleIds,
  bookedCounts,
  isFull,
  isWithinHorizon,
} = require('./slotController');

const ACTIVE_STATUSES = OpdAppointment.ACTIVE_STATUSES;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_KEY = /^([01]\d|2[0-3]):([0-5]\d)$/;

function slotTakenError(res) {
  return res.status(409).json({ message: 'That slot has just been taken. Please choose another.' });
}

// Maps the unique partial index on { profile, doctor, date, slotTime } to a 409,
// so a double submit or a race reads as "slot gone" rather than a server error.
function forwardConflict(error, res, next) {
  if (error && error.code === 11000) {
    slotTakenError(res);
    return;
  }
  next(error);
}

function validateRequest(res, { doctorId, date, slotTime }) {
  if (!doctorId || !date || !slotTime) {
    res.status(400).json({ message: 'doctorId, date and slotTime are required' });
    return false;
  }
  if (!isValidObjectId(doctorId)) {
    res.status(400).json({ message: 'Invalid doctor id' });
    return false;
  }
  if (!DATE_KEY.test(String(date))) {
    res.status(400).json({ message: 'A valid date is required (YYYY-MM-DD)' });
    return false;
  }
  if (!TIME_KEY.test(String(slotTime))) {
    res.status(400).json({ message: 'A valid time is required (HH:mm)' });
    return false;
  }

  const fromKey = today();
  if (String(date) < fromKey) {
    res.status(400).json({ message: 'That date has already passed' });
    return false;
  }
  if (!isWithinHorizon(String(date), fromKey)) {
    res.status(400).json({ message: 'That date is too far ahead to book' });
    return false;
  }
  return true;
}

// Resolves the Slot row backing a "date + HH:mm" pair, together with the Schedule
// that owns it (the schedule carries that day's consulting room). `date` is the
// local Colombo day, so the comparison uses the same localDate() key the booking
// flow stores rather than raw UTC instants.
async function findSlot(doctorId, date, slotTime) {
  const slots = await Slot.find({
    schedule: { $in: await scheduleIds(doctorId) },
    startsAt: { $gte: new Date() },
    status: 'available',
  })
    .sort({ startsAt: 1 })
    .lean();

  const slot = slots.find(
    (row) => localDate(row.startsAt) === date && clockLabel(row.startsAt) === slotTime,
  );
  if (!slot) return null;

  const schedule = await Schedule.findById(slot.schedule).lean();
  return { slot, schedule };
}

// @desc    Create a booking
// @route   POST /api/v1/bookings
// @access  Private/Patient
const createBooking = async (req, res, next) => {
  try {
    const { doctorId, date, slotTime, reason, type } = req.body;
    if (!validateRequest(res, { doctorId, date, slotTime })) return undefined;

    const doctor = await Doctor.findById(doctorId).lean();
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

    const profileId = req.patientProfile._id;

    const match = await findSlot(doctor._id, String(date), String(slotTime));
    if (!match) {
      return res.status(400).json({ message: 'That slot is no longer available' });
    }

    const counts = await bookedCounts(doctor._id, [String(date)]);
    if (isFull(counts, String(date), String(slotTime), match.slot.capacity)) {
      return slotTakenError(res);
    }

    // One live booking per patient per doctor per day.
    const sameDay = await OpdAppointment.findOne({
      profile: profileId,
      doctor: doctor._id,
      date: String(date),
      status: { $in: ACTIVE_STATUSES },
    }).lean();
    if (sameDay) {
      return res.status(409).json({
        message: 'You already have a booking with this doctor on that date.',
      });
    }

    const appointment = await OpdAppointment.create({
      profile: profileId,
      doctor: doctor._id,
      doctorName: doctor.name,
      department: doctor.department,
      room: (match.schedule && match.schedule.room) || doctor.room || null,
      date: String(date),
      slotTime: String(slotTime),
      endsAt: match.slot.endsAt || null,
      type: type === 'walk_in' ? 'walk_in' : 'pre_booked',
      reason: reason ? String(reason).trim() : undefined,
    });

    return res.status(201).json({
      appointment: mapAppointment(appointment, { todayKey: today() }),
    });
  } catch (error) {
    return forwardConflict(error, res, next);
  }
};

// Attaches live queue state to any checked-in appointment, so the "My bookings"
// list can show position and ETA without the client making a second request.
async function attachLive(appointments, todayKey) {
  if (!appointments.length) return [];

  const entries = await OpdQueueEntry.find({
    appointment: { $in: appointments.map((a) => a._id) },
  }).lean();
  const byAppointment = new Map(entries.map((entry) => [String(entry.appointment), entry]));

  return Promise.all(
    appointments.map(async (appointment) => {
      const entry = byAppointment.get(String(appointment._id));
      const live = entry ? await buildLiveState(entry) : null;
      return mapAppointment(appointment, { todayKey, live });
    }),
  );
}

// @desc    List my bookings
// @route   GET /api/v1/bookings?scope=upcoming|past|all
// @access  Private/Patient
const listMyBookings = async (req, res, next) => {
  try {
    const { scope = 'upcoming' } = req.query;
    const todayKey = today();
    const filter = { profile: req.patientProfile._id };

    if (scope === 'upcoming') {
      filter.date = { $gte: todayKey };
      filter.status = { $in: ACTIVE_STATUSES };
    } else if (scope === 'past') {
      filter.$or = [
        { date: { $lt: todayKey } },
        { status: { $in: ['completed', 'no_show', 'cancelled'] } },
      ];
    }

    const appointments = await OpdAppointment.find(filter)
      .sort({ date: 1, slotTime: 1 })
      .lean();

    return res.json({ appointments: await attachLive(appointments, todayKey), scope });
  } catch (error) {
    return next(error);
  }
};

// @desc    Cancel a booking
// @route   PATCH /api/v1/bookings/:id/cancel
// @access  Private/Patient
const cancelBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid appointment id' });
    }

    const appointment = await OpdAppointment.findOne({ _id: id, profile: req.patientProfile._id });
    if (!appointment) return res.status(404).json({ message: 'Booking not found' });

    if (!ACTIVE_STATUSES.includes(appointment.status)) {
      return res.status(400).json({ message: `This booking is already ${appointment.status}` });
    }

    const entry = await OpdQueueEntry.findOne({ appointment: appointment._id });

    appointment.status = 'cancelled';
    appointment.cancelledAt = new Date();
    if (req.body && req.body.reason) {
      appointment.cancelReason = String(req.body.reason).trim();
    }
    await appointment.save();

    // A waiting entry is released so the token returns to the pool. An entry the
    // doctor has already called is left alone, because the token was seen.
    let tokenReleased = false;
    if (entry && entry.status === 'waiting') {
      entry.status = 'cancelled';
      await entry.save();
      await releaseTokenNumber(entry.department, entry.queueDate, entry.tokenNumber);
      tokenReleased = true;
    }

    return res.json({
      appointment: mapAppointment(appointment, { todayKey: today() }),
      tokenReleased,
    });
  } catch (error) {
    return next(error);
  }
};

// @desc    Reschedule a booking
// @route   PATCH /api/v1/bookings/:id/reschedule
// @access  Private/Patient
const rescheduleBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date, slotTime } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid appointment id' });
    }
    if (!date || !slotTime) {
      return res.status(400).json({ message: 'date and slotTime are required' });
    }
    if (!DATE_KEY.test(String(date)) || !TIME_KEY.test(String(slotTime))) {
      return res.status(400).json({ message: 'A valid date and time are required' });
    }

    const todayKey = today();
    if (String(date) < todayKey) {
      return res.status(400).json({ message: 'That date has already passed' });
    }
    if (!isWithinHorizon(String(date), todayKey)) {
      return res.status(400).json({ message: 'That date is too far ahead to book' });
    }

    const appointment = await OpdAppointment.findOne({ _id: id, profile: req.patientProfile._id });
    if (!appointment) return res.status(404).json({ message: 'Booking not found' });

    if (!ACTIVE_STATUSES.includes(appointment.status)) {
      return res.status(400).json({ message: `This booking is already ${appointment.status}` });
    }

    if (appointment.date === String(date) && appointment.slotTime === String(slotTime)) {
      return res.status(400).json({ message: 'That is the slot you are already booked into' });
    }

    const match = await findSlot(appointment.doctor, String(date), String(slotTime));
    if (!match) {
      return res.status(400).json({ message: 'That slot is no longer available' });
    }

    const counts = await bookedCounts(appointment.doctor, [String(date)]);
    if (isFull(counts, String(date), String(slotTime), match.slot.capacity)) {
      return slotTakenError(res);
    }

    // Moving to a different day invalidates the token issued for the old day, so
    // a still-waiting entry is released and the patient re-checks-in to collect a
    // new one. Staying on the same day keeps the token.
    const entry = await OpdQueueEntry.findOne({ appointment: appointment._id });
    let tokenPreserved = false;

    if (entry) {
      if (entry.status === 'waiting') {
        entry.status = 'cancelled';
        await entry.save();
        await releaseTokenNumber(entry.department, entry.queueDate, entry.tokenNumber);
        appointment.queueEntry = null;
        appointment.tokenNumber = null;
      } else {
        tokenPreserved = true;
      }
    }

    if (appointment.date !== String(date)) {
      appointment.rescheduledFrom = appointment.date;
    }
    appointment.date = String(date);
    appointment.slotTime = String(slotTime);
    appointment.endsAt = match.slot.endsAt || null;
    if (match.schedule && match.schedule.room) appointment.room = match.schedule.room;
    await appointment.save();

    return res.json({
      appointment: mapAppointment(appointment, { todayKey }),
      tokenPreserved,
    });
  } catch (error) {
    return forwardConflict(error, res, next);
  }
};

// @desc    Booking summary counts for the dashboard
// @route   GET /api/v1/bookings/summary
// @access  Private/Patient
const bookingSummary = async (req, res, next) => {
  try {
    const todayKey = today();
    const profileId = req.patientProfile._id;

    const [upcoming, activeToday, next] = await Promise.all([
      OpdAppointment.countDocuments({
        profile: profileId,
        date: { $gte: todayKey },
        status: { $in: ACTIVE_STATUSES },
      }),
      OpdAppointment.findOne({
        profile: profileId,
        date: todayKey,
        status: { $in: ['booked', 'checked_in', 'in_consultation'] },
      })
        .sort({ slotTime: 1 })
        .lean(),
      OpdAppointment.findOne({
        profile: profileId,
        date: { $gte: todayKey },
        status: { $in: ACTIVE_STATUSES },
      })
        .sort({ date: 1, slotTime: 1 })
        .lean(),
    ]);

    return res.json({
      upcomingCount: upcoming,
      hasAppointmentToday: Boolean(activeToday),
      next: next ? mapAppointment(next, { todayKey }) : null,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createBooking,
  listMyBookings,
  cancelBooking,
  rescheduleBooking,
  bookingSummary,
  ACTIVE_STATUSES,
};
