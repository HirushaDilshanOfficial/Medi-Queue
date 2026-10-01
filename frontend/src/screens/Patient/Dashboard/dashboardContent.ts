// Static design content for the Patient Home dashboard.
//
// Option (a): the queue, schedule and appointment APIs that back most of these
// strings arrive in Part 2 and Part 3. Until then the layout uses the exact copy
// from the Patient Dashboard design, and the screen overrides any piece that the
// dashboard endpoint already returns.

export const ACTION_TILES = [
  { key: 'clinic-registration', label: 'Clinic', caption: 'Registration', icon: 'clipboard' },
  { key: 'doctor-schedule', label: 'Doctor', caption: 'Schedule', icon: 'calendar' },
  { key: 'doctor-appointment', label: 'Doctor', caption: 'Appt.', icon: 'stethoscope' },
  { key: 'medicine-queue', label: 'Medicine', caption: 'Queue Submit', icon: 'pill' },
] as const;

export const SPECIALTIES = [
  { key: 'orthopedic', label: 'Orthopedic', icon: 'spine' },
  { key: 'neurology', label: 'Neurology', icon: 'brain' },
  { key: 'ent', label: 'ENT', icon: 'ear' },
  { key: 'cardiology', label: 'Cardiology', icon: 'heart' },
  { key: 'children', label: 'Children', icon: 'child' },
  { key: 'psychology', label: 'Psychology', icon: 'mind' },
  { key: 'eye', label: 'Eye', icon: 'eye' },
  { key: 'urology', label: 'Urology', icon: 'kidney' },
] as const;

export const EVENTS = [
  {
    key: 'wellness-workshop',
    title: 'Wellness Workshop',
    description: 'Guided wellness session for OPD patients and staff.',
    schedule: 'Saturday, 08:30 WITA',
    image: require('../../../../assets/images/patient/wellness.png'),
    badge: 'Workshop',
  },
  {
    key: 'blood-screening',
    title: 'Free Blood Screening',
    description: 'Complimentary glucose check & basic panel.',
    schedule: 'Saturday, 08:30 WITA',
    image: require('../../../../assets/images/patient/screening.png'),
    badge: 'Free',
  },
  {
    key: 'spine-care',
    title: 'Posture & Spine Care',
    description: 'Ergonomic habits for workplace and home.',
    schedule: 'Next Tuesday, 14:00 WITA',
    image: require('../../../../assets/images/patient/spine.png'),
    badge: 'Clinic',
  },
] as const;

// Design fallbacks for data the dashboard endpoint does not return yet.
export const DESIGN_FALLBACK = {
  greetingName: 'Aurelia',
  clinicName: 'Orthopedic Clinic Queue',
  clinicSubline: 'Current Queue 3 of 17',
  tokenNumber: 6,
  room: 'Room 304',
  eta: 'Your turn at 11:12 WITA',
  checkupTitle: 'Your next medical checkup',
  checkupBadge: 'Tomorrow',
  bookingMetaPrimary: 'General & Specialist',
  bookingMetaSecondary: 'Today Available',
  doctorsOnline: 12,
} as const;
