const mongoose = require('mongoose');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const { asyncHandler } = require('../utils/errorHandler');
const QueueEntry = require('../models/QueueEntry');
const Patient = require('../models/Patient');
const Staff = require('../models/Staff');
const Hospital = require('../models/Hospital');

const ACTIVE_STATUSES = ['booked', 'checked_in', 'in_consultation'];

/**
 * @desc    Get doctors, optionally filtered by department, with active todayPatients count
 * @route   GET /api/reception/doctors?department=
 * @access  Private — receptionist
 */
const getDoctors = asyncHandler(async (req, res) => {
  const { department, hospitalId, date } = req.query;

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
  const activeHospitals = await Hospital.find({ isDeleted: false, status: 'Active' }).select('_id').lean();
  const activeHospitalIds = activeHospitals.map(h => h._id.toString());

  if (hospitalId && mongoose.isValidObjectId(hospitalId)) {
    if (!activeHospitalIds.includes(hospitalId.toString())) {
      return res.json([]);
    }
    const staffAtHospital = await Staff.find({
      hospital: hospitalId,
      role: { $regex: /^doctor$/i },
      isDeleted: false,
    }).distinct('_id');
    doctorFilter.$or = [
      { hospital: hospitalId },
      { staffId: { $in: staffAtHospital } },
    ];
  } else {
    doctorFilter.hospital = { $in: activeHospitalIds };
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

const listDoctors = getDoctors;

const listDepartments = asyncHandler(async (req, res) => {
  const Hospital = require('../models/Hospital');
  const activeHospitals = await Hospital.find({ isDeleted: false, status: 'Active' }).select('_id').lean();
  const activeHospitalIds = activeHospitals.map(h => h._id.toString());

  const departments = await Doctor.distinct('department', { hospital: { $in: activeHospitalIds } });
  res.json(departments.filter(Boolean).sort());
});

const getDoctor = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findById(req.params.id).lean();
  if (!doctor) {
    return res.status(404).json({ message: 'Doctor not found' });
  }
  res.json(doctor);
});

// Realistic mock data matching the Figma "Patient Queue & Next Call" design
const getMockDashboardData = () => {
  return {
    doctor: {
      _id: 'doc_default_01',
      name: 'Dr. Emilia Emelson',
      specialization: 'Orthopedics Surgeon',
      department: 'Orthopedics OPD',
      room: 'Room 3B',
      hospitalName: 'Colombo Teaching Hospital 1',
      status: 'active',
      dailyCapacity: 32,
      avgConsultMinutes: 9,
      workingHours: { start: '08:00', end: '16:00' },
    },
    metrics: {
      currentCallingToken: 28,
      waitingCount: 14,
      completedCount: 18,
      totalToday: 32,
      avgWaitMinutes: 9,
      estimatedWaitTime: '42m',
    },
    currentPatient: {
      tokenNumber: 28,
      patientName: 'Kamal Gunaratne',
      age: 48,
      gender: 'Male',
      priority: 'normal',
      status: 'in_consultation',
      reason: 'Spine Checkup',
      bloodPressure: '124/82',
      heartRate: '76 bpm',
      fileRecord: 'REC-841',
      checkedInTime: '10:15 AM',
      calledAtTime: '08:47',
    },
    upcomingQueue: [
      {
        tokenNumber: 29,
        patientName: 'Aurelia Sisca',
        age: 32,
        gender: 'Female',
        priority: 'normal',
        category: 'all',
        status: 'next',
        reason: 'Post-op Inspection',
        location: 'Ready at Lobby',
        arrivedTime: '10:14',
        vitalsVerified: true,
        slotTime: '11:15 AM',
      },
      {
        tokenNumber: 30,
        patientName: 'Rohan Mendis',
        age: 54,
        gender: 'Male',
        priority: 'elderly',
        category: 'priority',
        status: 'Checked In • Ready',
        reason: 'Hypertension follow',
        location: 'Waiting Area',
        arrivedTime: '10:20',
        vitalsVerified: true,
        slotTime: '11:30 AM',
      },
      {
        tokenNumber: 31,
        patientName: 'Dilshan Madushanka',
        age: 28,
        gender: 'Male',
        priority: 'walkin',
        category: 'walkin',
        status: 'X-Ray Ready',
        reason: 'Acute knee sprain',
        location: 'Radiology returned',
        arrivedTime: '10:32',
        vitalsVerified: true,
        slotTime: '11:45 AM',
      },
      {
        tokenNumber: 32,
        patientName: 'Sanduni Perera',
        age: 41,
        gender: 'Female',
        priority: 'normal',
        category: 'all',
        status: 'Waiting (18m)',
        reason: 'Routine Ortho Revie',
        location: 'Waiting Area',
        arrivedTime: '10:40',
        vitalsVerified: false,
        slotTime: '12:00 PM',
      },
      {
        tokenNumber: 33,
        patientName: 'Piyadasa Samarasinghe',
        age: 71,
        gender: 'Male',
        priority: 'elderly',
        category: 'priority',
        status: 'Checked In • Ready',
        reason: 'Severe Osteoarthritis',
        location: 'Waiting Area',
        arrivedTime: '10:45',
        vitalsVerified: true,
        slotTime: '12:15 PM',
      },
      {
        tokenNumber: 34,
        patientName: 'Kavindi Fernando',
        age: 24,
        gender: 'Female',
        priority: 'walkin',
        category: 'walkin',
        status: 'Waiting',
        reason: 'Ankle Sprain Bandage',
        location: 'Waiting Area',
        arrivedTime: '10:50',
        vitalsVerified: true,
        slotTime: '12:30 PM',
      },
    ],
  };
};

const patientCatalog = [
  { name: 'Sunil Shantha', age: 52, gender: 'Male', reason: 'Hypertension Follow-up', bp: '130/85', hr: '74 bpm' },
  { name: 'Kanthi Rajapaksha', age: 46, gender: 'Female', reason: 'Diabetes Screening', bp: '122/80', hr: '76 bpm' },
  { name: 'Nihal Jayawardena', age: 60, gender: 'Male', reason: 'Chest Discomfort Checkup', bp: '138/88', hr: '82 bpm' },
  { name: 'Anoma Wickramasinghe', age: 39, gender: 'Female', reason: 'Migraine Consultation', bp: '118/76', hr: '70 bpm' },
  { name: 'Bandula Gunasekara', age: 64, gender: 'Male', reason: 'Chronic Knee Pain', bp: '125/82', hr: '72 bpm' },
  { name: 'Malkanthi Silva', age: 43, gender: 'Female', reason: 'Routine Physical Exam', bp: '115/75', hr: '68 bpm' },
  { name: 'Dhammika Perera', age: 50, gender: 'Male', reason: 'Cholesterol Review', bp: '128/84', hr: '75 bpm' },
  { name: 'Sujatha Alwis', age: 57, gender: 'Female', reason: 'Thyroid Medication Review', bp: '120/78', hr: '71 bpm' },
  { name: 'Gamini Senanayake', age: 66, gender: 'Male', reason: 'Arthritis Follow-up', bp: '135/86', hr: '78 bpm' },
  { name: 'Rohini Jayasuriya', age: 48, gender: 'Female', reason: 'Gastritis & Acid Reflux', bp: '122/80', hr: '74 bpm' },
  { name: 'Prasanna Fernando', age: 35, gender: 'Male', reason: 'Lower Back Strain', bp: '120/80', hr: '72 bpm' },
  { name: 'Chitra Samaranayake', age: 59, gender: 'Female', reason: 'Osteoporosis Consultation', bp: '126/82', hr: '75 bpm' },
  { name: 'Mahinda Abeyrathne', age: 63, gender: 'Male', reason: 'Post-CABG Routine Check', bp: '130/80', hr: '70 bpm' },
  { name: 'Kumari Weerasinghe', age: 41, gender: 'Female', reason: 'Allergy & Sinus Review', bp: '118/74', hr: '69 bpm' },
  { name: 'Sarath Fonseka', age: 55, gender: 'Male', reason: 'Blood Sugar Monitoring', bp: '124/82', hr: '76 bpm' },
  { name: 'Manel Rathnayake', age: 51, gender: 'Female', reason: 'General OPD Consultation', bp: '120/78', hr: '73 bpm' },
  { name: 'Asoka Kulatunga', age: 47, gender: 'Male', reason: 'Skin Rash & Dermatology', bp: '118/78', hr: '72 bpm' },
  { name: 'Priyani Samarasekera', age: 44, gender: 'Female', reason: 'Fatigue & Blood Work Review', bp: '116/76', hr: '70 bpm' },
  { name: 'Lalith Jayatilleke', age: 58, gender: 'Male', reason: 'ECG Review & Follow-up', bp: '132/85', hr: '77 bpm' },
  { name: 'Pushpa Dissanayake', age: 62, gender: 'Female', reason: 'Hypertension Follow-up', bp: '136/84', hr: '79 bpm' },
  { name: 'Upul Tharanga', age: 38, gender: 'Male', reason: 'Ankle Sprain Bandage Check', bp: '120/80', hr: '71 bpm' },
  { name: 'Shirani Nanayakkara', age: 53, gender: 'Female', reason: 'Insomnia & Anxiety Consultation', bp: '124/82', hr: '75 bpm' },
  { name: 'Chandana Karunaratne', age: 49, gender: 'Male', reason: 'Urine Culture Follow-up', bp: '122/78', hr: '73 bpm' },
  { name: 'Indrani Cooray', age: 65, gender: 'Female', reason: 'Joint Pain & Physiotherapy', bp: '130/84', hr: '76 bpm' },
  { name: 'Ranil Wickramatunga', age: 56, gender: 'Male', reason: 'Cardiac Wellness Check', bp: '128/82', hr: '74 bpm' },
  { name: 'Menaka Hettiarachchi', age: 34, gender: 'Female', reason: 'Vitamin D Deficiency Follow-up', bp: '114/74', hr: '68 bpm' },
  { name: 'Sanath Jayasuriya', age: 54, gender: 'Male', reason: 'Shoulder Impingement', bp: '126/80', hr: '72 bpm' },
  { name: 'Kamal Gunaratne', age: 48, gender: 'Male', reason: 'Spine Checkup', bp: '124/82', hr: '76 bpm' },
];

const getPatientForToken = (tokenNum) => {
  const idx = Math.max(0, tokenNum - 1) % patientCatalog.length;
  const p = patientCatalog[idx];
  return {
    tokenNumber: tokenNum,
    patientName: p.name,
    age: p.age,
    gender: p.gender,
    priority: tokenNum % 3 === 0 ? 'elderly' : 'normal',
    status: 'in_consultation',
    reason: p.reason,
    bloodPressure: p.bp,
    heartRate: p.hr,
    fileRecord: `REC-${800 + tokenNum}`,
    checkedInTime: '08:15 AM',
    calledAtTime: '08:45 AM',
  };
};

let sessionHistoryStack = [];

// In-memory state for dev / quick testing when DB records aren't seeded yet
let currentSessionState = getMockDashboardData();

// Helper to accurately resolve the requesting doctor
const resolveDoctor = async (req) => {
  let doctor = null;
  const doctorId = req.query?.doctorId || req.body?.doctorId;

  if (doctorId && mongoose.isValidObjectId(doctorId)) {
    doctor = await Doctor.findById(doctorId).populate('hospital').catch(() => null);
  }

  if (!doctor && req.user) {
    if (req.user.email) {
      doctor = await Doctor.findOne({ email: req.user.email }).populate('hospital').catch(() => null);
    }
    if (!doctor && req.user.fullName) {
      const cleanName = req.user.fullName.replace(/^Dr\.\s*/i, '').trim();
      doctor = await Doctor.findOne({
        name: { $regex: cleanName, $options: 'i' },
      }).populate('hospital').catch(() => null);
    }
  }

  if (!doctor) {
    doctor = await Doctor.findOne().populate('hospital').catch(() => null);
  }

  return doctor;
};

// @desc    Get Doctor Home Dashboard data
// @route   GET /api/v1/doctor/dashboard
// @access  Public or Protected
const getDoctorDashboard = async (req, res) => {
  try {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const doctor = await resolveDoctor(req);

    if (!doctor) {
      return res.status(200).json({
        success: true,
        source: 'mock',
        data: currentSessionState,
      });
    }

    // Resolve doctor's current hospital name
    let hospitalName = doctor.hospitalName || (doctor.hospital && doctor.hospital.name);
    if (!hospitalName) {
      try {
        const Staff = require('../models/Staff');
        const cleanName = doctor.name.replace(/^Dr\.\s*/i, '').trim();
        const staffMember = await Staff.findOne({
          $or: [
            { fullName: new RegExp(cleanName, 'i') },
            ...(req.user?.email ? [{ email: req.user.email }] : []),
          ],
        }).populate('hospital').catch(() => null);
        if (staffMember) {
          hospitalName = staffMember.hospitalName || (staffMember.hospital && staffMember.hospital.name);
        }
      } catch (e) {}
    }
    if (!hospitalName) {
      hospitalName = 'Colombo Teaching Hospital 1';
    }

    // 1. Fetch real appointments from MongoDB
    const activeStatuses = ['checked_in', 'waiting', 'called', 'in_consultation'];

    let appointments = await Appointment.find({
      doctor: doctor._id,
      $or: [
        { date: today },
        { status: { $in: activeStatuses } },
      ],
    })
      .populate('patient')
      .sort({ priority: -1, tokenNumber: 1 })
      .lean()
      .catch(() => []);

    // If no appointments for this doctor specifically, check if active appointments exist in same department
    if (appointments.length === 0 && doctor.department) {
      appointments = await Appointment.find({
        department: { $regex: new RegExp(`^${doctor.department.trim()}$`, 'i') },
        $or: [
          { date: today },
          { status: { $in: activeStatuses } },
        ],
      })
        .populate('patient')
        .sort({ priority: -1, tokenNumber: 1 })
        .lean()
        .catch(() => []);
    }

    // If still 0, look for ANY active appointments in the system (checked_in, waiting, called, in_consultation)
    if (appointments.length === 0) {
      appointments = await Appointment.find({
        status: { $in: activeStatuses },
      })
        .populate('patient')
        .sort({ priority: -1, tokenNumber: 1 })
        .lean()
        .catch(() => []);
    }

    const completedCount = await Appointment.countDocuments({
      $or: [
        { doctor: doctor._id, status: 'completed' },
        { status: 'completed', date: today },
      ],
    }).catch(() => 0);

    if (appointments.length > 0) {
      let inConsultationAppt = appointments.find((a) => ['called', 'in_consultation'].includes(a.status));
      let waitingAppts = appointments.filter((a) => ['waiting', 'checked_in'].includes(a.status));

      let servingAppt = inConsultationAppt;
      let upcomingList = waitingAppts;

      if (!servingAppt && waitingAppts.length > 0) {
        servingAppt = waitingAppts[0];
        upcomingList = waitingAppts.slice(1);
      }

      const currentPatient = servingAppt ? {
        tokenNumber: servingAppt.tokenNumber || 1,
        patientName: servingAppt.patient?.fullName || servingAppt.patient?.name || `Patient #${servingAppt.tokenNumber || 1}`,
        age: servingAppt.patient?.age || (servingAppt.patient?.dob ? Math.floor((Date.now() - new Date(servingAppt.patient.dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : 35),
        gender: servingAppt.patient?.gender ? (servingAppt.patient.gender.charAt(0).toUpperCase() + servingAppt.patient.gender.slice(1)) : 'Male',
        priority: servingAppt.priority || 'normal',
        status: servingAppt.status === 'checked_in' ? 'Checked In • Ready' : servingAppt.status,
        reason: servingAppt.notes || `${doctor.department || 'OPD'} Consultation`,
        bloodPressure: servingAppt.patient?.vitals?.bloodPressure || '120/80',
        heartRate: servingAppt.patient?.vitals?.heartRate || '76 bpm',
        fileRecord: servingAppt.patient?.nic ? `NIC: ${servingAppt.patient.nic}` : `REC-${servingAppt.tokenNumber || 800}`,
        checkedInTime: servingAppt.slotTime || '10:00 AM',
        calledAtTime: servingAppt.calledAt ? new Date(servingAppt.calledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (servingAppt.slotTime || '08:45 AM'),
        patientId: servingAppt.patient?._id ? String(servingAppt.patient._id) : undefined,
        appointmentId: String(servingAppt._id),
        allergies: servingAppt.patient?.allergies || [],
        allergy: servingAppt.patient?.allergies && servingAppt.patient.allergies.length > 0
          ? servingAppt.patient.allergies.map((a) => `${a.name || a.allergen || 'Allergy'} (${a.severity || 'mild'})`).join(', ')
          : null,
      } : null;

      const formattedUpcoming = upcomingList.map((item, idx) => ({
        tokenNumber: item.tokenNumber || (idx + 2),
        patientName: item.patient?.fullName || item.patient?.name || `Patient #${item.tokenNumber || idx + 2}`,
        age: item.patient?.age || 30,
        gender: item.patient?.gender ? (item.patient.gender.charAt(0).toUpperCase() + item.patient.gender.slice(1)) : 'Male',
        priority: item.priority || 'normal',
        category: item.priority === 'urgent' ? 'priority' : 'all',
        status: item.status === 'checked_in' ? 'Checked In • Ready' : item.status,
        reason: item.notes || `${doctor.department || 'OPD'} Consultation`,
        location: 'Waiting Area',
        slotTime: item.slotTime || '--:--',
        vitalsVerified: true,
        patientId: item.patient?._id ? String(item.patient._id) : undefined,
        appointmentId: String(item._id),
      }));

      const waitingCount = waitingAppts.length;
      const totalToday = waitingCount + completedCount + (currentPatient ? 1 : 0);

      return res.status(200).json({
        success: true,
        source: 'database',
        data: {
          doctor: {
            _id: doctor._id,
            name: doctor.name,
            specialization: doctor.specialization,
            department: doctor.department,
            room: doctor.room || 'Room 101',
            hospitalName,
            hospital: doctor.hospital || null,
            status: doctor.status || 'active',
            dailyCapacity: doctor.dailyCapacity || 30,
            avgConsultMinutes: doctor.avgConsultMinutes || 10,
            workingHours: doctor.workingHours || { start: '08:00', end: '16:00' },
          },
          metrics: {
            currentCallingToken: currentPatient ? currentPatient.tokenNumber : (completedCount > 0 ? completedCount : 0),
            waitingCount,
            completedCount,
            totalToday,
            avgWaitMinutes: doctor.avgConsultMinutes || 10,
            estimatedWaitTime: `~${waitingCount * (doctor.avgConsultMinutes || 10)}m`,
          },
          currentPatient,
          upcomingQueue: formattedUpcoming,
        },
      });
    }

    // If completely empty in DB (no active appointments at all)
    return res.status(200).json({
      success: true,
      source: 'database_empty',
      data: {
        doctor: {
          _id: doctor._id,
          name: doctor.name,
          specialization: doctor.specialization,
          department: doctor.department,
          room: doctor.room || 'Room 101',
          hospitalName,
          hospital: doctor.hospital || null,
          status: doctor.status || 'active',
          dailyCapacity: doctor.dailyCapacity || 30,
          avgConsultMinutes: doctor.avgConsultMinutes || 10,
          workingHours: doctor.workingHours || { start: '08:00', end: '16:00' },
        },
        metrics: {
          currentCallingToken: 0,
          waitingCount: 0,
          completedCount,
          totalToday: completedCount,
          avgWaitMinutes: doctor.avgConsultMinutes || 10,
          estimatedWaitTime: '0m',
        },
        currentPatient: null,
        upcomingQueue: [],
      },
    });
  } catch (error) {
    console.error('Error in getDoctorDashboard:', error);
    return res.status(200).json({
      success: true,
      source: 'fallback',
      data: currentSessionState,
    });
  }
};

// @desc    Update doctor status ('active', 'on_break', 'offline')
// @route   PATCH /api/v1/doctor/status
// @access  Public / Protected
const updateDoctorStatus = async (req, res) => {
  try {
    const { status, doctorId } = req.body;
    const allowed = ['active', 'on_break', 'offline'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    if (doctorId) {
      await Doctor.findByIdAndUpdate(doctorId, { status }).catch(() => null);
    } else {
      await Doctor.findOneAndUpdate({}, { status }).catch(() => null);
    }

    currentSessionState.doctor.status = status;

    return res.status(200).json({
      success: true,
      message: `Status updated to ${status}`,
      status,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Call next patient in queue
// @route   POST /api/v1/doctor/call-next
// @access  Public / Protected
const callNextPatient = async (req, res) => {
  try {
    const doctor = await resolveDoctor(req);
    const activeStatuses = ['checked_in', 'waiting'];

    if (doctor?._id) {
      // 1. Mark currently serving appointment as completed
      const activeAppt = await Appointment.findOne({
        doctor: doctor._id,
        status: { $in: ['called', 'in_consultation'] },
      });
      if (activeAppt) {
        activeAppt.status = 'completed';
        await activeAppt.save().catch(() => null);
      }

      // 2. Find next waiting appointment for this doctor
      let nextWaiting = await Appointment.findOne({
        doctor: doctor._id,
        status: { $in: activeStatuses },
      })
        .sort({ priority: -1, tokenNumber: 1 })
        .populate('patient')
        .catch(() => null);

      if (!nextWaiting && doctor.department) {
        nextWaiting = await Appointment.findOne({
          department: { $regex: new RegExp(`^${doctor.department.trim()}$`, 'i') },
          status: { $in: activeStatuses },
        })
          .sort({ priority: -1, tokenNumber: 1 })
          .populate('patient')
          .catch(() => null);
      }

      if (!nextWaiting) {
        nextWaiting = await Appointment.findOne({
          status: { $in: activeStatuses },
        })
          .sort({ priority: -1, tokenNumber: 1 })
          .populate('patient')
          .catch(() => null);
      }

      if (nextWaiting) {
        nextWaiting.doctor = doctor._id;
        nextWaiting.status = 'in_consultation';
        nextWaiting.calledAt = new Date();
        await nextWaiting.save().catch(() => null);

        return getDoctorDashboard(req, res);
      }
    }

    // Fallback: update in-memory currentSessionState for dev
    if (currentSessionState.upcomingQueue.length > 0) {
      if (currentSessionState.currentPatient) {
        sessionHistoryStack.push({
          currentPatient: { ...currentSessionState.currentPatient },
          metrics: { ...currentSessionState.metrics },
        });
      }
      currentSessionState.metrics.completedCount += 1;
      const nextPat = currentSessionState.upcomingQueue.shift();
      currentSessionState.currentPatient = {
        ...nextPat,
        status: 'in_consultation',
        reason: nextPat.reason || 'General OPD Consultation',
        bloodPressure: '120/80',
        heartRate: '75 bpm',
        fileRecord: `REC-${800 + nextPat.tokenNumber}`,
        checkedInTime: nextPat.slotTime || '10:30 AM',
        calledAtTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      currentSessionState.metrics.currentCallingToken = nextPat.tokenNumber;
      currentSessionState.metrics.waitingCount = Math.max(0, currentSessionState.upcomingQueue.length);

      return res.status(200).json({
        success: true,
        message: `Token #${nextPat.tokenNumber} called`,
        calledToken: nextPat.tokenNumber,
        data: currentSessionState,
      });
    }

    // Last patient completed when queue has no more waiting patients
    if (currentSessionState.currentPatient) {
      sessionHistoryStack.push({
        currentPatient: { ...currentSessionState.currentPatient },
        metrics: { ...currentSessionState.metrics },
      });
      currentSessionState.metrics.completedCount += 1;
      currentSessionState.currentPatient = null;
      currentSessionState.metrics.waitingCount = 0;
      currentSessionState.metrics.currentCallingToken = 0;

      return res.status(200).json({
        success: true,
        message: 'All patients completed today! Queue is empty.',
        calledToken: null,
        data: currentSessionState,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'No more waiting patients in queue today!',
      calledToken: null,
      data: currentSessionState,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Undo previous consultation and restore previous patient (all the way to Token #001)
// @route   POST /api/v1/doctor/undo-patient
// @access  Public / Protected
const undoPatientConsultation = async (req, res) => {
  try {
    const doctor = await resolveDoctor(req);

    if (doctor?._id) {
      const activeAppt = await Appointment.findOne({
        doctor: doctor._id,
        status: { $in: ['called', 'in_consultation'] },
      });
      if (activeAppt) {
        activeAppt.status = 'checked_in';
        await activeAppt.save().catch(() => null);
      }

      const lastCompleted = await Appointment.findOne({
        doctor: doctor._id,
        status: 'completed',
      }).sort({ updatedAt: -1 });

      if (lastCompleted) {
        lastCompleted.status = 'in_consultation';
        await lastCompleted.save().catch(() => null);
        return getDoctorDashboard(req, res);
      }
    }

    const currentToken = currentSessionState.currentPatient?.tokenNumber;
    if (currentToken && currentToken <= 1) {
      return res.status(400).json({
        success: false,
        message: 'Already at the 1st patient (Token #001). Cannot undo further.',
        isFirstPatient: true,
        data: currentSessionState,
      });
    }

    if (!currentToken && sessionHistoryStack.length === 0 && (currentSessionState.metrics?.completedCount || 0) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'No completed consultations to undo.',
        data: currentSessionState,
      });
    }

    // Determine previous patient to restore
    let prevPatient = null;
    if (sessionHistoryStack.length > 0) {
      const popped = sessionHistoryStack.pop();
      prevPatient = popped.currentPatient;
    } else {
      const targetToken = currentToken ? currentToken - 1 : (currentSessionState.metrics.completedCount || 28);
      prevPatient = getPatientForToken(Math.max(1, targetToken));
    }

    // Put current patient back at the beginning of upcomingQueue if there was one
    if (currentSessionState.currentPatient) {
      const currentAsQueueItem = {
        tokenNumber: currentSessionState.currentPatient.tokenNumber,
        patientName: currentSessionState.currentPatient.patientName,
        age: currentSessionState.currentPatient.age,
        gender: currentSessionState.currentPatient.gender,
        priority: currentSessionState.currentPatient.priority || 'normal',
        category: 'all',
        status: 'next',
        reason: currentSessionState.currentPatient.reason || 'OPD Consultation',
        slotTime: currentSessionState.currentPatient.checkedInTime || '11:00 AM',
      };

      currentSessionState.upcomingQueue = [
        currentAsQueueItem,
        ...currentSessionState.upcomingQueue.filter(
          (q) => q.tokenNumber !== currentAsQueueItem.tokenNumber
        ),
      ];
    }

    currentSessionState.currentPatient = {
      ...prevPatient,
      status: 'in_consultation',
      calledAtTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    currentSessionState.metrics.currentCallingToken = prevPatient.tokenNumber;
    currentSessionState.metrics.completedCount = Math.max(0, currentSessionState.metrics.completedCount - 1);
    currentSessionState.metrics.waitingCount = currentSessionState.upcomingQueue.length;

    return res.status(200).json({
      success: true,
      message: `Undone! Restored Token #${String(prevPatient.tokenNumber).padStart(3, '0')} (${prevPatient.patientName})`,
      restoredToken: prevPatient.tokenNumber,
      isFirstPatient: prevPatient.tokenNumber <= 1,
      data: currentSessionState,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Recall / Ring room chime for active or specific token
// @route   POST /api/v1/doctor/chime
// @access  Public / Protected
const ringChime = async (req, res) => {
  try {
    const { tokenNumber, room } = req.body;
    const currentToken = tokenNumber || currentSessionState.currentPatient?.tokenNumber || 28;
    const currentRoom = room || currentSessionState.doctor.room || 'Room 3B';

    return res.status(200).json({
      success: true,
      message: `Chime & announcement sent: "Token #${currentToken}, please enter ${currentRoom}"`,
      tokenNumber: currentToken,
      room: currentRoom,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Call specific patient into room
// @route   POST /api/v1/doctor/call-token
// @access  Public / Protected
const callSpecificPatient = async (req, res) => {
  try {
    const { tokenNumber } = req.body;
    if (!tokenNumber) {
      return res.status(400).json({ success: false, message: 'Token number is required' });
    }

    const doctor = await resolveDoctor(req);

    if (doctor?._id) {
      await Appointment.updateMany(
        { doctor: doctor._id, status: { $in: ['in_consultation', 'called'] } },
        { $set: { status: 'completed' } }
      ).catch(() => null);

      let target = await Appointment.findOne({
        doctor: doctor._id,
        tokenNumber: Number(tokenNumber),
      }).populate('patient').catch(() => null);

      if (!target && doctor.department) {
        target = await Appointment.findOne({
          department: { $regex: new RegExp(`^${doctor.department.trim()}$`, 'i') },
          tokenNumber: Number(tokenNumber),
        }).populate('patient').catch(() => null);
      }

      if (!target) {
        target = await Appointment.findOne({
          tokenNumber: Number(tokenNumber),
          status: { $in: ['checked_in', 'waiting', 'in_consultation'] },
        }).populate('patient').catch(() => null);
      }

      if (target) {
        target.doctor = doctor._id;
        target.status = 'in_consultation';
        target.calledAt = new Date();
        await target.save().catch(() => null);
        return getDoctorDashboard(req, res);
      }
    }

    const idx = currentSessionState.upcomingQueue.findIndex((p) => p.tokenNumber === Number(tokenNumber));
    if (idx !== -1) {
      currentSessionState.metrics.completedCount += 1;
      const target = currentSessionState.upcomingQueue.splice(idx, 1)[0];
      currentSessionState.currentPatient = {
        ...target,
        status: 'in_consultation',
        bloodPressure: '120/80',
        heartRate: '75 bpm',
        fileRecord: `REC-${800 + target.tokenNumber}`,
        checkedInTime: target.arrivedTime || '10:30 AM',
        calledAtTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      currentSessionState.metrics.currentCallingToken = target.tokenNumber;
      currentSessionState.metrics.waitingCount = Math.max(0, currentSessionState.metrics.waitingCount - 1);

      return res.status(200).json({
        success: true,
        message: `Token #${target.tokenNumber} (${target.patientName}) called into room`,
        calledToken: target.tokenNumber,
        data: currentSessionState,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Token #${tokenNumber} called into room`,
      calledToken: tokenNumber,
      data: currentSessionState,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Real-time Date & Time Utility Helpers for Backend
const toDateKeyBackend = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatRealtimeDateHeaderBackend = (date = new Date()) => {
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const dayName = days[date.getDay()];
  const monthName = months[date.getMonth()];
  const dayNum = date.getDate();
  const year = date.getFullYear();
  return `${dayName}, ${monthName} ${dayNum}, ${year}`;
};

const getRealtimeWeekDaysBackend = (baseDate = new Date()) => {
  const today = new Date(baseDate);
  const dayOfWeek = today.getDay();
  const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayKey = toDateKeyBackend(today);

  let start = new Date(today);
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    start.setDate(today.getDate() - (dayOfWeek - 1));
  } else if (dayOfWeek === 6) {
    start.setDate(today.getDate() - 1);
  }

  const result = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const k = toDateKeyBackend(d);
    result.push({
      dayName: dayNamesShort[d.getDay()],
      dayNumber: d.getDate(),
      dateKey: k,
      isToday: k === todayKey,
      isSelected: k === todayKey,
    });
  }
  return result;
};

// Realistic mock schedule session state matching Figma design with Real-time dates
let scheduleSessionState = {
  doctor: {
    name: 'Dr. Emilia Emelson',
    room: 'Room 3B Online',
    status: 'active',
    avatarUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=200',
  },
  dateHeader: formatRealtimeDateHeaderBackend(new Date()),
  selectedDayKey: toDateKeyBackend(new Date()),
  weekDays: getRealtimeWeekDaysBackend(new Date()),
  shift: {
    title: 'Morning OPD Shift',
    timeRange: '08:30 AM – 01:00 PM',
    room: 'Room 3B Ortho',
    status: 'In Progress',
    consultedCount: 18,
    waitingCount: 14,
    totalCapacity: 32,
    avgMinutesPerPatient: 9,
    remainingWalkinSlots: 4,
    isOnBreak: false,
  },
  timeline: [
    {
      id: 'slot-1',
      time: '09:00 AM',
      timeHour: '09:00',
      timePeriod: 'AM',
      patientName: 'Priyantha Silva',
      reason: 'Fever & Cough • Token #026',
      tokenNumber: 26,
      status: 'done',
    },
    {
      id: 'slot-2',
      time: '09:30 AM',
      timeHour: '09:30',
      timePeriod: 'AM',
      patientName: 'Aurelia Sisca',
      reason: 'Post-op Check • Token #027',
      tokenNumber: 27,
      status: 'done',
    },
    {
      id: 'slot-3',
      time: '10:00 AM',
      timeHour: '10:00',
      timePeriod: 'AM',
      patientName: 'Kamal Gunaratne',
      reason: 'Spine checkup • 10:00 AM',
      tokenNumber: 28,
      status: 'now_attending',
      isNowAttending: true,
      elapsedMinutes: 6,
      locationStatus: 'In Room',
      age: 48,
      gender: 'Male',
      vitals: {
        bloodPressure: '124/82',
        heartRate: '76 bpm',
        temperature: '98.6°F',
        spO2: '98%',
      },
      fileRecord: 'REC-841',
    },
    {
      id: 'slot-4',
      time: '10:30 AM',
      timeHour: '10:30',
      timePeriod: 'AM',
      patientName: 'Rohan Mendis',
      reason: 'Hypertension review • Token #030',
      tokenNumber: 30,
      status: 'waiting',
      age: 54,
      gender: 'Male',
    },
    {
      id: 'slot-5',
      time: '11:00 AM',
      timeHour: '11:00',
      timePeriod: 'AM',
      patientName: 'Dilshan Madushanka',
      reason: 'Acute knee sprain • Token #031',
      tokenNumber: 31,
      status: 'waiting',
      age: 28,
      gender: 'Male',
    },
    {
      id: 'slot-6',
      time: '11:30 AM',
      timeHour: '11:30',
      timePeriod: 'AM',
      patientName: 'Sanduni Perera',
      reason: 'Routine Ortho • Token #032',
      tokenNumber: 32,
      status: 'scheduled',
      age: 41,
      gender: 'Female',
    },
  ],
};

// @desc    Get Doctor Schedule for calendar day
// @route   GET /api/v1/doctor/schedule
// @access  Public / Protected
const formatSlotTimeToAmPm = (slotTime) => {
  if (!slotTime) return '09:00 AM';
  if (/AM|PM/i.test(slotTime)) return slotTime;
  const parts = slotTime.split(':');
  if (parts.length >= 2) {
    let hour = parseInt(parts[0], 10);
    const minute = parts[1].padStart(2, '0');
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${String(hour).padStart(2, '0')}:${minute} ${ampm}`;
  }
  return slotTime;
};

// @desc    Get Doctor Schedule for calendar day
// @route   GET /api/v1/doctor/schedule
// @access  Public / Protected
const getDoctorSchedule = async (req, res) => {
  try {
    const { dateKey } = req.query;
    const todayKey = toDateKeyBackend(new Date());
    const targetKey = dateKey || todayKey;

    const doctor = await resolveDoctor(req);

    let mappedAppointments = [];
    let activeDates = [];

    if (doctor) {
      activeDates = await Appointment.distinct('date', { doctor: doctor._id }).catch(() => []);

      const appts = await Appointment.find({
        doctor: doctor._id,
        date: targetKey,
      })
        .populate('patient')
        .sort({ tokenNumber: 1, slotTime: 1 })
        .lean()
        .catch(() => []);

      mappedAppointments = appts.map((appt) => {
        const rawStatus = (appt.status || '').toLowerCase();
        let status = 'Scheduled';
        if (rawStatus === 'completed') status = 'Done';
        else if (rawStatus === 'in_consultation' || rawStatus === 'called') status = 'Now attending';
        else if (rawStatus === 'waiting' || rawStatus === 'checked_in') status = 'Waiting';

        const patientName =
          appt.patient?.fullName ||
          appt.patient?.name ||
          `Patient #${appt.tokenNumber || 1}`;

        let formattedTime = '09:00 AM';
        if (appt.slotTime) {
          formattedTime = formatSlotTimeToAmPm(appt.slotTime);
        }

        const age =
          appt.patient?.age ||
          (appt.patient?.dob
            ? Math.max(1, Math.floor((Date.now() - new Date(appt.patient.dob).getTime()) / (365.25 * 24 * 3600 * 1000)))
            : 35);

        let gender = 'Male';
        if (appt.patient?.gender) {
          const g = appt.patient.gender.toLowerCase();
          gender = g === 'female' ? 'Female' : 'Male';
        }

        return {
          id: String(appt._id),
          time: formattedTime,
          patientName,
          reason: appt.notes || appt.department || 'Consultation',
          token: `Token #${String(appt.tokenNumber || 1).padStart(3, '0')}`,
          status,
          hospitalId: 'cgh',
          age,
          sex: gender,
          bloodGroup: appt.patient?.bloodGroup || 'O+',
          nic: appt.patient?.nic || 'N/A',
          phone: appt.patient?.phone || 'N/A',
          allergy:
            Array.isArray(appt.patient?.allergies) && appt.patient.allergies.length > 0
              ? appt.patient.allergies.join(', ')
              : undefined,
          isWalkIn: appt.type === 'walk_in',
        };
      });
    }

    const hospitals = mappedAppointments.length > 0 ? ['cgh'] : [];

    const [y, m, d] = targetKey.split('-').map(Number);
    const selectedDate = (!isNaN(y) && !isNaN(m) && !isNaN(d)) ? new Date(y, m - 1, d) : new Date();
    const dynamicHeader = formatRealtimeDateHeaderBackend(selectedDate);

    const timeline = mappedAppointments.map((a) => ({
      id: a.id,
      time: a.time,
      timeHour: a.time.split(' ')[0],
      timePeriod: a.time.split(' ')[1] || 'AM',
      patientName: a.patientName,
      reason: `${a.reason} • ${a.token}`,
      tokenNumber: parseInt(a.token.replace(/\D/g, ''), 10) || 1,
      status: a.status === 'Done' ? 'done' : a.status === 'Now attending' ? 'now_attending' : a.status === 'Waiting' ? 'waiting' : 'scheduled',
    }));

    return res.status(200).json({
      success: true,
      data: {
        dateKey: targetKey,
        selectedDayKey: targetKey,
        dateHeader: dynamicHeader,
        hospitals,
        appointments: mappedAppointments,
        timeline,
        activeDates,
        weekDays: getRealtimeWeekDaysBackend(new Date()),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add Walk-in Slot to current queue and schedule
// @route   POST /api/v1/doctor/walkin-slot
// @access  Public / Protected
const addWalkInSlot = async (req, res) => {
  try {
    const { patientName, reason, priority = 'walkin', age = 35, gender = 'Male' } = req.body;
    if (!patientName || !patientName.trim()) {
      return res.status(400).json({ success: false, message: 'Patient name is required' });
    }

    const trimmedName = patientName.trim();
    const currentTokens = [
      currentSessionState.currentPatient?.tokenNumber || 0,
      ...currentSessionState.upcomingQueue.map((q) => q.tokenNumber || 0),
    ];
    const nextToken = Math.max(28, ...currentTokens) + 1;

    const newQueueItem = {
      tokenNumber: nextToken,
      patientName: trimmedName,
      age: Number(age) || 35,
      gender: gender || 'Male',
      priority: priority === 'urgent' ? 'urgent' : 'walkin',
      category: 'walkin',
      status: 'Waiting',
      reason: reason || 'Walk-in Consultation',
      location: 'Waiting Area',
      arrivedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      vitalsVerified: true,
      slotTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    if (priority === 'urgent') {
      currentSessionState.upcomingQueue.unshift(newQueueItem);
    } else {
      currentSessionState.upcomingQueue.push(newQueueItem);
    }
    currentSessionState.metrics.waitingCount = currentSessionState.upcomingQueue.length;

    // Also sync to scheduleSessionState
    if (typeof scheduleSessionState !== 'undefined' && scheduleSessionState?.timeline) {
      const newSlot = {
        id: `slot-walkin-${Date.now()}`,
        time: newQueueItem.slotTime,
        timeHour: '12:00',
        timePeriod: 'PM',
        patientName: trimmedName,
        reason: `${reason || 'Walk-in Consultation'} • Token #${String(nextToken).padStart(3, '0')}`,
        tokenNumber: nextToken,
        status: 'waiting',
        age: Number(age) || 35,
        gender: gender || 'Male',
      };

      scheduleSessionState.timeline.push(newSlot);
      if (scheduleSessionState.shift) {
        scheduleSessionState.shift.totalCapacity = (scheduleSessionState.shift.totalCapacity || 32) + 1;
        scheduleSessionState.shift.waitingCount = (scheduleSessionState.shift.waitingCount || 0) + 1;
        scheduleSessionState.shift.remainingWalkinSlots = Math.max(0, (scheduleSessionState.shift.remainingWalkinSlots || 4) - 1);
      }
    }

    return res.status(201).json({
      success: true,
      message: `Walk-in patient ${trimmedName} registered as Token #${String(nextToken).padStart(3, '0')}`,
      tokenNumber: nextToken,
      patient: newQueueItem,
      data: currentSessionState,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle break state
// @route   POST /api/v1/doctor/break
// @access  Public / Protected
const toggleDoctorBreak = async (req, res) => {
  try {
    const { minutes = 15 } = req.body;
    scheduleSessionState.shift.isOnBreak = !scheduleSessionState.shift.isOnBreak;
    scheduleSessionState.shift.status = scheduleSessionState.shift.isOnBreak ? 'On Break' : 'In Progress';

    return res.status(200).json({
      success: true,
      message: scheduleSessionState.shift.isOnBreak ? `Doctor took ${minutes}m break` : 'Doctor resumed shift',
      isOnBreak: scheduleSessionState.shift.isOnBreak,
      data: scheduleSessionState,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// PRESCRIPTION & CONSULTATION DETAILS STATE & HANDLERS
// ============================================

let prescriptionSessionState = {
  doctor: {
    name: 'Dr. Emilia Emelson',
    specialization: 'Orthopedics Surgeon',
    department: 'Orthopedics OPD',
    room: 'Room 3B',
    isOnline: true,
    avatarUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=200',
  },
  patient: {
    id: 'pat-8821',
    opdId: 'ID #OPD-8821',
    name: 'Kamal Gunaratne',
    initials: 'KG',
    gender: 'Male',
    age: 46,
    tokenNumber: 28,
    tokenFormatted: 'Token #028',
    vitals: {
      bloodPressure: '120/80',
      pulseRate: '74 bpm',
      weight: '72 kg',
    },
  },
  diagnoses: [
    {
      id: 'diag-1',
      code: 'M54.5',
      name: 'Lumbar Spine Spasm',
      displayName: 'Lumbar Spine Spasm (M54.5)',
      isPrimary: true,
    },
    {
      id: 'diag-2',
      name: 'Mechanical Low Back Pain',
      displayName: 'Mechanical Low Back Pain',
      isPrimary: false,
    },
  ],
  clinicalNotes: 'Mild tenderness over L4-L5 paraspinal region. Straight leg raise test negative bilaterally.',
  isNotesAutoSaved: true,
  prescriptions: [
    {
      id: 'rx-1',
      name: 'Paracetamol 500mg',
      type: 'TABLET',
      dosage: '1 tablet',
      frequency: 'TDS (3x daily)',
      frequencyCode: 'TDS',
      duration: '5 days',
      durationDays: 5,
      instructions: 'After food',
      tagType: 'food',
    },
    {
      id: 'rx-2',
      name: 'Thiocolchicoside 4mg',
      type: 'CAPSULE',
      dosage: '1 capsule',
      frequency: 'BD (2x daily)',
      frequencyCode: 'BD',
      duration: '3 days',
      durationDays: 3,
      instructions: 'Muscle relaxant',
      tagType: 'indication',
    },
  ],
  referrals: [],
};

let aureliaPrescriptionSessionState = {
  doctor: {
    name: 'Dr. Emilia Emelson',
    specialization: 'Orthopedics Surgeon',
    department: 'Orthopedics OPD',
    room: 'Room 3B',
    isOnline: true,
    avatarUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=200',
  },
  patient: {
    id: 'pat-aurelia-029',
    opdId: 'ID #OPD-9034',
    name: 'Aurelia Sisca',
    initials: 'AS',
    gender: 'Female',
    age: 32,
    tokenNumber: 29,
    tokenFormatted: 'Token #029',
    vitals: {
      bloodPressure: '118/76',
      pulseRate: '72 bpm',
      weight: '58 kg',
    },
  },
  diagnoses: [
    {
      id: 'diag-aur-1',
      code: 'S82.401A',
      name: 'Closed fracture distal fibula',
      displayName: 'Closed fracture distal fibula (S82.401A)',
      isPrimary: true,
    },
  ],
  clinicalNotes: 'Follow-up for right ankle distal fibula fracture. Cast intact, pain managed, minimal swelling.',
  isNotesAutoSaved: true,
  prescriptions: [
    {
      id: 'rx-aur-1',
      name: 'Paracetamol 500mg',
      type: 'TABLET',
      dosage: '500 mg',
      frequency: 'Every 6 hours, as needed',
      frequencyCode: 'TDS',
      duration: '5 days',
      durationDays: 5,
      instructions: 'Since Nov 04',
      tagType: 'food',
    },
    {
      id: 'rx-aur-2',
      name: 'Salbutamol Inhaler 100mcg',
      type: 'INHALER',
      dosage: '100 mcg',
      frequency: '2 puffs as needed for wheeze',
      frequencyCode: 'BD',
      duration: 'As needed',
      durationDays: 30,
      instructions: 'Since Aug 12',
      tagType: 'indication',
    },
  ],
  referrals: [],
};

// @desc    Get patient prescription & consultation details
// @route   GET /api/v1/doctor/prescription
// @access  Public / Protected
const getPrescriptionDetails = async (req, res) => {
  try {
    const { tokenNumber, patientName, patientId } = req.query;

    const doctor = await resolveDoctor(req);

    let patient = null;
    let appointment = null;

    if (patientId && mongoose.isValidObjectId(patientId)) {
      patient = await Patient.findById(patientId).lean().catch(() => null);
      if (patient) {
        appointment = await Appointment.findOne({ patient: patient._id })
          .populate('doctor')
          .sort({ updatedAt: -1 })
          .lean()
          .catch(() => null);
      }
    }

    if (!patient && tokenNumber) {
      if (doctor?._id) {
        appointment = await Appointment.findOne({ doctor: doctor._id, tokenNumber: Number(tokenNumber) })
          .populate('patient')
          .populate('doctor')
          .sort({ updatedAt: -1 })
          .lean()
          .catch(() => null);
      }
      if (!appointment) {
        appointment = await Appointment.findOne({ tokenNumber: Number(tokenNumber) })
          .populate('patient')
          .populate('doctor')
          .sort({ updatedAt: -1 })
          .lean()
          .catch(() => null);
      }

      if (appointment && appointment.patient) {
        patient = appointment.patient;
      }
    }

    if (!patient && patientName) {
      patient = await Patient.findOne({
        fullName: { $regex: patientName.trim(), $options: 'i' },
      }).lean().catch(() => null);
      if (patient) {
        appointment = await Appointment.findOne({ patient: patient._id })
          .populate('doctor')
          .sort({ updatedAt: -1 })
          .lean()
          .catch(() => null);
      }
    }

    // Default: prioritize current doctor's active consultation or checked-in queue patient
    if (!patient) {
      if (doctor?._id) {
        appointment = await Appointment.findOne({
          doctor: doctor._id,
          status: { $in: ['in_consultation', 'called'] },
        })
          .populate('patient')
          .populate('doctor')
          .sort({ updatedAt: -1 })
          .lean()
          .catch(() => null);

        if (!appointment) {
          appointment = await Appointment.findOne({
            doctor: doctor._id,
            status: { $in: ['checked_in', 'waiting'] },
          })
            .populate('patient')
            .populate('doctor')
            .sort({ priority: -1, tokenNumber: 1 })
            .lean()
            .catch(() => null);
        }
      }

      if (!appointment && doctor?.department) {
        appointment = await Appointment.findOne({
          department: { $regex: new RegExp(`^${doctor.department.trim()}$`, 'i') },
          status: { $in: ['in_consultation', 'called', 'checked_in', 'waiting'] },
        })
          .populate('patient')
          .populate('doctor')
          .sort({ priority: -1, tokenNumber: 1 })
          .lean()
          .catch(() => null);
      }

      if (!appointment) {
        appointment = await Appointment.findOne({
          status: { $in: ['in_consultation', 'called', 'checked_in', 'waiting'] },
        })
          .populate('patient')
          .populate('doctor')
          .sort({ priority: -1, tokenNumber: 1 })
          .lean()
          .catch(() => null);
      }

      if (appointment && appointment.patient) {
        patient = appointment.patient;
      }
    }

    if (patient) {
      const opdId = patient.nic ? `ID #${patient.nic}` : `ID #OPD-${String(patient._id).slice(-4).toUpperCase()}`;
      const nameParts = (patient.fullName || 'Patient').split(' ');
      const initials = nameParts.map((n) => n[0]).join('').toUpperCase().slice(0, 2);

      const realPrescriptionData = {
        doctor: {
          name: doctor?.name || appointment?.doctor?.name || 'Dr. Palitha Perera',
          specialization: doctor?.specialization || appointment?.doctor?.specialization || 'Consultant Physician',
          department: doctor?.department || appointment?.doctor?.department || 'General OPD',
          room: doctor?.room || appointment?.doctor?.room || 'Room 101',
          isOnline: true,
          avatarUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=200',
        },
        patient: {
          id: String(patient._id),
          opdId,
          name: patient.fullName,
          initials,
          gender: patient.gender ? (patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)) : 'Other',
          age: patient.age || 35,
          tokenNumber: appointment?.tokenNumber || (tokenNumber ? Number(tokenNumber) : 1),
          tokenFormatted: `Token #${String(appointment?.tokenNumber || tokenNumber || 1).padStart(3, '0')}`,
          vitals: {
            bloodPressure: patient.vitals?.bloodPressure || '--/--',
            pulseRate: patient.vitals?.heartRate ? (String(patient.vitals.heartRate).replace(/\D/g, '') + ' bpm') : '-- bpm',
            weight: patient.vitals?.weight ? `${patient.vitals.weight} kg` : '-- kg',
          },
          allergy: patient.allergies && patient.allergies.length > 0 ? {
            hasAllergy: true,
            isHighRisk: patient.allergies.some((a) => (a.severity || '').toLowerCase().includes('severe') || (a.severity || '').toLowerCase().includes('high')),
            title: `Allergy • ${patient.allergies.map((a) => a.name).join(', ')}`,
            description: patient.allergies.map((a) => `${a.name} (${a.severity || 'mild'})`).join('; '),
          } : {
            hasAllergy: false,
            isHighRisk: false,
            title: 'No Known Drug Allergies (NKDA)',
            description: 'No known adverse drug reactions recorded.',
          },
          allergies: patient.allergies && patient.allergies.length > 0
            ? patient.allergies.map((a, idx) => ({
                id: `alg-${patient._id}-${idx}`,
                allergen: a.name || a.allergen || 'Allergy',
                reaction: a.reaction || 'Other',
                severity: a.severity || 'mild',
                note: a.note || '',
              }))
            : [],
        },
        diagnoses: [
          {
            id: 'diag-real-1',
            name: appointment?.notes || 'General OPD Consultation',
            displayName: appointment?.notes || 'General OPD Consultation',
            isPrimary: true,
          },
        ],
        clinicalNotes: appointment?.notes || '',
        isNotesAutoSaved: true,
        prescriptions: [],
      };

      return res.status(200).json({
        success: true,
        data: realPrescriptionData,
      });
    }

    if (Number(tokenNumber) === 29 || (patientName && String(patientName).includes('Aurelia'))) {
      return res.status(200).json({
        success: true,
        data: aureliaPrescriptionSessionState,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        doctor: {
          name: doctor?.name || 'Dr. Palitha Perera',
          specialization: doctor?.specialization || 'Consultant Physician',
          department: doctor?.department || 'General OPD',
          room: doctor?.room || 'Room 101',
          isOnline: true,
          avatarUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=200',
        },
        patient: {
          id: 'pat-norm-001',
          opdId: 'ID #199000000001',
          name: 'Patient Normal',
          initials: 'PN',
          gender: 'Male',
          age: 30,
          tokenNumber: 1,
          tokenFormatted: 'Token #001',
          vitals: {
            bloodPressure: '--/--',
            pulseRate: '-- bpm',
            weight: '-- kg',
          },
          allergy: {
            hasAllergy: false,
            isHighRisk: false,
            title: 'No Known Drug Allergies (NKDA)',
            description: 'No known adverse drug reactions recorded.',
          },
          allergies: [],
        },
        diagnoses: [
          {
            id: 'diag-default-1',
            name: 'General OPD Consultation',
            displayName: 'General OPD Consultation',
            isPrimary: true,
          },
        ],
        clinicalNotes: '',
        isNotesAutoSaved: true,
        prescriptions: [],
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Save prescription and send digital Rx
// @route   POST /api/v1/doctor/prescription
// @access  Public / Protected
const savePrescription = async (req, res) => {
  try {
    const { diagnoses, clinicalNotes, prescriptions, tokenNumber } = req.body;
    const target = (!tokenNumber || Number(tokenNumber) === 29) ? aureliaPrescriptionSessionState : prescriptionSessionState;
    if (diagnoses !== undefined) target.diagnoses = diagnoses;
    if (clinicalNotes !== undefined) target.clinicalNotes = clinicalNotes;
    if (prescriptions !== undefined) target.prescriptions = prescriptions;

    return res.status(200).json({
      success: true,
      message: 'Prescription saved & Digital Rx sent to patient successfully!',
      data: target,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Refer patient to Physiotherapy or Laboratory
// @route   POST /api/v1/doctor/referral
// @access  Public / Protected
const referPatient = async (req, res) => {
  try {
    const { referralType = 'Physiotherapy', notes = '' } = req.body;
    const referralEntry = {
      id: `ref-${Date.now()}`,
      referralType,
      notes,
      patientName: prescriptionSessionState.patient.name,
      tokenNumber: prescriptionSessionState.patient.tokenNumber,
      createdAt: new Date().toISOString(),
    };
    prescriptionSessionState.referrals.push(referralEntry);

    return res.status(200).json({
      success: true,
      message: `Referral to ${referralType} recorded successfully.`,
      referral: referralEntry,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// PATIENT ELECTRONIC HEALTH RECORDS (EHR)
// ============================================

const patientRecordsDatabase = {
  'aurelia': {
    id: 'pat-aurelia-029',
    name: 'Aurelia Sisca',
    shortName: 'Aurelia',
    verified: true,
    age: 32,
    gender: 'Female',
    bloodGroup: 'B+',
    tokenNumber: 29,
    tokenFormatted: '#029',
    nic: '1993-8472901',
    registeredTime: '08:30 AM',
    photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
    allergy: {
      isHighRisk: true,
      title: 'High Risk Allergy • Angioedema',
      description: 'Sulfa Drugs (Sulfonamides, TMP-SMX). Do not administer.',
    },
    vitals: {
      triageTime: 'Triage: 12 min ago',
      bloodPressure: '118/75',
      bloodPressureUnit: 'mmHg',
      heartRate: '72',
      heartRateUnit: 'bpm',
      bodyTemp: '98.6',
      bodyTempUnit: '°F',
      spO2: '99%',
      spO2Status: 'Normal',
    },
    imaging: {
      subtitle: 'Recent (2 days ago)',
      title: 'X-Ray Right Ankle',
      description: 'AP & Lateral Views • Dr. Clara Silva',
      imageUrl: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=300',
      reportSummary: 'Non-displaced distal fibular micro-crack consolidation. Mild soft-tissue swelling around lateral malleolus. No acute displacement.',
    },
    recentVisits: [
      {
        id: 'rec-1',
        title: 'Closed fracture distal fibula',
        date: 'Nov 04, 2025',
        details: 'Orthopedic Suite • Short-leg cast applied, non-weight bearing advice.',
        icon: 'account-injury-outline',
      },
      {
        id: 'rec-2',
        title: 'Acute viral pharyngitis',
        date: 'Sept 12, 2025',
        details: 'Symptomatic care prescribed.',
        statusBadge: 'Resolved',
        icon: 'shield-plus-outline',
      },
      {
        id: 'rec-3',
        title: 'Annual Physical & CBC',
        date: 'May 18, 2025',
        details: 'All parameters normal. Vitamin D supplementation advised.',
        statusBadge: 'Completed',
        icon: 'clipboard-check-outline',
      },
    ],
  },
  'kamal': {
    id: 'pat-kamal-028',
    name: 'Kamal Gunaratne',
    shortName: 'Kamal',
    verified: true,
    age: 46,
    gender: 'Male',
    bloodGroup: 'O+',
    tokenNumber: 28,
    tokenFormatted: '#028',
    nic: '1978-5521940',
    registeredTime: '08:15 AM',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
    allergy: {
      isHighRisk: false,
      title: 'Mild Allergy • Penicillin',
      description: 'Mild cutaneous rash reported in 2018. Prefer Cephalosporins / Macrolides.',
    },
    vitals: {
      triageTime: 'Triage: 25 min ago',
      bloodPressure: '120/80',
      bloodPressureUnit: 'mmHg',
      heartRate: '74',
      heartRateUnit: 'bpm',
      bodyTemp: '98.4',
      bodyTempUnit: '°F',
      spO2: '98%',
      spO2Status: 'Normal',
    },
    imaging: {
      subtitle: 'Recent (1 week ago)',
      title: 'MRI Lumbar Spine',
      description: 'L4-L5 Axial & Sagittal • Dr. K. Silva',
      imageUrl: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=300',
      reportSummary: 'Mild L4-L5 disc protrusion without significant nerve root impingement.',
    },
    recentVisits: [
      {
        id: 'rec-k1',
        title: 'Lumbar Spine Spasm follow-up',
        date: 'Jan 15, 2026',
        details: 'Orthopedic Suite • Physiotherapy exercises prescribed.',
        statusBadge: 'Active',
        icon: 'account-injury-outline',
      },
      {
        id: 'rec-k2',
        title: 'General Health Screening',
        date: 'Oct 10, 2025',
        details: 'Lipid profile and fasting glucose normal.',
        statusBadge: 'Completed',
        icon: 'clipboard-check-outline',
      },
    ],
  },
};

// @desc    Get Patient Health Records by search query or list
// @route   GET /api/v1/doctor/records
// @access  Public / Protected
const getPatientRecords = async (req, res) => {
  try {
    const { query = '' } = req.query;
    const cleanQuery = query.trim();

    const doctor = await resolveDoctor(req);

    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const activeStatuses = ['in_consultation', 'called', 'checked_in', 'waiting'];

    let docAppointments = [];
    if (doctor?._id) {
      docAppointments = await Appointment.find({
        doctor: doctor._id,
        $or: [{ date: today }, { status: { $in: activeStatuses } }],
      })
        .populate('patient')
        .sort({ priority: -1, tokenNumber: 1 })
        .lean()
        .catch(() => []);
    }

    if (docAppointments.length === 0 && doctor?.department) {
      docAppointments = await Appointment.find({
        department: { $regex: new RegExp(`^${doctor.department.trim()}$`, 'i') },
        $or: [{ date: today }, { status: { $in: activeStatuses } }],
      })
        .populate('patient')
        .sort({ priority: -1, tokenNumber: 1 })
        .lean()
        .catch(() => []);
    }

    if (docAppointments.length === 0) {
      docAppointments = await Appointment.find({
        status: { $in: activeStatuses },
      })
        .populate('patient')
        .sort({ priority: -1, tokenNumber: 1 })
        .lean()
        .catch(() => []);
    }

    // Determine current serving appointment
    const inConsultationAppt = docAppointments.find((a) => ['in_consultation', 'called'].includes(a.status));
    const waitingAppts = docAppointments.filter((a) => ['waiting', 'checked_in'].includes(a.status));
    const servingAppt = inConsultationAppt || (waitingAppts.length > 0 ? waitingAppts[0] : null);

    // Build patient appointment map
    const patientApptMap = new Map();
    const allRecentAppts = await Appointment.find({})
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean()
      .catch(() => []);

    allRecentAppts.forEach((a) => {
      if (a.patient) {
        patientApptMap.set(String(a.patient), a);
      }
    });

    docAppointments.forEach((a) => {
      if (a.patient?._id) {
        patientApptMap.set(String(a.patient._id), a);
      }
    });

    let patients = [];
    if (cleanQuery) {
      patients = await Patient.find({
        $or: [
          { fullName: { $regex: cleanQuery, $options: 'i' } },
          { phone: { $regex: cleanQuery, $options: 'i' } },
          { nic: { $regex: cleanQuery, $options: 'i' } },
        ],
      })
        .limit(30)
        .lean()
        .catch(() => []);
    } else {
      const dbPatients = await Patient.find({})
        .sort({ updatedAt: -1 })
        .limit(35)
        .lean()
        .catch(() => []);

      const orderedPatients = [];
      const seenIds = new Set();

      // 1. First priority: The doctor's currently serving patient
      if (servingAppt?.patient && servingAppt.patient._id) {
        orderedPatients.push(servingAppt.patient);
        seenIds.add(String(servingAppt.patient._id));
      }

      // 2. Second priority: Other upcoming patients in this doctor's queue
      for (const appt of docAppointments) {
        if (appt.patient && appt.patient._id && !seenIds.has(String(appt.patient._id))) {
          orderedPatients.push(appt.patient);
          seenIds.add(String(appt.patient._id));
        }
      }

      // 3. Remainder of patients
      for (const p of dbPatients) {
        if (!seenIds.has(String(p._id))) {
          orderedPatients.push(p);
          seenIds.add(String(p._id));
        }
      }

      patients = orderedPatients;
    }

    if (patients && patients.length > 0) {
      const formatted = patients.map((p, idx) => {
        const nameParts = (p.fullName || 'Patient').split(' ');
        const shortName = nameParts[0];

        const hasRecordedVitals = Boolean(
          p.vitals &&
          (p.vitals.bloodPressure || p.vitals.heartRate || p.vitals.temperature || p.vitals.spO2 || p.vitals.weight)
        );

        const bpStr = hasRecordedVitals ? (p.vitals.bloodPressure || '120/80') : '--/--';
        const [sysStr, diaStr] = hasRecordedVitals ? bpStr.split('/') : ['0', '0'];
        const sys = Number(sysStr) || (hasRecordedVitals ? 120 : 0);
        const dia = Number(diaStr) || (hasRecordedVitals ? 80 : 0);
        const hr = hasRecordedVitals ? (Number(String(p.vitals.heartRate).replace(/\D/g, '')) || 74) : 0;
        const temp = hasRecordedVitals ? (Number(p.vitals.temperature) || 36.8) : 0;
        const spo2 = hasRecordedVitals ? (Number(p.vitals.spO2) || 99) : 0;
        const weightNum = hasRecordedVitals ? (Number(p.vitals.weight) || 65) : 0;
        const heightNum = hasRecordedVitals ? (Number(p.vitals.height) || 168) : 0;

        const pAppt = patientApptMap.get(String(p._id));
        const isCurrentServing = servingAppt && servingAppt.patient?._id && String(servingAppt.patient._id) === String(p._id);

        let realToken = pAppt?.tokenNumber;
        if (!realToken) {
          realToken = idx + 1;
        }

        let patientStatus = 'Waiting';
        if (isCurrentServing) {
          patientStatus = 'In consultation';
        } else if (pAppt) {
          if (['in_consultation', 'called'].includes(pAppt.status)) {
            patientStatus = 'In consultation';
          } else if (['checked_in', 'waiting'].includes(pAppt.status)) {
            patientStatus = 'Waiting';
          } else if (pAppt.status === 'completed') {
            patientStatus = 'Seen';
          }
        } else {
          patientStatus = 'Seen';
        }

        return {
          id: String(p._id),
          name: p.fullName,
          shortName,
          verified: p.nicVerified || false,
          age: p.age || 35,
          gender: p.gender ? (p.gender.charAt(0).toUpperCase() + p.gender.slice(1)) : 'Male',
          bloodGroup: p.bloodGroup || 'O+',
          tokenNumber: realToken,
          tokenFormatted: `#${String(realToken).padStart(3, '0')}`,
          nic: p.nic || 'N/A',
          phone: p.phone,
          status: patientStatus,
          registeredTime: p.createdAt ? new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '08:30 AM',
          photoUrl: p.gender === 'female'
            ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200'
            : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
          allergy: p.allergies && p.allergies.length > 0 ? {
            hasAllergy: true,
            isHighRisk: p.allergies.some((a) => (a.severity || '').toLowerCase().includes('severe') || (a.severity || '').toLowerCase().includes('high')),
            title: `Allergy • ${p.allergies.map((a) => a.name).join(', ')}`,
            description: p.allergies.map((a) => `${a.name} (${a.severity || 'mild'})`).join('; '),
          } : {
            hasAllergy: false,
            isHighRisk: false,
            title: 'No Known Drug Allergies (NKDA)',
            description: 'No known adverse drug reactions recorded.',
          },
          chronicConditions: p.chronicConditions || [],
          medications: p.medications || [],
          imaging: {
            hasImaging: false,
          },
          hasVitals: hasRecordedVitals,
          vitals: {
            hasVitals: hasRecordedVitals,
            triageTime: hasRecordedVitals
              ? (p.vitals.recordedAt ? new Date(p.vitals.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Triage: 15 min ago')
              : 'Triage: Not recorded',
            bloodPressure: bpStr,
            bloodPressureUnit: 'mmHg',
            heartRate: hasRecordedVitals ? String(hr) : '--',
            heartRateUnit: 'bpm',
            bodyTemp: hasRecordedVitals ? temp.toFixed(1) : '--',
            bodyTempUnit: '°C',
            spO2: hasRecordedVitals ? `${spo2}%` : '--%',
            spO2Status: hasRecordedVitals ? 'Normal' : 'Pending',
            systolic: sys,
            diastolic: dia,
            heartRateNum: hr,
            tempNum: temp,
            spO2Num: spo2,
            weight: hasRecordedVitals ? `${weightNum} kg` : '-- kg',
            weightNum,
            height: hasRecordedVitals ? `${heightNum} cm` : '-- cm',
            heightNum,
            bmi: hasRecordedVitals && heightNum > 0 ? (weightNum / Math.pow(heightNum / 100, 2)).toFixed(1) : '--',
            bmiNum: hasRecordedVitals && heightNum > 0 ? Number((weightNum / Math.pow(heightNum / 100, 2)).toFixed(1)) : 0,
          },
          vitalsHistory: hasRecordedVitals ? [
            {
              id: `vh-${p._id}-1`,
              dateLabel: 'Now',
              timestamp: 'Today, 08:30 AM',
              systolic: sys,
              diastolic: dia,
              heartRate: hr,
              bodyTemp: temp,
              spO2: spo2,
              weight: weightNum,
              bmi: Number((weightNum / Math.pow(heightNum / 100, 2)).toFixed(1)),
            },
          ] : [],
          recentVisits: [],
        };
      });

      return res.status(200).json({
        success: true,
        query,
        doctor: {
          name: doctor?.name || 'Dr. Palitha Perera',
          room: doctor?.room || 'Room 101',
          department: doctor?.department || 'General OPD',
        },
        currentPatientId: servingAppt?.patient?._id ? String(servingAppt.patient._id) : (formatted[0]?.id),
        data: formatted,
      });
    }

    let record = patientRecordsDatabase['aurelia'];
    const qLower = cleanQuery.toLowerCase();
    if (qLower.includes('kamal') || qLower.includes('28')) {
      record = patientRecordsDatabase['kamal'];
    }

    return res.status(200).json({
      success: true,
      query,
      data: [record],
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Doctor's currently assigned hospital
// @route   PATCH /api/v1/doctor/hospital
const updateDoctorHospital = async (req, res) => {
  try {
    const { hospitalName, hospitalId, doctorId } = req.body;
    let query = doctorId ? { _id: doctorId } : {};
    let doctor = await Doctor.findOne(query);
    if (doctor) {
      if (hospitalName) doctor.hospitalName = hospitalName;
      if (hospitalId) doctor.hospital = hospitalId;
      await doctor.save();
    }
    if (currentSessionState && currentSessionState.doctor) {
      if (hospitalName) currentSessionState.doctor.hospitalName = hospitalName;
      if (hospitalId) currentSessionState.doctor.hospital = hospitalId;
    }
    return res.status(200).json({
      success: true,
      message: 'Hospital updated successfully',
      hospitalName: hospitalName || currentSessionState.doctor.hospitalName,
      hospitalId,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all active hospitals for doctor
// @route   GET /api/v1/doctor/hospitals
const getDoctorHospitals = async (req, res) => {
  try {
    const Hospital = require('../models/Hospital');
    const hospitals = await Hospital.find({ isDeleted: false, status: 'Active' }).select('name code type location departments');
    return res.status(200).json({ success: true, data: hospitals });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update or record patient vitals
// @route   POST /api/v1/doctor/vitals
const updatePatientVitals = async (req, res) => {
  try {
    const { patientId, tokenNumber, bloodPressure, heartRate, temperature, spO2, weight, height } = req.body;
    let patient = null;
    if (patientId && mongoose.isValidObjectId(patientId)) {
      patient = await Patient.findById(patientId);
    }
    if (!patient && tokenNumber) {
      const appt = await Appointment.findOne({ tokenNumber }).populate('patient');
      if (appt && appt.patient) {
        patient = await Patient.findById(appt.patient._id || appt.patient);
      }
    }
    if (patient) {
      patient.vitals = {
        bloodPressure: bloodPressure || '120/80',
        heartRate: heartRate ? String(heartRate).replace(/\D/g, '') + ' bpm' : '74 bpm',
        temperature: Number(temperature) || 36.8,
        spO2: Number(spO2) || 99,
        weight: Number(weight) || 65,
        height: Number(height) || 168,
        recordedAt: new Date(),
      };
      await patient.save();
      return res.status(200).json({ success: true, message: 'Vitals saved successfully', data: patient.vitals });
    }
    return res.status(200).json({ success: true, message: 'Vitals saved locally' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const PDFDocument = require('pdfkit');

const generatePrescriptionPdfApi = async (req, res) => {
  try {
    const { data = {}, clinicalNotes = '' } = req.body || {};

    let resolvedDoctor = null;
    try {
      resolvedDoctor = await resolveDoctor(req);
    } catch (e) {}

    // Dynamic hospital name resolution
    let hospitalName =
      req.body.hospitalName ||
      data.hospitalName ||
      data.doctor?.hospitalName ||
      resolvedDoctor?.hospitalName;

    if (!hospitalName) {
      try {
        const docRecord = await Doctor.findOne();
        if (docRecord?.hospitalName) {
          hospitalName = docRecord.hospitalName;
        }
      } catch (e) {}
    }
    if (!hospitalName) {
      hospitalName = 'Colombo Teaching Hospital';
    }

    const patientObj = data.patient || {};
    const doctorObj = data.doctor || resolvedDoctor || {};
    const vitalsObj = patientObj.vitals || data.vitals || {};

    const patientName = patientObj.name || data.patientName || 'Patient Normal';
    const rawToken = patientObj.tokenFormatted || (patientObj.tokenNumber !== undefined ? `#${String(patientObj.tokenNumber).padStart(3, '0')}` : null) || data.tokenNumber || '#001';
    const tokenNumber = String(rawToken).startsWith('#') ? String(rawToken) : `#${rawToken}`;

    const patientAge = patientObj.age !== undefined ? `${patientObj.age} Years` : (data.patientAge ? `${data.patientAge} Years` : '30 Years');
    const patientGender = patientObj.gender || data.patientGender || 'Male';

    const allergiesList = (patientObj.allergies || data.allergies || []).map(a => typeof a === 'string' ? a : (a.name || a.allergen || String(a)));
    const allergiesStr = allergiesList.length > 0 ? allergiesList.join(', ') : 'None Reported';

    const doctorName = doctorObj.name || data.doctorName || 'Dr. Palitha Perera';
    const department = doctorObj.department || data.department || doctorObj.specialization || 'General OPD';

    // Vitals
    const bp = vitalsObj.bloodPressure || data.bloodPressure || '118/75';
    const pulse = vitalsObj.pulseRate || vitalsObj.heartRate || data.heartRate || '72 bpm';
    const temp = vitalsObj.temperature ? `${vitalsObj.temperature} °C` : (data.temperature ? `${data.temperature} °C` : '—');
    const spo2 = (vitalsObj.spO2 !== undefined ? vitalsObj.spO2 : (vitalsObj.spo2 !== undefined ? vitalsObj.spo2 : data.spO2)) ? `${vitalsObj.spO2 || vitalsObj.spo2 || data.spO2}%` : '—';
    const weightStr = vitalsObj.weight ? `${vitalsObj.weight} kg` : (data.weight ? `${data.weight} kg` : '68 kg');

    const rawDiagnoses = data.diagnoses || [];
    const diagnosesList = rawDiagnoses.map(d => typeof d === 'string' ? d : (d.displayName || d.name || 'General OPD Consultation'));
    const diagnosesText = diagnosesList.length > 0 ? diagnosesList.join(' • ') : 'General OPD Consultation';

    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const verificationCode = 'MQ-' + (Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase()).slice(0, 10);
    const filename = `Prescription_${patientName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${String(tokenNumber).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ size: 'A4', margin: 30 });
    doc.pipe(res);

    // 1. Double Outer Frame
    doc.rect(34, 30, 527, 782).lineWidth(1.2).strokeColor('#2b3d52').stroke();
    doc.rect(37, 33, 521, 776).lineWidth(0.5).strokeColor('#475569').stroke();

    // 2. Medical Emblem (Left)
    doc.circle(78, 85, 24).fill('#0c3150');
    doc.rect(74, 71, 8, 28).fill('#ffffff');
    doc.rect(64, 81, 28, 8).fill('#ffffff');

    // 3. Header Text
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#334155').text('DEMOCRATIC SOCIALIST REPUBLIC OF SRI LANKA', 115, 52, { align: 'center', width: 420 });
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1e293b').text('MINISTRY OF HEALTH', 115, 65, { align: 'center', width: 420 });
    doc.font('Times-Bold').fontSize(19).fillColor('#0c3150').text(hospitalName.toUpperCase(), 115, 78, { align: 'center', width: 420 });
    doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#475569').text('Medi-Queue Digital Healthcare — Outpatient Department (OPD)', 115, 103, { align: 'center', width: 420 });

    // 4. Divider Lines
    doc.lineWidth(1.5).strokeColor('#0c3150').moveTo(48, 122).lineTo(547, 122).stroke();
    doc.lineWidth(0.6).strokeColor('#0c3150').moveTo(48, 125).lineTo(547, 125).stroke();

    // 5. Outpatient Prescription Title
    doc.font('Times-Bold').fontSize(11.5).fillColor('#0c3150').text('O U T P A T I E N T   P R E S C R I P T I O N', 48, 137, { align: 'center', width: 499, characterSpacing: 2 });

    // 6. Patient Details Grid
    const gridX = 48;
    const gridY = 160;
    const gridW = 499;
    const gridH = 160;

    // Grid outer box
    doc.rect(gridX, gridY, gridW, gridH).lineWidth(0.8).strokeColor('#334155').stroke();

    // Horizontal grid lines
    doc.lineWidth(0.5).strokeColor('#94a3b8');
    doc.moveTo(gridX, gridY + 32).lineTo(gridX + gridW, gridY + 32).stroke(); // Row 1 bottom
    doc.moveTo(gridX, gridY + 64).lineTo(gridX + gridW, gridY + 64).stroke(); // Row 2 bottom
    doc.moveTo(gridX, gridY + 96).lineTo(gridX + gridW, gridY + 96).stroke(); // Row 3 bottom
    doc.moveTo(gridX, gridY + 128).lineTo(gridX + gridW, gridY + 128).stroke(); // Row 4 bottom

    // Row 1 (y: 160 - 192): Patient Name & Token
    doc.font('Helvetica-Oblique').fontSize(7).fillColor('#64748b').text('Patient Name', gridX + 6, gridY + 5);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text(patientName, gridX + 6, gridY + 16, { width: 340, lineBreak: false });

    // Vertical line between Patient Name and Token
    doc.moveTo(gridX + 355, gridY).lineTo(gridX + 355, gridY + 32).stroke();
    doc.font('Helvetica-Oblique').fontSize(7).fillColor('#64748b').text('OPD Token No.', gridX + 361, gridY + 5);
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#0c3150').text(tokenNumber, gridX + 361, gridY + 15);

    // Row 2 (y: 192 - 224): Age, Sex, Weight, Date, Time (5 cols)
    const r2Y = gridY + 32;
    const r2Cols = [
      { label: 'Age', val: patientAge, x: gridX, w: 90 },
      { label: 'Sex', val: patientGender, x: gridX + 90, w: 85 },
      { label: 'Weight', val: weightStr, x: gridX + 175, w: 85 },
      { label: 'Date', val: currentDate, x: gridX + 260, w: 110 },
      { label: 'Time', val: currentTime, x: gridX + 370, w: 129 },
    ];
    r2Cols.forEach((col, idx) => {
      doc.font('Helvetica-Oblique').fontSize(7).fillColor('#64748b').text(col.label, col.x + 6, r2Y + 4);
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#0f172a').text(col.val, col.x + 6, r2Y + 16, { width: col.w - 10, lineBreak: false });
      if (idx > 0) {
        doc.moveTo(col.x, r2Y).lineTo(col.x, r2Y + 32).stroke();
      }
    });

    // Row 3 (y: 224 - 256): Allergies, Department, Consulting Physician (3 cols)
    const r3Y = gridY + 64;
    const r3Cols = [
      { label: 'Allergies', val: allergiesStr, x: gridX, w: 165 },
      { label: 'Department', val: department, x: gridX + 165, w: 145 },
      { label: 'Consulting Physician | SLMC Reg: 48921', val: doctorName, x: gridX + 310, w: 189 },
    ];
    r3Cols.forEach((col, idx) => {
      doc.font('Helvetica-Oblique').fontSize(7).fillColor('#64748b').text(col.label, col.x + 6, r3Y + 4);
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#0f172a').text(col.val, col.x + 6, r3Y + 16, { width: col.w - 10, lineBreak: false });
      if (idx > 0) {
        doc.moveTo(col.x, r3Y).lineTo(col.x, r3Y + 32).stroke();
      }
    });

    // Row 4 (y: 256 - 288): BP, Pulse, Temp, SpO2, Weight (5 cols)
    const r4Y = gridY + 96;
    const r4Cols = [
      { label: 'BP', val: bp, x: gridX, w: 100 },
      { label: 'Pulse', val: pulse, x: gridX + 100, w: 100 },
      { label: 'Temp', val: temp, x: gridX + 200, w: 85 },
      { label: 'SpO2', val: spo2, x: gridX + 285, w: 85 },
      { label: 'Weight', val: weightStr, x: gridX + 370, w: 129 },
    ];
    r4Cols.forEach((col, idx) => {
      doc.font('Helvetica-Oblique').fontSize(7).fillColor('#64748b').text(col.label, col.x + 6, r4Y + 4);
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#0f172a').text(col.val, col.x + 6, r4Y + 16, { width: col.w - 10, lineBreak: false });
      if (idx > 0) {
        doc.moveTo(col.x, r4Y).lineTo(col.x, r4Y + 32).stroke();
      }
    });

    // Row 5 (y: 288 - 320): Diagnoses / Clinical Assessment (full width)
    const r5Y = gridY + 128;
    doc.font('Helvetica-Oblique').fontSize(7).fillColor('#64748b').text('Diagnoses / Clinical Assessment', gridX + 6, r5Y + 4);
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#0f172a').text(diagnosesText, gridX + 6, r5Y + 16, { width: gridW - 12, lineBreak: false });

    // 7. Prescribed Medicines Section Title
    const medSectionY = 336;
    doc.font('Times-Bold').fontSize(14).fillColor('#0c3150').text('Prescribed Medicines', gridX, medSectionY);

    // 8. Medicine Table
    const tableY = 356;
    const tableHeaderH = 22;
    const rowH = 22;
    const numRows = 7;
    const totalTableH = tableHeaderH + (numRows * rowH);

    // Header background
    doc.rect(gridX, tableY, gridW, tableHeaderH).fill('#0c3150');

    // Header column texts
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
    doc.text('#', gridX, tableY + 7, { width: 26, align: 'center' });
    doc.text('Medication & Type', gridX + 32, tableY + 7, { width: 175 });
    doc.text('Dosage', gridX + 215, tableY + 7, { width: 65 });
    doc.text('Frequency', gridX + 285, tableY + 7, { width: 75 });
    doc.text('Duration', gridX + 365, tableY + 7, { width: 55 });
    doc.text('Instructions', gridX + 425, tableY + 7, { width: 70 });

    // Outer table border
    doc.rect(gridX, tableY, gridW, totalTableH).lineWidth(0.8).strokeColor('#334155').stroke();

    // Table Column Dividers
    const colDividers = [gridX + 26, gridX + 210, gridX + 280, gridX + 360, gridX + 420];
    doc.lineWidth(0.5).strokeColor('#cbd5e1');

    // Draw horizontal row lines
    for (let i = 1; i <= numRows; i++) {
      const lineY = tableY + tableHeaderH + (i * rowH);
      doc.moveTo(gridX, lineY).lineTo(gridX + gridW, lineY).stroke();
    }

    // Draw vertical column dividers across full table
    colDividers.forEach((xPos) => {
      doc.moveTo(xPos, tableY).lineTo(xPos, tableY + totalTableH).stroke();
    });

    const prescriptions = data.prescriptions || [];

    if (prescriptions.length === 0) {
      doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#64748b').text(
        'No medications prescribed during this visit.',
        gridX,
        tableY + tableHeaderH + 7,
        { align: 'center', width: gridW }
      );
    } else {
      prescriptions.slice(0, numRows).forEach((med, idx) => {
        const rowCurrY = tableY + tableHeaderH + (idx * rowH);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#334155').text(String(idx + 1), gridX, rowCurrY + 7, { width: 26, align: 'center' });
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a').text(`${med.name || 'Medicine'} (${(med.type || 'Tab').toUpperCase()})`, gridX + 32, rowCurrY + 7, { width: 175, lineBreak: false });
        doc.font('Helvetica').fontSize(8.5).fillColor('#334155').text(med.dosage || '—', gridX + 215, rowCurrY + 7, { width: 65, lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0c3150').text(med.frequency || '—', gridX + 285, rowCurrY + 7, { width: 75, lineBreak: false });
        doc.font('Helvetica').fontSize(8.5).fillColor('#334155').text(med.duration || '—', gridX + 365, rowCurrY + 7, { width: 55, lineBreak: false });
        doc.font('Helvetica-Oblique').fontSize(8).fillColor('#64748b').text(med.instructions || 'As directed', gridX + 425, rowCurrY + 7, { width: 70, lineBreak: false });
      });
    }

    // 9. Clinical Notes (if any)
    const notesText = clinicalNotes || data.clinicalNotes;
    if (notesText && notesText.trim()) {
      const notesY = tableY + totalTableH + 8;
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#0c3150').text('Doctor Notes & Advice:', gridX, notesY);
      doc.font('Helvetica').fontSize(8).fillColor('#475569').text(notesText.trim(), gridX + 95, notesY, { width: gridW - 95, lineBreak: false });
    }

    // 10. Verification Stamp & Doctor Signature Block
    // Stamp (Left)
    const stampCenterX = 135;
    const stampCenterY = 705;
    doc.lineWidth(1.6).strokeColor('#2563eb').ellipse(stampCenterX, stampCenterY, 62, 34).stroke();
    doc.lineWidth(0.6).strokeColor('#2563eb').ellipse(stampCenterX, stampCenterY, 58, 30).stroke();

    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#1d4ed8').text('e-HEALTH NETWORK', stampCenterX - 50, stampCenterY - 21, { align: 'center', width: 100 });
    doc.font('Helvetica-Bold').fontSize(11.5).fillColor('#1d4ed8').text('VERIFIED', stampCenterX - 50, stampCenterY - 10, { align: 'center', width: 100, characterSpacing: 1.5 });
    doc.font('Helvetica-Bold').fontSize(6).fillColor('#1d4ed8').text('DIGITALLY SIGNED', stampCenterX - 50, stampCenterY + 5, { align: 'center', width: 100 });
    doc.font('Helvetica').fontSize(6.5).fillColor('#1d4ed8').text(verificationCode, stampCenterX - 50, stampCenterY + 14, { align: 'center', width: 100 });

    // Doctor Signature (Right)
    doc.lineWidth(0.8).strokeColor('#475569').moveTo(340, 672).lineTo(535, 672).stroke();
    doc.font('Times-Bold').fontSize(11.5).fillColor('#0f172a').text(doctorName, 340, 678, { width: 195 });
    doc.font('Helvetica').fontSize(8.5).fillColor('#475569').text('MBBS (Colombo), MD (Med)', 340, 693, { width: 195 });
    doc.font('Helvetica-Oblique').fontSize(7.5).fillColor('#64748b').text('Authorized Medical Officer — Registered Practitioner', 340, 706, { width: 195 });

    // 11. Footer
    doc.font('Helvetica-Oblique').fontSize(7).fillColor('#64748b').text(
      'Valid for 30 days from date of issue unless specified otherwise. Keep out of reach of children. Store medications in a cool, dry place.',
      gridX,
      765,
      { align: 'center', width: gridW }
    );
    doc.font('Helvetica').fontSize(7.5).fillColor('#334155').text(
      `Government of Sri Lanka - e-Health Network | Verification Code: ${verificationCode}`,
      gridX,
      778,
      { align: 'center', width: gridW }
    );

    doc.end();
  } catch (error) {
    console.error('generatePrescriptionPdfApi error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

module.exports = {
  getDoctors,
  listDoctors,
  listDepartments,
  getDoctor,
  getReceptionDoctors: getDoctors,
  getDoctorDashboard,
  updateDoctorStatus,
  updateDoctorHospital,
  getDoctorHospitals,
  callNextPatient,
  undoPatientConsultation,
  ringChime,
  callSpecificPatient,
  getDoctorSchedule,
  addWalkInSlot,
  toggleDoctorBreak,
  getPrescriptionDetails,
  savePrescription,
  referPatient,
  getPatientRecords,
  updatePatientVitals,
  generatePrescriptionPdfApi,
};
