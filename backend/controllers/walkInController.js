const mongoose = require('mongoose');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const QueueToken = require('../models/QueueToken');
const OpdAppointment = require('../models/OpdAppointment');
const OpdPatientProfile = require('../models/OpdPatientProfile');
const { ensurePatientForProfile } = require('../utils/patientSync');
const { normalizePhone, isValidDate, isValidSlot } = require('../utils/validators');
const { findOrCreatePatient } = require('../services/patientService');
const { getNextToken } = require('../utils/tokenGenerator');
const { estimateWaitMinutes } = require('../services/waitTimeService');
const {
  sendOtpSms,
  sendPatientRegistrationSms,
  sendSmsConfirmation,
} = require('../utils/notifier');

const { asyncHandler, createError } = require('../utils/errorHandler');

// Active in-memory OTP store for patient phone verification: Map<phone, { otp, expiresAt, verified, patientName }>
const patientOtpStore = new Map();

// ──────────────────────────────────────────────────────
// @desc    Send 6-digit OTP to patient's telephone number
// @route   POST /api/reception/send-otp
// @access  Private — receptionist
// ──────────────────────────────────────────────────────
const sendPatientOtp = asyncHandler(async (req, res) => {
  const { phone, patientName } = req.body;

  if (!phone || String(phone).trim().length < 7) {
    throw createError('A valid telephone number is required to send verification OTP.', 400);
  }

  const cleanPhone = String(phone).trim();
  const normalized = normalizePhone(cleanPhone) || cleanPhone;

  // Generate 6-digit numeric OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes validity

  const record = {
    otp,
    expiresAt,
    verified: false,
    patientName: patientName?.trim() || 'Patient',
  };

  patientOtpStore.set(cleanPhone, record);
  if (normalized !== cleanPhone) {
    patientOtpStore.set(normalized, record);
  }

  // Trigger SMS notification through gateway/notifier
  const smsResult = await sendOtpSms(cleanPhone, otp, patientName);

  res.status(200).json({
    success: true,
    message: `Verification OTP successfully dispatched to ${cleanPhone}`,
    phone: cleanPhone,
    otp, // included for demo and simulated testing convenience
    expiresAt,
    smsDispatched: true,
  });
});

// ──────────────────────────────────────────────────────
// @desc    Verify patient OTP
// @route   POST /api/reception/verify-otp
// @access  Private — receptionist
// ──────────────────────────────────────────────────────
const verifyPatientOtp = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    throw createError('Telephone number and 6-digit OTP are required.', 400);
  }

  const cleanPhone = String(phone).trim();
  const normalized = normalizePhone(cleanPhone) || cleanPhone;
  const cleanOtp = String(otp).trim();

  const record = patientOtpStore.get(cleanPhone) || patientOtpStore.get(normalized);

  if (!record) {
    throw createError('No active OTP found for this number. Please click Send OTP.', 400);
  }

  if (Date.now() > record.expiresAt) {
    patientOtpStore.delete(cleanPhone);
    patientOtpStore.delete(normalized);
    throw createError('OTP code has expired. Please request a new OTP.', 400);
  }

  if (record.otp !== cleanOtp) {
    throw createError('Incorrect OTP entered. Please check patient mobile and re-enter.', 400);
  }

  record.verified = true;

  res.status(200).json({
    success: true,
    verified: true,
    message: 'Patient telephone number successfully verified!',
    phone: cleanPhone,
  });
});

// ──────────────────────────────────────────────────────
// @desc    Search patients by NIC or phone
// @route   GET /api/reception/patients/search?q=
// @access  Private — receptionist
// ──────────────────────────────────────────────────────
const searchPatients = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q || q.trim().length < 3) {
    throw createError('Search query must be at least 3 characters.', 400);
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
    .select('fullName nic phone age gender dob bloodGroup nicVerified')
    .limit(10)
    .lean();

  res.json({
    found: patients.length > 0,
    patients,
  });
});

// ──────────────────────────────────────────────────────
// @desc    Get available time slots for a doctor on a date
// @route   GET /api/reception/slots?doctorId=&date=
// @access  Private — receptionist
// ──────────────────────────────────────────────────────
const getSlots = asyncHandler(async (req, res) => {
  const { doctorId, date } = req.query;

  if (!doctorId) {
    throw createError('doctorId is required.', 400);
  }
  if (!date || !isValidDate(date)) {
    throw createError('A valid date (YYYY-MM-DD) is required.', 400);
  }

  const doctor = await Doctor.findById(doctorId).lean();
  if (!doctor) {
    throw createError('Doctor not found.', 404);
  }

  const start = doctor.workingHours?.start || '08:00';
  const end = doctor.workingHours?.end || '16:30';
  const allSlots = buildSlots(start, end);

  const OpdAppointment = require('../models/OpdAppointment');

  const [activeAppointments, activeOpdAppointments] = await Promise.all([
    Appointment.find({
      doctor: doctorId,
      date,
      status: { $nin: ['cancelled', 'no_show'] },
    })
      .select('slotTime')
      .lean(),
    OpdAppointment.find({
      doctor: doctorId,
      date,
      status: { $nin: ['cancelled', 'no_show'] },
    })
      .select('slotTime')
      .lean(),
  ]);

  const bookedTimes = new Set([
    ...activeAppointments.map((a) => a.slotTime),
    ...activeOpdAppointments.map((a) => a.slotTime),
  ]);

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
});

