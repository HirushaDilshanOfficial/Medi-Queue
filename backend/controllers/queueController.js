const crypto = require('crypto');

const Doctor = require('../models/Doctor');
const OpdAppointment = require('../models/OpdAppointment');
const OpdQueueEntry = require('../models/OpdQueueEntry');
const { nextTokenNumber, releaseTokenNumber } = require('../models/OpdQueueCounter');
const { today, buildLiveState, buildBoard, ACTIVE_STATUSES } = require('../utils/opdQueue');
const { relativeDate, humanDate, isValidObjectId } = require('../utils/opdAppointment');

const APPOINTMENT_ACTIVE = OpdAppointment.ACTIVE_STATUSES;

// Short, unambiguous alphabet: no I/O/0/1, so a code read aloud or copied off a
// blurry print still scans.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generatePassCode() {
  const bytes = crypto.randomBytes(24);
  let out = '';
  for (const byte of bytes) {
    out += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return out;
}

// The pass QR carries a URL so a scanner at the clinic door can validate the pass
// instead of showing a dead string. Only the code travels; no patient identity.
function passQrValue(entry) {
  const base = process.env.PUBLIC_WEB_URL || 'https://app.medi-queue.lk';
  return `${base.replace(/\/+$/, '')}/pass/${entry.passCode}`;
}

function mapPass(entry, { todayKey, live } = {}) {
  if (!entry) return null;

  return {
    id: String(entry._id),
    appointmentId: entry.appointment ? String(entry.appointment) : null,
    department: entry.department,
    queueDate: entry.queueDate,
    dateLabel: relativeDate(entry.queueDate, todayKey),
    dateLong: humanDate(entry.queueDate),
    tokenNumber: entry.tokenNumber,
    // Displayed as A-014 so a letter plus digits is easier to recall than a
    // bare number when a patient is called.
    tokenLabel: `A-${String(entry.tokenNumber).padStart(3, '0')}`,
    passCode: entry.passCode,
    qrValue: passQrValue(entry),
    doctorName: entry.doctorName || null,
    room: entry.room || null,
    priority: entry.priority,
    status: entry.status,
    checkedInAt: entry.checkedInAt ? entry.checkedInAt.toISOString() : null,
    calledAt: entry.calledAt ? entry.calledAt.toISOString() : null,
    live: live || null,
  };
}

async function activePassFor(profileId) {
  return OpdQueueEntry.findOne({
    profile: profileId,
    status: { $in: ACTIVE_STATUSES },
  }).sort({ checkedInAt: -1 });
}

// @desc    Check in for today's appointment and collect a queue token
// @route   POST /api/v1/queue/check-in
// @access  Private/Patient
const checkIn = async (req, res, next) => {
  try {
    const { appointmentId, priority } = req.body;
    const profileId = req.patientProfile._id;
    const todayKey = today();

    if (!appointmentId || !isValidObjectId(appointmentId)) {
      return res.status(400).json({ message: 'A valid appointmentId is required' });
    }

    const existing = await activePassFor(profileId);
    if (existing) {
      const live = await buildLiveState(existing);
      return res.status(409).json({
        message: 'You already have an active queue pass',
        pass: mapPass(existing, { todayKey, live }),
      });
    }

    const appointment = await OpdAppointment.findOne({
      _id: appointmentId,
      profile: profileId,
    });
    if (!appointment) return res.status(404).json({ message: 'Booking not found' });

    if (!APPOINTMENT_ACTIVE.includes(appointment.status)) {
      return res.status(400).json({ message: `This booking is ${appointment.status}` });
    }

    if (appointment.date !== todayKey) {
      return res.status(400).json({
        message: `You can only check in on the day of your appointment (${humanDate(appointment.date)}).`,
      });
    }

    if (appointment.status === 'checked_in' && appointment.queueEntry) {
      const entry = await OpdQueueEntry.findById(appointment.queueEntry);
      if (entry) {
        const live = await buildLiveState(entry);
        return res.json({ pass: mapPass(entry, { todayKey, live }) });
      }
    }

    const doctor = await Doctor.findById(appointment.doctor).select('avgConsultMinutes room').lean();
    const avgConsultMinutes = Number(doctor && doctor.avgConsultMinutes) || 10;

    const tokenNumber = await nextTokenNumber(appointment.department, todayKey);

    // A collision is only possible if a token was released out of order; retrying
    // pulls the next number rather than failing the check-in.
    let entry = null;
    for (let attempt = 0; attempt < 3 && !entry; attempt += 1) {
      try {
        entry = await OpdQueueEntry.create({
          appointment: appointment._id,
          profile: profileId,
          department: appointment.department,
          queueDate: todayKey,
          tokenNumber,
          passCode: generatePassCode(),
          doctor: appointment.doctor,
          doctorName: appointment.doctorName,
          room: appointment.room || (doctor && doctor.room) || null,
          avgConsultMinutes,
          priority: priority === 'urgent' ? 'urgent' : 'normal',
          status: 'waiting',
        });
      } catch (error) {
        if (error && error.code === 11000) {
          tokenNumber = await nextTokenNumber(appointment.department, todayKey);
          continue;
        }
        throw error;
      }
    }
    if (!entry) {
      return res.status(503).json({ message: 'Could not allocate a queue token. Please try again.' });
    }

    appointment.status = 'checked_in';
    appointment.queueEntry = entry._id;
    appointment.tokenNumber = entry.tokenNumber;
    await appointment.save();

    const live = await buildLiveState(entry);
    return res.status(201).json({ pass: mapPass(entry, { todayKey, live }) });
  } catch (error) {
    return next(error);
  }
};

