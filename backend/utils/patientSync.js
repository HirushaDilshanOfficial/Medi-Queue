const Patient = require('../models/Patient');
const OpdPatientProfile = require('../models/OpdPatientProfile');
const Appointment = require('../models/Appointment');
const OpdAppointment = require('../models/OpdAppointment');
const QueueToken = require('../models/QueueToken');

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

/**
 * Ensures a receptionist `Patient` record exists for a given `OpdPatientProfile`.
 * Links them mutually so populates and queries always succeed.
 */
async function ensurePatientForProfile(profile) {
  if (!profile) return null;

  // 1. If already linked, verify it exists
  if (profile.patient) {
    const existing = await Patient.findById(profile.patient);
    if (existing && !existing.isDeleted) return existing;
  }

  // 2. Search by NIC if available
  let patientDoc = null;
  if (profile.nic && String(profile.nic).trim()) {
    patientDoc = await Patient.findOne({
      nic: String(profile.nic).trim().toUpperCase(),
      isDeleted: { $ne: true },
    });
  }

  // 3. Search by Phone if available
  if (!patientDoc && profile.phone && String(profile.phone).trim()) {
    patientDoc = await Patient.findOne({
      phone: String(profile.phone).trim(),
      isDeleted: { $ne: true },
    });
  }

  // 4. Create a new Patient record if not found
  if (!patientDoc) {
    const cleanPhone = (profile.phone && String(profile.phone).trim()) || '0770000000';
    const cleanName = (profile.fullName && String(profile.fullName).trim()) || 'Patient';
    const cleanNic = (profile.nic && String(profile.nic).trim().toUpperCase()) || undefined;

    const allergies = Array.isArray(profile.allergies)
      ? profile.allergies.map((a) => (typeof a === 'string' ? { name: a.trim(), severity: 'moderate' } : a))
      : [];

    patientDoc = await Patient.create({
      fullName: cleanName,
      nic: cleanNic,
      phone: cleanPhone,
      dob: profile.birthday || undefined,
      age: profile.birthday ? ageFrom(profile.birthday) : undefined,
      gender: profile.gender || undefined,
      address: profile.address || undefined,
      district: profile.district || undefined,
      bloodGroup: profile.bloodGroup || undefined,
      allergies,
      emergencyContact: profile.emergencyContact || undefined,
      registeredVia: 'app',
      status: 'Active',
      createdBy: profile.user || undefined,
    });
  }

  // 5. Save the link on profile
  if (String(profile.patient) !== String(patientDoc._id)) {
    profile.patient = patientDoc._id;
    await OpdPatientProfile.updateOne(
      { _id: profile._id },
      { $set: { patient: patientDoc._id } }
    ).catch(() => {});
  }

  return patientDoc;
}

/**
 * Sync all existing patient profiles, queue tokens, and appointments across collections.
 * Fixes any tokens that pointed to OpdPatientProfile or OpdAppointment.
 */
async function syncDatabaseRecords() {
  try {
    // 1. Link all OpdPatientProfiles to Patients
    const profiles = await OpdPatientProfile.find({});
    for (const prof of profiles) {
      await ensurePatientForProfile(prof);
    }

    // 2. Fix QueueTokens with missing/invalid patient pointers
    const tokens = await QueueToken.find({}).lean();
    for (const t of tokens) {
      let patientNeedsFix = false;
      let apptNeedsFix = false;

      // Check if patient exists in Patient
      let pDoc = await Patient.findById(t.patient).lean();
      if (!pDoc) {
        // Maybe t.patient is an OpdPatientProfile ID
        const prof = await OpdPatientProfile.findById(t.patient);
        if (prof) {
          pDoc = await ensurePatientForProfile(prof);
          if (pDoc) {
            patientNeedsFix = true;
          }
        }
      }

      // Check if appointment exists in Appointment
      let aDoc = await Appointment.findById(t.appointment).lean();
      if (!aDoc) {
        // Maybe t.appointment is an OpdAppointment ID
        const opdAppt = await OpdAppointment.findById(t.appointment).lean();
        if (opdAppt) {
          // Find or create matching Appointment in appointments collection
          let matched = await Appointment.findOne({
            doctor: opdAppt.doctor,
            date: opdAppt.date,
            slotTime: opdAppt.slotTime,
          });

          if (!matched) {
            const patId = pDoc ? pDoc._id : (opdAppt.profile ? (await OpdPatientProfile.findById(opdAppt.profile))?.patient : null);
            if (patId) {
              matched = await Appointment.create({
                patient: patId,
                doctor: opdAppt.doctor,
                department: opdAppt.department,
                date: opdAppt.date,
                slotTime: opdAppt.slotTime,
                type: opdAppt.type || 'pre_booked',
                status: opdAppt.status,
                tokenNumber: opdAppt.tokenNumber || t.tokenNumber,
                notes: opdAppt.reason || undefined,
                isActive: ['booked', 'checked_in', 'in_consultation'].includes(opdAppt.status),
              });
            }
          }

          if (matched) {
            aDoc = matched;
            apptNeedsFix = true;
          }
        }
      }

      const updates = {};
      if (patientNeedsFix && pDoc) updates.patient = pDoc._id;
      if (apptNeedsFix && aDoc) updates.appointment = aDoc._id;

      if (Object.keys(updates).length > 0) {
        await QueueToken.updateOne({ _id: t._id }, { $set: updates });
      }
    }
  } catch (err) {
    console.error('Error during syncDatabaseRecords:', err.message);
  }
}

module.exports = {
  ensurePatientForProfile,
  syncDatabaseRecords,
  ageFrom,
};
