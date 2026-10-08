const OpdPatientProfile = require('../models/OpdPatientProfile');
const Doctor = require('../models/Doctor');
const OpdAppointment = require('../models/OpdAppointment');
const OpdQueueEntry = require('../models/OpdQueueEntry');
const OpdMedicalReport = require('../models/OpdMedicalReport');
const { today, buildLiveState, ACTIVE_STATUSES: QUEUE_ACTIVE } = require('../utils/opdQueue');
const { mapAppointment, relativeDate, isValidObjectId } = require('../utils/opdAppointment');
const fs = require('fs');
const path = require('path');
const { REPORT_UPLOAD_DIR } = require('../middleware/reportUpload');

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

    // Closed appointments belong in history immediately, including cancellations
    // for a future date and consultations completed today.
    const [appointments, reports] = await Promise.all([
      OpdAppointment.find({
        profile: profileId,
        $or: [
          { date: { $lt: todayKey } },
          { status: { $in: ['completed', 'no_show', 'cancelled'] } },
        ],
      })
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

    const visits = appointments.map((appointment) => {
        const mapped = mapAppointment(appointment, { todayKey });
        return {
          ...mapped,
          // An expired booking that was never checked in is a missed visit,
          // even when staff have not explicitly marked it as a no-show yet.
          status: appointment.status === 'booked' && appointment.date < todayKey ? 'no_show' : appointment.status,
          canCheckIn: false,
          canReschedule: false,
          canCancel: false,
          reportCount: reportCountByAppointment.get(String(appointment._id)) || 0,
        };
      });

    res.json({
      visits,
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
        totalVisits: visits.filter((a) => a.status === 'completed').length,
        cancelled: visits.filter((a) => a.status === 'cancelled').length,
        noShow: visits.filter((a) => a.status === 'no_show').length,
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

const getMyReport = async (req, res, next) => {
  try {
    const report = await OpdMedicalReport.findOne({
      _id: req.params.id,
      profile: req.patientProfile._id,
    }).lean();
    if (!report) return res.status(404).json({ message: 'Report not found' });
    return res.json({ report: toReportDto(report) });
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'That report id is not valid' });
    return next(error);
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
    fileMimeType: report.fileMimeType || null,
    fileSize: report.fileSize || null,
    fileUrl: report.fileKey ? `/api/v1/patients/me/reports/${String(report._id)}/file` : null,
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
    const appointmentId = patch.appointmentId;
    if (appointmentId) {
      const owned = await OpdAppointment.exists({
        _id: appointmentId,
        profile: req.patientProfile._id,
      });
      if (!owned) {
        return res.status(404).json({ message: 'That visit was not found in your history' });
      }
    }

    delete patch.appointmentId;
    const report = await OpdMedicalReport.create({
      ...patch,
      appointment: appointmentId || null,
      profile: req.patientProfile._id,
      ...(req.file ? {
        fileName: req.file.originalname,
        fileKey: req.file.filename,
        fileMimeType: req.file.mimetype,
        fileSize: req.file.size,
      } : {}),
    });

    res.status(201).json({ report: toReportDto(report.toObject()) });
  } catch (error) {
    if (req.file) fs.rm(req.file.path, { force: true }, () => {});
    // A schema validation error is the caller's fault, not a server fault.
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};

const updateMyReport = async (req, res, next) => {
  let previousFile;
  try {
    const { patch, error } = buildReportPatch(req.body);
    if (error) {
      if (req.file) fs.rm(req.file.path, { force: true }, () => {});
      return res.status(400).json({ message: error });
    }

    const report = await OpdMedicalReport.findOne({
      _id: req.params.id,
      profile: req.patientProfile._id,
    });
    if (!report) {
      if (req.file) fs.rm(req.file.path, { force: true }, () => {});
      return res.status(404).json({ message: 'Report not found' });
    }

    if (patch.appointmentId) {
      const owned = await OpdAppointment.exists({
        _id: patch.appointmentId,
        profile: req.patientProfile._id,
      });
      if (!owned) {
        if (req.file) fs.rm(req.file.path, { force: true }, () => {});
        return res.status(404).json({ message: 'That visit was not found in your history' });
      }
    }

    previousFile = report.fileKey;
    const appointmentWasSubmitted = Object.prototype.hasOwnProperty.call(req.body, 'appointmentId');
    const appointmentId = appointmentWasSubmitted ? (patch.appointmentId || null) : report.appointment;
    delete patch.appointmentId;
    Object.assign(report, {
      ...patch,
      appointment: appointmentId || null,
      ...(req.file ? {
        fileName: req.file.originalname,
        fileKey: req.file.filename,
        fileMimeType: req.file.mimetype,
        fileSize: req.file.size,
      } : {}),
    });
    await report.save();

    if (req.file && previousFile) {
      fs.rm(path.join(REPORT_UPLOAD_DIR, previousFile), { force: true }, () => {});
    }
    return res.json({ report: toReportDto(report.toObject()) });
  } catch (error) {
    if (req.file) fs.rm(req.file.path, { force: true }, () => {});
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'That report id is not valid' });
    }
    return next(error);
  }
};