// ──────────────────────────────────────────────────────
// @desc    Register a walk-in patient and book appointment
// @route   POST /api/reception/walk-in
// @access  Private — receptionist
// ──────────────────────────────────────────────────────
const walkInBooking = asyncHandler(async (req, res) => {
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
    throw createError('Department is required.', 400);
  }
  if (!doctorId) {
    throw createError('Doctor ID is required.', 400);
  }
  if (!mongoose.Types.ObjectId.isValid(doctorId)) {
    throw createError('Doctor ID is not valid.', 400);
  }
  if (!date || !isValidDate(date)) {
    throw createError('A valid date (YYYY-MM-DD) is required.', 400);
  }
  if (slotTime && !isValidSlot(slotTime)) {
    throw createError('Slot time must be in HH:mm format.', 400);
  }
  if (!['normal', 'senior', 'urgent'].includes(priority)) {
    throw createError('Priority must be normal, senior, or urgent.', 400);
  }

  // ── 2. Load and check doctor ──
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) {
    throw createError('Doctor not found.', 404);
  }
  if (doctor.status !== 'active') {
    throw createError(`Doctor is currently ${doctor.status}. Please select an active doctor.`, 400);
  }

  // ── 3. Find or create patient ──
  const { patient, isNewPatient } = await findOrCreatePatient({
    existingPatientId,
    patient: patientData || {},
    createdBy: req.user._id,
  });

  // ── 4. Resolve slot time ──
  let resolvedSlot = slotTime;
  if (!resolvedSlot) {
    resolvedSlot = await findEarliestAvailableSlot(doctor, doctorId, date);
    if (!resolvedSlot) {
      throw createError('No free slots left today for this doctor', 409);
    }
  }

  const resolvedType =
    req.body.type === 'pre_booked' || req.body.intakeType === 'pre_booked'
      ? 'pre_booked'
      : 'walk_in';

  // If checking in a pre-existing appointment ID (Appointment or OpdAppointment)
  if (req.body.appointmentId && mongoose.Types.ObjectId.isValid(req.body.appointmentId)) {
    let existing = await Appointment.findById(req.body.appointmentId);
    let existingOpd = null;
    if (!existing) {
      const OpdAppointment = require('../models/OpdAppointment');
      existingOpd = await OpdAppointment.findById(req.body.appointmentId);
    }

    if (existing || existingOpd) {
      if (existing) {
        existing.status = 'checked_in';
        if (priority) existing.priority = priority;
      }
      if (existingOpd) {
        existingOpd.status = 'checked_in';
        await existingOpd.save();
        if (!existing) {
          existing = await Appointment.create({
            patient: patient._id,
            doctor: doctorId,
            department: department.trim(),
            date,
            slotTime: resolvedSlot || existingOpd.slotTime,
            type: 'pre_booked',
            status: 'checked_in',
            bookedBy: req.user._id,
          });
        }
      }
      let existingToken = await QueueToken.findOne({ appointment: existing._id });
      if (!existingToken) {
        existingToken = await getNextToken(existing.department, date, priority);
        existingToken.appointment = existing._id;
        existingToken.patient = existing.patient;
        existingToken.doctor = existing.doctor;
        await existingToken.save();
        existing.tokenNumber = existingToken.tokenNumber;
        await existing.save();
      }
      const waitInfo = await estimateWaitMinutes(existing.doctor, date);
      return res.status(200).json({
        isNewPatient: false,
        patient,
        appointment: existing,
        token: {
          tokenLabel: existingToken.tokenLabel,
          tokenNumber: existingToken.tokenNumber,
        },
        doctor: {
          name: doctor.name,
          department: doctor.department,
          room: doctor.room,
        },
        estimatedWaitMinutes: waitInfo.estimatedWaitMinutes,
        patientsAhead: waitInfo.patientsAhead,
      });
    }
  }

  // Double booking check across both Appointment and OpdAppointment
  const OpdAppointment = require('../models/OpdAppointment');
  const [existingAppt, existingOpd] = await Promise.all([
    Appointment.findOne({
      doctor: doctorId,
      date,
      slotTime: resolvedSlot,
      status: { $nin: ['cancelled', 'no_show'] },
    }).lean(),
    OpdAppointment.findOne({
      doctor: doctorId,
      date,
      slotTime: resolvedSlot,
      status: { $nin: ['cancelled', 'no_show'] },
    }).lean(),
  ]);

  if (existingAppt || existingOpd) {
    const nextAvailableSlot = await findEarliestAvailableSlot(doctor, doctorId, date);
    const conflictErr = createError(`Slot ${resolvedSlot} is already booked by a patient. Please choose an available slot.`, 409);
    conflictErr.requestedSlot = resolvedSlot;
    conflictErr.nextAvailableSlot = nextAvailableSlot;
    throw conflictErr;
  }

  const appointmentData = {
    patient: patient._id,
    doctor: doctorId,
    department: department.trim(),
    date,
    slotTime: resolvedSlot,
    type: resolvedType,
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
      const conflictErr = createError('Slot was just taken, please choose the next slot', 409);
      conflictErr.requestedSlot = resolvedSlot;
      conflictErr.nextAvailableSlot = nextAvailableSlot;
      throw conflictErr;
    }
    throw err;
  }

  // ── 8. Estimate wait time ──
  const waitInfo = await estimateWaitMinutes(doctorId, date);

  // ── 9. SMS notification to patient (Registration Confirmation) ──
  let smsNotification = null;
  try {
    smsNotification = await sendPatientRegistrationSms(patient, appointment, token, doctor, waitInfo);
  } catch (smsErr) {
    console.error('SMS notification failed (non-blocking):', smsErr.message);
    smsNotification = {
      sent: false,
      recipient: patient.phone,
      message: `Dear ${patient.fullName}, your registration at Medi-Queue Hospital is confirmed! Token: ${token.tokenLabel}. Doctor: Dr. ${doctor.name}.`,
      error: smsErr.message,
    };
  }

  // Clear OTP verified record once patient is registered
  if (patient.phone) {
    patientOtpStore.delete(patient.phone);
    const norm = normalizePhone(patient.phone);
    if (norm) patientOtpStore.delete(norm);
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
      dob: patient.dob ? new Date(patient.dob).toISOString().split('T')[0] : null,
      bloodGroup: patient.bloodGroup || null,
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
    smsNotification: smsNotification || {
      sent: true,
      recipient: patient.phone,
      message: `Dear ${patient.fullName}, your registration at Medi-Queue Hospital is confirmed! Token: ${token.tokenLabel}. Doctor: Dr. ${doctor.name}.`,
      sentAt: new Date().toISOString(),
    },
  });
});

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

  const OpdAppointment = require('../models/OpdAppointment');
  const [booked, opdBooked] = await Promise.all([
    Appointment.find({
      doctor: doctorId,
      date,
      status: { $nin: ['cancelled', 'no_show'] },
    })
      .select('slotTime')
      .lean(),
    OpdAppointment.find({
      doctor: doctorId,
      date,
      status: { $nin: ['cancelled', 'no_show'] },
    })
      .select('slotTime')
      .lean(),
  ]);
  const bookedSet = new Set([
    ...booked.map((a) => a.slotTime),
    ...opdBooked.map((a) => a.slotTime),
  ]);

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

