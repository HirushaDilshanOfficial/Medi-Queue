const Patient = require('../models/Patient');
const { normalizePhone } = require('../utils/validators');

// @desc    Search patients by NIC or phone (partial, case-insensitive)
// @route   GET /api/reception/patients/search?q=
// @access  Private — receptionist
const searchPatients = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 3) {
      res.status(400);
      throw new Error('Search query must be at least 3 characters.');
    }

    const query = q.trim();

    // Build OR conditions: match NIC or phone (partial, case-insensitive)
    const conditions = [
      { nic: { $regex: query, $options: 'i' } },
      { phone: { $regex: query, $options: 'i' } },
    ];

    // If the query looks like a phone number, also try the normalized form
    const normalized = normalizePhone(query);
    if (normalized && normalized !== query) {
      conditions.push({ phone: { $regex: normalized, $options: 'i' } });
    }

    const patients = await Patient.find({ $or: conditions })
      .select('fullName nic phone age gender nicVerified')
      .limit(10)
      .lean();

    res.json({
      found: patients.length > 0,
      patients,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { searchPatients };
