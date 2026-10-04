const mongoose = require('mongoose');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const QueueToken = require('../models/QueueToken');
const { normalizePhone, isValidDate, isValidSlot } = require('../utils/validators');
const { findOrCreatePatient } = require('../services/patientService');
const { getNextToken } = require('../utils/tokenGenerator');
const { estimateWaitMinutes } = require('../services/waitTimeService');
const { sendSmsConfirmation } = require('../utils/notifier');

// ──────────────────────────────────────────────────────
// @desc    Search patients by NIC or phone
// @route   GET /api/reception/patients/search?q=
// @access  Private — receptionist
// ──────────────────────────────────────────────────────
const searchPatients = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 3) {
      res.status(400);
      throw new Error('Search query must be at least 3 characters.');
    }

    const query = q.trim();

    const conditions = [
      { nic: { $regex: query, $options: 'i' } },
      { phone: { $regex: query, $options: 'i' } },
    ];

    const normalized = normalizePhone(query);
    if (normalized && normalized !== query) {
      conditions.push({ phone: { $regex: normalized, $options: 'i' } });
    }

    const patients = await Patient.find({ $or: conditions })
      .select('fullName nic phone age gender nicVerified')
      .limit(10)
      .lean();

    res.json({
      found: patients.length > 0,
      patients,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────
// @desc    Get available time slots for a doctor on a date
// @route   GET /api/reception/slots?doctorId=&date=
// @access  Private — receptionist
// ──────────────────────────────────────────────────────
const getSlots = async (req, res, next) => {
  try {
    const { doctorId, date } = req.query;

    if (!doctorId) {
      res.status(400);
      throw new Error('doctorId is required.');
    }
    if (!date || !isValidDate(date)) {
      res.status(400);
      throw new Error('A valid date (YYYY-MM-DD) is required.');
    }

    const doctor = await Doctor.findById(doctorId).lean();
    if (!doctor) {
      res.status(404);
      throw new Error('Doctor not found.');
    }

    const start = doctor.workingHours?.start || '08:00';
    const end = doctor.workingHours?.end || '16:30';
    const allSlots = buildSlots(start, end);

    const activeAppointments = await Appointment.find({
      doctor: doctorId,
      date,
      isActive: true,
    })
      .select('slotTime')
      .lean();

    const bookedTimes = new Set(activeAppointments.map((a) => a.slotTime));

    const now = new Date();
    const isToday =
      date === new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Colombo',
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(now);

    const currentTime = isToday
      ? new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Colombo',
          hour: '2-digit', minute: '2-digit', hour12: false,
        }).format(now)
      : null;

    let earliestAvailable = null;

    const slots = allSlots.map((time) => {
      let status;
      if (isToday && currentTime && time < currentTime) {
        status = 'past';
      } else if (bookedTimes.has(time)) {
        status = 'booked';
      } else {
        status = 'available';
        if (!earliestAvailable) earliestAvailable = time;
      }
      return { time, status };
    });

    res.json({
      doctor: { name: doctor.name, room: doctor.room || null, status: doctor.status },
      date,
      slots,
      earliestAvailable,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────
// @desc    Register a walk-in patient and book appointment
// @route   POST /api/reception/walk-in
// @access  Private — receptionist
// ──────────────────────────────────────────────────────
const walkInBooking = async (req, res, next) => {
  try {
    const {
      patient: patientData,
      existingPatientId,
      department,
      doctorId,
      date,
      slotTime,
      priority = 'normal',
    } = req.body;

    // ── 1. Validate input ──
    if (typeof department !== 'string' || !department.trim()) {
      res.status(400);
      throw new Error('Department is required.');
    }
    if (!doctorId) {
      res.status(400);
      throw new Error('Doctor ID is required.');
    }
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      res.status(400);
      throw new Error('Doctor ID is not valid.');
    }
    if (!date || !isValidDate(date)) {
      res.status(400);
      throw new Error('A valid date (YYYY-MM-DD) is required.');
    }
    if (slotTime && !isValidSlot(slotTime)) {
      res.status(400);
      throw new Error('Slot time must be in HH:mm format.');
    }
    if (!['normal', 'senior', 'urgent'].includes(priority)) {
      res.status(400);
      throw new Error('Priority must be normal, senior, or urgent.');
    }

    // ── 2. Load and check doctor ──
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      res.status(404);
      throw new Error('Doctor not found.');
    }
    if (doctor.status !== 'active') {
      res.status(400);
      throw new Error(`Doctor is currently ${doctor.status}. Please select an active doctor.`);
    }

    // ── 3. Find or create patient ──
    const { patient, isNewPatient } = await findOrCreatePatient({
      existingPatientId,
      patient: patientData || {},
      createdBy: req.user._id,
    }).catch((err) => {
      res.status(err.statusCode || 400);
      throw err;
    });

    // ── 4. Resolve slot time ──
    let resolvedSlot = slotTime;
    if (!resolvedSlot) {
      resolvedSlot = await findEarliestAvailableSlot(doctor, doctorId, date);
      if (!resolvedSlot) {
        return res.status(409).json({
          message: 'No free slots left today for this doctor',
        });
      }
    }

    const appointmentData = {
      patient: patient._id,
      doctor: doctorId,
      department: department.trim(),
      date,
      slotTime: resolvedSlot,
      type: 'walk_in',
      status: 'checked_in',
      bookedBy: req.user._id,
    };

    // ── 5–7. Appointment + token + QueueToken ──
    let appointment;
    let token;
    try {
      if (await supportsTransactions()) {
        ({ appointment, token } = await createWithTransaction(
          appointmentData, patient, doctorId, priority
        ));
      } else {
        ({ appointment, token } = await createWithRollback(
          appointmentData, patient, doctorId, priority
        ));
      }
    } catch (err) {
      if (err.code === 11000 && isAppointmentSlotConflict(err)) {
        const nextAvailableSlot = await findEarliestAvailableSlot(doctor, doctorId, date);
        return res.status(409).json({
          message: 'Slot was just taken, please choose the next slot',
          requestedSlot: resolvedSlot,
          nextAvailableSlot,
        });
      }
      throw err;
    }

    // ── 8. Estimate wait time ──
    const waitInfo = await estimateWaitMinutes(doctorId, date);

    // ── 9. SMS notification (fire-and-forget) ──
    try {
      await sendSmsConfirmation(patient, token);
    } catch (smsErr) {
      console.error('SMS notification failed (non-blocking):', smsErr.message);
    }

    // ── 10. Respond ──
    res.status(201).json({
      isNewPatient,
      patient: {
        _id: patient._id,
        fullName: patient.fullName,
        nic: patient.nic || null,
        phone: patient.phone,
        age: patient.age || null,
        gender: patient.gender || null,
      },
      appointment: {
        _id: appointment._id,
        date: appointment.date,
        slotTime: appointment.slotTime,
        status: appointment.status,
        type: appointment.type,
        department: appointment.department,
      },
      token: {
        tokenLabel: token.tokenLabel,
        tokenNumber: token.tokenNumber,
      },
      doctor: {
        name: doctor.name,
        room: doctor.room || null,
      },
      estimatedWaitMinutes: waitInfo.estimatedWaitMinutes,
      patientsAhead: waitInfo.patientsAhead,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────

let transactionSupportCache = null;

/**
 * Transactions need a replica set or sharded cluster (mongos).
 * Result is cached after the first check.
 */
async function supportsTransactions() {
  if (transactionSupportCache !== null) return transactionSupportCache;
  try {
    const info = await mongoose.connection.db.admin().command({ hello: 1 });
    transactionSupportCache = Boolean(info.setName) || info.msg === 'isdbgrid';
  } catch {
    transactionSupportCache = false;
  }
  return transactionSupportCache;
}

/** True when an 11000 error comes from the doctor+date+slotTime index. */
function isAppointmentSlotConflict(err) {
  if (err.keyPattern) return Boolean(err.keyPattern.slotTime);
  return /slotTime/.test(err.message || '');
}

function buildQueueTokenData(appointment, patient, doctorId, priority, token) {
  return {
    appointment: appointment._id,
    patient: patient._id,
    department: appointment.department,
    date: appointment.date,
    tokenNumber: token.tokenNumber,
    tokenLabel: token.tokenLabel,
    status: 'waiting',
    priority,
    assignedDoctor: doctorId,
  };
}

/**
 * Steps 5–7 inside a MongoDB transaction.
 * The token counter stays outside the transaction on purpose: it is already
 * atomic, and keeping it out avoids write conflicts on the shared counter doc.
 * If the transaction aborts, that token number is skipped (a harmless gap).
 */
async function createWithTransaction(appointmentData, patient, doctorId, priority) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const [appointment] = await Appointment.create([appointmentData], { session });

      const token = await getNextToken(appointmentData.date);
      appointment.tokenNumber = token.tokenNumber;
      await appointment.save({ session });

      await QueueToken.create(
        [buildQueueTokenData(appointment, patient, doctorId, priority, token)],
        { session }
      );

      result = { appointment, token };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

/**
 * Steps 5–7 without transactions (standalone MongoDB).
 * If step 6 or 7 fails, the Appointment is deleted so no orphan remains.
 */
async function createWithRollback(appointmentData, patient, doctorId, priority) {
  const appointment = await Appointment.create(appointmentData);
  try {
    const token = await getNextToken(appointmentData.date);
    appointment.tokenNumber = token.tokenNumber;
    await appointment.save();

    await QueueToken.create(
      buildQueueTokenData(appointment, patient, doctorId, priority, token)
    );

    return { appointment, token };
  } catch (err) {
    await Appointment.findByIdAndDelete(appointment._id).catch((delErr) =>
      console.error('Rollback failed for appointment', appointment._id, delErr.message)
    );
    throw err;
  }
}

/**
 * Build "HH:mm" strings in 15-min steps (exclusive of endTime).
 */
function buildSlots(startTime, endTime) {
  const slots = [];
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;

  for (let m = startMin; m < endMin; m += 15) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    slots.push(`${hh}:${mm}`);
  }
  return slots;
}

/**
 * Find the earliest available slot for a doctor on a date.
 * Skips past slots if the date is today.
 */
async function findEarliestAvailableSlot(doctor, doctorId, date) {
  const start = doctor.workingHours?.start || '08:00';
  const end = doctor.workingHours?.end || '16:30';
  const allSlots = buildSlots(start, end);

  const booked = await Appointment.find({ doctor: doctorId, date, isActive: true })
    .select('slotTime')
    .lean();
  const bookedSet = new Set(booked.map((a) => a.slotTime));

  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);

  const currentTime = date === todayStr
    ? new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Colombo',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(now)
    : null;

  for (const slot of allSlots) {
    if (currentTime && slot < currentTime) continue;
    if (!bookedSet.has(slot)) return slot;
  }
  return null;
}

module.exports = { searchPatients, getSlots, walkInBooking };
