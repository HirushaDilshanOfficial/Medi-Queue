const { asyncHandler } = require('../utils/errorHandler');
const QueueToken = require('../models/QueueToken');

const Hospital = require('../models/Hospital');
const Staff = require('../models/Staff');
const Patient = require('../models/Patient');

const getMohDashboard = asyncHandler(async (req, res) => {
  const totalQueues = await QueueToken.countDocuments({ status: { $in: ['waiting', 'called', 'serving'] } });
  const totalHospitals = await Hospital.countDocuments();
  const totalStaff = await Staff.countDocuments();
  const totalPatients = await Patient.countDocuments();
  
  res.json({ totalQueues, totalHospitals, totalStaff, totalPatients });
});

module.exports = { getMohDashboard };
