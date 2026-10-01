export type Gender = 'male' | 'female' | 'other' | null;

export type BloodGroup =
  | 'A+'
  | 'A-'
  | 'B+'
  | 'B-'
  | 'AB+'
  | 'AB-'
  | 'O+'
  | 'O-'
  | null;

export type EmergencyContact = {
  name?: string;
  relationship?: string;
  phone?: string;
} | null;

export type PatientProfile = {
  id: string;
  fullName: string;
  nic: string | null;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  age: number | null;
  gender: Gender;
  address: string | null;
  district: string | null;
  bloodGroup: BloodGroup;
  allergies: string[];
  emergencyContact: EmergencyContact;
  favouriteDepartment: string | null;
  remindersEnabled: boolean;
};

export type DashboardStats = {
  totalDoctors: number;
  activeDoctors: number;
  departments: number;
  upcomingAppointments: number | null;
  completedVisits: number | null;
  activePass: QueuePassSummary | null;
};

export type QueuePassSummary = {
  tokenNumber: number;
  department: string;
  position: number;
  status: string;
};

export type NextAppointment = {
  id: string;
  doctorName: string;
  department: string;
  date: string;
  slotTime: string;
  tokenNumber: number | null;
  status: string;
} | null;

export type DashboardPayload = {
  patient: PatientProfile;
  stats: DashboardStats;
  nextAppointment: NextAppointment;
  recentActivity: unknown[];
};

export type Doctor = {
  id: string;
  name: string;
  displayName: string;
  firstName: string;
  title: string;
  initials: string;
  avatarUrl: string | null;
  specialization: string;
  department: string;
  qualifications: string;
  languages: string[];
  about: string;
  room: string | null;
  status: 'active' | 'on_break' | 'offline' | string;
  isAvailable: boolean;
  dailyCapacity: number;
  avgConsultMinutes: number;
  workingHours: { start: string | null; end: string | null };
  rating: number | null;
  reviewCount: number;
  fee: number | null;
  createdAt: string | null;
};
