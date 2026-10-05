const { asyncHandler } = require('../utils/errorHandler');
const { getOrderedQueue } = require('../services/queueService');

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

module.exports = {
  getQueue,
  getNextInQueue,
};
