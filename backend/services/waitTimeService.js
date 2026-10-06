const QueueToken = require('../models/QueueToken');
const Doctor = require('../models/Doctor');

/**
 * Estimate the wait time for the next patient in a doctor's queue.
 *
 * @param {string} doctorId - Doctor ObjectId
 * @param {string} date     - "YYYY-MM-DD"
 * @returns {{ patientsAhead: number, estimatedWaitMinutes: number }}
 */
const estimateWaitMinutes = async (doctorId, date) => {
  const patientsAhead = await QueueToken.countDocuments({
    assignedDoctor: doctorId,
    date,
    status: { $in: ['waiting', 'called'] },
  });

  const doctor = await Doctor.findById(doctorId).select('avgConsultMinutes').lean();
  const avgMinutes = doctor?.avgConsultMinutes || 10;

  return {
    patientsAhead,
    estimatedWaitMinutes: patientsAhead * avgMinutes,
  };
};

module.exports = { estimateWaitMinutes };
