const Shift = require('../models/Shift');
const { getShiftSummary } = require('../services/shiftService');
const { isValidDate } = require('../utils/validators');
const { asyncHandler, createError } = require('../utils/errorHandler');

/**
 * @desc    Get shift summary statistics for reception on a given date (defaults to today)
 * @route   GET /api/reception/shift/summary?date=
 * @access  Private — receptionist
 */
const getShiftSummaryController = asyncHandler(async (req, res) => {
  const { date } = req.query;

  if (date !== undefined && date !== null && date !== '') {
    if (!isValidDate(date)) {
      throw createError('A valid date (YYYY-MM-DD) is required.', 400);
    }
  }

  const summary = await getShiftSummary(date);
  res.json(summary);
});

/**
 * @desc    Close receptionist's shift for today: find open Shift (create if none),
 *          save summary snapshot from getShiftSummary, set endTime and status "closed".
 *          Return 409 if already closed.
 * @route   POST /api/reception/shift/close
 * @access  Private — receptionist
 */
const closeShiftController = asyncHandler(async (req, res) => {
  const receptionistId = req.user._id;

  const targetDate =
    req.body?.date ||
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

  // 1. Look for an open shift for this receptionist on targetDate
  let shift = await Shift.findOne({
    receptionist: receptionistId,
    date: targetDate,
    status: 'open',
  });

  // 2. If no open shift, check if one was already closed today
  if (!shift) {
    const closedShift = await Shift.findOne({
      receptionist: receptionistId,
      date: targetDate,
      status: 'closed',
    });

    if (closedShift) {
      throw createError('Shift is already closed for today.', 409);
    }

    // No shift exists at all today -> create one
    shift = new Shift({
      receptionist: receptionistId,
      date: targetDate,
      startTime: new Date(),
      status: 'open',
    });
  }

  // 3. Save summary snapshot from getShiftSummary
  const summarySnapshot = await getShiftSummary(targetDate);

  shift.summary = {
    totalRegistered: summarySnapshot.totalRegistered,
    attended: summarySnapshot.attended,
    noShows: summarySnapshot.noShows,
    cancelled: summarySnapshot.cancelled,
    avgHandlingMinutes: summarySnapshot.avgHandlingMinutes,
    throughputPercent: summarySnapshot.throughputPercent,
    doctors: summarySnapshot.doctors,
  };

  // 4. Set endTime and status "closed"
  shift.endTime = new Date();
  shift.status = 'closed';

  await shift.save();

  res.status(200).json({
    message: 'Shift closed successfully',
    ...shift.toObject(),
    shift,
  });
});

module.exports = {
  getShiftSummary: getShiftSummaryController,
  getShiftSummaryController,
  closeShift: closeShiftController,
  closeShiftController,
};
