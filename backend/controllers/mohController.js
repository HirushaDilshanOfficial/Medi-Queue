const { asyncHandler } = require('../utils/errorHandler');
const QueueToken = require('../models/QueueToken');

const getMohDashboard = asyncHandler(async (req, res) => {
  const totalQueues = await QueueToken.countDocuments({ status: { $in: ['waiting', 'called', 'serving'] } });
  res.json({ totalQueues });
});

module.exports = { getMohDashboard };
