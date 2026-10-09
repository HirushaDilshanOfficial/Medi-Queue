const { nextTokenNumber } = require('../models/OpdQueueCounter');

/**
 * Atomically increment and return the next OPD token for a department and date.
 * Uses OpdQueueCounter so all booking flows (patient online, walk-in, reception)
 * share a single, strictly sequential sequence per department per date.
 *
 * @param {string} arg1 - department or dateString
 * @param {string} [arg2] - dateString (when arg1 is department)
 * @returns {Promise<{ tokenNumber: number, tokenLabel: string }>}
 */
const getNextToken = async (arg1, arg2) => {
  let department = 'General OPD';
  let queueDate = new Date().toISOString().slice(0, 10);

  if (arg2 && /^\d{4}-\d{2}-\d{2}$/.test(String(arg2).trim())) {
    department = String(arg1).trim() || 'General OPD';
    queueDate = String(arg2).trim();
  } else if (arg1 && /^\d{4}-\d{2}-\d{2}$/.test(String(arg1).trim())) {
    queueDate = String(arg1).trim();
  } else if (arg1) {
    department = String(arg1).trim();
    if (arg2) queueDate = String(arg2).trim();
  }

  const tokenNumber = await nextTokenNumber(department, queueDate);

  return {
    tokenNumber,
    tokenLabel: `OPD-${String(tokenNumber).padStart(3, '0')}`,
  };
};

module.exports = { getNextToken };
