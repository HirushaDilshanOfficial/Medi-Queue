const Appointment = require('../models/Appointment');
const QueueToken = require('../models/QueueToken');
const { isValidDate } = require('../utils/validators');
const { asyncHandler, createError } = require('../utils/errorHandler');


function escapeCsvValue(val) {
  if (val === null || val === undefined) {
    return '';
  }
  const str = String(val);
  if (
    str.includes('"') ||
    str.includes(',') ||
    str.includes('\n') ||
    str.includes('\r')
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * @desc    Export today's appointments as CSV report
 * @route   GET /api/reception/reports/daily?format=csv
 * @access  Private — receptionist
 */
const getDailyReport = asyncHandler(async (req, res) => {
  const { format, date } = req.query;

  // Format validation: must be 'csv'
  if (!format || format.trim().toLowerCase() !== 'csv') {
    throw createError('Invalid format. Only format=csv is supported.', 400);
  }

  // Date validation: defaults to today in Asia/Colombo
  let targetDate;
  if (date !== undefined && date !== null && date !== '') {
    if (!isValidDate(date)) {
      throw createError('A valid date (YYYY-MM-DD) is required.', 400);
    }
    targetDate = date;
  } else {
    targetDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  // Fetch appointments and queue tokens for targetDate in parallel
  const [appointments, tokens] = await Promise.all([
    Appointment.find({ date: targetDate })
      .populate('patient', 'fullName nic phone')
      .populate('doctor', 'name')
      .sort({ slotTime: 1, tokenNumber: 1, createdAt: 1 })
      .lean(),
    QueueToken.find({ date: targetDate })
      .select('appointment tokenLabel tokenNumber')
      .lean(),
  ]);

  // Index queue tokens by appointment ID
  const tokenMap = new Map();
  for (const t of tokens) {
    if (t.appointment) {
      tokenMap.set(String(t.appointment), t.tokenLabel || t.tokenNumber);
    }
  }

  // Columns: token, patient name, NIC, phone, doctor, department, type, status, slot time
  const headers = [
    'token',
    'patient name',
    'NIC',
    'phone',
    'doctor',
    'department',
    'type',
    'status',
    'slot time',
  ];

  const rows = [headers.join(',')];

  for (const appt of appointments) {
    const tokenVal =
      tokenMap.get(String(appt._id)) ||
      (appt.tokenNumber !== undefined && appt.tokenNumber !== null
        ? String(appt.tokenNumber)
        : '');

    const patientName = appt.patient?.fullName || '';
    const nic = appt.patient?.nic || '';
    const phone = appt.patient?.phone || '';
    const doctor = appt.doctor?.name || '';
    const department = appt.department || '';
    const type = appt.type || '';
    const status = appt.status || '';
    const slotTime = appt.slotTime || '';

    const row = [
      escapeCsvValue(tokenVal),
      escapeCsvValue(patientName),
      escapeCsvValue(nic),
      escapeCsvValue(phone),
      escapeCsvValue(doctor),
      escapeCsvValue(department),
      escapeCsvValue(type),
      escapeCsvValue(status),
      escapeCsvValue(slotTime),
    ].join(',');

    rows.push(row);
  }

  const csvContent = rows.join('\r\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="daily-report-${targetDate}.csv"`
  );

  res.status(200).send(csvContent);
});

module.exports = {
  getDailyReport,
};
