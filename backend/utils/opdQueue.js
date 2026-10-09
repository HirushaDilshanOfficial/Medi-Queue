const OpdQueueEntry = require('../models/OpdQueueEntry');
const { localDate } = require('../models/receptionistFields');

const ACTIVE_STATUSES = ['waiting', 'called', 'in_consultation'];

// Urgent patients are served before normal ones, and within each group the lower
// token was issued first. This is the same ordering the receptionist queue uses.
function aheadOfMeFilter(entry) {
  return {
    department: entry.department,
    queueDate: entry.queueDate,
    status: { $in: ACTIVE_STATUSES },
    $or: [
      { priority: 'urgent', tokenNumber: { $lte: entry.tokenNumber } },
      { priority: 'normal', tokenNumber: { $lte: entry.tokenNumber } },
    ],
  };
}

function minutesBetween(a, b) {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}

/**
 * Derives the live position and estimated turn time for one queue entry.
 *
 * Position counts every active entry ahead of this one, so calling a patient
 * moves everyone behind them forward by one. The ETA is derived from the number of
 * patients still to be seen and the serving pace captured at check-in, then
 * adjusted for any patient currently in consultation (whose remaining time is
 * already partly spent).
 */
async function buildLiveState(entry, now = new Date()) {
  if (!entry) return null;

  const ahead = await OpdQueueEntry.countDocuments(aheadOfMeFilter(entry));

  // Position is "people ahead of me" + 1, so the patient being served counts.
  const position = ahead;

  const inConsultation = await OpdQueueEntry.findOne({
    department: entry.department,
    queueDate: entry.queueDate,
    status: 'in_consultation',
  })
    .sort({ calledAt: -1 })
    .lean();

  const consultMinutes = entry.avgConsultMinutes || 10;

  // Everyone ahead of me, minus the patient already in the room, is outstanding
  // work. Add the remainder of the current consultation before my turn starts.
  const outstanding = Math.max(0, position - 1 - (inConsultation ? 1 : 0));
  const currentRemaining = inConsultation
    ? Math.max(0, consultMinutes - minutesBetween(inConsultation.calledAt || inConsultation.checkedInAt, now))
    : 0;

  const waitMinutes = outstanding * consultMinutes + currentRemaining;

  let estimatedTurnAt = null;
  if (['waiting', 'called'].includes(entry.status)) {
    const turn = new Date(now.getTime() + waitMinutes * 60000);
    estimatedTurnAt = `${String(turn.getHours()).padStart(2, '0')}:${String(turn.getMinutes()).padStart(2, '0')} WITA`;
  }

  return {
    position,
    peopleAhead: Math.max(0, position - 1),
    waitMinutes,
    estimatedTurnAt,
    avgConsultMinutes: consultMinutes,
    servingNow: inConsultation
      ? { tokenNumber: inConsultation.tokenNumber, doctorName: inConsultation.doctorName || null }
      : null,
  };
}

/**
 * Aggregate a department's queue for the "now serving" board: the token being
 * served right now plus a short window of upcoming tokens.
 */
async function buildBoard(department, queueDate, limit = 8) {
  const entries = await OpdQueueEntry.find({
    department,
    queueDate,
    status: { $in: ACTIVE_STATUSES },
  })
    .sort({ priority: -1, tokenNumber: 1 })
    .limit(limit)
    .lean();

  const now = new Date();
  const remaining = await OpdQueueEntry.countDocuments({
    department,
    queueDate,
    status: { $in: ACTIVE_STATUSES },
  });

  return {
    department,
    queueDate,
    waiting: remaining,
    updatedAt: now.toISOString(),
    serving: entries.map((entry) => ({
      tokenNumber: entry.tokenNumber,
      status: entry.status,
      doctorName: entry.doctorName || null,
      room: entry.room || null,
      checkedInAt: entry.checkedInAt,
    })),
  };
}

function today() {
  return localDate(new Date());
}

module.exports = { buildLiveState, buildBoard, today, ACTIVE_STATUSES };