// ──────────────────────────────────────────────────────
// @desc    List/search pre-booked appointments for today
// @route   GET /api/reception/pre-booked?date=&q=
// @access  Private — receptionist
// ──────────────────────────────────────────────────────
const getPreBookedAppointments = asyncHandler(async (req, res) => {
  const { date, q } = req.query;
  const now = new Date();
  const todayStr =
    date ||
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

  const [appointments, opdList] = await Promise.all([
    Appointment.find({
      date: todayStr,
      $or: [{ type: 'pre_booked' }, { status: 'booked' }],
    })
      .populate('patient', 'fullName nic phone age gender')
      .populate('doctor', 'name department room specialization')
      .sort({ slotTime: 1 })
      .lean(),
    OpdAppointment.find({
      date: todayStr,
      status: { $nin: ['cancelled'] },
    })
      .populate('profile', 'fullName nic phone age gender allergies birthday')
      .populate('doctor', 'name department room specialization')
      .sort({ slotTime: 1 })
      .lean(),
  ]);

  const seenDoctorSlot = new Set();
  let results = [];

  // 1. Process legacy / shared appointments
  for (const a of appointments) {
    const key = `${String(a.doctor?._id || a.doctor)}_${a.date}_${a.slotTime}`;
    seenDoctorSlot.add(key);

    results.push({
      _id: a._id,
      bookingRef: `BK-${String(a._id).slice(-4).toUpperCase()}`,
      date: a.date,
      slotTime: a.slotTime,
      department: a.department || a.doctor?.department || 'General OPD',
      status: a.status,
      type: a.type || 'pre_booked',
      priority: a.priority || 'normal',
      tokenNumber: a.tokenNumber || null,
      patient: a.patient
        ? {
            _id: a.patient._id,
            fullName: a.patient.fullName,
            nic: a.patient.nic || '',
            phone: a.patient.phone || '',
            age: a.patient.age,
            gender: a.patient.gender,
          }
        : null,
      doctor: a.doctor && typeof a.doctor === 'object'
        ? {
            _id: a.doctor._id,
            name: a.doctor.name,
            department: a.doctor.department,
            room: a.doctor.room,
          }
        : null,
    });
  }

  // 2. Process OpdAppointments, ensuring matching Patient doc and deduplication
  for (const a of opdList) {
    const key = `${String(a.doctor?._id || a.doctor)}_${a.date}_${a.slotTime}`;
    if (seenDoctorSlot.has(key)) continue; // already covered by shared Appointment
    seenDoctorSlot.add(key);

    let patDoc = null;
    if (a.profile) {
      patDoc = await ensurePatientForProfile(a.profile);
    }

    results.push({
      _id: a._id,
      bookingRef: `OPD-${String(a._id).slice(-4).toUpperCase()}`,
      date: a.date,
      slotTime: a.slotTime,
      department: a.department || a.doctor?.department || 'General OPD',
      status: a.status,
      type: a.type || 'pre_booked',
      priority: 'normal',
      tokenNumber: a.tokenNumber || null,
      patient: patDoc
        ? {
            _id: patDoc._id,
            fullName: patDoc.fullName,
            nic: patDoc.nic || '',
            phone: patDoc.phone || '',
            age: patDoc.age,
            gender: patDoc.gender,
          }
        : (a.profile
          ? {
              _id: a.profile._id,
              fullName: a.profile.fullName,
              nic: a.profile.nic || '',
              phone: a.profile.phone || '',
              age: a.profile.age,
              gender: a.profile.gender,
            }
          : null),
      doctor: a.doctor && typeof a.doctor === 'object'
        ? {
            _id: a.doctor._id,
            name: a.doctor.name,
            department: a.doctor.department,
            room: a.doctor.room,
          }
        : null,
    });
  }

  // ── AUTO-ISSUE TOKENS FOR PRE-BOOKINGS ──
  for (const item of results) {
    let qt = await QueueToken.findOne({ appointment: item._id });
    if (!qt && item.patient?._id) {
      try {
        const nextTok = await getNextToken(todayStr);
        qt = await QueueToken.create({
          appointment: item._id,
          patient: item.patient._id,
          department: item.department || item.doctor?.department || 'General OPD',
          date: todayStr,
          tokenNumber: nextTok.tokenNumber,
          tokenLabel: nextTok.tokenLabel,
          status: 'waiting',
          priority: item.priority || 'normal',
          assignedDoctor: item.doctor?._id || null,
        });
        await Appointment.findByIdAndUpdate(item._id, { tokenNumber: nextTok.tokenNumber }).catch(() => {});
        await OpdAppointment.findByIdAndUpdate(item._id, { tokenNumber: nextTok.tokenNumber }).catch(() => {});
      } catch (err) {
        qt = await QueueToken.findOne({ appointment: item._id });
      }
    }
    item.tokenNumber = qt?.tokenNumber || item.tokenNumber || null;
    item.tokenLabel = qt?.tokenLabel || (item.tokenNumber ? `OPD-${String(item.tokenNumber).padStart(3, '0')}` : null);
    item.queueStatus = qt?.status || 'waiting';
  }

  if (q && q.trim()) {
    const term = q.trim().toLowerCase();
    results = results.filter((item) => {
      const pName = (item.patient?.fullName || '').toLowerCase();
      const pNic = (item.patient?.nic || '').toLowerCase();
      const pPhone = (item.patient?.phone || '').toLowerCase();
      const bRef = (item.bookingRef || '').toLowerCase();
      const dName = (item.doctor?.name || '').toLowerCase();
      const idStr = String(item._id).toLowerCase();
      return (
        pName.includes(term) ||
        pNic.includes(term) ||
        pPhone.includes(term) ||
        bRef.includes(term) ||
        dName.includes(term) ||
        idStr.includes(term)
      );
    });
  }

  res.json({
    success: true,
    count: results.length,
    appointments: results,
  });
});

module.exports = {
  searchPatients,
  getSlots,
  walkInBooking,
  getPreBookedAppointments,
  sendPatientOtp,
  verifyPatientOtp,
};
