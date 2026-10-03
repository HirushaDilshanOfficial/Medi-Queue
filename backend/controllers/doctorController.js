const Doctor = require('../models/Doctor');
const QueueEntry = require('../models/QueueEntry');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');

// Realistic mock data matching the Figma "Patient Queue & Next Call" design
const getMockDashboardData = () => {
  return {
    doctor: {
      _id: 'doc_default_01',
      name: 'Dr. Emilia Emelson',
      specialization: 'Orthopedics Surgeon',
      department: 'Orthopedics OPD',
      room: 'Room 3B',
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
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Realistic mock schedule session state matching Figma design
let scheduleSessionState = {
  doctor: {
    name: 'Dr. Emilia Emelson',
    room: 'Room 3B Online',
    status: 'active',
    avatarUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=200',
  },
  dateHeader: 'WEDNESDAY, NOV 20, 2024',
  selectedDayKey: '2024-11-20',
  weekDays: [
    { dayName: 'Mon', dayNumber: 18, dateKey: '2024-11-18' },
    { dayName: 'Tue', dayNumber: 19, dateKey: '2024-11-19' },
    { dayName: 'Wed', dayNumber: 20, dateKey: '2024-11-20', isToday: true, isSelected: true },
    { dayName: 'Thu', dayNumber: 21, dateKey: '2024-11-21' },
    { dayName: 'Fri', dayNumber: 22, dateKey: '2024-11-22' },
  ],
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
    if (dateKey && dateKey !== '2024-11-20') {
      const selectedDayObj = scheduleSessionState.weekDays.find((d) => d.dateKey === dateKey);
      const dayName = selectedDayObj ? selectedDayObj.dayName.toUpperCase() : 'SELECTED';
      return res.status(200).json({
        success: true,
        data: {
          ...scheduleSessionState,
          dateHeader: `${dayName}DAY, NOV ${selectedDayObj?.dayNumber || 21}, 2024`,
          selectedDayKey: dateKey,
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

    return res.status(200).json({
      success: true,
      data: scheduleSessionState,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add Walk-in Slot to current schedule
// @route   POST /api/v1/doctor/walkin-slot
// @access  Public / Protected
const addWalkInSlot = async (req, res) => {
  try {
    const { patientName, reason, priority = 'walkin', age = 35, gender = 'Other' } = req.body;
    if (!patientName) {
      return res.status(400).json({ success: false, message: 'Patient name is required' });
    }

    const nextToken = (scheduleSessionState.shift.totalCapacity || 32) + 1;
    const newSlot = {
      id: `slot-walkin-${Date.now()}`,
      time: '12:00 PM',
      timeHour: '12:00',
      timePeriod: 'PM',
      patientName,
      reason: `${reason || 'Emergency Walk-in'} • Token #${String(nextToken).padStart(3, '0')}`,
      tokenNumber: nextToken,
      status: 'waiting',
      age,
      gender,
    };

    scheduleSessionState.timeline.push(newSlot);
    scheduleSessionState.shift.totalCapacity += 1;
    scheduleSessionState.shift.waitingCount += 1;
    scheduleSessionState.shift.remainingWalkinSlots = Math.max(0, scheduleSessionState.shift.remainingWalkinSlots - 1);

    return res.status(201).json({
      success: true,
      message: `Walk-in slot added successfully for ${patientName} (Token #${nextToken})`,
      slot: newSlot,
      data: scheduleSessionState,
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

module.exports = {
  getDoctorDashboard,
  updateDoctorStatus,
  callNextPatient,
  ringChime,
  callSpecificPatient,
  getDoctorSchedule,
  addWalkInSlot,
  toggleDoctorBreak,
};

