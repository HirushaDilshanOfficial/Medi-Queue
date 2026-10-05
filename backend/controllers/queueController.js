const mongoose = require('mongoose');
const { asyncHandler, createError } = require('../utils/errorHandler');
const { getOrderedQueue } = require('../services/queueService');
const QueueToken = require('../models/QueueToken');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Settings = require('../models/Settings');

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

/**
 * @desc    Recall a patient: only for "called" tokens; update calledAt, return tokenLabel and room
 * @route   POST /api/reception/queue/:id/recall
 * @access  Private — receptionist, doctor
 */
const recallToken = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let query;
  if (mongoose.Types.ObjectId.isValid(id)) {
    query = { _id: id };
  } else if (/^\d+$/.test(id)) {
    query = { tokenNumber: Number(id) };
  } else {
    query = { tokenLabel: id };
  }

  const token = await QueueToken.findOne(query)
    .populate('assignedDoctor')
    .populate({
      path: 'appointment',
      populate: { path: 'doctor' },
    });

  if (!token) {
    throw createError('Queue token not found', 404);
  }

  if (token.status !== 'called') {
    throw createError('Only tokens with status "called" can be recalled', 400);
  }

  const now = new Date();
  token.calledAt = now;
  await token.save();

  const doctor = token.assignedDoctor || token.appointment?.doctor || null;
  const room = doctor?.room || null;

  res.json({
    tokenLabel: token.tokenLabel,
    room,
  });
});

/**
 * @desc    Mark token and appointment as no-show. Reject if already done.
 * @route   POST /api/reception/queue/:id/no-show
 * @access  Private — receptionist, doctor
 */
const markNoShow = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let query;
  if (mongoose.Types.ObjectId.isValid(id)) {
    query = { _id: id };
  } else if (/^\d+$/.test(id)) {
    query = { tokenNumber: Number(id) };
  } else {
    query = { tokenLabel: id };
  }

  const token = await QueueToken.findOne(query).populate('appointment');

  if (!token) {
    throw createError('Queue token not found', 404);
  }

  if (token.status === 'done' || token.appointment?.status === 'completed') {
    throw createError('Cannot mark as no-show: token is already done', 400);
  }

  token.status = 'no_show';
  await token.save();

  if (token.appointment) {
    const appointmentId = token.appointment._id || token.appointment;
    await Appointment.findByIdAndUpdate(appointmentId, {
      $set: {
        status: 'no_show',
        isActive: false,
      },
    });
  }

  res.json({
    tokenLabel: token.tokenLabel,
    status: 'no_show',
  });
});

/**
 * @desc    Move a "waiting" token 3 positions back in the ordered queue and increment moveBackCount.
 *          Do not let urgent tokens be moved. Return the new position.
 * @route   POST /api/reception/queue/:id/move-back
 * @access  Private — receptionist, doctor
 */
const moveBackToken = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let query;
  if (mongoose.Types.ObjectId.isValid(id)) {
    query = { _id: id };
  } else if (/^\d+$/.test(id)) {
    query = { tokenNumber: Number(id) };
  } else {
    query = { tokenLabel: id };
  }

  const token = await QueueToken.findOne(query);

  if (!token) {
    throw createError('Queue token not found', 404);
  }

  if (token.status !== 'waiting') {
    throw createError('Only waiting tokens can be moved back', 400);
  }

  if (token.priority === 'urgent') {
    throw createError('Urgent tokens cannot be moved back', 400);
  }

  // Find all waiting tokens for this queue (same date and assigned doctor / department)
  const filter = {
    date: token.date,
    status: 'waiting',
  };
  if (token.assignedDoctor) {
    filter.assignedDoctor = token.assignedDoctor;
  } else if (token.department) {
    filter.department = token.department;
  }

  const waitingTokens = await QueueToken.find(filter);

  // Sort by priority (urgent > senior > normal), then tokenNumber ascending
  const PRIORITY_ORDER = { urgent: 0, senior: 1, normal: 2 };
  waitingTokens.sort((a, b) => {
    const pA = PRIORITY_ORDER[a.priority] ?? 99;
    const pB = PRIORITY_ORDER[b.priority] ?? 99;
    if (pA !== pB) return pA - pB;
    return a.tokenNumber - b.tokenNumber;
  });

  const currentIndex = waitingTokens.findIndex(
    (t) => t._id.toString() === token._id.toString()
  );

  if (currentIndex === -1) {
    throw createError('Token not found in waiting queue', 400);
  }

  const targetIndex = Math.min(currentIndex + 3, waitingTokens.length - 1);
  const newPosition = targetIndex + 1;
  const newMoveBackCount = (token.moveBackCount || 0) + 1;

  if (targetIndex > currentIndex) {
    const tokensToShift = waitingTokens.slice(currentIndex, targetIndex + 1);
    const origNumbers = tokensToShift.map((t) => t.tokenNumber);
    const origPriorities = tokensToShift.map((t) => t.priority);
    const k = tokensToShift.length - 1;

    // 1. Move target token to temporary negative tokenNumber to avoid unique index conflict
    const tempTokenNumber = -Math.floor(Date.now() % 1000000000 + Math.random() * 10000);
    await QueueToken.updateOne(
      { _id: tokensToShift[0]._id },
      { $set: { tokenNumber: tempTokenNumber } }
    );

    // 2. Shift intermediate tokens forward one slot each
    for (let i = 1; i <= k; i++) {
      await QueueToken.updateOne(
        { _id: tokensToShift[i]._id },
        {
          $set: {
            tokenNumber: origNumbers[i - 1],
            priority: origPriorities[i - 1],
          },
        }
      );
      if (tokensToShift[i].appointment) {
        await Appointment.findByIdAndUpdate(tokensToShift[i].appointment, {
          $set: {
            tokenNumber: origNumbers[i - 1],
            priority: origPriorities[i - 1],
          },
        });
      }
    }

    // 3. Move target token to the target slot and increment moveBackCount
    await QueueToken.updateOne(
      { _id: tokensToShift[0]._id },
      {
        $set: {
          tokenNumber: origNumbers[k],
          priority: origPriorities[k],
          moveBackCount: newMoveBackCount,
        },
      }
    );
    if (tokensToShift[0].appointment) {
      await Appointment.findByIdAndUpdate(tokensToShift[0].appointment, {
        $set: {
          tokenNumber: origNumbers[k],
          priority: origPriorities[k],
        },
      });
    }
  } else {
    // Already at the end of the queue — just increment moveBackCount
    await QueueToken.updateOne(
      { _id: token._id },
      { $set: { moveBackCount: newMoveBackCount } }
    );
  }

  res.json({
    position: newPosition,
    newPosition,
    tokenLabel: token.tokenLabel,
    moveBackCount: newMoveBackCount,
  });
});

