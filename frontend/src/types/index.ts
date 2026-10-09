// Global TypeScript interfaces for Medi-Queue

// Existing User interface preserved
export interface User {
  id: string;
  name: string;
  email: string;
}

// ─────────────────────────────────────────────────────────
// Patient Types
// ─────────────────────────────────────────────────────────

export interface EmergencyContact {
  name?: string;
  relationship?: string;
  phone?: string;
}

export interface Allergy {
  name?: string;
  severity?: string;
}

export interface PatientVisitHistoryItem {
  _id: string;
  date: string;
  slotTime: string;
  doctor?: string | null;
  doctorName?: string | null;
  doctorDetails?: {
    _id: string;
    name: string;
    specialization?: string;
    department?: string;
    room?: string;
  } | null;
  department?: string;
  status?: string;
  type?: string;
  tokenNumber?: number;
  priority?: QueuePriority;
  notes?: string;
  createdAt?: string;
}

export interface Patient {
  _id: string;
  id?: string;
  fullName: string;
  nic?: string;
  nicVerified?: boolean;
  phone: string;
  dob?: string | Date;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  address?: string;
  district?: string;
  emergencyContact?: EmergencyContact;
  bloodGroup?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  allergies?: Allergy[];
  registeredVia?: 'app' | 'reception';
  status?: 'Active' | 'Inactive';
  patientNo?: string;
  isDeleted?: boolean;
  createdBy?: string;
  visitHistory?: PatientVisitHistoryItem[];
  latestVisitDate?: string;
  latestVisitSlotTime?: string;
  latestType?: 'walk_in' | 'pre_booked' | string;
  latestDoctorName?: string;
  latestDepartment?: string;
  latestTokenNumber?: number;
  latestStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─────────────────────────────────────────────────────────
// Doctor Types
// ─────────────────────────────────────────────────────────

export interface WorkingHours {
  start?: string;
  end?: string;
}

export interface Doctor {
  _id: string;
  id?: string;
  name: string;
  specialization: string;
  department: string;
  room?: string;
  status: 'active' | 'on_break' | 'offline';
  dailyCapacity?: number;
  avgConsultMinutes?: number;
  workingHours?: WorkingHours;
  todayPatients?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ─────────────────────────────────────────────────────────
// Appointment Types
// ─────────────────────────────────────────────────────────

export type AppointmentType = 'walk_in' | 'pre_booked';

export type AppointmentStatus =
  | 'booked'
  | 'checked_in'
  | 'in_consultation'
  | 'completed'
  | 'no_show'
  | 'cancelled';

export interface Appointment {
  _id: string;
  id?: string;
  patient: string | Patient;
  doctor: string | Doctor;
  department: string;
  date: string; // YYYY-MM-DD
  slotTime: string; // HH:mm
  type: AppointmentType;
  status: AppointmentStatus;
  bookedBy?: string;
  tokenNumber?: number;
  notes?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// ─────────────────────────────────────────────────────────
// Queue Token Types
// ─────────────────────────────────────────────────────────

export type QueueTokenStatus = 'waiting' | 'called' | 'serving' | 'done' | 'no_show';

export type QueuePriority = 'normal' | 'senior' | 'urgent';

export interface QueueToken {
  _id: string;
  id?: string;
  appointment: string | Appointment;
  patient: string | Patient;
  department?: string;
  date: string; // YYYY-MM-DD
  tokenNumber: number;
  tokenLabel: string; // e.g. "OPD-001"
  status: QueueTokenStatus;
  priority: QueuePriority;
  assignedDoctor?: string | Doctor | null;
  calledAt?: string | Date;
  servedAt?: string | Date;
  moveBackCount?: number;
  sortOffset?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ─────────────────────────────────────────────────────────
// Reception Dashboard Types
// ─────────────────────────────────────────────────────────

export interface DashboardIntake {
  total: number;
  walkIn: number;
  preBooked: number;
}

export interface CurrentlyServingPatient {
  name: string;
  age?: number;
  gender?: string;
  nic?: string;
}

export interface CurrentlyServingDoctor {
  _id?: string;
  name: string;
  department?: string;
}

export interface CurrentlyServingToken {
  tokenLabel: string;
  patient: CurrentlyServingPatient | null;
  doctor: CurrentlyServingDoctor | string | null;
  room: string | null;
}

export interface DashboardRoom {
  doctor: string;
  room: string;
  status: 'Consulting' | 'Available' | 'On Break';
  nextToken: string | null;
}

export interface DashboardData {
  date: string;
  intake: DashboardIntake;
  inWaiting: number;
  avgWaitMinutes: number;
  attendedDone: number;
  doctorsActive: number;
  currentlyServing: CurrentlyServingToken | null;
  rooms: DashboardRoom[];
  nextInQueue: QueueToken[];
  lastUpdated: string;
}

// ─────────────────────────────────────────────────────────
// Shift Summary Types
// ─────────────────────────────────────────────────────────

export interface ShiftDoctorSummary {
  _id: string;
  name: string;
  room: string | null;
  status: string;
  attended: number;
  capacity: number;
}

export interface ShiftSummary {
  date: string;
  totalRegistered: number;
  attended: number;
  noShows: number;
  cancelled: number;
  avgHandlingMinutes: number;
  throughputPercent: number;
  doctors: ShiftDoctorSummary[];
}
