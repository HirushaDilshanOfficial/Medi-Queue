const Patient = require('../models/Patient');
const {
  isValidNIC,
  isValidSLPhone,
  normalizePhone,
  normalizeNIC,
} = require('../utils/validators');

/**
 * Find an existing patient or create a new one.
 * Never creates a duplicate — handles race conditions via unique-index retry.
 *
 * @param {Object} opts
 * @param {string}  [opts.existingPatientId] - If set, load this patient by _id
 * @param {Object}  opts.patient             - Patient fields from the request body
 * @param {string}  opts.createdBy           - The receptionist's User._id
 * @returns {{ patient: Object, isNewPatient: boolean }}
 */
const findOrCreatePatient = async ({ existingPatientId, patient: data, createdBy }) => {
  // ── 1. Load by ID if provided ──
  if (existingPatientId) {
    const existing = await Patient.findById(existingPatientId);
    if (!existing) {
      const err = new Error('Patient not found.');
      err.statusCode = 404;
      throw err;
    }
    return { patient: existing, isNewPatient: false };
  }

  // ── 2. Normalize inputs ──
  const nic = data.nic ? normalizeNIC(data.nic) : null;
  const phone = data.phone ? normalizePhone(data.phone) || data.phone.trim() : null;

  // ── 3. Try to find existing patient by NIC, then by phone ──
  if (nic) {
    const byNic = await Patient.findOne({ nic });
    if (byNic) return { patient: byNic, isNewPatient: false };
  }

  if (phone) {
    const byPhone = await Patient.findOne({ phone });
    if (byPhone) return { patient: byPhone, isNewPatient: false };
  }

  // ── 4. Validate required fields before creating ──
  if (!data.fullName || !data.fullName.trim()) {
    const err = new Error('Patient full name is required.');
    err.statusCode = 400;
    throw err;
  }

  if (!phone) {
    const err = new Error('A valid phone number is required.');
    err.statusCode = 400;
    throw err;
  }

  if (data.phone && !isValidSLPhone(data.phone)) {
    const err = new Error('Invalid Sri Lankan phone number format.');
    err.statusCode = 400;
    throw err;
  }

  if (data.nic && !isValidNIC(data.nic)) {
    const err = new Error('Invalid NIC format. Use 9 digits + V/X or 12 digits.');
    err.statusCode = 400;
    throw err;
  }

  // ── 5. Create patient ──
  const newData = {
    fullName: data.fullName.trim(),
    phone,
    registeredVia: 'reception',
    createdBy,
  };

  if (nic) newData.nic = nic;
  if (data.dob) newData.dob = data.dob;
  if (data.age != null) newData.age = data.age;
  if (data.gender) newData.gender = data.gender;
  if (data.address) newData.address = data.address.trim();
  if (data.district) newData.district = data.district.trim();
  if (data.bloodGroup) newData.bloodGroup = data.bloodGroup;
  if (data.emergencyContact) newData.emergencyContact = data.emergencyContact;
  if (data.allergies) newData.allergies = data.allergies;

  try {
    const created = await Patient.create(newData);
    return { patient: created, isNewPatient: true };
  } catch (err) {
    // ── 5b. Duplicate NIC race condition — another request created it first ──
    if (err.code === 11000 && nic) {
      const reFetched = await Patient.findOne({ nic });
      if (reFetched) return { patient: reFetched, isNewPatient: false };
    }
    throw err;
  }
};

module.exports = { findOrCreatePatient };
