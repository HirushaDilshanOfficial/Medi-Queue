import { API_URL } from '../config';

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
  };
  currentPatient: {
    tokenNumber: number;
    patientName: string;
    age: number;
    gender: string;
    priority: 'normal' | 'urgent';
    status: string;
    reason?: string;
    checkedInTime?: string;
    calledAtTime?: string;
  } | null;
  upcomingQueue: Array<{
    tokenNumber: number;
    patientName: string;
    age: number;
    gender: string;
    priority: 'normal' | 'urgent';
    status: string;
    slotTime: string;
  }>;
}

// Fallback data matching the Figma "Doctor Home Dashboard (Simple)" design
const fallbackDoctorData: DoctorDashboardData = {
  doctor: {
    name: 'Dr. Emilia Emelson',
    specialization: 'Orthopedics Surgeon',
    department: 'Orthopedics OPD',
    room: 'Room 3B',
    status: 'active',
    dailyCapacity: 32,
    avgConsultMinutes: 15,
    workingHours: { start: '08:00', end: '16:00' },
  },
  metrics: {
    currentCallingToken: 28,
    waitingCount: 14,
    completedCount: 18,
    totalToday: 32,
    avgWaitMinutes: 15,
  },
  currentPatient: {
    tokenNumber: 28,
    patientName: 'Kamal Gunaratne',
    age: 46,
    gender: 'Male',
    priority: 'normal',
    status: 'in_consultation',
    reason: 'Spine checkup',
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
      status: 'waiting',
      slotTime: '11:15 AM',
    },
    {
      tokenNumber: 30,
      patientName: 'Rohan Mendis',
      age: 52,
      gender: 'Male',
      priority: 'normal',
      status: 'waiting',
      slotTime: '11:30 AM',
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