// @desc    My current queue pass
// @route   GET /api/v1/queue/my-pass
// @access  Private/Patient
const myPass = async (req, res, next) => {
  try {
    const todayKey = today();
    const entry = await activePassFor(req.patientProfile._id);

    if (!entry) {
      return res.json({ pass: null, message: 'You do not have an active queue pass' });
    }

    const live = await buildLiveState(entry);

    // Keep the linked appointment in step with the queue so the bookings list and
    // the pass card never disagree about whether the patient is checked in.
    await OpdAppointment.updateOne(
      { _id: entry.appointment, profile: req.patientProfile._id, status: 'booked' },
      { $set: { status: 'checked_in', isActive: true, queueEntry: entry._id, tokenNumber: entry.tokenNumber } },
    );

    return res.json({ pass: mapPass(entry, { todayKey, live }) });
  } catch (error) {
    return next(error);
  }
};

// @desc    Lightweight polling endpoint for the live position
// @route   GET /api/v1/queue/my-pass/live
// @access  Private/Patient
const liveState = async (req, res, next) => {
  try {
    const entry = await activePassFor(req.patientProfile._id);
    if (!entry) return res.json({ pass: null, live: null });

    const live = await buildLiveState(entry);
    return res.json({
      pass: {
        id: String(entry._id),
        tokenNumber: entry.tokenNumber,
        status: entry.status,
        calledAt: entry.calledAt ? entry.calledAt.toISOString() : null,
        department: entry.department,
      },
      live,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    return next(error);
  }
};

// @desc    "Now serving" board for a department
// @route   GET /api/v1/queue/board?department=Cardiology
// @access  Private/Patient
const board = async (req, res, next) => {
  try {
    const department = String(req.query.department || '').trim();
    if (!department) {
      return res.status(400).json({ message: 'A department query is required' });
    }

    const data = await buildBoard(department, today());
    return res.json(data);
  } catch (error) {
    return next(error);
  }
};

// @desc    Departments with a live queue right now
// @route   GET /api/v1/queue/departments
// @access  Private/Patient
const liveDepartments = async (req, res, next) => {
  try {
    const todayKey = today();
    const rows = await OpdQueueEntry.aggregate([
      { $match: { queueDate: todayKey, status: { $in: ACTIVE_STATUSES } } },
      {
        $group: {
          _id: '$department',
          waiting: { $sum: 1 },
          nowServing: { $max: '$tokenNumber' },
        },
      },
      { $sort: { waiting: -1, _id: 1 } },
    ]);

    return res.json({
      queueDate: todayKey,
      departments: rows.map((row) => ({
        department: row._id,
        waiting: row.waiting,
        nowServing: row.nowServing || null,
      })),
    });
  } catch (error) {
    return next(error);
  }
};

// @desc    Leave the queue (releases the token if still waiting)
// @route   DELETE /api/v1/queue/my-pass
// @access  Private/Patient
const leaveQueue = async (req, res, next) => {
  try {
    const profileId = req.patientProfile._id;
    const entry = await activePassFor(profileId);
    if (!entry) return res.status(404).json({ message: 'You do not have an active queue pass' });

    if (entry.status === 'called' || entry.status === 'in_consultation') {
      return res
        .status(400)
        .json({ message: 'You have already been called. Please speak to the front desk.' });
    }

    entry.status = 'cancelled';
    await entry.save();
    await releaseTokenNumber(entry.department, entry.queueDate, entry.tokenNumber);

    await OpdAppointment.updateOne(
      { _id: entry.appointment, profile: profileId, status: 'checked_in' },
      { $set: { status: 'booked', isActive: true, queueEntry: null, tokenNumber: null } },
    );

    return res.json({ pass: null, released: true });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  checkIn,
  myPass,
  liveState,
  board,
  liveDepartments,
  leaveQueue,
  mapPass,
  generatePassCode,
  passQrValue,
};