const getMyReportFile = async (req, res, next) => {
  try {
    const report = await OpdMedicalReport.findOne({
      _id: req.params.id,
      profile: req.patientProfile._id,
    }).lean();
    if (!report) return res.status(404).json({ message: 'Report not found' });
    if (!report.fileKey) return res.status(404).json({ message: 'This report has no uploaded file' });

    const filePath = path.join(REPORT_UPLOAD_DIR, report.fileKey);
    if (!filePath.startsWith(REPORT_UPLOAD_DIR + path.sep) || !fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Uploaded file is not available' });
    }
    res.type(report.fileMimeType || 'application/octet-stream');
    return res.sendFile(filePath);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'That report id is not valid' });
    return next(error);
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

    if (removed.fileKey) {
      fs.rm(path.join(REPORT_UPLOAD_DIR, removed.fileKey), { force: true }, () => {});
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

const mongoose = require('mongoose');
const { asyncHandler, createError } = require('../utils/errorHandler');
const {
  isValidNIC,
  isValidSLPhone,
  normalizePhone,
} = require('../utils/validators');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const QueueToken = require('../models/QueueToken');

/**
 * @desc    Search patients by NIC, phone, passCode, QR code, token, or bookingRef
 * @route   GET /api/reception/patients/search?q=
 * @access  Private — receptionist
 */
const searchPatients = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q || q.trim().length < 3) {
    throw createError('Search query must be at least 3 characters.', 400);
  }

  const query = q.trim();

  // 1. Check if query is or contains a 24-character passCode / Queue Pass URL
  let passCode = null;
  const passUrlMatch = query.match(/(?:\/queue-pass\/|\/pass\/)([A-Z0-9]+)/i);
  if (passUrlMatch?.[1]) {
    passCode = passUrlMatch[1].toUpperCase();
  } else if (/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{24}$/i.test(query)) {
    passCode = query.toUpperCase();
  }

  if (passCode) {
    const queueEntry = await OpdQueueEntry.findOne({ passCode })
      .populate('profile')
      .populate('appointment')
      .populate('doctor', 'name specialization department room')
      .lean();

    if (queueEntry) {
      let patient = null;
      if (queueEntry.profile?.patient) {
        patient = await Patient.findById(queueEntry.profile.patient).lean();
      } else if (queueEntry.profile?.nic) {
        patient = await Patient.findOne({ nic: queueEntry.profile.nic }).lean();
      } else if (queueEntry.appointment?.patient) {
        patient = await Patient.findById(queueEntry.appointment.patient).lean();
      }

      if (!patient && queueEntry.profile) {
        patient = {
          _id: queueEntry.profile._id,
          fullName: queueEntry.profile.fullName,
          nic: queueEntry.profile.nic || null,
          phone: queueEntry.profile.phone || null,
          gender: queueEntry.profile.gender || null,
          age: queueEntry.profile.birthday ? ageFrom(new Date(queueEntry.profile.birthday)) : null,
          dob: queueEntry.profile.birthday || null,
          bloodGroup: queueEntry.profile.bloodGroup || null,
          registeredVia: 'app',
        };
      }

      if (patient) {
        const passDetails = {
          tokenNumber: queueEntry.tokenNumber,
          tokenLabel: `A-${String(queueEntry.tokenNumber).padStart(3, '0')}`,
          department: queueEntry.department,
          doctorName: queueEntry.doctorName || queueEntry.doctor?.name || null,
          room: queueEntry.room || queueEntry.doctor?.room || null,
          queueDate: queueEntry.queueDate,
          status: queueEntry.status,
          passCode: queueEntry.passCode,
        };

        return res.json({
          found: true,
          patients: [{
            ...patient,
            passDetails,
            latestDoctorName: passDetails.doctorName,
            latestDepartment: passDetails.department,
            latestTokenNumber: passDetails.tokenNumber,
            latestStatus: passDetails.status,
          }],
        });
      }
    }
  }

  // 2. Check if query is a Booking Reference (e.g. APT-... or OPD-...)
  const appt = await Appointment.findOne({ bookingRef: new RegExp(`^${query}$`, 'i') })
    .populate('patient')
    .populate('doctor', 'name department room')
    .lean();
  if (appt?.patient) {
    return res.json({
      found: true,
      patients: [{
        ...appt.patient,
        latestType: appt.type || 'pre_booked',
        latestVisitDate: appt.date,
        latestVisitSlotTime: appt.slotTime,
        latestDoctorName: appt.doctor?.name,
        latestDepartment: appt.department,
      }],
    });
  }

  const opdAppt = await OpdAppointment.findOne({ bookingRef: new RegExp(`^${query}$`, 'i') })
    .populate('patient')
    .populate('profile')
    .populate('doctor', 'name department room')
    .lean();
  if (opdAppt) {
    const p = opdAppt.patient || (opdAppt.profile ? {
      _id: opdAppt.profile._id,
      fullName: opdAppt.profile.fullName,
      nic: opdAppt.profile.nic || null,
      phone: opdAppt.profile.phone || null,
      gender: opdAppt.profile.gender || null,
      registeredVia: 'app',
    } : null);
    if (p) {
      return res.json({
        found: true,
        patients: [{
          ...p,
          latestType: 'pre_booked',
          latestVisitDate: opdAppt.date,
          latestVisitSlotTime: opdAppt.slotTime,
          latestDoctorName: opdAppt.doctor?.name || opdAppt.doctorName,
          latestDepartment: opdAppt.department,
        }],
      });
    }
  }

  // 3. Check if query matches a Queue Token (e.g. OPD-014, A-014, or number)
  const tokenMatch = await QueueToken.findOne({
    $or: [
      { tokenLabel: new RegExp(`^${query}$`, 'i') },
      ...(Number.isInteger(Number(query)) && Number(query) > 0 ? [{ tokenNumber: Number(query) }] : []),
    ],
  })
    .populate('patient')
    .populate('assignedDoctor', 'name department')
    .sort({ createdAt: -1 })
    .lean();
  if (tokenMatch?.patient) {
    return res.json({
      found: true,
      patients: [{
        ...tokenMatch.patient,
        latestTokenNumber: tokenMatch.tokenNumber,
        latestStatus: tokenMatch.status,
        latestDoctorName: tokenMatch.assignedDoctor?.name,
        latestDepartment: tokenMatch.department,
      }],
    });
  }

  // 4. Check if query is a valid MongoDB ObjectId
  if (mongoose.Types.ObjectId.isValid(query)) {
    const directPatient = await Patient.findById(query).lean();
    if (directPatient) {
      return res.json({
        found: true,
        patients: [directPatient],
      });
    }
    const directProfile = await OpdPatientProfile.findById(query).populate('patient').lean();
    if (directProfile) {
      const p = directProfile.patient || {
        _id: directProfile._id,
        fullName: directProfile.fullName,
        nic: directProfile.nic || null,
        phone: directProfile.phone || null,
        gender: directProfile.gender || null,
        dob: directProfile.birthday || null,
        age: directProfile.birthday ? ageFrom(new Date(directProfile.birthday)) : null,
        registeredVia: 'app',
      };
      return res.json({
        found: true,
        patients: [p],
      });
    }
  }

  // 5. Standard Search by NIC, phone, fullName
  const conditions = [
    { nic: { $regex: query, $options: 'i' } },
    { phone: { $regex: query, $options: 'i' } },
    { fullName: { $regex: query, $options: 'i' } },
  ];

  const normalized = normalizePhone(query);
  if (normalized && normalized !== query) {
    conditions.push({ phone: { $regex: normalized, $options: 'i' } });
  }

  let patients = await Patient.find({
    $or: conditions,
    isDeleted: { $ne: true },
  })
    .select('fullName nic phone age gender dob bloodGroup nicVerified district address')
    .limit(20)
    .lean();

  if (patients.length === 0) {
    const profiles = await OpdPatientProfile.find({ $or: conditions })
      .populate('patient')
      .limit(10)
      .lean();

    patients = profiles.map((prof) => {
      if (prof.patient) return prof.patient;
      return {
        _id: prof._id,
        fullName: prof.fullName,
        nic: prof.nic || null,
        phone: prof.phone || null,
        gender: prof.gender || null,
        dob: prof.birthday || null,
        age: prof.birthday ? ageFrom(new Date(prof.birthday)) : null,
        bloodGroup: prof.bloodGroup || null,
        registeredVia: 'app',
      };
    });
  }

  const patientsWithDetails = await attachLatestAppointments(patients);

  res.json({
    found: patientsWithDetails.length > 0,
    patients: patientsWithDetails,
  });
});

