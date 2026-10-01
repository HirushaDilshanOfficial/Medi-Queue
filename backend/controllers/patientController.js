const OpdPatientProfile = require('../models/OpdPatientProfile');
const Doctor = require('../models/Doctor');
const OpdAppointment = require('../models/OpdAppointment');
const OpdQueueEntry = require('../models/OpdQueueEntry');
const OpdMedicalReport = require('../models/OpdMedicalReport');
const { today, buildLiveState, ACTIVE_STATUSES: QUEUE_ACTIVE } = require('../utils/opdQueue');
const { mapAppointment, relativeDate, isValidObjectId } = require('../utils/opdAppointment');

function ageFrom(birthday) {
  if (!(birthday instanceof Date) || Number.isNaN(birthday.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birthday.getFullYear();
  const monthDiff = now.getMonth() - birthday.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthday.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

function toProfileDto(profile) {
  return {
    id: String(profile._id),
    fullName: profile.fullName,
    nic: profile.nic || null,
    phone: profile.phone || null,
    email: profile.email || null,
    birthday: profile.birthday ? profile.birthday.toISOString() : null,
    age: ageFrom(profile.birthday),
    gender: profile.gender || null,
    address: profile.address || null,
    district: profile.district || null,
    bloodGroup: profile.bloodGroup || null,
    allergies: profile.allergies || [],
    emergencyContact: profile.emergencyContact || null,
    favouriteDepartment: profile.favouriteDepartment || null,
    remindersEnabled: profile.remindersEnabled !== false,
  };
}

// @desc    Get the signed-in patient's OPD profile
// @route   GET /api/v1/patients/me
// @access  Private/Patient
const getMyProfile = async (req, res) => {
  res.json({ patient: toProfileDto(req.patientProfile) });
};

// Fields the patient is allowed to change about themselves.
//
// `user`, `patient`, `nic` and `fullName` are deliberately absent. `user` and
// `patient` are link columns the middleware owns, and the NIC is the identity
// key used to link a receptionist record, so letting it be edited here would let
// a patient attach their profile to someone else's record. Name and NIC changes
// belong to the registration/auth flow, not to a self-service form.
const EDITABLE_FIELDS = [
  'phone',
  'email',
  'birthday',
  'gender',
  'address',
  'district',
  'bloodGroup',
  'allergies',
  'favouriteDepartment',
  'remindersEnabled',
  'emergencyContact',
];

const GENDERS = ['male', 'female', 'other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

/**
 * Normalises one text field.
 *
 * The two return values are deliberately different, and callers depend on it:
 * `null` means "clear this field" (a valid edit), while `undefined` means "reject
 * this input". Conflating the two would make it impossible to clear a value.
 */
function cleanText(value, maxlength) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > maxlength) return undefined;
  return text;
}

function cleanDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  // A birthday in the future is a typo, not a real value.
  if (date.getTime() > Date.now()) return undefined;
  return date;
}

function cleanEnum(value, allowed) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim().toLowerCase();
  return allowed.includes(text) ? text : undefined;
}

function cleanAllergies(value) {
  if (value === null || value === undefined) return undefined;
  if (!Array.isArray(value)) return undefined;
  if (value.length > 20) return undefined;
  return value
    .map((item) => cleanText(item, 60))
    .filter((item) => typeof item === 'string' && item.length > 0);
}

