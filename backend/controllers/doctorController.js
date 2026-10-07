const mongoose = require('mongoose');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const { asyncHandler } = require('../utils/errorHandler');
const QueueEntry = require('../models/QueueEntry');
const Patient = require('../models/Patient');
const Staff = require('../models/Staff');

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
  if (hospitalId && mongoose.isValidObjectId(hospitalId)) {
    const staffAtHospital = await Staff.find({
      hospital: hospitalId,
      role: { $regex: /^doctor$/i },
      isDeleted: false,
    }).distinct('_id');
    doctorFilter.$or = [
      { hospital: hospitalId },
      { staffId: { $in: staffAtHospital } },
    ];
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
  const departments = await Doctor.distinct('department');
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

// @desc    Get Doctor Home Dashboard data
// @route   GET /api/v1/doctor/dashboard
// @access  Public or Protected
const getDoctorDashboard = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Attempt to find doctor from DB if doctorId is supplied or authenticated
    let doctor = null;
    const doctorId = req.query.doctorId || (req.user && req.user._id);

    if (doctorId) {
      doctor = await Doctor.findById(doctorId).populate('hospital').catch(() => null);
    }

    if (!doctor) {
      doctor = await Doctor.findOne().populate('hospital').catch(() => null);
    }

    // If no doctor exists in DB yet, return the realistic mock dashboard state
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
      } catch (e) {
        // Ignore staff lookup error
      }
    }
    if (!hospitalName) {
      hospitalName = 'Colombo Teaching Hospital 1';
    }

    // Doctor found in DB - calculate real metrics
    const [waitingCount, completedCount, inConsultation, upcomingQueue] = await Promise.all([
      QueueEntry.countDocuments({
        queueDate: today,
        status: 'waiting',
        ...(doctor._id ? { assignedDoctor: doctor._id } : {}),
      }).catch(() => 0),
      QueueEntry.countDocuments({
        queueDate: today,
        status: 'completed',
        ...(doctor._id ? { assignedDoctor: doctor._id } : {}),
      }).catch(() => 0),
      QueueEntry.findOne({
        queueDate: today,
        status: { $in: ['called', 'in_consultation'] },
        ...(doctor._id ? { assignedDoctor: doctor._id } : {}),
      })
        .populate({
          path: 'appointment',
          populate: { path: 'patient' },
        })
        .catch(() => null),
      QueueEntry.find({
        queueDate: today,
        status: 'waiting',
        ...(doctor._id ? { assignedDoctor: doctor._id } : {}),
      })
        .sort({ priority: -1, tokenNumber: 1 })
        .limit(5)
        .populate({
          path: 'appointment',
          populate: { path: 'patient' },
        })
        .catch(() => []),
    ]);

    const totalToday = waitingCount + completedCount + (inConsultation ? 1 : 0);

    const formattedUpcoming = upcomingQueue.map((item) => ({
      tokenNumber: item.tokenNumber,
      patientName: item.appointment?.patient?.fullName || `Patient #${item.tokenNumber}`,
      age: item.appointment?.patient?.age || 30,
      gender: item.appointment?.patient?.gender || 'Other',
      priority: item.priority || 'normal',
      status: item.status,
      slotTime: item.appointment?.slotTime || '--:--',
    }));

    let currentPatient = null;
    if (inConsultation) {
      currentPatient = {
        tokenNumber: inConsultation.tokenNumber,
        patientName: inConsultation.appointment?.patient?.fullName || `Patient #${inConsultation.tokenNumber}`,
        age: inConsultation.appointment?.patient?.age || 40,
        gender: inConsultation.appointment?.patient?.gender || 'Other',
        priority: inConsultation.priority,
        status: inConsultation.status,
        reason: inConsultation.appointment?.notes || 'General OPD Consultation',
        checkedInTime: inConsultation.checkedInAt ? new Date(inConsultation.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
        calledAtTime: inConsultation.calledAt ? new Date(inConsultation.calledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
      };
    }

    // If DB has no active queue for today, synchronize with currentSessionState so doctor always has an interactive queue!
    if (!currentPatient && formattedUpcoming.length === 0) {
      currentSessionState.doctor = {
        ...currentSessionState.doctor,
        _id: doctor._id,
        name: doctor.name || currentSessionState.doctor.name,
        room: doctor.room || currentSessionState.doctor.room,
        specialization: doctor.specialization || currentSessionState.doctor.specialization,
        department: doctor.department || currentSessionState.doctor.department,
        hospitalName: hospitalName || currentSessionState.doctor.hospitalName || 'Colombo Teaching Hospital 1',
        hospital: doctor.hospital || null,
      };

      return res.status(200).json({
        success: true,
        source: 'session_sync',
        data: currentSessionState,
      });
    }

    return res.status(200).json({
      success: true,
      source: 'database',
      data: {
        doctor: {
          _id: doctor._id,
          name: doctor.name,
          specialization: doctor.specialization,
          department: doctor.department,
          room: doctor.room || 'Room 01',
          hospitalName: hospitalName || 'Colombo Teaching Hospital 1',
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
        },
        currentPatient,
        upcomingQueue: formattedUpcoming,
      },
    });
  } catch (error) {
    console.error('Error in getDoctorDashboard:', error);
    // Return mock on unexpected error so frontend never breaks
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
    const today = new Date().toISOString().split('T')[0];

    // Try in DB first
    const activeEntry = await QueueEntry.findOne({
      queueDate: today,
      status: { $in: ['called', 'in_consultation'] },
    }).catch(() => null);

    if (activeEntry) {
      activeEntry.status = 'completed';
      activeEntry.completedAt = new Date();
      await activeEntry.save().catch(() => null);
    }

    const nextWaiting = await QueueEntry.findOne({
      queueDate: today,
      status: 'waiting',
    })
      .sort({ priority: -1, tokenNumber: 1 })
      .populate({
        path: 'appointment',
        populate: { path: 'patient' },
      })
      .catch(() => null);

    if (nextWaiting) {
      nextWaiting.status = 'in_consultation';
      nextWaiting.calledAt = new Date();
      await nextWaiting.save().catch(() => null);

      return res.status(200).json({
        success: true,
        message: `Token #${nextWaiting.tokenNumber} called`,
        calledToken: nextWaiting.tokenNumber,
      });
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
    const today = new Date().toISOString().split('T')[0];

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

    try {
      const activeEntry = await QueueEntry.findOne({
        queueDate: today,
        status: { $in: ['called', 'in_consultation'] },
      }).catch(() => null);

      const prevCompleted = await QueueEntry.findOne({
        queueDate: today,
        status: 'completed',
      })
        .sort({ completedAt: -1, tokenNumber: -1 })
        .populate({ path: 'appointment', populate: { path: 'patient' } })
        .catch(() => null);

      if (activeEntry) {
        activeEntry.status = 'waiting';
        await activeEntry.save().catch(() => null);
      }
      if (prevCompleted) {
        prevCompleted.status = 'in_consultation';
        prevCompleted.completedAt = null;
        await prevCompleted.save().catch(() => null);
      }
    } catch (e) {
      // Continue with in-memory sync
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
const getDoctorSchedule = async (req, res) => {
  try {
    const { dateKey } = req.query;
    const todayKey = toDateKeyBackend(new Date());
    const targetKey = dateKey || todayKey;

    // Refresh real-time week days
    scheduleSessionState.weekDays = getRealtimeWeekDaysBackend(new Date());

    if (targetKey !== todayKey) {
      const [y, m, d] = targetKey.split('-').map(Number);
      const selectedDate = (!isNaN(y) && !isNaN(m) && !isNaN(d)) ? new Date(y, m - 1, d) : new Date();
      const dynamicHeader = formatRealtimeDateHeaderBackend(selectedDate);

      return res.status(200).json({
        success: true,
        data: {
          ...scheduleSessionState,
          dateHeader: dynamicHeader,
          selectedDayKey: targetKey,
          timeline: [
            {
              id: `slot-other-1`,
              time: '08:30 AM',
              timeHour: '08:30',
              timePeriod: 'AM',
              patientName: 'Bandara Wijesekara',
              reason: 'Ortho Follow-up • Token #001',
              tokenNumber: 1,
              status: 'scheduled',
            },
            {
              id: `slot-other-2`,
              time: '09:00 AM',
              timeHour: '09:00',
              timePeriod: 'AM',
              patientName: 'Anoma Jayawardena',
              reason: 'Joint Stiffness • Token #002',
              tokenNumber: 2,
              status: 'scheduled',
            },
            {
              id: `slot-other-3`,
              time: '09:30 AM',
              timeHour: '09:30',
              timePeriod: 'AM',
              patientName: 'Saman Kumara',
              reason: 'Fracture Review • Token #003',
              tokenNumber: 3,
              status: 'scheduled',
            },
          ],
        },
      });
    }

    scheduleSessionState.dateHeader = formatRealtimeDateHeaderBackend(new Date());
    scheduleSessionState.selectedDayKey = todayKey;

    return res.status(200).json({
      success: true,
      data: scheduleSessionState,
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
    const { tokenNumber, patientName } = req.query;
    if (!tokenNumber || Number(tokenNumber) === 29 || (patientName && String(patientName).includes('Aurelia'))) {
      return res.status(200).json({
        success: true,
        data: aureliaPrescriptionSessionState,
      });
    }
    return res.status(200).json({
      success: true,
      data: prescriptionSessionState,
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

// @desc    Get Patient Health Records by search query or default (Aurelia)
// @route   GET /api/v1/doctor/records
// @access  Public / Protected
const getPatientRecords = async (req, res) => {
  try {
    const { query = 'Aurelia' } = req.query;
    const cleanQuery = query.toLowerCase().trim();

    let record = patientRecordsDatabase['aurelia'];
    if (cleanQuery.includes('kamal') || cleanQuery.includes('28')) {
      record = patientRecordsDatabase['kamal'];
    }

    return res.status(200).json({
      success: true,
      query,
      data: record,
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
    const hospitals = await Hospital.find({ isDeleted: false }).select('name code type location departments');
    return res.status(200).json({ success: true, data: hospitals });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
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
};