/**
 * Helper to attach latest appointment details to an array of patients
 */
async function attachLatestAppointments(patients) {
  if (!patients || patients.length === 0) return patients;
  const pIds = patients.map((p) => p._id);
  const appts = await Appointment.find({
    patient: { $in: pIds },
    status: { $ne: 'cancelled' },
  })
    .populate('doctor', 'name specialization department room')
    .sort({ date: -1, slotTime: -1, createdAt: -1 })
    .lean();

  // Also query OpdAppointment via linked profiles
  const profiles = await OpdPatientProfile.find({
    patient: { $in: pIds },
  }).select('_id patient').lean();

  const profileMap = new Map();
  for (const prof of profiles) {
    profileMap.set(String(prof._id), String(prof.patient));
  }

  let opdAppts = [];
  if (profiles.length > 0) {
    opdAppts = await OpdAppointment.find({
      profile: { $in: profiles.map((p) => p._id) },
      status: { $ne: 'cancelled' },
    })
      .populate('doctor', 'name specialization department room')
      .sort({ date: -1, slotTime: -1, createdAt: -1 })
      .lean();
  }

  const latestByPatient = new Map();
  for (const a of appts) {
    const pidStr = String(a.patient);
    if (!latestByPatient.has(pidStr)) {
      latestByPatient.set(pidStr, a);
    }
  }

  for (const oa of opdAppts) {
    const pidStr = profileMap.get(String(oa.profile));
    if (pidStr) {
      const existing = latestByPatient.get(pidStr);
      if (!existing || oa.date > existing.date || (oa.date === existing.date && oa.slotTime > existing.slotTime)) {
        latestByPatient.set(pidStr, oa);
      }
    }
  }

  return patients.map((p) => {
    const a = latestByPatient.get(String(p._id));
    return {
      ...p,
      latestType: a ? (a.type || 'pre_booked') : (p.registeredVia === 'app' ? 'pre_booked' : 'walk_in'),
      latestVisitDate: a ? a.date : undefined,
      latestVisitSlotTime: a ? a.slotTime : undefined,
      latestDoctorName: a?.doctor?.name || a?.doctorName || undefined,
      latestDepartment: a ? a.department : undefined,
      latestTokenNumber: a ? a.tokenNumber : undefined,
      latestStatus: a ? a.status : undefined,
    };
  });
}

