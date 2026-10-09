const mongoose = require('mongoose');
const { dateKey } = require('./receptionistFields');

// One row per department per queue day. Guarantees a gap-free, strictly
// increasing token sequence even when several patients check in at once,
// because the increment is a single atomic findOneAndUpdate.
const opdQueueCounterSchema = new mongoose.Schema(
  {
    department: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    queueDate: dateKey(),
    // Highest token handed out so far. Tokens start at 1.
    lastToken: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true, strict: 'throw' },
);

opdQueueCounterSchema.index({ department: 1, queueDate: 1 }, { unique: true });

const OpdQueueCounter = mongoose.model('OpdQueueCounter', opdQueueCounterSchema);

/**
 * Atomically reserve the next token number for a department on a given day.
 *
 * `upsert` with `$inc` is what makes this safe under concurrency: two check-ins
 * racing on the same department cannot read the same value, because the
 * increment and the read are one server-side operation. The `lastToken: 0`
 * default on insert means a brand new counter starts at 1.
 */
async function nextTokenNumber(department, queueDate) {
  const dept = (department && String(department).trim()) || 'General OPD';
  const date = (queueDate && String(queueDate).trim()) || new Date().toISOString().slice(0, 10);
  const counter = await OpdQueueCounter.findOneAndUpdate(
    { department: dept, queueDate: date },
    { $inc: { lastToken: 1 }, $setOnInsert: { department: dept, queueDate: date } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();

  return counter.lastToken;
}

/**
 * Release a token back to the pool when a patient cancels the most recent waiting
 * entry, so the counter keeps issuing a gap-free sequence.
 *
 * Guarded on `lastToken: tokenNumber` so an older token is never released: that
 * would hand the same number to a later patient who already saw it issued.
 */
async function releaseTokenNumber(department, queueDate, tokenNumber) {
  if (!Number.isSafeInteger(tokenNumber) || tokenNumber < 1) return;

  await OpdQueueCounter.updateOne(
    { department, queueDate, lastToken: tokenNumber },
    { $inc: { lastToken: -1 } },
  );
}

module.exports = OpdQueueCounter;
module.exports.nextTokenNumber = nextTokenNumber;
module.exports.releaseTokenNumber = releaseTokenNumber;
