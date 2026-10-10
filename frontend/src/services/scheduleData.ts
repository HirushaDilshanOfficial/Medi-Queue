/**
 * Schedule Data Model & Mock Data for Doctor "My Schedule"
 * Separated cleanly from the UI for easy backend replacement.
 */

export interface HospitalInfo {
  id: string;
  name: string;
  shortName: string;
  room: string;
  address: string;
  shiftName: string;
  shiftTime: string;
  shiftIcon: string; // MaterialCommunityIcons or Ionicons name
  accentColor: string; // Tag & dropdown dot accent
  accentLight: string;
  walkInCapacity: number;
}

export type AppointmentStatus = 'Done' | 'Now attending' | 'Waiting' | 'Scheduled';

export interface ScheduleAppointment {
  id: string;
  time: string;
  patientName: string;
  reason: string;
  token: string;
  status: AppointmentStatus;
  hospitalId: string;
  age: number;
  sex: 'Male' | 'Female' | 'Other';
  bloodGroup: string;
  nic: string;
  phone: string;
  allergy?: string;
  elapsedMin?: number;
  isWalkIn?: boolean;
}

export interface DaySchedule {
  dateKey: string; // YYYY-MM-DD
  isLeave?: boolean;
  leaveReason?: string;
  hospitals: string[]; // hospital IDs active on this day
  appointments: ScheduleAppointment[];
}

// ─────────────────────────────────────────────────────────────
// 1. HOSPITAL DEFINITIONS (3 Hospitals with specific accents)
// ─────────────────────────────────────────────────────────────
export const HOSPITALS: Record<string, HospitalInfo> = {
  cgh: {
    id: 'cgh',
    name: 'Colombo General Hospital',
    shortName: 'Colombo General',
    room: 'OPD Room 3B',
    address: 'No. 01 Regent Street, Colombo 08',
    shiftName: 'Morning OPD Shift',
    shiftTime: '08:00 AM – 12:30 PM',
    shiftIcon: 'weather-sunset-up',
    accentColor: '#0e8a96', // Teal
    accentLight: '#e6f7f9',
    walkInCapacity: 5,
  },
  lakeview: {
    id: 'lakeview',
    name: 'Colombo General Hospital',
    shortName: 'Colombo General',
    room: 'OPD Room 3B',
    address: 'No. 01 Regent Street, Colombo 08',
    shiftName: 'Afternoon OPD Shift',
    shiftTime: '01:30 PM – 05:00 PM',
    shiftIcon: 'weather-sunny',
    accentColor: '#d97706', // Amber
    accentLight: '#fef3c7',
    walkInCapacity: 4,
  },
  'st-lucia': {
    id: 'st-lucia',
    name: 'Colombo General Hospital',
    shortName: 'Colombo General',
    room: 'OPD Room 3B',
    address: 'No. 01 Regent Street, Colombo 08',
    shiftName: 'Night OPD Shift',
    shiftTime: '05:30 PM – 08:30 PM',
    shiftIcon: 'weather-night',
    accentColor: '#7c3aed', // Purple
    accentLight: '#f3e8ff',
    walkInCapacity: 3,
  },
};

// ─────────────────────────────────────────────────────────────
// 2. FIXED REFERENCE DATES (Mon Oct 5 - Fri Oct 9, Today = Tue Oct 6, 2026)
// ─────────────────────────────────────────────────────────────
export const REFERENCE_TODAY = (() => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
})();

export const INITIAL_SCHEDULE_DATA: Record<string, DaySchedule> = {};

// ─────────────────────────────────────────────────────────────
// 3. HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────

export interface WeekDayItem {
  date: Date;
  dateKey: string;
  dayLabel: string; // Mon, Tue...
  dateNum: number;  // 5, 6...
  isToday: boolean;
  isWeekend: boolean;
  isLeave: boolean;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns 7 days (Mon to Sun) for the week containing `targetDate`
 */
export function getWeekDays(targetDate: Date): WeekDayItem[] {
  const current = new Date(targetDate);
  // Get Monday of this week (0=Sun, 1=Mon, ..., 6=Sat)
  const dayOfWeek = current.getDay();
  // If Sunday (0), distance to Monday is -6; else distance is 1 - dayOfWeek
  const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(current);
  monday.setDate(current.getDate() + distanceToMonday);

  const days: WeekDayItem[] = [];
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = formatDateKey(d);
    const isWeekend = i === 5 || i === 6;
    const isToday = key === REFERENCE_TODAY;
    const isLeave = Boolean(INITIAL_SCHEDULE_DATA[key]?.isLeave);

    days.push({
      date: d,
      dateKey: key,
      dayLabel: dayLabels[i],
      dateNum: d.getDate(),
      isToday,
      isWeekend,
      isLeave,
    });
  }

  return days;
}

/**
 * Format week range label (e.g. "Oct 5 – 11, 2026")
 */
export function formatWeekRangeLabel(weekDays: WeekDayItem[]): string {
  if (weekDays.length === 0) return '';
  const first = weekDays[0].date;
  const last = weekDays[6].date;
  const monthFirst = first.toLocaleDateString('en-US', { month: 'short' });
  const monthLast = last.toLocaleDateString('en-US', { month: 'short' });
  const year = last.getFullYear();

  if (monthFirst === monthLast) {
    return `${monthFirst} ${first.getDate()} – ${last.getDate()}, ${year}`;
  }
  return `${monthFirst} ${first.getDate()} – ${monthLast} ${last.getDate()}, ${year}`;
}

/**
 * Format date for header (e.g. "TUESDAY, OCT 6, 2026")
 */
export function formatHeaderDate(dateKey: string): string {
  const d = parseDateKey(dateKey);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = d.getDate();
  const year = d.getFullYear();
  return `${weekday}, ${month} ${day}, ${year}`;
}
