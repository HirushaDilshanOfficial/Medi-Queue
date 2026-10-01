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
  room: string | null;
  position: number | null;
  estimatedTurnAt: string | null;
  status: string;
};

export type NextAppointment = {
  id: string;
  doctorName: string;
  department: string;
  date: string;
  dateLabel: string | null;
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

export type AppointmentStatus =
  | 'booked'
  | 'checked_in'
  | 'in_consultation'
  | 'completed'
  | 'no_show'
  | 'cancelled';

export type QueueStatus = 'waiting' | 'called' | 'in_consultation' | 'completed' | 'no_show' | 'cancelled';

// Position and ETA for a checked-in patient. `servingNow` is who is in the room,
// which is what patients actually want to know.
export type LiveQueueState = {
  position: number;
  peopleAhead: number;
  waitMinutes: number;
  estimatedTurnAt: string | null;
  avgConsultMinutes: number;
  servingNow: { tokenNumber: number; doctorName: string | null } | null;
};

export type Appointment = {
  id: string;
  doctorId: string | null;
  doctorName: string;
  department: string;
  room: string | null;
  date: string;
  dateLabel: string | null;
  dateLong: string | null;
  slotTime: string;
  endsAt: string | null;
  type: 'walk_in' | 'pre_booked';
  status: AppointmentStatus;
  isActive: boolean;
  tokenNumber: number | null;
  queueEntryId: string | null;
  reason: string | null;
  canReschedule: boolean;
  canCancel: boolean;
  live: LiveQueueState | null;
  createdAt: string | null;
};

export type BookingSummary = {
  upcomingCount: number;
  hasAppointmentToday: boolean;
  next: Appointment | null;
};

export type BookableDay = {
  date: string;
  slotsRemaining: number;
};

export type SlotOption = {
  id: string;
  time: string;
  endsAt: string | null;
  capacity: number;
  remaining: number;
  available: boolean;
};

export type QueuePass = {
  id: string;
  appointmentId: string | null;
  department: string;
  queueDate: string;
  dateLabel: string;
  dateLong: string;
  tokenNumber: number;
  tokenLabel: string;
  passCode: string;
  qrValue: string;
  doctorName: string | null;
  room: string | null;
  priority: 'normal' | 'urgent';
  status: QueueStatus;
  checkedInAt: string | null;
  calledAt: string | null;
  live: LiveQueueState | null;
};

export type QueueBoard = {
  department: string;
  queueDate: string;
  waiting: number;
  updatedAt: string;
  serving: {
    tokenNumber: number;
    status: QueueStatus;
    doctorName: string | null;
    room: string | null;
    checkedInAt: string;
  }[];
};

export type LiveDepartment = {
  department: string;
  waiting: number;
  nowServing: number | null;
};

