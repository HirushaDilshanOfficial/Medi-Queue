const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const { normalizePhone, isValidDate } = require('../utils/validators');

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

// @desc    Get available time slots for a doctor on a given date
// @route   GET /api/reception/slots?doctorId=&date=
// @access  Private — receptionist
const getSlots = async (req, res, next) => {
  try {
    const { doctorId, date } = req.query;

    // Validate inputs
    if (!doctorId) {
      res.status(400);
      throw new Error('doctorId is required.');
    }
    if (!date || !isValidDate(date)) {
      res.status(400);
      throw new Error('A valid date (YYYY-MM-DD) is required.');
    }

    // Find the doctor
    const doctor = await Doctor.findById(doctorId).lean();
    if (!doctor) {
      res.status(404);
      throw new Error('Doctor not found.');
    }

    // Build 15-minute slots from workingHours
    const start = doctor.workingHours?.start || '08:00';
    const end = doctor.workingHours?.end || '16:30';
    const allSlots = buildSlots(start, end);

    // Fetch active appointments for this doctor on this date
    const activeAppointments = await Appointment.find({
      doctor: doctorId,
      date,
      isActive: true,
    })
      .select('slotTime')
      .lean();

    const bookedTimes = new Set(activeAppointments.map((a) => a.slotTime));

    // Determine current time for today's "past" marking
    const now = new Date();
    const isToday =
      date ===
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Colombo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now);

    const currentTime = isToday
      ? new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Colombo',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(now)
      : null;

    // Mark each slot
    let earliestAvailable = null;

    const slots = allSlots.map((time) => {
      let status;

      if (isToday && currentTime && time < currentTime) {
        status = 'past';
      } else if (bookedTimes.has(time)) {
        status = 'booked';
      } else {
        status = 'available';
        if (!earliestAvailable) earliestAvailable = time;
      }

      return { time, status };
    });

    res.json({
      doctor: {
        name: doctor.name,
        room: doctor.room || null,
        status: doctor.status,
      },
      date,
      slots,
      earliestAvailable,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Build an array of "HH:mm" strings in 15-minute steps
 * from startTime to endTime (exclusive).
 */
function buildSlots(startTime, endTime) {
  const slots = [];
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  for (let m = startMinutes; m < endMinutes; m += 15) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    slots.push(`${hh}:${mm}`);
  }

  return slots;
}

module.exports = { searchPatients, getSlots };
