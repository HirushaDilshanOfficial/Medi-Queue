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
  { key: 'clinics-queue', label: 'Clinics', caption: 'Queue', icon: 'hourglass' },
  { key: 'medicine-queue', label: 'Medicine', caption: 'Submit', icon: 'pill' },
] as const;

// Core services a real hospital app puts one tap away, modelled on the
// service set Sri Lankan private hospital groups publish (ongoing number,
// pre-registration, lab reports, consultation booking, pharmacy, payment).
export const HOSPITAL_SERVICES = [
  { key: 'ongoing-number', label: 'Ongoing', caption: 'Number', icon: 'hourglass' },
  { key: 'pre-registration', label: 'Pre-', caption: 'Registration', icon: 'clipboard' },
  { key: 'lab-reports', label: 'Lab', caption: 'Reports', icon: 'screening' },
  { key: 'pharmacy', label: 'Online', caption: 'Pharmacy', icon: 'pill' },
  { key: 'payment', label: 'Pay', caption: 'Bills', icon: 'badge' },
  { key: 'wellness', label: 'Wellness', caption: 'Packages', icon: 'heart' },
  { key: 'feedback', label: 'Patient', caption: 'Feedback', icon: 'help' },
  { key: 'ambulance', label: 'Ambulance', caption: '24/7', icon: 'medical' },
] as const;

// Quality indicators surfaced the way hospital groups publish them.
export const QUALITY_STATS = [
  { key: 'satisfaction', value: '94.8%', label: 'Satisfaction' },
  { key: 'hand-hygiene', value: '88.3%', label: 'Hand Hygiene' },
  { key: 'infection', value: '0.09%', label: 'Infection Rate' },
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
    key: 'blood-screening',
    title: 'Free Blood Screening',
    description: 'Complimentary glucose check & bone density tests',
    schedule: 'Saturday, 08:30 WITA',
    image: require('../../../../assets/images/patient/dashboard-screening.png'),
    badge: 'Workshop',
  },
  {
    key: 'spine-care',
    title: 'Posture & Spine Care',
    description: 'Ergonomic habits for workplace orthopedic health',
    schedule: 'Next Tuesday, 14:00 WITA',
    image: require('../../../../assets/images/patient/dashboard-wellness.png'),
    badge: 'Wellness',
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
  helpline: '1313',
} as const;