/**
 * @desc    Get patients filtered by visited_today | recent | walk_in | pre_booked | all
 * @route   GET /api/reception/patients?filter=visited_today|recent|walk_in|pre_booked|all
 * @access  Private — receptionist
 */
const getPatients = asyncHandler(async (req, res) => {
  const filter = req.query.filter || 'all';

  if (!['visited_today', 'recent', 'all', 'walk_in', 'pre_booked'].includes(filter)) {
    throw createError('Invalid filter. Allowed values: visited_today, recent, walk_in, pre_booked, all.', 400);
  }

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);

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

    const result = await attachLatestAppointments(patients);
    return res.json(result);
  }

  // 2. Filter: walk_in or pre_booked
  if (filter === 'walk_in' || filter === 'pre_booked') {
    const appts = await Appointment.find({
      type: filter,
      status: { $ne: 'cancelled' },
    })
      .sort({ date: -1, slotTime: -1, createdAt: -1 })
      .lean();

    const seenPatientIds = new Set();
    const uniquePatientIds = [];
    for (const a of appts) {
      const pid = String(a.patient);
      if (!seenPatientIds.has(pid)) {
        seenPatientIds.add(pid);
        uniquePatientIds.push(a.patient);
      }
    }

    const patientDocs = await Patient.find({
      _id: { $in: uniquePatientIds.slice(0, limit) },
      isDeleted: { $ne: true },
    }).lean();

    const patientMap = new Map(patientDocs.map((p) => [String(p._id), p]));
    const ordered = [];
    for (const pid of uniquePatientIds) {
      const p = patientMap.get(String(pid));
      if (p) ordered.push(p);
      if (ordered.length >= limit) break;
    }

    const result = await attachLatestAppointments(ordered);
    return res.json(result);
  }

  // 3. Date match for visited_today or recent (last 30 days)
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

  const result = await attachLatestAppointments(orderedPatients);
  res.json(result);
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
  const [appointments, profiles] = await Promise.all([
    Appointment.find({ patient: id })
      .populate('doctor', 'name specialization department room')
      .sort({ date: -1, slotTime: -1, createdAt: -1 })
      .lean(),
    OpdPatientProfile.find({
      $or: [
        { patient: id },
        ...(patient.nic ? [{ nic: patient.nic }] : []),
        ...(patient.phone ? [{ phone: patient.phone }] : []),
      ],
    }).select('_id').lean(),
  ]);

  let opdList = [];
  if (profiles.length > 0) {
    opdList = await OpdAppointment.find({
      profile: { $in: profiles.map((p) => p._id) },
    })
      .populate('doctor', 'name specialization department room')
      .sort({ date: -1, slotTime: -1, createdAt: -1 })
      .lean();
  }

  const seenKeys = new Set();
  const allVisits = [];

  for (const appt of appointments) {
    const key = `${appt.date}_${appt.slotTime}_${String(appt.doctor?._id || appt.doctor)}`;
    seenKeys.add(key);

    const doctorName = appt.doctor?.name || (typeof appt.doctor === 'string' ? appt.doctor : null);
    allVisits.push({
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
      type: appt.type || 'walk_in',
      tokenNumber: appt.tokenNumber,
      tokenLabel: appt.tokenNumber ? `OPD-${String(appt.tokenNumber).padStart(3, '0')}` : null,
      notes: appt.notes || '',
      createdAt: appt.createdAt,
    });
  }

  for (const appt of opdList) {
    const key = `${appt.date}_${appt.slotTime}_${String(appt.doctor?._id || appt.doctor)}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const doctorName = appt.doctor?.name || appt.doctorName || 'Doctor';
    allVisits.push({
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
      type: appt.type || 'pre_booked',
      tokenNumber: appt.tokenNumber,
      tokenLabel: appt.tokenNumber ? `OPD-${String(appt.tokenNumber).padStart(3, '0')}` : null,
      notes: appt.reason || '',
      createdAt: appt.createdAt,
    });
  }

  allVisits.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (b.slotTime || '').localeCompare(a.slotTime || '');
  });

  const visitHistory = allVisits;

  res.json({
    ...patient,
    patient: { ...patient },
    visitHistory,
    visits: visitHistory,
    appointments: visitHistory,
  });
});

/**
 * @desc    Update editable fields of a patient (phone, address, district, emergencyContact, bloodGroup, allergies)
 * @route   PATCH /api/reception/patients/:id
 * @access  Private — receptionist
 */
const updatePatientProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createError('Patient not found.', 404);
  }

  const patient = await Patient.findOne({
    _id: id,
    isDeleted: { $ne: true },
  });

  if (!patient) {
    throw createError('Patient not found.', 404);
  }

  // 1. Validate and update phone if provided
  if (req.body.phone !== undefined) {
    if (!isValidSLPhone(req.body.phone)) {
      throw createError('Invalid Sri Lankan phone number format.', 400);
    }
    patient.phone = normalizePhone(req.body.phone);
  }

  // 2. Address
  if (req.body.address !== undefined) {
    patient.address =
      typeof req.body.address === 'string'
        ? req.body.address.trim()
        : req.body.address;
  }

  // 3. District
  if (req.body.district !== undefined) {
    patient.district =
      typeof req.body.district === 'string'
        ? req.body.district.trim()
        : req.body.district;
  }

  // 4. Emergency Contact
  if (req.body.emergencyContact !== undefined) {
    if (
      typeof req.body.emergencyContact === 'object' &&
      req.body.emergencyContact !== null
    ) {
      patient.emergencyContact = {
        name:
          req.body.emergencyContact.name !== undefined
            ? String(req.body.emergencyContact.name).trim()
            : patient.emergencyContact?.name,
        relationship:
          req.body.emergencyContact.relationship !== undefined
            ? String(req.body.emergencyContact.relationship).trim()
            : patient.emergencyContact?.relationship,
        phone:
          req.body.emergencyContact.phone !== undefined
            ? String(req.body.emergencyContact.phone).trim()
            : patient.emergencyContact?.phone,
      };
    }
  }

  // 5. Blood Group
  if (req.body.bloodGroup !== undefined) {
    const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    if (
      req.body.bloodGroup !== null &&
      req.body.bloodGroup !== '' &&
      !validBloodGroups.includes(req.body.bloodGroup)
    ) {
      throw createError(
        'Invalid blood group. Allowed: A+, A-, B+, B-, AB+, AB-, O+, O-.',
        400
      );
    }
    patient.bloodGroup = req.body.bloodGroup || undefined;
  }

  // 6. Allergies
  if (req.body.allergies !== undefined) {
    if (Array.isArray(req.body.allergies)) {
      patient.allergies = req.body.allergies
        .map((item) => {
          if (typeof item === 'string') {
            return { name: item.trim(), severity: 'moderate' };
          }
          return {
            name: item.name ? String(item.name).trim() : '',
            severity: item.severity ? String(item.severity).trim() : 'moderate',
          };
        })
        .filter((a) => a.name);
    }
  }

  // All other fields (e.g. fullName, nic, nicVerified, status, etc.) are ignored
  await patient.save();

  res.json({
    message: 'Patient profile updated successfully',
    ...patient.toObject(),
    patient,
  });
});

/**
 * @desc    Verify patient NIC (requires valid NIC on record, sets nicVerified = true)
 * @route   POST /api/reception/patients/:id/verify-nic
 * @access  Private — receptionist
 */
const verifyPatientNIC = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createError('Patient not found.', 404);
  }

  const patient = await Patient.findOne({
    _id: id,
    isDeleted: { $ne: true },
  });

  if (!patient) {
    throw createError('Patient not found.', 404);
  }

  if (!patient.nic || !patient.nic.trim()) {
    throw createError('Patient does not have an NIC on record to verify.', 400);
  }

  if (!isValidNIC(patient.nic)) {
    throw createError('Patient NIC on record is not a valid Sri Lankan NIC.', 400);
  }

  patient.nicVerified = true;
  await patient.save();

  res.json({
    message: 'NIC verified successfully',
    nicVerified: true,
    patient,
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
  getMyProfile,
  updateMyProfile,
  getMyHistory,
  getMyReports,
  getMyReport,
  createMyReport,
  updateMyReport,
  deleteMyReport,
  getMyReportFile,
  getDashboard,
  toProfileDto,
  buildProfilePatch,
  buildReportPatch,
  searchPatients,
  getPatients,
  getPatientById,
  updatePatientProfile,
  patchPatient: updatePatientProfile,
  verifyPatientNIC,
  getAllPatients,
  updatePatient,
  togglePatientStatus,
  deletePatient,
};
