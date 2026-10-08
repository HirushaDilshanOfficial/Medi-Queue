const Doctor = require('../models/Doctor');
const OpdAppointment = require('../models/OpdAppointment');
const OpdQueueEntry = require('../models/OpdQueueEntry');
const { nextTokenNumber, releaseTokenNumber } = require('../models/OpdQueueCounter');
const { today, buildLiveState, buildBoard, ACTIVE_STATUSES } = require('../utils/opdQueue');
const { relativeDate, humanDate, isValidObjectId } = require('../utils/opdAppointment');
const Policy = require('../models/Policy');
const { generatePassCode } = require('../utils/queuePass');
const { ensureBookingQueueEntry } = require('../utils/ensureBookingQueueEntry');

const APPOINTMENT_ACTIVE = OpdAppointment.ACTIVE_STATUSES;

// Short, unambiguous alphabet: no I/O/0/1, so a code read aloud or copied off a
// blurry print still scans.
// The QR must contain a URL so a phone opens a useful pass page rather than
// searching the opaque pass code as plain text.
function passQrValue(entry) {
  const base = process.env.PUBLIC_WEB_URL || 'http://10.240.7.66:5001';
  const passPath = process.env.PUBLIC_WEB_URL ? '/pass/' : '/api/v1/public/queue-pass/';
  return `${base.replace(/\/+$/, '')}${passPath}${entry.passCode}`;
}

const publicPass = async (req, res, next) => {
  try {
    const passCode = String(req.params.passCode || '').trim().toUpperCase();
    if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{24}$/.test(passCode)) {
      return res.status(400).send('<h1>Invalid queue pass</h1>');
    }

    const entry = await OpdQueueEntry.findOne({ passCode }).lean();
    if (!entry) return res.status(404).send('<h1>Queue pass not found</h1>');

    const escapeHtml = (value) => String(value ?? '—')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const token = `A-${String(entry.tokenNumber).padStart(3, '0')}`;
    return res.type('html').send(`<!doctype html>
      <html><head><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Medi-Queue Pass</title>
      <style>body{font-family:Arial,sans-serif;background:#eef7f7;color:#12343b;padding:24px}
      main{max-width:420px;margin:20px auto;background:white;border-radius:18px;padding:24px;
      box-shadow:0 4px 18px #12343b22}h1{color:#006b78;margin-top:0}strong{font-size:42px;
      display:block;margin:12px 0;color:#006b78}p{margin:10px 0}</style></head>
      <body><main><h1>Medi-Queue</h1><p>Queue pass verified</p>
      <strong>${escapeHtml(token)}</strong><p><b>Department:</b> ${escapeHtml(entry.department)}</p>
      <p><b>Doctor:</b> ${escapeHtml(entry.doctorName)}</p><p><b>Date:</b> ${escapeHtml(entry.queueDate)}</p>
      <p><b>Status:</b> ${escapeHtml(entry.status)}</p><p>Show this page at the reception desk.</p>
      </main></body></html>`);
  } catch (error) {
    return next(error);
  }
};

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

async function activePassesFor(profileId) {
  return OpdQueueEntry.find({
    profile: profileId,
    status: { $in: ACTIVE_STATUSES },
  }).sort({ queueDate: 1, checkedInAt: 1 });
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

    if (appointment.queueEntry) {
      const entry = await OpdQueueEntry.findOne({
        _id: appointment.queueEntry,
        appointment: appointment._id,
        profile: profileId,
        status: { $in: ACTIVE_STATUSES },
      });
      if (entry) {
        if (appointment.status !== 'checked_in') {
          appointment.status = 'checked_in';
          await appointment.save();
        }
        const live = await buildLiveState(entry);
        return res.json({ pass: mapPass(entry, { todayKey, live }) });
      }
    }

    const existing = await activePassFor(profileId);
    if (existing) {
      const live = await buildLiveState(existing);
      return res.status(409).json({
        message: 'You already have an active queue pass',
        pass: mapPass(existing, { todayKey, live }),
      });
    }

    const doctor = await Doctor.findById(appointment.doctor).select('avgConsultMinutes room').lean();
    const policy = await Policy.findOne() || { targetWaitTime: 10 };
    const avgConsultMinutes = Number(doctor && doctor.avgConsultMinutes) || policy.targetWaitTime;

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
    let entries = await activePassesFor(req.patientProfile._id);
    const upcoming = await OpdAppointment.find({
        profile: req.patientProfile._id,
        status: 'booked',
        date: { $gte: todayKey },
      }).sort({ date: 1, slotTime: 1 });
    for (const appointment of upcoming) {
      await ensureBookingQueueEntry(appointment);
    }
    entries = await activePassesFor(req.patientProfile._id);

    if (!entries.length) {
      return res.json({ pass: null, passes: [], message: 'You do not have an active queue pass' });
    }

    const passes = await Promise.all(entries.map(async (entry) => (
      mapPass(entry, { todayKey, live: await buildLiveState(entry) })
    )));
    return res.json({ pass: passes[0], passes });
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

const validatePass = async (req, res, next) => {
  try {
    const passCode = String(req.params.passCode || '').trim().toUpperCase();
    if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{24}$/.test(passCode)) {
      return res.status(400).json({ message: 'Invalid queue pass code' });
    }

    const entry = await OpdQueueEntry.findOne({ passCode })
      .populate('profile', 'fullName nic phone email gender')
      .lean();
    if (!entry) return res.status(404).json({ message: 'Queue pass not found' });

    return res.json({
      pass: {
        id: String(entry._id),
        passCode: entry.passCode,
        tokenNumber: entry.tokenNumber,
        tokenLabel: `A-${String(entry.tokenNumber).padStart(3, '0')}`,
        department: entry.department,
        doctorName: entry.doctorName || null,
        room: entry.room || null,
        queueDate: entry.queueDate,
        status: entry.status,
      },
      patient: entry.profile
        ? {
            id: String(entry.profile._id),
            fullName: entry.profile.fullName,
            nic: entry.profile.nic || null,
            phone: entry.profile.phone || null,
            email: entry.profile.email || null,
            gender: entry.profile.gender || null,
          }
        : null,
    });
  } catch (error) {
    return next(error);
  }
};

const mongoose = require('mongoose');
const { asyncHandler, createError } = require('../utils/errorHandler');
const { getOrderedQueue } = require('../services/queueService');
const QueueToken = require('../models/QueueToken');
const Appointment = require('../models/Appointment');
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

  const policy = await Policy.findOne() || { targetWaitTime: 10 };

  let totalConsultMinutes = 0;
  for (const token of queue) {
    const consult = token.assignedDoctor?.avgConsultMinutes || policy.targetWaitTime;
    totalConsultMinutes += consult;
  }
  const avgConsultMinutes =
    inQueue > 0 ? Math.round(totalConsultMinutes / inQueue) : policy.targetWaitTime;
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
  checkIn,
  myPass,
  liveState,
  board,
  liveDepartments,
  leaveQueue,
  validatePass,
  mapPass,
  generatePassCode,
  passQrValue,
  publicPass,
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
