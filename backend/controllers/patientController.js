const mongoose = require('mongoose');
const { asyncHandler, createError } = require('../utils/errorHandler');
const { normalizePhone } = require('../utils/validators');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const User = require('../models/User');

/**
 * @desc    Search patients by NIC or phone (min 3 chars)
 * @route   GET /api/reception/patients/search?q=
 * @access  Private — receptionist
 */
const searchPatients = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q || q.trim().length < 3) {
    throw createError('Search query must be at least 3 characters.', 400);
  }

  const query = q.trim();

  const conditions = [
    { nic: { $regex: query, $options: 'i' } },
    { phone: { $regex: query, $options: 'i' } },
  ];

  const normalized = normalizePhone(query);
  if (normalized && normalized !== query) {
    conditions.push({ phone: { $regex: normalized, $options: 'i' } });
  }

  const patients = await Patient.find({
    $or: conditions,
    isDeleted: { $ne: true },
  })
    .select('fullName nic phone age gender nicVerified')
    .limit(10)
    .lean();

  res.json({
    found: patients.length > 0,
    patients,
  });
});

/**
 * @desc    Get patients filtered by visited_today | recent | all
 * @route   GET /api/reception/patients?filter=visited_today|recent|all
 * @access  Private — receptionist
 */
const getPatients = asyncHandler(async (req, res) => {
  const filter = req.query.filter || 'all';

  if (!['visited_today', 'recent', 'all'].includes(filter)) {
    throw createError('Invalid filter. Allowed values: visited_today, recent, all.', 400);
  }

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 20);

  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  // 1. Filter: all -> all patients, newest first
  if (filter === 'all') {
    const patients = await Patient.find({ isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json(patients);
  }

  // 2. Date match for visited_today or recent (last 30 days)
  let dateMatch;
  if (filter === 'visited_today') {
    dateMatch = todayStr;
  } else if (filter === 'recent') {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(thirtyDaysAgo);

    dateMatch = { $gte: thirtyDaysAgoStr, $lte: todayStr };
  }

  // Find unique patients who have non-cancelled appointments in the date range, ordered newest visit first
  const visitAggregates = await Appointment.aggregate([
    {
      $match: {
        date: dateMatch,
        status: { $ne: 'cancelled' },
      },
    },
    {
      $sort: { date: -1, slotTime: -1, createdAt: -1 },
    },
    {
      $group: {
        _id: '$patient',
        latestVisitDate: { $first: '$date' },
        latestVisitSlotTime: { $first: '$slotTime' },
        latestVisitCreatedAt: { $first: '$createdAt' },
      },
    },
    {
      $sort: { latestVisitDate: -1, latestVisitCreatedAt: -1 },
    },
    {
      $limit: limit,
    },
  ]);

  const patientIds = visitAggregates.map((v) => v._id);
  if (patientIds.length === 0) {
    return res.json([]);
  }

  const patientDocs = await Patient.find({
    _id: { $in: patientIds },
    isDeleted: { $ne: true },
  }).lean();

  const patientMap = new Map(patientDocs.map((p) => [String(p._id), p]));

  // Preserve newest-first ordering
  const orderedPatients = [];
  for (const v of visitAggregates) {
    const p = patientMap.get(String(v._id));
    if (p) {
      orderedPatients.push({
        ...p,
        latestVisitDate: v.latestVisitDate,
      });
    }
  }

  res.json(orderedPatients);
});

/**
 * @desc    Get patient profile plus visit history (Appointments newest first)
 * @route   GET /api/reception/patients/:id
 * @access  Private — receptionist
 */
const getPatientById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createError('Patient not found.', 404);
  }

  const patient = await Patient.findOne({
    _id: id,
    isDeleted: { $ne: true },
  }).lean();

  if (!patient) {
    throw createError('Patient not found.', 404);
  }

  // Visit history: Appointments newest first with doctor name, department, date, status, notes
  const appointments = await Appointment.find({ patient: id })
    .populate('doctor', 'name specialization department room')
    .sort({ date: -1, slotTime: -1, createdAt: -1 })
    .lean();

  const visitHistory = appointments.map((appt) => {
    const doctorName =
      appt.doctor?.name ||
      (typeof appt.doctor === 'string' ? appt.doctor : null);

    return {
      _id: appt._id,
      date: appt.date,
      slotTime: appt.slotTime,
      doctor: doctorName,
      doctorName,
      doctorDetails: appt.doctor && typeof appt.doctor === 'object' ? {
        _id: appt.doctor._id,
        name: appt.doctor.name,
        specialization: appt.doctor.specialization,
        department: appt.doctor.department,
        room: appt.doctor.room,
      } : null,
      department: appt.department,
      status: appt.status,
      type: appt.type,
      tokenNumber: appt.tokenNumber,
      notes: appt.notes || '',
      createdAt: appt.createdAt,
    };
  });

  res.json({
    ...patient,
    patient: { ...patient },
    visitHistory,
    visits: visitHistory,
    appointments: visitHistory,
  });
});

// ─────────────────────────────────────────────────────────────
// Legacy handlers for /api/v1/patients compatibility (MOH screens)
// ─────────────────────────────────────────────────────────────
const getAllPatients = async (req, res) => {
  try {
    const patients = await User.find({ role: 'Patient' }).sort({ createdAt: -1 });

    const mappedPatients = patients.map((p) => {
      const patientObj = p.toObject();
      return {
        ...patientObj,
        mobile: patientObj.phone,
        status: patientObj.status || 'Active',
        patientNo: patientObj._id.toString().substring(0, 8).toUpperCase(),
      };
    });

    res.status(200).json(mappedPatients);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    if (updateData.mobile) {
      updateData.phone = updateData.mobile;
      delete updateData.mobile;
    }

    const updatedPatient = await User.findByIdAndUpdate(id, updateData, { new: true });

    if (!updatedPatient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    res.status(200).json({ message: 'Patient updated successfully', patient: updatedPatient });
  } catch (error) {
    console.error('Error updating patient:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const togglePatientStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const patient = await User.findById(id);

    if (!patient || patient.role !== 'Patient') {
      return res.status(404).json({ message: 'Patient not found' });
    }

    patient.status = patient.status === 'Active' ? 'Inactive' : 'Active';
    await patient.save();

    res.status(200).json({ message: `Patient marked as ${patient.status}`, patient });
  } catch (error) {
    console.error('Error toggling patient status:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const deletePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedPatient = await User.findByIdAndDelete(id);

    if (!deletedPatient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    res.status(200).json({ message: 'Patient deleted successfully' });
  } catch (error) {
    console.error('Error deleting patient:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  searchPatients,
  getPatients,
  getPatientById,
  getAllPatients,
  updatePatient,
  togglePatientStatus,
  deletePatient,
};
