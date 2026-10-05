const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const { asyncHandler } = require('../utils/errorHandler');

const ACTIVE_STATUSES = ['booked', 'checked_in', 'in_consultation'];

/**
 * @desc    Get doctors, optionally filtered by department, with active todayPatients count
 * @route   GET /api/reception/doctors?department=
 * @access  Private — receptionist
 */
const getDoctors = asyncHandler(async (req, res) => {
  const { department, date } = req.query;

  const targetDate =
    date ||
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

  const doctorFilter = {};
  if (department && department.trim()) {
    doctorFilter.department = {
      $regex: new RegExp(`^${department.trim()}$`, 'i'),
    };
  }

  // Fetch doctors and active appointments count for targetDate in parallel
  const [doctors, activeAppointmentCounts] = await Promise.all([
    Doctor.find(doctorFilter).sort({ name: 1 }).lean(),
    Appointment.aggregate([
      {
        $match: {
          date: targetDate,
          status: { $in: ACTIVE_STATUSES },
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

  const countsByDoctor = new Map(
    activeAppointmentCounts.map((item) => [String(item._id), item.count])
  );

  const doctorsWithTodayPatients = doctors.map((doc) => ({
    _id: doc._id,
    name: doc.name,
    specialization: doc.specialization,
    department: doc.department,
    room: doc.room || null,
    status: doc.status,
    dailyCapacity: doc.dailyCapacity ?? 30,
    todayPatients: countsByDoctor.get(String(doc._id)) || 0,
    avgConsultMinutes: doc.avgConsultMinutes,
    workingHours: doc.workingHours,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }));

  res.json(doctorsWithTodayPatients);
});

module.exports = {
  getDoctors,
  getReceptionDoctors: getDoctors,
};