function cleanEmergencyContact(value) {
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out = {};
  for (const field of ['name', 'relationship', 'phone']) {
    if (value[field] === undefined) continue;
    const cleaned = cleanText(value[field], 120);
    if (cleaned === undefined) return undefined;
    // Blank sub-fields are dropped rather than stored as null, so an emptied
    // form clears the contact instead of leaving a half-empty object behind.
    if (cleaned !== null) out[field] = cleaned;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Validates a partial profile update. Returns `{ patch }` when the input is
 * acceptable, or `{ error }` describing the first problem found.
 *
 * Only keys the caller actually sent are returned, so an omitted field keeps its
 * stored value. That matters for a PATCH endpoint on a partially filled profile:
 * a client sending `{ phone }` must not blank out the address.
 */
function buildProfilePatch(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Send a JSON object' };
  }

  const unknown = Object.keys(body).filter((key) => !EDITABLE_FIELDS.includes(key));
  if (unknown.length) {
    return { error: `Cannot change: ${unknown.join(', ')}` };
  }

  const patch = {};

  if ('phone' in body) {
    const phone = cleanText(body.phone, 30);
    if (phone === undefined) return { error: 'Phone number is too long' };
    patch.phone = phone;
  }

  if ('email' in body) {
    const email = cleanText(body.email, 120);
    if (email === undefined) return { error: 'Email address is too long' };
    if (email !== null) {
      // Deliberately loose: the only authoritative test of an address is
      // delivering to it, and a strict regex rejects valid ones.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { error: 'That email address does not look right' };
      }
      patch.email = email.toLowerCase();
    } else {
      patch.email = null;
    }
  }

  if ('birthday' in body) {
    const birthday = cleanDate(body.birthday);
    if (birthday === undefined) return { error: 'Birthday is not a valid past date' };
    patch.birthday = birthday;
  }

  if ('gender' in body) {
    const gender = cleanEnum(body.gender, GENDERS);
    if (gender === undefined) return { error: 'Gender must be male, female or other' };
    patch.gender = gender;
  }

  if ('bloodGroup' in body) {
    const bloodGroup = cleanEnum(body.bloodGroup, BLOOD_GROUPS.map((g) => g.toLowerCase()));
    if (bloodGroup === undefined) return { error: 'That blood group is not recognised' };
    // Stored upper-case to match the schema enum, e.g. "o+" -> "O+".
    patch.bloodGroup = bloodGroup ? bloodGroup.toUpperCase() : null;
  }

  if ('address' in body) {
    const address = cleanText(body.address, 200);
    if (address === undefined) return { error: 'Address is too long' };
    patch.address = address;
  }

  if ('district' in body) {
    const district = cleanText(body.district, 80);
    if (district === undefined) return { error: 'District name is too long' };
    patch.district = district;
  }

  if ('favouriteDepartment' in body) {
    const department = cleanText(body.favouriteDepartment, 80);
    if (department === undefined) return { error: 'Department name is too long' };
    patch.favouriteDepartment = department;
  }

  if ('allergies' in body) {
    const allergies = cleanAllergies(body.allergies);
    if (allergies === undefined) return { error: 'Allergies must be a list of up to 20 short entries' };
    patch.allergies = allergies;
  }

  if ('remindersEnabled' in body) {
    if (typeof body.remindersEnabled !== 'boolean') {
      return { error: 'remindersEnabled must be true or false' };
    }
    patch.remindersEnabled = body.remindersEnabled;
  }

  if ('emergencyContact' in body) {
    const emergencyContact = cleanEmergencyContact(body.emergencyContact);
    if (emergencyContact === undefined) return { error: 'Emergency contact details are not valid' };
    patch.emergencyContact = emergencyContact;
  }

  return { patch };
}

// @desc    Update the signed-in patient's own profile
// @route   PATCH /api/v1/patients/me
// @access  Private/Patient
const updateMyProfile = async (req, res, next) => {
  try {
    const { patch, error } = buildProfilePatch(req.body);
    if (error) {
      return res.status(400).json({ message: error });
    }

    if (!Object.keys(patch).length) {
      // Nothing to change is not a failure, and re-reading avoids a pointless write.
      return res.json({ patient: toProfileDto(req.patientProfile) });
    }

    const profile = await OpdPatientProfile.findByIdAndUpdate(
      req.patientProfile._id,
      { $set: patch },
      { new: true, runValidators: true },
    );

    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    // Keep the request-scoped copy current so anything later in the same request
    // sees the update rather than the pre-update document.
    req.patientProfile = profile;

    res.json({ patient: toProfileDto(profile) });
  } catch (error) {
    next(error);
  }
};

