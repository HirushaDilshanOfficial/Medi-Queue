const Counter = require('../models/Counter');

/**
 * Atomically increment and return the next OPD token for a given date.
 * Uses findOneAndUpdate with $inc so two concurrent calls never get the
 * same number. The key includes the date, so tokens reset daily.
 *
 * @param {string} dateString - "YYYY-MM-DD"
 * @returns {Promise<{ tokenNumber: number, tokenLabel: string }>}
 */
const getNextToken = async (dateString) => {
  const counter = await Counter.findOneAndUpdate(
    { key: `OPD:${dateString}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return {
    tokenNumber: counter.seq,
    tokenLabel: `OPD-${String(counter.seq).padStart(3, '0')}`,
  };
};

module.exports = { getNextToken };
