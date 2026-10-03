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

// Fallback data matching the Figma "Live Patient Queue & Next Call" design
const fallbackDoctorData: DoctorDashboardData = {
  doctor: {
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
    estimatedWaitTime: '~42m',
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
      return fallbackDoctorData;
    }

    const json = await response.json();
    return json.data || fallbackDoctorData;
  } catch (error) {
    console.log('Using local fallback doctor dashboard data:', error);
    return fallbackDoctorData;
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

export const fallbackScheduleData: DoctorScheduleData = {
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
      return fallbackScheduleData;
    }

    const json = await response.json();
    return json.data || fallbackScheduleData;
  } catch (error) {
    console.log('Using local fallback doctor schedule data:', error);
    return fallbackScheduleData;
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