// @desc    Past and completed visits for the signed-in patient
// @route   GET /api/v1/patients/me/history
// @access  Private/Patient
const getMyHistory = async (req, res, next) => {
  try {
    const profileId = req.patientProfile._id;
    const todayKey = today();

    // A visit is "history" once its date has passed. That deliberately includes
    // cancelled and no-show bookings, since a patient looking at their history
    // wants the record of what they booked, not a flattering version of it.
    const [appointments, reports] = await Promise.all([
      OpdAppointment.find({ profile: profileId, date: { $lt: todayKey } })
        .sort({ date: -1, slotTime: -1 })
        .limit(100)
        .lean(),
      OpdMedicalReport.find({ profile: profileId }).sort({ createdAt: -1 }).limit(100).lean(),
    ]);

    const reportCountByAppointment = new Map();
    for (const report of reports) {
      if (!report.appointment) continue;
      const key = String(report.appointment);
      reportCountByAppointment.set(key, (reportCountByAppointment.get(key) || 0) + 1);
    }

    res.json({
      visits: appointments.map((appointment) => {
        const mapped = mapAppointment(appointment, { todayKey });
        return {
          ...mapped,
          // A past visit is not reschedulable or cancellable, whatever its status.
          canReschedule: false,
          canCancel: false,
          reportCount: reportCountByAppointment.get(String(appointment._id)) || 0,
        };
      }),
      // Reports not tied to a visit still belong in the history view.
      reports: reports
        .filter((report) => !report.appointment)
        .map((report) => ({
          id: String(report._id),
          title: report.title,
          category: report.category,
          reportDate: report.reportDate ? report.reportDate.toISOString() : null,
          status: report.status,
          fileName: report.fileName || null,
          createdAt: report.createdAt ? report.createdAt.toISOString() : null,
        })),
      summary: {
        totalVisits: appointments.filter((a) => a.status === 'completed').length,
        cancelled: appointments.filter((a) => a.status === 'cancelled').length,
        noShow: appointments.filter((a) => a.status === 'no_show').length,
        reports: reports.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reports the patient has lodged
// @route   GET /api/v1/patients/me/reports
// @access  Private/Patient
const getMyReports = async (req, res, next) => {
  try {
    const reports = await OpdMedicalReport.find({ profile: req.patientProfile._id })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ reports: reports.map(toReportDto) });
  } catch (error) {
    next(error);
  }
};

function toReportDto(report) {
  return {
    id: String(report._id),
    appointmentId: report.appointment ? String(report.appointment) : null,
    title: report.title,
    category: report.category,
    reportDate: report.reportDate ? report.reportDate.toISOString() : null,
    performedOn: report.performedOn ? report.performedOn.toISOString() : null,
    notes: report.notes || null,
    fileName: report.fileName || null,
    status: report.status,
    createdAt: report.createdAt ? report.createdAt.toISOString() : null,
  };
}

/**
 * Validates a report the patient is lodging. Returns `{ patch }` or `{ error }`.
 *
 * `profile` and `status` are not accepted: the profile comes from the token, and
 * letting the client set `status` would let a patient mark a report as already
 * reviewed by a doctor.
 */
function buildReportPatch(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Send a JSON object' };
  }

  const allowed = ['appointmentId', 'title', 'category', 'reportDate', 'performedOn', 'notes', 'fileName'];
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length) {
    return { error: `Cannot set: ${unknown.join(', ')}` };
  }

  const patch = {};

  // A title is the one genuinely required field. Checked here rather than left to
  // the schema so an empty body gets a clear message instead of a 400 from a
  // validation error the client cannot map to a field.
  if (!('title' in body)) {
    return { error: 'Give the report a title' };
  }

  {
    const title = cleanText(body.title, 120);
    if (!title) return { error: 'Give the report a title' };
    patch.title = title;
  }

  if ('category' in body) {
    const category = cleanText(body.category, 60);
    if (category === undefined) return { error: 'Category is too long' };
    patch.category = category || 'General';
  }

  for (const field of ['reportDate', 'performedOn']) {
    if (!(field in body)) continue;
    const date = cleanDate(body[field]);
    if (date === undefined) return { error: `${field} is not a valid date` };
    patch[field] = date;
  }

  if ('notes' in body) {
    const notes = cleanText(body.notes, 500);
    if (notes === undefined) return { error: 'Notes are too long' };
    patch.notes = notes;
  }

  if ('fileName' in body) {
    const fileName = cleanText(body.fileName, 160);
    if (fileName === undefined) return { error: 'File name is too long' };
    patch.fileName = fileName;
  }

  if ('appointmentId' in body) {
    // Shape check only. Ownership is confirmed with a query in the controller,
    // since a valid ObjectId belonging to another patient must not be accepted.
    const id = cleanText(body.appointmentId, 40);
    if (id === undefined) return { error: 'That visit is not valid' };
    if (id !== null) {
      if (!isValidObjectId(id)) return { error: 'That visit is not valid' };
      patch.appointmentId = id;
    }
  }

  return { patch };
}

// @desc    Lodge a medical report
// @route   POST /api/v1/patients/me/reports
// @access  Private/Patient
const createMyReport = async (req, res, next) => {
  try {
    const { patch, error } = buildReportPatch(req.body);
    if (error) {
      return res.status(400).json({ message: error });
    }

    // The optional visit link is checked here rather than in the validator,
    // because confirming it exists needs a query.
    if (patch.appointmentId) {
      const owned = await OpdAppointment.exists({
        _id: patch.appointmentId,
        profile: req.patientProfile._id,
      });
      if (!owned) {
        return res.status(404).json({ message: 'That visit was not found in your history' });
      }
    }

    const report = await OpdMedicalReport.create({
      ...patch,
      profile: req.patientProfile._id,
    });

    res.status(201).json({ report: toReportDto(report.toObject()) });
  } catch (error) {
    // A schema validation error is the caller's fault, not a server fault.
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};

// @desc    Remove a report the patient lodged
// @route   DELETE /api/v1/patients/me/reports/:id
// @access  Private/Patient
const deleteMyReport = async (req, res, next) => {
  try {
    // Scoped by `profile` in the query, so a patient cannot delete someone
    // else's report even by guessing the id.
    const removed = await OpdMedicalReport.findOneAndDelete({
      _id: req.params.id,
      profile: req.patientProfile._id,
    });

    if (!removed) {
      return res.status(404).json({ message: 'Report not found' });
    }

    res.json({ message: 'Report removed' });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'That report id is not valid' });
    }
    next(error);
  }
};

