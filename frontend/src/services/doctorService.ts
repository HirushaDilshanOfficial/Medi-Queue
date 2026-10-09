import { API_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    hospitalName?: string;
    hospitalId?: string;
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
    allergy?: string | null;
    allergies?: any[];
    nic?: string;
    patientId?: string;
    appointmentId?: string;
  } | null;
  upcomingQueue: PatientQueueItem[];
}

// Hospital-specific presets for all 4 hospitals
export const HOSPITAL_DASHBOARDS: Record<string, DoctorDashboardData> = {
  'Colombo Teaching Hospital 1': {
    doctor: {
      name: 'Dr. Palitha Perera',
      specialization: 'Orthopedics Surgeon',
      department: 'Orthopedics OPD',
      room: 'Room 101',
      hospitalName: 'Colombo Teaching Hospital 1',
      status: 'active',
      dailyCapacity: 32,
      avgConsultMinutes: 9,
      workingHours: { start: '08:00', end: '16:00' },
    },
    metrics: {
      currentCallingToken: 28,
      waitingCount: 6,
      completedCount: 18,
      totalToday: 25,
      avgWaitMinutes: 9,
      estimatedWaitTime: '~36m',
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
      fileRecord: 'REC-828',
      checkedInTime: '08:45 AM',
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
        patientName: 'Sunil Shantha',
        age: 52,
        gender: 'Male',
        priority: 'elderly',
        category: 'priority',
        status: 'Checked In • Ready',
        reason: 'Hypertension Follow-up',
        location: 'Waiting Area',
        arrivedTime: '10:20',
        vitalsVerified: true,
        slotTime: '11:30 AM',
      },
      {
        tokenNumber: 31,
        patientName: 'Kanthi Rajapaksha',
        age: 46,
        gender: 'Female',
        priority: 'urgent',
        category: 'priority',
        status: 'Checked In • Ready',
        reason: 'Diabetes Screening',
        location: 'Waiting Area',
        arrivedTime: '10:30',
        vitalsVerified: true,
        slotTime: '11:45 AM',
      },
      {
        tokenNumber: 32,
        patientName: 'Bandula Gunasekara',
        age: 64,
        gender: 'Male',
        priority: 'elderly',
        category: 'priority',
        status: 'Waiting',
        reason: 'Chronic Knee Pain',
        location: 'Waiting Area',
        arrivedTime: '10:40',
        vitalsVerified: false,
        slotTime: '12:00 PM',
      },
      {
        tokenNumber: 33,
        patientName: 'Malkanthi Silva',
        age: 43,
        gender: 'Female',
        priority: 'normal',
        category: 'all',
        status: 'Waiting',
        reason: 'Routine Physical Exam',
        location: 'Waiting Area',
        arrivedTime: '10:45',
        vitalsVerified: true,
        slotTime: '12:15 PM',
      },
      {
        tokenNumber: 34,
        patientName: 'Dilshan Madushanka',
        age: 28,
        gender: 'Male',
        priority: 'walkin',
        category: 'walkin',
        status: 'X-Ray Ready',
        reason: 'Acute knee sprain',
        location: 'Radiology returned',
        arrivedTime: '10:50',
        vitalsVerified: true,
        slotTime: '12:30 PM',
      },
    ],
  },

  'City General Hospital': {
    doctor: {
      name: 'Dr. Palitha Perera',
      specialization: 'General Physician',
      department: 'General OPD',
      room: 'Room 3B',
      hospitalName: 'City General Hospital',
      status: 'active',
      dailyCapacity: 30,
      avgConsultMinutes: 8,
      workingHours: { start: '08:30', end: '16:30' },
    },
    metrics: {
      currentCallingToken: 2,
      waitingCount: 0,
      completedCount: 2,
      totalToday: 3,
      avgWaitMinutes: 15,
      estimatedWaitTime: '~0m',
    },
    currentPatient: {
      tokenNumber: 2,
      patientName: 'Heshani Wickramasinghe',
      age: 22,
      gender: 'Female',
      priority: 'normal',
      status: 'in_consultation',
      reason: 'General OPD Consultation',
      bloodPressure: '120/80',
      heartRate: '74 bpm',
      fileRecord: 'NIC: 200382013019',
      checkedInTime: '01:20 PM',
      calledAtTime: '01:20 PM',
    },
    upcomingQueue: [],
  },

  'National Hospital Sri Lanka': {
    doctor: {
      name: 'Dr. Palitha Perera',
      specialization: 'Endocrinologist & Physician',
      department: 'Diabetic & Endocrine OPD',
      room: 'Room 204',
      hospitalName: 'National Hospital Sri Lanka',
      status: 'active',
      dailyCapacity: 35,
      avgConsultMinutes: 12,
      workingHours: { start: '08:00', end: '17:00' },
    },
    metrics: {
      currentCallingToken: 101,
      waitingCount: 6,
      completedCount: 24,
      totalToday: 31,
      avgWaitMinutes: 12,
      estimatedWaitTime: '~45m',
    },
    currentPatient: {
      tokenNumber: 101,
      patientName: 'Sarath Fonseka',
      age: 55,
      gender: 'Male',
      priority: 'normal',
      status: 'in_consultation',
      reason: 'Blood Sugar Monitoring',
      bloodPressure: '124/82',
      heartRate: '76 bpm',
      fileRecord: 'REC-101',
      checkedInTime: '08:30 AM',
      calledAtTime: '08:40',
    },
    upcomingQueue: [
      {
        tokenNumber: 102,
        patientName: 'Gamini Senanayake',
        age: 66,
        gender: 'Male',
        priority: 'elderly',
        category: 'priority',
        status: 'next',
        reason: 'Arthritis Follow-up',
        location: 'Ready at Lobby',
        arrivedTime: '08:45',
        vitalsVerified: true,
        slotTime: '09:00 AM',
      },
      {
        tokenNumber: 103,
        patientName: 'Rohini Jayasuriya',
        age: 48,
        gender: 'Female',
        priority: 'normal',
        category: 'all',
        status: 'Checked In • Ready',
        reason: 'Gastritis & Acid Reflux',
        location: 'Waiting Area',
        arrivedTime: '08:50',
        vitalsVerified: true,
        slotTime: '09:15 AM',
      },
      {
        tokenNumber: 104,
        patientName: 'Prasanna Fernando',
        age: 35,
        gender: 'Male',
        priority: 'normal',
        category: 'all',
        status: 'Waiting',
        reason: 'Lower Back Strain',
        location: 'Waiting Area',
        arrivedTime: '09:05',
        vitalsVerified: true,
        slotTime: '09:30 AM',
      },
      {
        tokenNumber: 105,
        patientName: 'Chitra Samaranayake',
        age: 59,
        gender: 'Female',
        priority: 'elderly',
        category: 'priority',
        status: 'Waiting',
        reason: 'Osteoporosis Consultation',
        location: 'Waiting Area',
        arrivedTime: '09:15',
        vitalsVerified: false,
        slotTime: '09:45 AM',
      },
      {
        tokenNumber: 106,
        patientName: 'Mahinda Abeyrathne',
        age: 63,
        gender: 'Male',
        priority: 'urgent',
        category: 'priority',
        status: 'Waiting',
        reason: 'Post-CABG Routine Check',
        location: 'Waiting Area',
        arrivedTime: '09:25',
        vitalsVerified: true,
        slotTime: '10:00 AM',
      },
      {
        tokenNumber: 107,
        patientName: 'Kumari Weerasinghe',
        age: 41,
        gender: 'Female',
        priority: 'walkin',
        category: 'walkin',
        status: 'Waiting',
        reason: 'Allergy & Sinus Review',
        location: 'Waiting Area',
        arrivedTime: '09:40',
        vitalsVerified: true,
        slotTime: '10:15 AM',
      },
    ],
  },

  'Colombo South Teaching Hospital': {
    doctor: {
      name: 'Dr. Palitha Perera',
      specialization: 'Cardiologist & Physician',
      department: 'Cardiology OPD',
      room: 'Room 12A',
      hospitalName: 'Colombo South Teaching Hospital',
      status: 'active',
      dailyCapacity: 28,
      avgConsultMinutes: 10,
      workingHours: { start: '08:00', end: '16:00' },
    },
    metrics: {
      currentCallingToken: 201,
      waitingCount: 5,
      completedCount: 15,
      totalToday: 21,
      avgWaitMinutes: 10,
      estimatedWaitTime: '~35m',
    },
    currentPatient: {
      tokenNumber: 201,
      patientName: 'Upul Tharanga',
      age: 38,
      gender: 'Male',
      priority: 'normal',
      status: 'in_consultation',
      reason: 'Ankle Sprain Bandage Check',
      bloodPressure: '120/80',
      heartRate: '71 bpm',
      fileRecord: 'REC-201',
      checkedInTime: '08:35 AM',
      calledAtTime: '08:45',
    },
    upcomingQueue: [
      {
        tokenNumber: 202,
        patientName: 'Shirani Nanayakkara',
        age: 53,
        gender: 'Female',
        priority: 'normal',
        category: 'all',
        status: 'next',
        reason: 'Insomnia & Anxiety Consultation',
        location: 'Ready at Lobby',
        arrivedTime: '08:50',
        vitalsVerified: true,
        slotTime: '09:10 AM',
      },
      {
        tokenNumber: 203,
        patientName: 'Chandana Karunaratne',
        age: 49,
        gender: 'Male',
        priority: 'normal',
        category: 'all',
        status: 'Checked In • Ready',
        reason: 'Urine Culture Follow-up',
        location: 'Waiting Area',
        arrivedTime: '09:05',
        vitalsVerified: true,
        slotTime: '09:25 AM',
      },
      {
        tokenNumber: 204,
        patientName: 'Indrani Cooray',
        age: 65,
        gender: 'Female',
        priority: 'elderly',
        category: 'priority',
        status: 'Waiting',
        reason: 'Joint Pain & Physiotherapy',
        location: 'Waiting Area',
        arrivedTime: '09:15',
        vitalsVerified: true,
        slotTime: '09:40 AM',
      },
      {
        tokenNumber: 205,
        patientName: 'Ranil Wickramatunga',
        age: 56,
        gender: 'Male',
        priority: 'urgent',
        category: 'priority',
        status: 'Waiting',
        reason: 'Cardiac Wellness Check',
        location: 'Waiting Area',
        arrivedTime: '09:30',
        vitalsVerified: false,
        slotTime: '09:55 AM',
      },
      {
        tokenNumber: 206,
        patientName: 'Menaka Hettiarachchi',
        age: 34,
        gender: 'Female',
        priority: 'walkin',
        category: 'walkin',
        status: 'Waiting',
        reason: 'Vitamin D Deficiency Follow-up',
        location: 'Waiting Area',
        arrivedTime: '09:45',
        vitalsVerified: true,
        slotTime: '10:10 AM',
      },
    ],
  },
};

