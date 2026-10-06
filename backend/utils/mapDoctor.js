// Single place where the shared `Doctor` schema is read by the patient module.
// The MOH team owns that model, so every field assumption is isolated here and
// defaults are applied defensively instead of trusting the shape.

const TITLE_PREFIX = /^(dr\.?|prof\.?|mr\.?|mrs\.?|ms\.?|miss)\s+/i;

// Doctor names in the shared model already carry their title, so strip it before
// deriving a given name for the dashboard and booking greetings.
function stripTitle(name) {
  return typeof name === 'string' ? name.trim().replace(TITLE_PREFIX, '').trim() : '';
}

function firstNameOf(name) {
  const stripped = stripTitle(name);
  if (!stripped) return 'Doctor';
  return stripped.split(/\s+/)[0];
}

function initialsOf(name) {
  const parts = stripTitle(name).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'DR';
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] || '' : '';
  return (first + last).toUpperCase() || 'DR';
}

function toIso(value) {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : null;
}

/**
 * Normalises a Doctor document (plus its optional OpdDoctorProfile) into the
 * shape the patient app consumes.
 */
function mapDoctor(doctor, profile) {
  if (!doctor) return null;

  const id = String(doctor._id);
  const name = (doctor.name || '').trim();
  const qualifications = (profile && profile.qualifications) || '';

  return {
    id,
    name,
    displayName: name,
    firstName: firstNameOf(name),
    title: (profile && profile.title) || 'Dr.',
    initials: initialsOf(name),
    avatarUrl: (profile && profile.avatarUrl) || null,
    specialization: doctor.specialization || 'General',
    department: doctor.department || 'General',
    qualifications,
    languages: (profile && profile.languages) || [],
    about: (profile && profile.about) || '',
    room: doctor.room || null,
    status: doctor.status || 'offline',
    isAvailable: doctor.status === 'active',
    dailyCapacity: typeof doctor.dailyCapacity === 'number' ? doctor.dailyCapacity : 0,
    avgConsultMinutes:
      typeof doctor.avgConsultMinutes === 'number' ? doctor.avgConsultMinutes : 10,
    workingHours: {
      start: (doctor.workingHours && doctor.workingHours.start) || null,
      end: (doctor.workingHours && doctor.workingHours.end) || null,
    },
    rating: profile && typeof profile.rating === 'number' ? profile.rating : null,
    reviewCount:
      profile && typeof profile.reviewCount === 'number' ? profile.reviewCount : 0,
    fee: profile && typeof profile.fee === 'number' ? profile.fee : null,
    createdAt: toIso(doctor.createdAt),
  };
}

module.exports = { mapDoctor, initialsOf, firstNameOf, stripTitle };