const RECENT_ACTIVITY_LIMIT = 6;

/**
 * Builds the dashboard's "recent activity" feed from bookings and reports.
 *
 * The feed is a plain merge of the two collections sorted by time, rather than a
 * stored list, so it can never drift out of date. Reads are windowed to the last
 * 90 days: a patient with years of history would otherwise be served hundreds of
 * rows the dashboard cannot display.
 */
async function buildRecentActivity(profileId, todayKey) {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);

  const [appointments, reports] = await Promise.all([
    OpdAppointment.find({
      profile: profileId,
      $or: [
        { createdAt: { $gte: ninetyDaysAgo } },
        { updatedAt: { $gte: ninetyDaysAgo } },
      ],
    })
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean(),
    OpdMedicalReport.find({ profile: profileId, createdAt: { $gte: ninetyDaysAgo } })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
  ]);

  const items = [
    ...appointments.map((appointment) => ({
      type: 'appointment',
      at: appointment.updatedAt || appointment.createdAt,
      id: String(appointment._id),
      title: `${appointment.doctorName} · ${appointment.department}`,
      date: appointment.date,
      dateLabel: relativeDate(appointment.date, todayKey),
      status: appointment.status,
    })),
    ...reports.map((report) => ({
      type: 'report',
      at: report.createdAt,
      id: String(report._id),
      title: report.title,
      dateLabel: report.category,
      status: report.status,
    })),
  ]
    .filter((item) => item.at instanceof Date && !Number.isNaN(item.at.getTime()))
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, RECENT_ACTIVITY_LIMIT)
    .map((item) => ({ ...item, at: item.at.toISOString() }));

  return items;
}

// @desc    Dashboard aggregate for the signed-in patient
// @route   GET /api/v1/patients/me/dashboard
// @access  Private/Patient
const getDashboard = async (req, res, next) => {
  try {
    const profile = req.patientProfile;
    const todayKey = today();
    const profileId = profile._id;

    const [totalDoctors, activeDoctors, departments, upcomingAppointments, completedVisits, entry, reports] =
      await Promise.all([
        Doctor.countDocuments({}),
        Doctor.countDocuments({ status: 'active' }),
        Doctor.distinct('department'),
        OpdAppointment.countDocuments({
          profile: profileId,
          date: { $gte: todayKey },
          status: { $in: OpdAppointment.ACTIVE_STATUSES },
        }),
        OpdAppointment.countDocuments({ profile: profileId, status: 'completed' }),
        // The patient's live pass, so the dashboard queue card is real rather than
        // the design placeholder. Null until they check in.
        OpdQueueEntry.findOne({ profile: profileId, status: { $in: QUEUE_ACTIVE } })
          .sort({ checkedInAt: -1 })
          .lean(),
        OpdMedicalReport.countDocuments({ profile: profileId }),
      ]);

    const live = entry ? await buildLiveState(entry) : null;

    const nextDoc = await OpdAppointment.findOne({
      profile: profileId,
      date: { $gte: todayKey },
      status: { $in: OpdAppointment.ACTIVE_STATUSES },
    })
      .sort({ date: 1, slotTime: 1 })
      .lean();

    const next = nextDoc ? mapAppointment(nextDoc, { todayKey }) : null;

    res.json({
      patient: toProfileDto(profile),
      stats: {
        totalDoctors,
        activeDoctors,
        departments: departments.filter(Boolean).length,
        upcomingAppointments,
        completedVisits,
        reports,
        activePass: entry
          ? {
              tokenNumber: entry.tokenNumber,
              department: entry.department,
              room: entry.room || null,
              position: live ? live.position : null,
              estimatedTurnAt: live ? live.estimatedTurnAt : null,
              status: entry.status,
            }
          : null,
      },
      nextAppointment: next
        ? {
            id: next.id,
            doctorName: next.doctorName,
            department: next.department,
            date: next.date,
            dateLabel: relativeDate(next.date, todayKey),
            slotTime: next.slotTime,
            tokenNumber: next.tokenNumber,
            status: next.status,
          }
        : null,
      // Newest first, and only events the patient can recognise. A cancelled
      // booking or a new report is worth showing; a routine read is not.
      recentActivity: await buildRecentActivity(profileId, todayKey),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  getMyHistory,
  getMyReports,
  createMyReport,
  deleteMyReport,
  getDashboard,
  toProfileDto,
  buildProfilePatch,
  buildReportPatch,
};
