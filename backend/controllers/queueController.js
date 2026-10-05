const { asyncHandler, createError } = require('../utils/errorHandler');
const { getOrderedQueue } = require('../services/queueService');
const QueueToken = require('../models/QueueToken');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');

/**
 * @desc    Get today's ordered queue with totals and timestamp
 * @route   GET /api/reception/queue
 * @access  Private — receptionist
 */
const getQueue = asyncHandler(async (req, res) => {
  const { type, status, date, department, doctorId } = req.query;

  const targetDate =
    date ||
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

  const queue = await getOrderedQueue(targetDate, {
    type,
    status,
    department,
    doctorId,
  });

  const inQueue = queue.length;
  const walkIns = queue.filter(
    (t) => t.appointment && t.appointment.type === 'walk_in'
  ).length;
  const preBooked = queue.filter(
    (t) => t.appointment && t.appointment.type === 'pre_booked'
  ).length;

  let totalConsultMinutes = 0;
  for (const token of queue) {
    const consult = token.assignedDoctor?.avgConsultMinutes || 10;
    totalConsultMinutes += consult;
  }
  const avgConsultMinutes =
    inQueue > 0 ? Math.round(totalConsultMinutes / inQueue) : 10;
  const avgWaitMinutes = inQueue > 0 ? inQueue * avgConsultMinutes : 0;

  res.json({
    queue,
    totals: {
      inQueue,
      walkIns,
      preBooked,
      avgWaitMinutes,
    },
    lastUpdated: new Date().toISOString(),
  });
});

/**
 * @desc    Get next waiting token in priority order
 * @route   GET /api/reception/queue/next
 * @access  Private — receptionist
 */
const getNextInQueue = asyncHandler(async (req, res) => {
  const { date, department, doctorId } = req.query;

  const targetDate =
    date ||
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

  const waitingTokens = await getOrderedQueue(targetDate, {
    status: 'waiting',
    department,
    doctorId,
  });

  const nextToken = waitingTokens.length > 0 ? waitingTokens[0] : null;

  res.json(nextToken);
});

/**
 * @desc    Call next patient in queue:
 *          1. Mark any current "serving" token as "done" (servedAt = now) and its Appointment "completed".
 *          2. Atomically (findOneAndUpdate) pick the first "waiting" token in order and set status "called", calledAt = now. Appointment -> "in_consultation".
 *          3. Return { patient, tokenLabel, room, doctor } or 404 "Queue is empty".
 * @route   POST /api/reception/queue/call-next
 * @access  Private — receptionist
 */
const callNext = asyncHandler(async (req, res) => {
  const { date, department, doctorId: docIdParam } = {
    ...req.query,
    ...req.body,
  };
  const doctorId = docIdParam || req.body?.doctor || req.query?.doctor;

  const targetDate =
    date ||
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

  const now = new Date();

  // 1. Mark any current "serving" token as "done" (servedAt = now) and its Appointment "completed"
  const servingQuery = {
    status: 'serving',
  };
  if (targetDate) servingQuery.date = targetDate;
  if (doctorId) servingQuery.assignedDoctor = doctorId;
  if (department) servingQuery.department = department;

  const servingTokens = await QueueToken.find(servingQuery);
  if (servingTokens.length > 0) {
    const servingIds = servingTokens.map((t) => t._id);
    const appointmentIds = servingTokens
      .map((t) => t.appointment)
      .filter(Boolean);

    await QueueToken.updateMany(
      { _id: { $in: servingIds } },
      { $set: { status: 'done', servedAt: now } }
    );

    if (appointmentIds.length > 0) {
      await Appointment.updateMany(
        { _id: { $in: appointmentIds } },
        { $set: { status: 'completed', isActive: false } }
      );
    }
  }

  // 2. Atomically (findOneAndUpdate) pick the first "waiting" token in order and set
  //    status "called", calledAt = now. Appointment -> "in_consultation".
  const waitingQuery = {
    status: 'waiting',
  };
  if (targetDate) waitingQuery.date = targetDate;
  if (doctorId) waitingQuery.assignedDoctor = doctorId;
  if (department) waitingQuery.department = department;

  const calledToken = await QueueToken.findOneAndUpdate(
    waitingQuery,
    {
      $set: {
        status: 'called',
        calledAt: now,
      },
    },
    {
      sort: { priority: -1, tokenNumber: 1 },
      new: true,
    }
  )
    .populate('patient')
    .populate('assignedDoctor')
    .populate({
      path: 'appointment',
      populate: { path: 'doctor' },
    });

  // 3. Return { patient, tokenLabel, room, doctor } or 404 "Queue is empty"
  if (!calledToken) {
    throw createError('Queue is empty', 404);
  }

  // Update associated appointment to "in_consultation"
  if (calledToken.appointment) {
    const appointmentId =
      calledToken.appointment._id || calledToken.appointment;
    await Appointment.findByIdAndUpdate(appointmentId, {
      $set: {
        status: 'in_consultation',
        isActive: true,
      },
    });
  }

  let doctor =
    calledToken.assignedDoctor || calledToken.appointment?.doctor || null;
  if (!doctor && doctorId) {
    doctor = await Doctor.findById(doctorId);
  }

  const room = doctor?.room || null;

  res.json({
    patient: calledToken.patient,
    tokenLabel: calledToken.tokenLabel,
    room,
    doctor,
  });
});

module.exports = {
  getQueue,
  getNextInQueue,
  callNext,
};
