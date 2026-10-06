const User = require('../models/User');
const Patient = require('../models/Patient');
const OpdPatientProfile = require('../models/OpdPatientProfile');

const GENDER_MAP = { Male: 'male', Female: 'female', Other: 'other' };

function normaliseGender(value) {
  if (typeof value !== 'string') return null;
  const key = value.trim().toLowerCase();
  return GENDER_MAP[value.trim()] || (key === 'male' || key === 'female' || key === 'other' ? key : null);
}

function parseBirthday(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// The shared `User` model keeps patient basics; this middleware guarantees an
// OpdPatientProfile row exists for the logged-in patient and links it to a
// receptionist-side `Patient` record when the NIC matches one.
const loadPatientProfile = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }

    let profile = await OpdPatientProfile.findOne({ user: req.user._id });

    if (!profile) {
      const user = req.user;

      // Best-effort link to the receptionist record (never creates one).
      let linkedPatient = null;
      if (user.nic) {
        linkedPatient = await Patient.findOne({ nic: String(user.nic).toUpperCase() });
      }

      profile = await OpdPatientProfile.create({
        user: user._id,
        patient: linkedPatient ? linkedPatient._id : null,
        fullName: (user.fullName || (linkedPatient && linkedPatient.fullName) || 'Patient').trim(),
        nic: (user.nic || (linkedPatient && linkedPatient.nic) || undefined) || undefined,
        phone: user.phone || (linkedPatient && linkedPatient.phone) || undefined,
        email: user.email || undefined,
        birthday: parseBirthday(user.birthday) || (linkedPatient && linkedPatient.dob) || undefined,
        gender: normaliseGender(user.gender) || (linkedPatient && linkedPatient.gender) || null,
        address: (linkedPatient && linkedPatient.address) || undefined,
        district: (linkedPatient && linkedPatient.district) || undefined,
        bloodGroup: (linkedPatient && linkedPatient.bloodGroup) || null,
      });
    }

    req.patientProfile = profile;
    next();
  } catch (error) {
    next(error);
  }
};

// Blocks non-patients from the patient-only endpoints.
const patientOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'Patient') {
    return res.status(403).json({
      message: `User role '${req.user ? req.user.role : 'unknown'}' is not authorized to access this route`,
    });
  }
  next();
};

module.exports = { loadPatientProfile, patientOnly, normaliseGender, parseBirthday };
