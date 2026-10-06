const Appointment = require('../models/Appointment');
const QueueToken = require('../models/QueueToken');
const Doctor = require('../models/Doctor');

const ACTIVE_STATUSES = ['booked', 'checked_in', 'in_consultation'];

/**
 * Summarize daily shift performance metrics for reception.
 *
 * @param {string} [date] - Target date "YYYY-MM-DD" (defaults to today in Asia/Colombo)
 * @returns {Promise<Object>} Shift summary figures
 */
const getShiftSummary = async (date) => {
  const targetDate =
    date ||
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

  // Gather appointment stats, token stats, handled tokens, and doctors in parallel
  const [
    appointmentStats,
    tokenStats,
    handledTokens,
    doctors,
    doctorAttendedTokens,
    doctorAttendedAppts,
  ] = await Promise.all([
    Appointment.aggregate([
      { $match: { date: targetDate } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    QueueToken.aggregate([
      { $match: { date: targetDate } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    QueueToken.find({
      date: targetDate,
      calledAt: { $exists: true, $ne: null },
      servedAt: { $exists: true, $ne: null },
    }).select('calledAt servedAt').lean(),
    Doctor.find().sort({ name: 1 }).lean(),
    QueueToken.aggregate([
      {
        $match: {
          date: targetDate,
          status: 'done',
          assignedDoctor: { $ne: null },
        },
      },
      {
        $group: {
          _id: '$assignedDoctor',
          count: { $sum: 1 },
        },
      },
    ]),
    Appointment.aggregate([
      {
        $match: {
          date: targetDate,
          status: 'completed',
          doctor: { $ne: null },
        },
      },
      {
        $group: {
          _id: '$doctor',
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  // Index appointment counts by status
  const apptCounts = new Map(appointmentStats.map((r) => [r._id, r.count]));
  let totalAppointments = 0;
  for (const count of apptCounts.values()) {
    totalAppointments += count;
  }

  // Index queue token counts by status
  const tokCounts = new Map(tokenStats.map((r) => [r._id, r.count]));
  let totalTokens = 0;
  for (const count of tokCounts.values()) {
    totalTokens += count;
  }

  // 1. Metric: Attended
  const attendedTokens = tokCounts.get('done') || 0;
  const attendedAppts = apptCounts.get('completed') || 0;
  const attended = Math.max(attendedTokens, attendedAppts);

  // 2. Metric: No Shows
  const noShowTokens = tokCounts.get('no_show') || 0;
  const noShowAppts = apptCounts.get('no_show') || 0;
  const noShows = Math.max(noShowTokens, noShowAppts);

  // 3. Metric: Cancelled
  const cancelled = apptCounts.get('cancelled') || 0;

  // 4. Metric: Still Waiting
  const waitingTokens =
    (tokCounts.get('waiting') || 0) +
    (tokCounts.get('called') || 0) +
    (tokCounts.get('serving') || 0);
  const waitingAppts =
    (apptCounts.get('booked') || 0) +
    (apptCounts.get('checked_in') || 0) +
    (apptCounts.get('in_consultation') || 0);
  const stillWaiting = Math.max(waitingTokens, waitingAppts);

  // 5. Metric: Total Registered
  const totalRegistered = Math.max(
    totalAppointments,
    totalTokens,
    attended + noShows + cancelled + stillWaiting
  );

  // 6. Metric: Average Handling Minutes (servedAt - calledAt)
  let totalHandlingMinutes = 0;
  let handledCount = 0;
  for (const t of handledTokens) {
    if (t.calledAt && t.servedAt) {
      const diffMs = new Date(t.servedAt).getTime() - new Date(t.calledAt).getTime();
      if (!isNaN(diffMs) && diffMs >= 0) {
        totalHandlingMinutes += diffMs / (1000 * 60);
        handledCount += 1;
      }
    }
  }

  const avgHandlingMinutes =
    handledCount > 0
      ? Math.round((totalHandlingMinutes / handledCount) * 10) / 10
      : 0;

  // 7. Metric: Throughput Percent = attended / (attended + noShows + stillWaiting) * 100
  const throughputDenominator = attended + noShows + stillWaiting;
  const throughputPercent =
    throughputDenominator > 0
      ? Math.round(((attended / throughputDenominator) * 100) * 100) / 100
      : 0;

  // 8. Metric: Per-doctor breakdown
  const doctorTokenAttendedMap = new Map(
    doctorAttendedTokens.map((r) => [String(r._id), r.count])
  );
  const doctorApptAttendedMap = new Map(
    doctorAttendedAppts.map((r) => [String(r._id), r.count])
  );

  const doctorsList = doctors.map((doc) => {
    const docId = String(doc._id);
    const docAttended = Math.max(
      doctorTokenAttendedMap.get(docId) || 0,
      doctorApptAttendedMap.get(docId) || 0
    );

    return {
      _id: doc._id,
      name: doc.name,
      room: doc.room || null,
      status: doc.status,
      attended: docAttended,
      capacity: doc.dailyCapacity ?? 30,
    };
  });

  return {
    date: targetDate,
    totalRegistered,
    attended,
    noShows,
    cancelled,
    avgHandlingMinutes,
    throughputPercent,
    doctors: doctorsList,
  };
};

module.exports = {
  getShiftSummary,
};
