import { API_URL } from '../config';

export interface PatientQueueItem {
  tokenNumber: number;
  patientName: string;
  age: number;
  gender: string;
  priority: 'normal' | 'urgent' | 'elderly' | 'walkin';
  category?: 'all' | 'priority' | 'walkin';
  status: string;
  reason?: string;
  location?: string;
  arrivedTime?: string;
  vitalsVerified?: boolean;
  slotTime?: string;
}

export interface DoctorDashboardData {
  doctor: {
    _id?: string;
    name: string;
    specialization: string;
    department: string;
    room: string;
    status: 'active' | 'on_break' | 'offline';
    dailyCapacity: number;
    avgConsultMinutes: number;
    workingHours?: { start: string; end: string };
  };
  metrics: {
    currentCallingToken: number;
    waitingCount: number;
    completedCount: number;
    totalToday: number;
    avgWaitMinutes: number;
    estimatedWaitTime?: string;
  };
  currentPatient: {
    tokenNumber: number;
    patientName: string;
    age: number;
    gender: string;
    priority: 'normal' | 'urgent';
    status: string;
    reason?: string;
    bloodPressure?: string;
    heartRate?: string;
    fileRecord?: string;
    checkedInTime?: string;
    calledAtTime?: string;
  } | null;
  upcomingQueue: PatientQueueItem[];
}

const emptyDoctorData: DoctorDashboardData = {
  doctor: {
    name: '',
    specialization: '',
    department: '',
    room: '',
    status: 'offline',
    dailyCapacity: 0,
    avgConsultMinutes: 0,
    workingHours: { start: '', end: '' },
  },
  metrics: {
    currentCallingToken: 0,
    waitingCount: 0,
    completedCount: 0,
    totalToday: 0,
    avgWaitMinutes: 0,
  },
  currentPatient: null,
  upcomingQueue: [],
};

export const fetchDoctorDashboard = async (doctorId?: string): Promise<DoctorDashboardData> => {
  try {
    const url = doctorId
      ? `${API_URL}/doctor/dashboard?doctorId=${doctorId}`
      : `${API_URL}/doctor/dashboard`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Doctor dashboard request failed (${response.status})`);
    }

    const json = await response.json();
    if (!json.data) throw new Error('Doctor dashboard returned no database data');
    return json.data;
  } catch (error) {
    throw error instanceof Error ? error : new Error('Could not load doctor dashboard data');
  }
};

export const updateDoctorStatusApi = async (
  status: 'active' | 'on_break' | 'offline',
  doctorId?: string
): Promise<boolean> => {
  try {
    const response = await fetch(`${API_URL}/doctor/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, doctorId }),
    });
    return response.ok;
  } catch (error) {
    console.log('Status update offline mode');
    return true;
  }
};

export const callNextPatientApi = async (): Promise<any> => {
  try {
    const response = await fetch(`${API_URL}/doctor/call-next`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return await response.json();
  } catch (error) {
    console.log('Call next patient offline mode');
    return { success: true, message: 'Called next token (offline mode)' };
  }
};

export const ringRoomChimeApi = async (tokenNumber?: number, room?: string): Promise<any> => {
  try {
    const response = await fetch(`${API_URL}/doctor/chime`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenNumber, room }),
    });
    return await response.json();
  } catch (error) {
    return {
      success: true,
      message: `Chime & announcement sent: "Token #${tokenNumber || '028'}, please enter ${room || 'Room 3B'}"`,
    };
  }
};

export const callSpecificTokenApi = async (tokenNumber: number): Promise<any> => {
  try {
    const response = await fetch(`${API_URL}/doctor/call-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenNumber }),
    });
    return await response.json();
  } catch (error) {
    return {
      success: true,
      message: `Token #${tokenNumber} called into room (offline mode)`,
    };
  }
};

// ============================================
// DOCTOR SCHEDULE TYPES & SERVICES (Matching UI)
// ============================================

export interface ScheduleTimelineItem {
  id: string;
  time: string;
  timeHour: string;
  timePeriod: string;
  patientName: string;
  reason: string;
  tokenNumber: number;
  status: 'done' | 'now_attending' | 'waiting' | 'scheduled';
  elapsedMinutes?: number;
  isNowAttending?: boolean;
  locationStatus?: string;
  age?: number;
  gender?: string;
  vitals?: {
    bloodPressure?: string;
    heartRate?: string;
    temperature?: string;
    spO2?: string;
  };
  fileRecord?: string;
}

export interface DoctorShiftInfo {
  title: string;
  timeRange: string;
  room: string;
  status: string;
  consultedCount: number;
  waitingCount: number;
  totalCapacity: number;
  avgMinutesPerPatient: number;
  remainingWalkinSlots: number;
  isOnBreak?: boolean;
}

