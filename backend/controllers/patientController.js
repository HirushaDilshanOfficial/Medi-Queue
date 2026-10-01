const OpdPatientProfile = require('../models/OpdPatientProfile');
const Doctor = require('../models/Doctor');

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
const getDashboard = async (req, res) => {
  const profile = req.patientProfile;

  const [totalDoctors, activeDoctors, departments] = await Promise.all([
    Doctor.countDocuments({}),
    Doctor.countDocuments({ status: 'active' }),
    Doctor.distinct('department'),
  ]);

  res.json({
    patient: toProfileDto(profile),
    stats: {
      totalDoctors,
      activeDoctors,
      departments: departments.filter(Boolean).length,
      // Filled in by the booking and queue parts of the patient module.
      upcomingAppointments: null,
      completedVisits: null,
      activePass: null,
    },
    nextAppointment: null,
    recentActivity: [],
  });
};

module.exports = { getMyProfile, getDashboard, toProfileDto };
