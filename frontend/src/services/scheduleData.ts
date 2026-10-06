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
    name: 'City General Hospital',
    shortName: 'City General',
    room: 'Room 3B',
    address: 'No. 12 Regent Street, Colombo 08',
    shiftName: 'Morning OPD Shift',
    shiftTime: '08:00 AM – 12:30 PM',
    shiftIcon: 'weather-sunset-up',
    accentColor: '#0e8a96', // Teal
    accentLight: '#e6f7f9',
    walkInCapacity: 5,
  },
  lakeview: {
    id: 'lakeview',
    name: 'Lakeview Medical Centre',
    shortName: 'Lakeview Medical',
    room: 'OPD Suite 2',
    address: 'No. 42 Lake Road, Rajagiriya',
    shiftName: 'Afternoon Clinic',
    shiftTime: '01:30 PM – 05:00 PM',
    shiftIcon: 'weather-sunny',
    accentColor: '#d97706', // Amber
    accentLight: '#fef3c7',
    walkInCapacity: 4,
  },
  'st-lucia': {
    id: 'st-lucia',
    name: 'St. Lucia Private Hospital',
    shortName: 'St. Lucia Private',
    room: 'Cons. Rm 104',
    address: 'No. 88 Havelock Road, Colombo 05',
    shiftName: 'Evening Clinic',
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
export const REFERENCE_TODAY = '2026-10-06';

export const INITIAL_SCHEDULE_DATA: Record<string, DaySchedule> = {
  // Monday Oct 5, 2026 (Past day)
  '2026-10-05': {
    dateKey: '2026-10-05',
    hospitals: ['cgh', 'lakeview'],
    appointments: [
      {
        id: 'mon-1',
        time: '08:30 AM',
        patientName: 'Sunil Weerasinghe',
        reason: 'Post-viral Fatigue',
        token: 'Token #001',
        status: 'Done',
        hospitalId: 'cgh',
        age: 49,
        sex: 'Male',
        bloodGroup: 'O+',
        nic: '197521004321',
        phone: '077 345 6789',
      },
      {
        id: 'mon-2',
        time: '09:15 AM',
        patientName: 'Malkanthi Silva',
        reason: 'Hypertension Follow-up',
        token: 'Token #004',
        status: 'Done',
        hospitalId: 'cgh',
        age: 58,
        sex: 'Female',
        bloodGroup: 'A+',
        nic: '196678201234',
        phone: '071 890 1234',
        allergy: 'Aspirin (Bronchospasm)',
      },
      {
        id: 'mon-3',
        time: '02:00 PM',
        patientName: 'Prasanna Gunawardena',
        reason: 'Joint Stiffness & Pain',
        token: 'Token #018',
        status: 'Done',
        hospitalId: 'lakeview',
        age: 62,
        sex: 'Male',
        bloodGroup: 'B+',
        nic: '196234105678',
        phone: '072 456 7890',
      },
    ],
  },

  // Tuesday Oct 6, 2026 (TODAY - 11 appointments across all 3 hospitals)
  '2026-10-06': {
    dateKey: '2026-10-06',
    hospitals: ['cgh', 'lakeview', 'st-lucia'],
    appointments: [
      // 1. CGH Morning OPD
      {
        id: 'tue-1',
        time: '08:30 AM',
        patientName: 'Kasun Chamara Mendis',
        reason: 'Routine Health Checkup',
        token: 'Token #001',
        status: 'Done',
        hospitalId: 'cgh',
        age: 42,
        sex: 'Male',
        bloodGroup: 'O+',
        nic: '198418201234',
        phone: '077 123 4567',
      },
      {
        id: 'tue-2',
        time: '08:50 AM',
        patientName: 'Nimali Perera',
        reason: 'Hypertension Monitoring',
        token: 'Token #003',
        status: 'Done',
        hospitalId: 'cgh',
        age: 56,
        sex: 'Female',
        bloodGroup: 'A+',
        nic: '197065402345',
        phone: '071 987 6543',
        allergy: 'Penicillin (Severe anaphylactic rash)',
      },
      {
        id: 'tue-3',
        time: '09:15 AM',
        patientName: 'Ruwan Wijesinghe',
        reason: 'Fasting Blood Sugar Follow-up',
        token: 'Token #005',
        status: 'Done',
        hospitalId: 'cgh',
        age: 61,
        sex: 'Male',
        bloodGroup: 'B+',
        nic: '196532104567',
        phone: '072 345 6789',
      },
      {
        id: 'tue-4',
        time: '09:40 AM',
        patientName: 'Sanduni Jayawardena',
        reason: 'Acute Migraine & Visual Aura',
        token: 'Token #008',
        status: 'Now attending',
        hospitalId: 'cgh',
        age: 29,
        sex: 'Female',
        bloodGroup: 'B+',
        nic: '199754302198',
        phone: '075 432 1098',
        elapsedMin: 6,
      },
      {
        id: 'tue-5',
        time: '10:15 AM',
        patientName: 'Tharindu Alwis',
        reason: 'Persistent Dry Cough & Wheeze',
        token: 'Token #010',
        status: 'Waiting',
        hospitalId: 'cgh',
        age: 35,
        sex: 'Male',
        bloodGroup: 'AB+',
        nic: '199109803456',
        phone: '077 876 5432',
        allergy: 'Sulfa Drugs (Severe hives & edema)',
      },
      {
        id: 'tue-6',
        time: '10:45 AM',
        patientName: 'Dilhani Fernando',
        reason: 'Knee Osteoarthritis Review',
        token: 'Token #012',
        status: 'Waiting',
        hospitalId: 'cgh',
        age: 48,
        sex: 'Female',
        bloodGroup: 'O-',
        nic: '197823405678',
        phone: '076 543 2109',
      },

      // 2. Lakeview Medical Centre Afternoon Clinic
      {
        id: 'tue-7',
        time: '01:45 PM',
        patientName: 'Chaminda Senanayake',
        reason: 'Post-op Laparoscopy Follow-up',
        token: 'Token #020',
        status: 'Scheduled',
        hospitalId: 'lakeview',
        age: 52,
        sex: 'Male',
        bloodGroup: 'A-',
        nic: '197412306789',
        phone: '070 123 4567',
      },
      {
        id: 'tue-8',
        time: '02:20 PM',
        patientName: 'Kavindi Wickramasinghe',
        reason: 'Thyroid Ultrasound Review',
        token: 'Token #022',
        status: 'Scheduled',
        hospitalId: 'lakeview',
        age: 33,
        sex: 'Female',
        bloodGroup: 'B+',
        nic: '199345607890',
        phone: '071 234 5678',
        allergy: 'Ibuprofen & NSAIDs (Facial Swelling)',
      },
      {
        id: 'tue-9',
        time: '03:00 PM',
        patientName: 'Mahesh Kumara',
        reason: 'Resting ECG & Cardiac Clearance',
        token: 'Token #025',
        status: 'Scheduled',
        hospitalId: 'lakeview',
        age: 64,
        sex: 'Male',
        bloodGroup: 'O+',
        nic: '196234508901',
        phone: '077 654 3210',
      },

      // 3. St. Lucia Private Hospital Evening Clinic
      {
        id: 'tue-10',
        time: '05:45 PM',
        patientName: 'Anoma Bandara',
        reason: 'Comprehensive Executive Health Screening',
        token: 'Token #031',
        status: 'Scheduled',
        hospitalId: 'st-lucia',
        age: 45,
        sex: 'Female',
        bloodGroup: 'AB-',
        nic: '198156709012',
        phone: '078 901 2345',
      },
      {
        id: 'tue-11',
        time: '06:30 PM',
        patientName: 'Janaka Rathnayake',
        reason: 'Lumbar Spine MRI Discussion',
        token: 'Token #034',
        status: 'Scheduled',
        hospitalId: 'st-lucia',
        age: 38,
        sex: 'Male',
        bloodGroup: 'A+',
        nic: '198867801234',
        phone: '076 789 0123',
      },
    ],
  },

  // Wednesday Oct 7, 2026
  '2026-10-07': {
    dateKey: '2026-10-07',
    hospitals: ['cgh', 'st-lucia'],
    appointments: [
      {
        id: 'wed-1',
        time: '08:45 AM',
        patientName: 'Dhanushka Priyashantha',
        reason: 'Gastritis & Acid Reflux',
        token: 'Token #002',
        status: 'Scheduled',
        hospitalId: 'cgh',
        age: 36,
        sex: 'Male',
        bloodGroup: 'B+',
        nic: '199043201876',
        phone: '071 345 9876',
      },
      {
        id: 'wed-2',
        time: '09:30 AM',
        patientName: 'Ishara Madushani',
        reason: 'Prenatal 2nd Trimester Check',
        token: 'Token #006',
        status: 'Scheduled',
        hospitalId: 'cgh',
        age: 28,
        sex: 'Female',
        bloodGroup: 'O+',
        nic: '199854301987',
        phone: '077 654 0987',
      },
      {
        id: 'wed-3',
        time: '06:00 PM',
        patientName: 'Roshan Samarasekera',
        reason: 'Cholesterol & Lipid Panel Review',
        token: 'Token #028',
        status: 'Scheduled',
        hospitalId: 'st-lucia',
        age: 50,
        sex: 'Male',
        bloodGroup: 'A+',
        nic: '197623409871',
        phone: '072 123 9087',
      },
    ],
  },

  // Thursday Oct 8, 2026
  '2026-10-08': {
    dateKey: '2026-10-08',
    hospitals: ['lakeview'],
    appointments: [
      {
        id: 'thu-1',
        time: '02:00 PM',
        patientName: 'Nelum Kumari',
        reason: 'Migraine Medication Adjustment',
        token: 'Token #015',
        status: 'Scheduled',
        hospitalId: 'lakeview',
        age: 41,
        sex: 'Female',
        bloodGroup: 'B-',
        nic: '198543201765',
        phone: '076 987 1234',
        allergy: 'Paracetamol (Mild urticaria)',
      },
      {
        id: 'thu-2',
        time: '02:45 PM',
        patientName: 'Asela Karunaratne',
        reason: 'Shoulder Impingement Follow-up',
        token: 'Token #019',
        status: 'Scheduled',
        hospitalId: 'lakeview',
        age: 47,
        sex: 'Male',
        bloodGroup: 'O+',
        nic: '197943201543',
        phone: '071 876 2345',
      },
    ],
  },

  // Friday Oct 9, 2026
  '2026-10-09': {
    dateKey: '2026-10-09',
    hospitals: ['cgh', 'lakeview', 'st-lucia'],
    appointments: [
      {
        id: 'fri-1',
        time: '09:00 AM',
        patientName: 'Devika Abeywickrama',
        reason: 'Diabetes Type 2 HbA1c Review',
        token: 'Token #003',
        status: 'Scheduled',
        hospitalId: 'cgh',
        age: 53,
        sex: 'Female',
        bloodGroup: 'A+',
        nic: '197345601234',
        phone: '077 234 8765',
      },
      {
        id: 'fri-2',
        time: '02:30 PM',
        patientName: 'Gayan Disanayake',
        reason: 'Sprained Ankle Clearance',
        token: 'Token #021',
        status: 'Scheduled',
        hospitalId: 'lakeview',
        age: 31,
        sex: 'Male',
        bloodGroup: 'B+',
        nic: '199512304567',
        phone: '075 987 3456',
      },
    ],
  },

  // Saturday Oct 10 & Sunday Oct 11 are weekends (no clinics scheduled)

  // Monday Oct 12, 2026 (LEAVE DAY)
  '2026-10-12': {
    dateKey: '2026-10-12',
    isLeave: true,
    leaveReason: 'Approved Annual Medical Conference Leave',
    hospitals: [],
    appointments: [],
  },

  // Tuesday Oct 13, 2026 (LEAVE DAY)
  '2026-10-13': {
    dateKey: '2026-10-13',
    isLeave: true,
    leaveReason: 'Approved Annual Medical Conference Leave',
    hospitals: [],
    appointments: [],
  },
};

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