/**
 * @desc    Assign doctor to a queue token and appointment
 *          Doctor must be active; update QueueToken.assignedDoctor and Appointment.doctor
 * @route   PATCH /api/reception/queue/:id/assign-doctor
 *          PATCH /api/reception/:id/assign-doctor
 * @access  Private — receptionist, doctor
 */
const assignDoctor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { doctorId } = req.body;

  if (!doctorId) {
    throw createError('doctorId is required', 400);
  }

  if (!mongoose.Types.ObjectId.isValid(doctorId)) {
    throw createError('Invalid doctorId format', 400);
  }

  const doctor = await Doctor.findById(doctorId);
  if (!doctor) {
    throw createError('Doctor not found', 404);
  }

  if (doctor.status !== 'active') {
    throw createError(`Doctor is not active (current status: ${doctor.status})`, 400);
  }

  let query;
  if (mongoose.Types.ObjectId.isValid(id)) {
    query = { _id: id };
  } else if (/^\d+$/.test(id)) {
    query = { tokenNumber: Number(id) };
  } else {
    query = { tokenLabel: id };
  }

  const token = await QueueToken.findOne(query).populate('appointment');
  if (!token) {
    throw createError('Queue token not found', 404);
  }

  // Update QueueToken assignedDoctor
  token.assignedDoctor = doctor._id;
  await token.save();

  // Update Appointment doctor
  let updatedAppointment = null;
  if (token.appointment) {
    const apptId = token.appointment._id || token.appointment;
    try {
      updatedAppointment = await Appointment.findByIdAndUpdate(
        apptId,
        { $set: { doctor: doctor._id } },
        { new: true }
      );
    } catch (err) {
      if (err.code === 11000) {
        throw createError('Selected doctor already has an appointment booked for this slot', 409);
      }
      throw err;
    }
  }

  res.json({
    success: true,
    message: 'Doctor assigned successfully',
    tokenLabel: token.tokenLabel,
    assignedDoctor: doctor._id,
    doctor: {
      _id: doctor._id,
      name: doctor.name,
      room: doctor.room,
      department: doctor.department,
      status: doctor.status,
    },
    appointment: updatedAppointment,
  });
});

/**
 * @desc    Update auto-advance setting in Settings model (key, value)
 * @route   PATCH /api/reception/queue/auto-advance
 *          PATCH /api/reception/auto-advance
 * @access  Private — receptionist, doctor
 */
const updateAutoAdvance = asyncHandler(async (req, res) => {
  const { enabled } = req.body;

  if (typeof enabled !== 'boolean') {
    throw createError('enabled must be a boolean', 400);
  }

  const setting = await Settings.findOneAndUpdate(
    { key: 'auto_advance' },
    { $set: { value: enabled } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.json({
    success: true,
    enabled: Boolean(setting.value),
  });
});

/**
 * @desc    Get auto-advance setting from Settings model
 * @route   GET /api/reception/queue/auto-advance
 *          GET /api/reception/auto-advance
 * @access  Private — receptionist, doctor
 */
const getAutoAdvance = asyncHandler(async (req, res) => {
  const setting = await Settings.findOne({
    $or: [{ key: 'auto_advance' }, { key: 'auto-advance' }],
  });

  const enabled = setting ? Boolean(setting.value) : false;

  res.json({
    success: true,
    enabled,
  });
});

module.exports = {
  getQueue,
  getNextInQueue,
  callNext,
  recallToken,
  markNoShow,
  moveBackToken,
  assignDoctor,
  updateAutoAdvance,
  getAutoAdvance,
};



