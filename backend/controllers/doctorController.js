const Doctor = require('../models/Doctor');
const QueueEntry = require('../models/QueueEntry');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');

// Fallback mock data in case MongoDB is empty or in local dev mode
const getMockDashboardData = () => {
  const today = new Date().toISOString().split('T')[0];
  return {
    doctor: {
      _id: 'doc_default_01',
      name: 'Dr. Emilia Emelson',
      specialization: 'Orthopedics Surgeon',
      department: 'Orthopedics OPD',
      room: 'Room 3B',
      status: 'active',
      dailyCapacity: 32,
      avgConsultMinutes: 15,
      workingHours: { start: '08:00', end: '16:00' },
    },
    metrics: {
      currentCallingToken: 28,
      waitingCount: 14,
      completedCount: 18,
      totalToday: 32,
      avgWaitMinutes: 15,
    },
    currentPatient: {
      tokenNumber: 28,
      patientName: 'Kamal Gunaratne',
      age: 46,
      gender: 'Male',
      priority: 'normal',
      status: 'in_consultation',
      reason: 'Spine checkup',
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
        status: 'waiting',
        slotTime: '11:15 AM',
      },
      {
        tokenNumber: 30,
        patientName: 'Rohan Mendis',
        age: 52,
        gender: 'Male',
        priority: 'normal',
        status: 'waiting',
        slotTime: '11:30 AM',
      },
    ],
  };
};

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
      doctor = await Doctor.findById(doctorId).catch(() => null);
    }

    if (!doctor) {
      doctor = await Doctor.findOne().catch(() => null);
    }

    // If no doctor exists in DB yet, return the realistic mock dashboard state
    if (!doctor) {
      return res.status(200).json({
        success: true,
        source: 'mock',
        data: currentSessionState,
      });
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
      currentSessionState.metrics.completedCount += 1;
      const nextPat = currentSessionState.upcomingQueue.shift();
      currentSessionState.currentPatient = {
        ...nextPat,
        status: 'in_consultation',
        reason: 'General OPD Consultation',
        checkedInTime: '10:30 AM',
        calledAtTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      currentSessionState.metrics.currentCallingToken = nextPat.tokenNumber;
      currentSessionState.metrics.waitingCount = Math.max(0, currentSessionState.metrics.waitingCount - 1);

      return res.status(200).json({
        success: true,
        message: `Token #${nextPat.tokenNumber} called`,
        calledToken: nextPat.tokenNumber,
        data: currentSessionState,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'No more waiting patients in queue today!',
      calledToken: null,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDoctorDashboard,
  updateDoctorStatus,
  callNextPatient,
};