export interface WeekDayItem {
  dayName: string;
  dayNumber: number;
  dateKey: string;
  isToday?: boolean;
  isSelected?: boolean;
}

export interface DoctorScheduleData {
  doctor: {
    name: string;
    room: string;
    status: string;
    avatarUrl?: string;
  };
  dateHeader: string;
  selectedDayKey: string;
  weekDays: WeekDayItem[];
  shift: DoctorShiftInfo;
  timeline: ScheduleTimelineItem[];
}

// Real-time Date & Time Utility Helpers
export const toDateKey = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const formatRealtimeDateHeader = (date: Date = new Date()): string => {
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const dayName = days[date.getDay()];
  const monthName = months[date.getMonth()];
  const dayNum = date.getDate();
  const year = date.getFullYear();
  return `${dayName}, ${monthName} ${dayNum}, ${year}`;
};

export const formatRealtimeClock = (date: Date = new Date()): string => {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strMinutes = minutes < 10 ? '0' + minutes : minutes;
  const strHours = hours < 10 ? '0' + hours : hours;
  return `${strHours}:${strMinutes} ${ampm}`;
};

export const getRealtimeWeekDays = (baseDate: Date = new Date()): WeekDayItem[] => {
  const today = new Date(baseDate);
  const dayOfWeek = today.getDay(); // 0 is Sun, 1 is Mon ... 6 is Sat
  const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayKey = toDateKey(today);

  // If weekday (Mon-Fri)
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek - 1));
    const result: WeekDayItem[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const k = toDateKey(d);
      result.push({
        dayName: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i],
        dayNumber: d.getDate(),
        dateKey: k,
        isToday: k === todayKey,
        isSelected: k === todayKey,
      });
    }
    return result;
  }

  // If weekend (Sunday or Saturday), show 5 days including today
  const start = new Date(today);
  if (dayOfWeek === 6) {
    // Saturday: Fri, Sat, Sun, Mon, Tue
    start.setDate(today.getDate() - 1);
  } // Sunday: Sun, Mon, Tue, Wed, Thu

  const result: WeekDayItem[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const k = toDateKey(d);
    result.push({
      dayName: dayNamesShort[d.getDay()],
      dayNumber: d.getDate(),
      dateKey: k,
      isToday: k === todayKey,
      isSelected: k === todayKey,
    });
  }
  return result;
};

export const fallbackScheduleData: DoctorScheduleData = {
  doctor: {
    name: 'Dr. Emilia Emelson',
    room: 'Room 3B Online',
    status: 'active',
    avatarUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=200',
  },
  dateHeader: formatRealtimeDateHeader(new Date()),
  selectedDayKey: toDateKey(new Date()),
  weekDays: getRealtimeWeekDays(new Date()),
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
      age: 42,
      gender: 'Male',
      vitals: { bloodPressure: '120/80', heartRate: '72 bpm' },
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
      age: 32,
      gender: 'Female',
      vitals: { bloodPressure: '118/76', heartRate: '68 bpm' },
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
      vitals: { bloodPressure: '138/88', heartRate: '80 bpm' },
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
      vitals: { bloodPressure: '122/80', heartRate: '74 bpm' },
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

export const fetchDoctorSchedule = async (dateKey?: string): Promise<DoctorScheduleData> => {
  try {
    const url = dateKey ? `${API_URL}/doctor/schedule?dateKey=${dateKey}` : `${API_URL}/doctor/schedule`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Doctor schedule request failed (${response.status})`);
    }

    const json = await response.json();
    if (!json.data) throw new Error('Doctor schedule returned no database data');
    return json.data;
  } catch (error) {
    throw error instanceof Error ? error : new Error('Could not load doctor schedule data');
  }
};

export const addWalkInSlotApi = async (payload: {
  patientName: string;
  reason?: string;
  priority?: string;
  age?: number;
  gender?: string;
}): Promise<any> => {
  try {
    const response = await fetch(`${API_URL}/doctor/walkin-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await response.json();
  } catch (error) {
    console.log('Walk-in added in offline mode');
    return {
      success: true,
      message: `Walk-in slot added successfully for ${payload.patientName}`,
    };
  }
};

export const toggleDoctorBreakApi = async (minutes: number = 15): Promise<any> => {
  try {
    const response = await fetch(`${API_URL}/doctor/break`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes }),
    });
    return await response.json();
  } catch (error) {
    console.log('Break toggled in offline mode');
    return {
      success: true,
      message: 'Break status updated',
    };
  }
};