export const getDoctorDashboardForHospital = (hospitalName: string): DoctorDashboardData => {
  return HOSPITAL_DASHBOARDS[hospitalName] || HOSPITAL_DASHBOARDS['Colombo Teaching Hospital 1'];
};

// Fallback data matching default hospital
const fallbackDoctorData: DoctorDashboardData = HOSPITAL_DASHBOARDS['Colombo Teaching Hospital 1'];

const getDoctorAuthContext = async (doctorId?: string) => {
  let resolvedDoctorId = doctorId;
  let token: string | null = null;
  try {
    const userStr = await AsyncStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (!resolvedDoctorId && (user.doctorId || (user.role && user.role.toLowerCase() === 'doctor'))) {
        resolvedDoctorId = user.doctorId || user._id;
      }
      if (user.token) token = user.token;
    }
    if (!token) {
      token = await AsyncStorage.getItem('token');
    }
  } catch (e) {}

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return { resolvedDoctorId, headers };
};

export const fetchDoctorDashboard = async (
  doctorId?: string,
  hospitalName?: string
): Promise<DoctorDashboardData> => {
  let activeHosp = hospitalName;
  if (!activeHosp) {
    try {
      activeHosp = (await AsyncStorage.getItem('doctor_current_hospital')) || undefined;
      if (!activeHosp && typeof window !== 'undefined' && (window as any).localStorage) {
        activeHosp = (window as any).localStorage.getItem('doctor_current_hospital') || undefined;
      }
    } catch (e) {}
  }
  const fallback = getDoctorDashboardForHospital(activeHosp || 'Colombo Teaching Hospital 1');
  try {
    const { resolvedDoctorId, headers } = await getDoctorAuthContext(doctorId);
    const params = new URLSearchParams();
    if (resolvedDoctorId) params.append('doctorId', resolvedDoctorId);
    if (activeHosp) params.append('hospitalName', activeHosp);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const url = `${API_URL}/doctor/dashboard${qs}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return fallback;
    }

    const json = await response.json();
    return json.data || fallback;
  } catch (error) {
    console.log('Using local fallback doctor dashboard data:', error);
    return fallback;
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

export const updateDoctorHospitalApi = async (
  hospitalName: string,
  hospitalId?: string,
  doctorId?: string
): Promise<boolean> => {
  try {
    const response = await fetch(`${API_URL}/doctor/hospital`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hospitalName, hospitalId, doctorId }),
    });
    return response.ok;
  } catch (error) {
    console.log('Hospital update offline mode');
    return true;
  }
};

export const fetchDoctorHospitalsApi = async (): Promise<any[]> => {
  try {
    const response = await fetch(`${API_URL}/doctor/hospitals`);
    if (response.ok) {
      const json = await response.json();
      return json.data || [];
    }
    return [];
  } catch (error) {
    return [];
  }
};

export const PATIENT_CATALOG = [
  { name: 'Sunil Shantha', age: 52, gender: 'Male', reason: 'Hypertension Follow-up', bp: '130/85', hr: '74 bpm' },
  { name: 'Kanthi Rajapaksha', age: 46, gender: 'Female', reason: 'Diabetes Screening', bp: '122/80', hr: '76 bpm' },
  { name: 'Nihal Jayawardena', age: 60, gender: 'Male', reason: 'Chest Discomfort Checkup', bp: '138/88', hr: '82 bpm' },
  { name: 'Anoma Wickramasinghe', age: 39, gender: 'Female', reason: 'Migraine Consultation', bp: '118/76', hr: '70 bpm' },
  { name: 'Bandula Gunasekara', age: 64, gender: 'Male', reason: 'Chronic Knee Pain', bp: '125/82', hr: '72 bpm' },
  { name: 'Malkanthi Silva', age: 43, gender: 'Female', reason: 'Routine Physical Exam', bp: '115/75', hr: '68 bpm' },
  { name: 'Dhammika Perera', age: 50, gender: 'Male', reason: 'Cholesterol Review', bp: '128/84', hr: '75 bpm' },
  { name: 'Sujatha Alwis', age: 57, gender: 'Female', reason: 'Thyroid Medication Review', bp: '120/78', hr: '71 bpm' },
  { name: 'Gamini Senanayake', age: 66, gender: 'Male', reason: 'Arthritis Follow-up', bp: '135/86', hr: '78 bpm' },
  { name: 'Rohini Jayasuriya', age: 48, gender: 'Female', reason: 'Gastritis & Acid Reflux', bp: '122/80', hr: '74 bpm' },
  { name: 'Prasanna Fernando', age: 35, gender: 'Male', reason: 'Lower Back Strain', bp: '120/80', hr: '72 bpm' },
  { name: 'Chitra Samaranayake', age: 59, gender: 'Female', reason: 'Osteoporosis Consultation', bp: '126/82', hr: '75 bpm' },
  { name: 'Mahinda Abeyrathne', age: 63, gender: 'Male', reason: 'Post-CABG Routine Check', bp: '130/80', hr: '70 bpm' },
  { name: 'Kumari Weerasinghe', age: 41, gender: 'Female', reason: 'Allergy & Sinus Review', bp: '118/74', hr: '69 bpm' },
  { name: 'Sarath Fonseka', age: 55, gender: 'Male', reason: 'Blood Sugar Monitoring', bp: '124/82', hr: '76 bpm' },
  { name: 'Manel Rathnayake', age: 51, gender: 'Female', reason: 'General OPD Consultation', bp: '120/78', hr: '73 bpm' },
  { name: 'Asoka Kulatunga', age: 47, gender: 'Male', reason: 'Skin Rash & Dermatology', bp: '118/78', hr: '72 bpm' },
  { name: 'Priyani Samarasekera', age: 44, gender: 'Female', reason: 'Fatigue & Blood Work Review', bp: '116/76', hr: '70 bpm' },
  { name: 'Lalith Jayatilleke', age: 58, gender: 'Male', reason: 'ECG Review & Follow-up', bp: '132/85', hr: '77 bpm' },
  { name: 'Pushpa Dissanayake', age: 62, gender: 'Female', reason: 'Hypertension Follow-up', bp: '136/84', hr: '79 bpm' },
  { name: 'Upul Tharanga', age: 38, gender: 'Male', reason: 'Ankle Sprain Bandage Check', bp: '120/80', hr: '71 bpm' },
  { name: 'Shirani Nanayakkara', age: 53, gender: 'Female', reason: 'Insomnia & Anxiety Consultation', bp: '124/82', hr: '75 bpm' },
  { name: 'Chandana Karunaratne', age: 49, gender: 'Male', reason: 'Urine Culture Follow-up', bp: '122/78', hr: '73 bpm' },
  { name: 'Indrani Cooray', age: 65, gender: 'Female', reason: 'Joint Pain & Physiotherapy', bp: '130/84', hr: '76 bpm' },
  { name: 'Ranil Wickramatunga', age: 56, gender: 'Male', reason: 'Cardiac Wellness Check', bp: '128/82', hr: '74 bpm' },
  { name: 'Menaka Hettiarachchi', age: 34, gender: 'Female', reason: 'Vitamin D Deficiency Follow-up', bp: '114/74', hr: '68 bpm' },
  { name: 'Sanath Jayasuriya', age: 54, gender: 'Male', reason: 'Shoulder Impingement', bp: '126/80', hr: '72 bpm' },
  { name: 'Kamal Gunaratne', age: 48, gender: 'Male', reason: 'Spine Checkup', bp: '124/82', hr: '76 bpm' },
];

export const getCatalogPatient = (tokenNum: number) => {
  const idx = Math.max(0, tokenNum - 1) % PATIENT_CATALOG.length;
  const p = PATIENT_CATALOG[idx];
  return {
    tokenNumber: tokenNum,
    patientName: p.name,
    age: p.age,
    gender: p.gender,
    priority: (tokenNum % 3 === 0 ? 'urgent' : 'normal') as 'normal' | 'urgent',
    status: 'in_consultation',
    reason: p.reason,
    bloodPressure: p.bp,
    heartRate: p.hr,
    fileRecord: `REC-${800 + tokenNum}`,
    checkedInTime: '08:15 AM',
    calledAtTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
};

export const callNextPatientApi = async (): Promise<any> => {
  try {
    const { resolvedDoctorId, headers } = await getDoctorAuthContext();
    const response = await fetch(`${API_URL}/doctor/call-next`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ doctorId: resolvedDoctorId }),
    });
    return await response.json();
  } catch (error) {
    console.log('Call next patient offline mode');
    return { success: true, message: 'Called next token (offline mode)' };
  }
};

export const undoPatientApi = async (): Promise<any> => {
  try {
    const { resolvedDoctorId, headers } = await getDoctorAuthContext();
    const activeHosp =
      (await AsyncStorage.getItem('doctor_current_hospital')) ||
      (typeof window !== 'undefined' && (window as any).localStorage?.getItem('doctor_current_hospital')) ||
      undefined;
    const response = await fetch(`${API_URL}/doctor/undo-patient`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ doctorId: resolvedDoctorId, hospitalName: activeHosp }),
    });
    return await response.json();
  } catch (error) {
    console.log('Undo patient offline mode');
    return null;
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
    const { resolvedDoctorId, headers } = await getDoctorAuthContext();
    const response = await fetch(`${API_URL}/doctor/call-token`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tokenNumber, doctorId: resolvedDoctorId }),
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
    name: 'Dr. Palitha Perera',
    room: 'Room 101',
    status: 'active',
    avatarUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=200',
  },
  dateHeader: formatRealtimeDateHeader(new Date()),
  selectedDayKey: toDateKey(new Date()),
  weekDays: getRealtimeWeekDays(new Date()),
  shift: {
    title: 'Morning OPD Shift',
    timeRange: '08:00 AM – 12:30 PM',
    room: 'Room 101',
    status: 'In Progress',
    consultedCount: 0,
    waitingCount: 0,
    totalCapacity: 30,
    avgMinutesPerPatient: 10,
    remainingWalkinSlots: 5,
    isOnBreak: false,
  },
  timeline: [],
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

