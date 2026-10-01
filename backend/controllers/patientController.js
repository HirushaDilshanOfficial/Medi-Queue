const OpdPatientProfile = require('../models/OpdPatientProfile');
const Doctor = require('../models/Doctor');
const OpdAppointment = require('../models/OpdAppointment');
const OpdQueueEntry = require('../models/OpdQueueEntry');
const { today, buildLiveState, ACTIVE_STATUSES: QUEUE_ACTIVE } = require('../utils/opdQueue');
const { mapAppointment, relativeDate } = require('../utils/opdAppointment');

function ageFrom(birthday) {
  if (!(birthday instanceof Date) || Number.isNaN(birthday.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birthday.getFullYear();
  const monthDiff = now.getMonth() - birthday.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthday.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

function toProfileDto(profile) {
  return {
    id: String(profile._id),
    fullName: profile.fullName,
    nic: profile.nic || null,
    phone: profile.phone || null,
    email: profile.email || null,
    birthday: profile.birthday ? profile.birthday.toISOString() : null,
    age: ageFrom(profile.birthday),
    gender: profile.gender || null,
    address: profile.address || null,
    district: profile.district || null,
    bloodGroup: profile.bloodGroup || null,
    allergies: profile.allergies || [],
    emergencyContact: profile.emergencyContact || null,
    favouriteDepartment: profile.favouriteDepartment || null,
    remindersEnabled: profile.remindersEnabled !== false,
  };
}

// @desc    Get the signed-in patient's OPD profile
// @route   GET /api/v1/patients/me
// @access  Private/Patient
const getMyProfile = async (req, res) => {
  res.json({ patient: toProfileDto(req.patientProfile) });
};

// @desc    Dashboard aggregate for the signed-in patient
// @route   GET /api/v1/patients/me/dashboard
// @access  Private/Patient
const getDashboard = async (req, res, next) => {
  try {
    const profile = req.patientProfile;
    const todayKey = today();
    const profileId = profile._id;

    const [totalDoctors, activeDoctors, departments, upcomingAppointments, completedVisits, entry] =
      await Promise.all([
        Doctor.countDocuments({}),
        Doctor.countDocuments({ status: 'active' }),
        Doctor.distinct('department'),
        OpdAppointment.countDocuments({
          profile: profileId,
          date: { $gte: todayKey },
          status: { $in: OpdAppointment.ACTIVE_STATUSES },
        }),
        OpdAppointment.countDocuments({ profile: profileId, status: 'completed' }),
        // The patient's live pass, so the dashboard queue card is real rather than
        // the design placeholder. Null until they check in.
        OpdQueueEntry.findOne({ profile: profileId, status: { $in: QUEUE_ACTIVE } })
          .sort({ checkedInAt: -1 })
          .lean(),
      ]);

    const live = entry ? await buildLiveState(entry) : null;

    const nextDoc = await OpdAppointment.findOne({
      profile: profileId,
      date: { $gte: todayKey },
      status: { $in: OpdAppointment.ACTIVE_STATUSES },
    })
      .sort({ date: 1, slotTime: 1 })
      .lean();

    const next = nextDoc ? mapAppointment(nextDoc, { todayKey }) : null;

    res.json({
      patient: toProfileDto(profile),
      stats: {
        totalDoctors,
        activeDoctors,
        departments: departments.filter(Boolean).length,
        upcomingAppointments,
        completedVisits,
        activePass: entry
          ? {
              tokenNumber: entry.tokenNumber,
              department: entry.department,
              room: entry.room || null,
              position: live ? live.position : null,
              estimatedTurnAt: live ? live.estimatedTurnAt : null,
              status: entry.status,
            }
          : null,
      },
      nextAppointment: next
        ? {
            id: next.id,
            doctorName: next.doctorName,
            department: next.department,
            date: next.date,
            dateLabel: relativeDate(next.date, todayKey),
            slotTime: next.slotTime,
            tokenNumber: next.tokenNumber,
            status: next.status,
          }
        : null,
      recentActivity: [],
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getMyProfile, getDashboard, toProfileDto };
