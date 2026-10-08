const { asyncHandler, createError } = require('../utils/errorHandler');
const { isValidDate } = require('../utils/validators');
const { getOrderedQueue } = require('../services/queueService');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const QueueToken = require('../models/QueueToken');
const Policy = require('../models/Policy');

// QueueToken statuses meaning "the patient is in the room with the doctor".
// callNext marks tokens "called"; "serving" is honoured for legacy/fixture rows.
const IN_CONSULTATION_STATUSES = ['called', 'serving'];

/**
 * @desc    Reception dashboard for a single day: intake split, live queue counts,
 *          average estimated wait, the token currently being consulted, per-doctor
 *          room states and the next 3 waiting tokens.
 * @route   GET /api/reception/dashboard?date=
 * @access  Private — receptionist
 */
const getReceptionDashboard = asyncHandler(async (req, res) => {
  // ── 1. Resolve the target date (defaults to today in Asia/Colombo) ──
  const targetDate = resolveTargetDate(req.query.date);

  // ── 2. Gather every figure for the day in parallel ──
  const [
    intakeRows,
    waitingTokens,
    inConsultationTokens,
    attendedDone,
    doctorsActive,
    doctors,
  ] = await Promise.all([
    Appointment.aggregate([
      { $match: { date: targetDate, status: { $nin: ['cancelled', 'no_show'] } } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
    getOrderedQueue(targetDate, { status: 'waiting' }),
    QueueToken.find({
      date: targetDate,
      status: { $in: IN_CONSULTATION_STATUSES },
    })
      .populate('patient')
      .populate('assignedDoctor')
      .populate({ path: 'appointment', populate: { path: 'doctor' } }),
    QueueToken.countDocuments({ date: targetDate, status: 'done' }),
    Doctor.countDocuments({ status: 'active' }),
    Doctor.find({ status: { $in: ['active', 'on_break'] } }).lean(),
  ]);

  const policy = await Policy.findOne() || { targetWaitTime: 10 };

  // Only consider tokens with valid, non-deleted patient records
  const validWaitingTokens = waitingTokens.filter((t) => Boolean(t.patient));

  // ── 3. Waiting queue: count, mean estimated wait, next token per doctor ──
  const { avgWaitMinutes, nextTokenByDoctor } = summarizeWaitingQueue(
    validWaitingTokens,
    inConsultationTokens,
    policy.targetWaitTime
  );

  const servingDoctorIds = new Set(
    inConsultationTokens
      .map(doctorKey)
      .filter(Boolean)
  );

  // ── 4. Respond ──
  res.json({
    date: targetDate,
    intake: shapeIntake(intakeRows),
    inWaiting: validWaitingTokens.length,
    avgWaitMinutes,
    attendedDone,
    doctorsActive,
    currentlyServing: serializeServingToken(pickCurrentToken(inConsultationTokens)),
    rooms: buildRooms(doctors, servingDoctorIds, nextTokenByDoctor),
    nextInQueue: validWaitingTokens.slice(0, 10),
    lastUpdated: new Date().toISOString(),
  });
});

function resolveTargetDate(date) {
  if (date === undefined || date === null || date === '') {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  if (!isValidDate(date)) {
    throw createError('A valid date (YYYY-MM-DD) is required.', 400);
  }

  return date;
}

function shapeIntake(rows) {
  const intake = { total: 0, walkIn: 0, preBooked: 0 };

  for (const row of rows) {
    intake.total += row.count;
    if (row._id === 'walk_in') intake.walkIn += row.count;
    if (row._id === 'pre_booked') intake.preBooked += row.count;
  }

  return intake;
}

// Waiting tokens arrive already ordered (urgent > senior > normal, then tokenNumber),
// so each doctor's subsequence preserves their real place in line.
function summarizeWaitingQueue(waitingTokens, inConsultationTokens, defaultWaitTime = 10) {
  const inConsultationByDoctor = new Map();
  for (const token of inConsultationTokens) {
    const key = doctorKey(token);
    inConsultationByDoctor.set(key, (inConsultationByDoctor.get(key) || 0) + 1);
  }

  const seenPerDoctor = new Map();
  const nextTokenByDoctor = new Map();
  let totalEstimateMinutes = 0;

  for (const token of waitingTokens) {
    const key = doctorKey(token);
    const position = seenPerDoctor.get(key) || 0;
    seenPerDoctor.set(key, position + 1);

    if (key && !nextTokenByDoctor.has(key)) {
      nextTokenByDoctor.set(key, token.tokenLabel);
    }

    const ahead = key
      ? (inConsultationByDoctor.get(key) || 0) + position
      : inConsultationTokens.length + position;

    totalEstimateMinutes +=
      ahead * (token.assignedDoctor?.avgConsultMinutes || defaultWaitTime);
  }

  return {
    avgWaitMinutes: waitingTokens.length
      ? Math.round(totalEstimateMinutes / waitingTokens.length)
      : 0,
    nextTokenByDoctor,
  };
}

function doctorKey(token) {
  return token.assignedDoctor?._id ? String(token.assignedDoctor._id) : null;
}

function pickCurrentToken(inConsultationTokens) {
  return inConsultationTokens.reduce((current, token) => {
    if (!current) return token;
    return tokenCalledAtMs(token) >= tokenCalledAtMs(current) ? token : current;
  }, null);
}

function tokenCalledAtMs(token) {
  const value = token.calledAt || token.createdAt;
  const ms = value ? new Date(value).getTime() : 0;
  return Number.isNaN(ms) ? 0 : ms;
}

function serializeServingToken(token) {
  if (!token) return null;

  const doctor = token.assignedDoctor || token.appointment?.doctor || null;

  return {
    tokenLabel: token.tokenLabel,
    patient: {
      name: token.patient?.fullName || null,
      age: token.patient?.age ?? null,
      gender: token.patient?.gender || null,
      nic: token.patient?.nic || null,
    },
    doctor: doctor
      ? { _id: doctor._id, name: doctor.name, department: doctor.department }
      : null,
    room: doctor?.room || null,
  };
}

function buildRooms(doctors, servingDoctorIds, nextTokenByDoctor) {
  return doctors.map((doctor) => {
    const key = String(doctor._id);

    let status = 'Available';
    if (doctor.status === 'on_break') {
      status = 'On Break';
    } else if (servingDoctorIds.has(key)) {
      status = 'Consulting';
    }

    return {
      doctor: doctor.name,
      room: doctor.room || null,
      status,
      nextToken: nextTokenByDoctor.get(key) || null,
    };
  });
}

module.exports = { getReceptionDashboard };
