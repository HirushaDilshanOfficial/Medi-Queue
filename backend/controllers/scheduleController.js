const DoctorSchedule = require('../models/DoctorSchedule');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const { isValidDate, isValidSlot } = require('../utils/validators');
const { asyncHandler, createError } = require('../utils/errorHandler');

/**
 * Returns today's date in YYYY-MM-DD using Asia/Colombo timezone
 */
const getTodayDate = () => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
};

/**
 * @desc    Create a new doctor schedule
 * @route   POST /api/reception/schedules
 * @access  Private (Receptionist)
 */
const createSchedule = asyncHandler(async (req, res) => {
  const {
    doctor,
    date,
    startTime,
    endTime,
    slotMinutes,
    maxPatients,
    status,
    notes,
  } = req.body;

  // 1. Validate doctor exists
  if (!doctor) {
    throw createError('Doctor is required', 400);
  }
  const doctorExists = await Doctor.findById(doctor);
  if (!doctorExists) {
    throw createError('Doctor not found', 404);
  }

  // 2. Validate date and ensure it is not in the past
  if (!date || !isValidDate(date)) {
    throw createError('A valid date in YYYY-MM-DD format is required', 400);
  }
  const today = getTodayDate();
  if (date < today) {
    throw createError('Date cannot be in the past', 400);
  }

  // 3. Validate times
  if (!startTime || !endTime) {
    throw createError('Start time and end time are required', 400);
  }
  if (!isValidSlot(startTime) || !isValidSlot(endTime)) {
    throw createError('Start time and end time must be in HH:mm 24-hour format', 400);
  }
  if (endTime <= startTime) {
    throw createError('End time must be after start time', 400);
  }

  // 4. Reject overlapping schedules for the same doctor and date with 409
  const overlapping = await DoctorSchedule.findOne({
    doctor,
    date,
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  });
  if (overlapping) {
    throw createError('Doctor already has an overlapping schedule for this date and time range', 409);
  }

  // 5. Create schedule
  const schedule = await DoctorSchedule.create({
    doctor,
    date,
    startTime,
    endTime,
    slotMinutes: slotMinutes !== undefined ? slotMinutes : 15,
    maxPatients: maxPatients !== undefined ? maxPatients : 30,
    status: status || 'available',
    notes: notes || '',
    createdBy: req.user?._id,
  });

  await schedule.populate('doctor', 'name room department specialization');

  res.status(201).json({
    success: true,
    data: schedule,
  });
});

/**
 * @desc    Get schedules filtered by date and/or doctorId
 * @route   GET /api/reception/schedules?date=&doctorId=
 * @access  Private (Receptionist)
 */
const getSchedules = asyncHandler(async (req, res) => {
  const { date, doctorId } = req.query;
  const filter = {};

  if (date) {
    if (!isValidDate(date)) {
      throw createError('Invalid date format (must be YYYY-MM-DD)', 400);
    }
    filter.date = date;
  }

  if (doctorId) {
    filter.doctor = doctorId;
  }

  const schedules = await DoctorSchedule.find(filter)
    .populate('doctor', 'name room department specialization')
    .sort({ date: 1, startTime: 1 });

  res.status(200).json({
    success: true,
    count: schedules.length,
    data: schedules,
  });
});

/**
 * @desc    Update schedule (times, slotMinutes, maxPatients, status, notes)
 * @route   PUT /api/reception/schedules/:id
 * @access  Private (Receptionist)
 */
const updateSchedule = asyncHandler(async (req, res) => {
  const schedule = await DoctorSchedule.findById(req.params.id);
  if (!schedule) {
    throw createError('Schedule not found', 404);
  }

  const newStartTime = req.body.startTime !== undefined ? req.body.startTime : schedule.startTime;
  const newEndTime = req.body.endTime !== undefined ? req.body.endTime : schedule.endTime;

  // Validate times if updated
  if (req.body.startTime !== undefined && !isValidSlot(req.body.startTime)) {
    throw createError('Start time must be in HH:mm 24-hour format', 400);
  }
  if (req.body.endTime !== undefined && !isValidSlot(req.body.endTime)) {
    throw createError('End time must be in HH:mm 24-hour format', 400);
  }
  if (newEndTime <= newStartTime) {
    throw createError('End time must be after start time', 400);
  }

  // Check overlapping schedules if times changed
  if (newStartTime !== schedule.startTime || newEndTime !== schedule.endTime) {
    const overlapping = await DoctorSchedule.findOne({
      _id: { $ne: schedule._id },
      doctor: schedule.doctor,
      date: schedule.date,
      startTime: { $lt: newEndTime },
      endTime: { $gt: newStartTime },
    });
    if (overlapping) {
      throw createError('Updated times overlap with an existing schedule for this doctor', 409);
    }
    schedule.startTime = newStartTime;
    schedule.endTime = newEndTime;
  }

  if (req.body.slotMinutes !== undefined) {
    schedule.slotMinutes = req.body.slotMinutes;
  }
  if (req.body.maxPatients !== undefined) {
    schedule.maxPatients = req.body.maxPatients;
  }
  if (req.body.status !== undefined) {
    if (!['available', 'leave'].includes(req.body.status)) {
      throw createError('Status must be available or leave', 400);
    }
    schedule.status = req.body.status;
  }
  if (req.body.notes !== undefined) {
    schedule.notes = req.body.notes;
  }

  await schedule.save();
  await schedule.populate('doctor', 'name room department specialization');

  res.status(200).json({
    success: true,
    data: schedule,
  });
});

/**
 * @desc    Delete schedule (only if no active appointments exist in range)
 * @route   DELETE /api/reception/schedules/:id
 * @access  Private (Receptionist)
 */
const deleteSchedule = asyncHandler(async (req, res) => {
  const schedule = await DoctorSchedule.findById(req.params.id);
  if (!schedule) {
    throw createError('Schedule not found', 404);
  }

  // Check if active appointments exist in schedule date and time range
  const activeAppointment = await Appointment.findOne({
    doctor: schedule.doctor,
    date: schedule.date,
    slotTime: { $gte: schedule.startTime, $lte: schedule.endTime },
    $or: [
      { isActive: true },
      { status: { $in: ['booked', 'checked_in', 'in_consultation'] } },
    ],
  });

  if (activeAppointment) {
    throw createError('Appointments exist for this schedule', 409);
  }

  await DoctorSchedule.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Schedule deleted successfully',
  });
});

module.exports = {
  createSchedule,
  getSchedules,
  updateSchedule,
  deleteSchedule,
};
