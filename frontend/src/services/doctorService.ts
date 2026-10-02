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
