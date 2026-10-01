const mongoose = require('mongoose');
const Doctor = require('../models/Doctor');
const OpdDoctorProfile = require('../models/OpdDoctorProfile');
const { mapDoctor } = require('../utils/mapDoctor');

// @desc    List doctors for the patient directory
// @route   GET /api/v1/doctors
// @access  Private/Patient
const listDoctors = async (req, res) => {
  const { department, search, available, sort } = req.query;

  const filter = {};

  if (department && department !== 'All') {
    filter.department = department;
  }

  if (available === 'true') {
    filter.status = 'active';
  }

  if (search) {
    const term = String(search).trim();
    if (term) {
      const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: new RegExp(safe, 'i') },
        { specialization: new RegExp(safe, 'i') },
        { department: new RegExp(safe, 'i') },
      ];
    }
  }

  const sortMap = {
    name: { name: 1 },
    rating: { name: 1 },
  };
  const sortSpec = sortMap[sort] || { name: 1 };

  const doctors = await Doctor.find(filter).sort(sortSpec).lean();
  const ids = doctors.map((d) => d._id);
  const profiles = ids.length
    ? await OpdDoctorProfile.find({ doctor: { $in: ids } }).lean()
    : [];
  const byDoctor = new Map(profiles.map((p) => [String(p.doctor), p]));

  res.json({
    doctors: doctors.map((d) => mapDoctor(d, byDoctor.get(String(d._id)))),
  });
};

// @desc    List distinct departments for filter chips
// @route   GET /api/v1/doctors/departments
// @access  Private/Patient
const listDepartments = async (req, res) => {
  const departments = await Doctor.distinct('department');
  res.json({ departments: departments.filter(Boolean).sort() });
};

// @desc    Get a single doctor
// @route   GET /api/v1/doctors/:id
// @access  Private/Patient
const getDoctor = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid doctor id' });
  }

  const doctor = await Doctor.findById(id).lean();
  if (!doctor) {
    return res.status(404).json({ message: 'Doctor not found' });
  }

  const profile = await OpdDoctorProfile.findOne({ doctor: doctor._id }).lean();

  res.json({ doctor: mapDoctor(doctor, profile) });
};

module.exports = { listDoctors, listDepartments, getDoctor };
