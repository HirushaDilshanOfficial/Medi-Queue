const QueueToken = require('../models/QueueToken');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Policy = require('../models/Policy');

// Priority order: urgent (0) > senior (1) > normal (2)
const PRIORITY_ORDER = {
  urgent: 0,
  senior: 1,
  normal: 2,
};

/**
 * Retrieve queue tokens for a date, populated with patient and assignedDoctor,
 * ordered by priority (urgent > senior > normal) then tokenNumber ascending.
 *
 * @param {string} [date] - Target date "YYYY-MM-DD" (defaults to today in Asia/Colombo)
 * @param {Object} [filters]
 * @param {string} [filters.type] - "walk_in" | "pre_booked" (matched via associated Appointment)
 * @param {string|string[]} [filters.status] - Status filter (defaults to ['waiting', 'called', 'serving'])
 * @param {string} [filters.department] - Optional department filter
 * @param {string} [filters.doctorId] - Optional assigned doctor filter
 * @param {string} [filters.assignedDoctor] - Optional alias for doctorId
 * @returns {Promise<Array>} List of ordered QueueToken documents
 */
const getOrderedQueue = async (date, filters = {}) => {
  // Default to today in Asia/Colombo if date is omitted
  const targetDate =
    date ||
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

  const query = { date: targetDate };

  // Status filter: defaults to ['waiting', 'called', 'serving']
  if (filters.status) {
    if (filters.status !== 'all') {
      query.status = Array.isArray(filters.status)
        ? { $in: filters.status }
        : filters.status;
    }
  } else {
    query.status = { $in: ['waiting', 'called', 'serving'] };
  }

  // Filter by Appointment type (walk_in | pre_booked)
  if (filters.type && filters.type !== 'all') {
    const OpdAppointment = require('../models/OpdAppointment');
    const appointmentQuery = {
      date: targetDate,
      type: filters.type,
    };
    if (filters.department) {
      appointmentQuery.department = filters.department;
    }

    const [matchingAppointments, matchingOpd] = await Promise.all([
      Appointment.find(appointmentQuery).select('_id').lean(),
      OpdAppointment.find(appointmentQuery).select('_id').lean(),
    ]);

    const appointmentIds = [
      ...matchingAppointments.map((a) => a._id),
      ...matchingOpd.map((a) => a._id),
    ];
    query.appointment = { $in: appointmentIds };
  }

  // Additional optional filters
  if (filters.department && !query.department) {
    query.department = filters.department;
  }
  const doctor = filters.doctorId || filters.assignedDoctor;
  if (doctor) {
    query.assignedDoctor = doctor;
  }

  let policy = await Policy.findOne();
  if (!policy) policy = { priorityQueue: true, dataMasking: true, tokenAutoExpiry: true };

  // Auto expire tokens called > 15 minutes ago
  if (policy.tokenAutoExpiry) {
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const expiredTokens = await QueueToken.find({
      status: 'called',
      calledAt: { $lte: fifteenMinsAgo },
      date: targetDate
    });

    for (const token of expiredTokens) {
      token.status = 'no_show';
      await token.save();
      if (token.appointment) {
        await Appointment.findByIdAndUpdate(token.appointment, {
          $set: { status: 'no_show', isActive: false }
        });
      }
    }
  }

  // Retrieve tokens and populate patient and assignedDoctor (and appointment)
  const tokens = await QueueToken.find(query)
    .populate('patient')
    .populate('assignedDoctor')
    .populate('appointment')
    .sort({ priority: -1, tokenNumber: 1 });

  // Fallback resolution for any tokens where patient or appointment failed to populate directly
  const OpdPatientProfile = require('../models/OpdPatientProfile');
  const OpdAppointment = require('../models/OpdAppointment');
  for (const token of tokens) {
    if (!token.patient) {
      const rawToken = await QueueToken.findById(token._id).lean();
      if (rawToken && rawToken.patient) {
        const prof = await OpdPatientProfile.findById(rawToken.patient).lean();
        if (prof) {
          token.patient = {
            _id: prof._id,
            fullName: prof.fullName,
            nic: prof.nic || '',
            phone: prof.phone || '',
            gender: prof.gender,
          };
        }
      }
    }

    if (!token.appointment) {
      const rawToken = await QueueToken.findById(token._id).lean();
      if (rawToken && rawToken.appointment) {
        const opd = await OpdAppointment.findById(rawToken.appointment).populate('doctor').lean();
        if (opd) {
          token.appointment = {
            _id: opd._id,
            type: opd.type || 'pre_booked',
            status: opd.status,
            date: opd.date,
            slotTime: opd.slotTime,
            department: opd.department,
            doctor: opd.doctor,
            tokenNumber: opd.tokenNumber,
          };
        }
      }
    }

    // Default appointment type if missing
    if (token.appointment && !token.appointment.type) {
      token.appointment.type = 'pre_booked';
    }
  }

  // Guarantee ordering based on priority policy
  tokens.sort((a, b) => {
    if (policy.priorityQueue) {
      const pA = PRIORITY_ORDER[a.priority] ?? 99;
      const pB = PRIORITY_ORDER[b.priority] ?? 99;
      if (pA !== pB) return pA - pB;
    }
    return a.tokenNumber - b.tokenNumber;
  });

  if (policy.dataMasking) {
    tokens.forEach(t => {
      if (t.patient && t.patient.nic) {
        t.patient.nic = t.patient.nic.replace(/^(.{4})(.*)(.{2})$/, '$1****$3');
      }
      if (t.patient && t.patient.contactNumber) {
        t.patient.contactNumber = t.patient.contactNumber.replace(/^(.{3})(.*)(.{2})$/, '$1****$3');
      }
    });
  }

  return tokens;
};

module.exports = {
  getOrderedQueue,
};
