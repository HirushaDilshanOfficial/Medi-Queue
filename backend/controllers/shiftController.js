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

module.exports = {
  getShiftSummary: getShiftSummaryController,
  getShiftSummaryController,
};
