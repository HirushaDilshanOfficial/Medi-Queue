import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  Patient,
  Doctor,
  Appointment,
  QueueToken,
  DashboardData,
  ShiftSummary,
  DoctorSchedule,
  DoctorScheduleDoctor,
  CreateDoctorSchedulePayload,
  UpdateDoctorSchedulePayload,
  GetSchedulesParams,
  SchedulesResponse,
  ScheduleResponse,
  DeleteScheduleResponse,
} from '../types';

export type {
  DoctorSchedule,
  DoctorScheduleDoctor,
  CreateDoctorSchedulePayload,
  UpdateDoctorSchedulePayload,
  GetSchedulesParams,
  SchedulesResponse,
  ScheduleResponse,
  DeleteScheduleResponse,
};

export const getApiBaseUrl = (): string => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    const hostname = window.location.hostname;
    return `http://${hostname === 'localhost' || hostname === '127.0.0.1' ? 'localhost' : hostname}:5001`;
  }

  // Prefer an explicit backend URL over the Expo development-server address.
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && !envUrl.includes('192.168.56.') && !envUrl.includes('192.168.1.2')) {
    return envUrl.includes(':5001') ? envUrl : `${envUrl.replace(/\/+$/, '')}:5001`;
  }

  // Fall back to the Expo host address for local development.
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1' && !ip.startsWith('192.168.56.')) {
      return `http://${ip}:5001`;
    }
  }

  return 'http://10.240.7.66:5001';
};

export const API_BASE_URL: string = getApiBaseUrl();

// Helper to normalize path and prepend API_BASE_URL
const resolveUrl = (path: string): string => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const base = getApiBaseUrl().replace(/\/+$/, '');
  const endpoint = path.startsWith('/') ? path : `/${path}`;
  return `${base}${endpoint}`;
};

// Global in-memory JWT token cache
let storedAuthToken: string | null = null;

export const setAuthToken = (token: string | null): void => {
  storedAuthToken = token;
};

export const getAuthToken = (): string | null => {
  return storedAuthToken;
};

export interface ApiRequestOptions extends RequestInit {
  token?: string;
}

/**
 * Unified helper to extract human-readable error messages from backend responses.
 */
export const getErrorMessage = (error: unknown): string => {
  if (!error) return 'An unexpected error occurred.';
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && 'message' in error) {
    return String((error as any).message);
  }
  return 'An unexpected error occurred. Please try again.';
};

const getHeaders = async (
  customHeaders?: HeadersInit,
  explicitToken?: string
): Promise<HeadersInit> => {
  let token = explicitToken || storedAuthToken;
  if (!token) {
    try {
      token =
        (await AsyncStorage.getItem('token')) ||
        (await AsyncStorage.getItem('jwt')) ||
        (await AsyncStorage.getItem('mediqueue_token')) ||
        (await AsyncStorage.getItem('authToken')) ||
        (await AsyncStorage.getItem('auth_token'));
      if (!token) {
        const userStr = await AsyncStorage.getItem('user');
        if (userStr) {
          try {
            const parsed = JSON.parse(userStr);
            token = parsed.token || null;
          } catch {}
        }
      }
      if (token) {
        storedAuthToken = token;
      }
    } catch {}
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((customHeaders as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const handleResponse = async <T>(
  response: Response,
  targetUrl: string
): Promise<T> => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        errorText || `Request failed with status ${response.status}`
      );
    }
    return (await response.text()) as unknown as T;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      data.message ||
      data.error ||
      (typeof data === 'string' ? data : null) ||
      `Request to ${targetUrl} failed with status ${response.status}`;
    const err = new Error(message);
    (err as any).status = response.status;
    (err as any).response = data;
    throw err;
  }
  return data as T;
};

export const api = {
  baseUrl: API_BASE_URL,
  get: async <T = any>(
    url: string,
    options?: ApiRequestOptions
  ): Promise<T> => {
    const targetUrl = resolveUrl(url);
    const headers = await getHeaders(options?.headers, options?.token);
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers,
      ...options,
    });
    return handleResponse<T>(response, targetUrl);
  },
  post: async <T = any>(
    url: string,
    data?: any,
    options?: ApiRequestOptions
  ): Promise<T> => {
    const targetUrl = resolveUrl(url);
    const headers = await getHeaders(options?.headers, options?.token);
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: data !== undefined ? JSON.stringify(data) : undefined,
      ...options,
    });
    return handleResponse<T>(response, targetUrl);
  },
  patch: async <T = any>(
    url: string,
    data?: any,
    options?: ApiRequestOptions
  ): Promise<T> => {
    const targetUrl = resolveUrl(url);
    const headers = await getHeaders(options?.headers, options?.token);
    const response = await fetch(targetUrl, {
      method: 'PATCH',
      headers,
      body: data !== undefined ? JSON.stringify(data) : undefined,
      ...options,
    });
    return handleResponse<T>(response, targetUrl);
  },
  put: async <T = any>(
    url: string,
    data?: any,
    options?: ApiRequestOptions
  ): Promise<T> => {
    const targetUrl = resolveUrl(url);
    const headers = await getHeaders(options?.headers, options?.token);
    const response = await fetch(targetUrl, {
      method: 'PUT',
      headers,
      body: data !== undefined ? JSON.stringify(data) : undefined,
      ...options,
    });
    return handleResponse<T>(response, targetUrl);
  },
  delete: async <T = any>(
    url: string,
    options?: ApiRequestOptions
  ): Promise<T> => {
    const targetUrl = resolveUrl(url);
    const headers = await getHeaders(options?.headers, options?.token);
    const response = await fetch(targetUrl, {
      method: 'DELETE',
      headers,
      ...options,
    });
    return handleResponse<T>(response, targetUrl);
  },
};

export const validateQueuePass = (passCode: string) =>
  api.get<{
    pass: {
      id: string;
      passCode: string;
      tokenNumber: number;
      tokenLabel: string;
      department: string;
      doctorName: string | null;
      room: string | null;
      queueDate: string;
      status: string;
    };
    patient: {
      id: string;
      fullName: string;
      nic: string | null;
      phone: string | null;
      email: string | null;
      gender: string | null;
    } | null;
  }>(`/api/v1/queue/pass/${encodeURIComponent(passCode)}`);

// ─────────────────────────────────────────────────────────
// Payload & Response Types for Receptionist API
// ─────────────────────────────────────────────────────────

export interface DoctorSlotsResponse {
  doctor: {
    id: string;
    name: string;
    department: string;
  };
  date: string;
  slots: Array<{
    time: string;
    status: 'available' | 'booked' | 'past';
  }>;
  earliestAvailable?: string | null;
}

export interface WalkInPatientInput {
  fullName: string;
  phone: string;
  nic?: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  dob?: string | Date;
  address?: string;
  district?: string;
  bloodGroup?: string;
}

export interface WalkInPayload {
  patient?: WalkInPatientInput;
  existingPatientId?: string;
  appointmentId?: string;
  department: string;
  doctorId: string;
  date: string;
  slotTime?: string;
  priority?: 'normal' | 'senior' | 'urgent';
  type?: 'walk_in' | 'pre_booked';
  intakeType?: 'walk_in' | 'pre_booked';
}

export interface PreBookedAppointment {
  _id: string;
  bookingRef: string;
  date: string;
  slotTime: string;
  department: string;
  status: string;
  type: string;
  priority?: 'normal' | 'senior' | 'urgent';
  tokenNumber?: number | null;
  tokenLabel?: string | null;
  queueStatus?: string | null;
  patient: {
    _id: string;
    fullName: string;
    nic: string;
    phone: string;
    age?: number;
    gender?: 'male' | 'female' | 'other';
  } | null;
  doctor: {
    _id: string;
    name: string;
    department?: string;
    room?: string;
  } | null;
}

export interface WalkInResponse {
  isNewPatient: boolean;
  patient: Patient;
  appointment: Appointment;
  token: {
    tokenLabel: string;
    tokenNumber: number;
  };
  doctor: {
    name: string;
    department?: string;
    room?: string;
  };
  estimatedWaitMinutes?: number;
  patientsAhead?: number;
  smsNotification?: {
    sent: boolean;
    recipient: string;
    patientName?: string;
    tokenLabel?: string;
    message: string;
    sentAt: string;
  };
}

export interface SendPatientOtpResponse {
  success: boolean;
  message: string;
  phone: string;
  otp?: string;
  expiresAt?: number;
  smsDispatched?: boolean;
}

export interface VerifyPatientOtpResponse {
  success: boolean;
  verified: boolean;
  message: string;
  phone?: string;
}

export interface GetQueueParams {
  date?: string;
  department?: string;
  doctorId?: string;
  status?: string;
  type?: 'all' | 'walk_in' | 'pre_booked' | string;
}

export interface QueueResponse {
  date: string;
  total?: number;
  waiting?: number;
  serving?: number;
  queue: QueueToken[];
  doctors?: Doctor[];
  totals?: {
    inQueue: number;
    walkIns: number;
    preBooked: number;
    avgWaitMinutes: number;
  };
  lastUpdated: string;
}

export interface CallNextParams {
  date?: string;
  department?: string;
  doctorId?: string;
  doctor?: string;
}

export interface CallNextResponse {
  message?: string;
  tokenLabel: string;
  tokenNumber?: number;
  patient: {
    _id?: string;
    fullName?: string;
    name?: string;
    nic?: string;
    phone?: string;
    age?: number;
    gender?: string;
  };
  doctor: {
    _id?: string;
    name: string;
    department?: string;
  };
  room?: string;
}

// ─────────────────────────────────────────────────────────
// Typed Receptionist API Functions
// ─────────────────────────────────────────────────────────

/**
 * Search patients by NIC or phone number (min 3 characters).
 */
export const searchPatients = async (
  query: string,
  token?: string
): Promise<{ found: boolean; patients: Patient[] }> => {
  return api.get<{ found: boolean; patients: Patient[] }>(
    `/api/reception/patients/search?q=${encodeURIComponent(query)}`,
    { token }
  );
};

/**
 * Get available 15-minute time slots for a doctor on a specific date.
 */
export const getSlots = async (
  doctorId: string,
  date: string,
  token?: string
): Promise<DoctorSlotsResponse> => {
  return api.get<DoctorSlotsResponse>(
    `/api/reception/slots?doctorId=${encodeURIComponent(
      doctorId
    )}&date=${encodeURIComponent(date)}`,
    { token }
  );
};

/**
 * Register a walk-in patient, create appointment, and generate OPD token.
 */
export const createWalkIn = async (
  data: WalkInPayload,
  token?: string
): Promise<WalkInResponse> => {
  return api.post<WalkInResponse>('/api/reception/walk-in', data, { token });
};

/**
 * Dispatch 6-digit verification OTP to patient mobile number.
 */
export const sendPatientOtp = async (
  phone: string,
  patientName?: string,
  token?: string
): Promise<SendPatientOtpResponse> => {
  return api.post<SendPatientOtpResponse>(
    '/api/reception/send-otp',
    { phone, patientName },
    { token }
  );
};

/**
 * Verify 6-digit OTP entered for patient telephone number.
 */
export const verifyPatientOtp = async (
  phone: string,
  otp: string,
  token?: string
): Promise<VerifyPatientOtpResponse> => {
  return api.post<VerifyPatientOtpResponse>(
    '/api/reception/verify-otp',
    { phone, otp },
    { token }
  );
};

/**
 * List or search pre-booked appointments for today or a specific date.
 */
export const getPreBookedAppointments = async (
  date?: string,
  query?: string,
  token?: string
): Promise<{ success: boolean; count: number; appointments: PreBookedAppointment[] }> => {
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  if (query) params.append('q', query);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return api.get<{ success: boolean; count: number; appointments: PreBookedAppointment[] }>(
    `/api/reception/pre-booked${qs}`,
    { token }
  );
};

/**
 * Get the live ordered queue with totals and wait times.
 */
export const getQueue = async (
  params?: GetQueueParams | 'all' | 'walk_in' | 'pre_booked',
  token?: string
): Promise<QueueResponse> => {
  const query = new URLSearchParams();
  if (typeof params === 'string') {
    if (params && params !== 'all') query.append('type', params);
  } else if (params) {
    if (params.date) query.append('date', params.date);
    if (params.department) query.append('department', params.department);
    if (params.doctorId) query.append('doctorId', params.doctorId);
    if (params.status) query.append('status', params.status);
    if (params.type && params.type !== 'all') query.append('type', params.type);
  }
  const qs = query.toString() ? `?${query.toString()}` : '';
  return api.get<QueueResponse>(`/api/reception/queue${qs}`, { token });
};

/**
 * Call the next waiting patient in the queue.
 */
export const callNext = async (
  params?: CallNextParams,
  token?: string
): Promise<CallNextResponse> => {
  return api.post<CallNextResponse>(
    '/api/reception/queue/call-next',
    params || {},
    { token }
  );
};

/**
 * Recall a previously called token.
 */
export const recallToken = async (
  tokenId: string,
  token?: string
): Promise<{ message: string; token: QueueToken }> => {
  return api.post<{ message: string; token: QueueToken }>(
    `/api/reception/queue/${tokenId}/recall`,
    {},
    { token }
  );
};

/**
 * Mark a token & appointment as no-show.
 */
export const markNoShow = async (
  tokenId: string,
  token?: string
): Promise<{ message: string; token: QueueToken }> => {
  return api.post<{ message: string; token: QueueToken }>(
    `/api/reception/queue/${tokenId}/no-show`,
    {},
    { token }
  );
};

/**
 * Move a waiting token 3 positions back in the queue.
 */

/**
 * Mark a waiting token as urgent.
 */
export const markTokenUrgent = async (
  tokenId: string,
  token?: string
): Promise<{ success: boolean; token: QueueToken }> => {
  return api.post<{ success: boolean; token: QueueToken }>(
    `/api/reception/queue/${tokenId}/urgent`,
    {},
    { token }
  );
};

export const moveBack = async (
  tokenId: string,
  token?: string
): Promise<{ message: string; token: QueueToken }> => {
  return api.post<{ message: string; token: QueueToken }>(
    `/api/reception/queue/${tokenId}/move-back`,
    {},
    { token }
  );
};

/**
 * Reassign a doctor to a queue token and appointment.
 */
export const assignDoctor = async (
  tokenId: string,
  doctorId: string,
  token?: string
): Promise<{ message: string; token: QueueToken; doctor: Doctor }> => {
  return api.patch<{ message: string; token: QueueToken; doctor: Doctor }>(
    `/api/reception/queue/${tokenId}/assign-doctor`,
    { doctorId },
    { token }
  );
};

/**
 * Get the live reception dashboard overview (intake, waiting, serving, rooms, next 3 tokens).
 */
export const getDashboard = async (
  date?: string,
  token?: string
): Promise<DashboardData> => {
  const qs = date ? `?date=${encodeURIComponent(date)}` : '';
  return api.get<DashboardData>(`/api/reception/dashboard${qs}`, { token });
};

/**
 * List patients filtered by visited_today, recent (last 30 days), or all.
 */
export const getPatients = async (
  filter?: 'visited_today' | 'recent' | 'all' | 'walk_in' | 'pre_booked',
  token?: string
): Promise<Patient[]> => {
  const qs = filter ? `?filter=${encodeURIComponent(filter)}` : '';
  return api.get<Patient[]>(`/api/reception/patients${qs}`, { token });
};

/**
 * Get full patient profile and visit history.
 */
export const getPatient = async (
  patientId: string,
  token?: string
): Promise<Patient> => {
  return api.get<Patient>(
    `/api/reception/patients/${encodeURIComponent(patientId)}`,
    { token }
  );
};

/**
 * Update patient contact, address, or medical details.
 */
export const updatePatient = async (
  patientId: string,
  updates: Partial<Patient>,
  token?: string
): Promise<{ message: string; patient: Patient }> => {
  return api.patch<{ message: string; patient: Patient }>(
    `/api/reception/patients/${encodeURIComponent(patientId)}`,
    updates,
    { token }
  );
};

/**
 * Verify a patient's National Identity Card (NIC).
 */
export const verifyNic = async (
  patientId: string,
  token?: string
): Promise<{ message: string; patient: Patient }> => {
  return api.post<{ message: string; patient: Patient }>(
    `/api/reception/patients/${encodeURIComponent(patientId)}/verify-nic`,
    {},
    { token }
  );
};

/**
 * List doctors with capacity and active patients today (optional department filter).
 */
export const getDoctors = async (
  department?: string,
  token?: string
): Promise<Doctor[]> => {
  const qs = department ? `?department=${encodeURIComponent(department)}` : '';
  return api.get<Doctor[]>(`/api/reception/doctors${qs}`, { token });
};

/**
 * Get the daily shift summary snapshot and throughput metrics.
 */
export const getShiftSummary = async (
  date?: string,
  token?: string
): Promise<ShiftSummary> => {
  const qs = date ? `?date=${encodeURIComponent(date)}` : '';
  return api.get<ShiftSummary>(`/api/reception/shift/summary${qs}`, { token });
};

/**
 * Close the receptionist's daily shift and record final summary snapshot.
 */
export const closeShift = async (
  token?: string
): Promise<{ message: string; shift: any; summary: ShiftSummary }> => {
  return api.post<{ message: string; shift: any; summary: ShiftSummary }>(
    '/api/reception/shift/close',
    {},
    { token }
  );
};

/**
 * Export and download today's appointments and tokens as a CSV string.
 */
export const downloadDailyReport = async (
  date?: string,
  token?: string
): Promise<string> => {
  const qs = date ? `&date=${encodeURIComponent(date)}` : '';
  return api.get<string>(`/api/reception/reports/daily?format=csv${qs}`, {
    token,
    headers: { Accept: 'text/csv' },
  });
};

/**
 * Get Auto-Advance queue setting.
 */
export const getAutoAdvance = async (
  token?: string
): Promise<{ success: boolean; enabled: boolean }> => {
  return api.get<{ success: boolean; enabled: boolean }>(
    '/api/reception/queue/auto-advance',
    { token }
  );
};

/**
 * Update Auto-Advance queue setting.
 */
export const updateAutoAdvance = async (
  enabled: boolean,
  token?: string
): Promise<{ success: boolean; enabled: boolean }> => {
  return api.patch<{ success: boolean; enabled: boolean }>(
    '/api/reception/queue/auto-advance',
    { enabled },
    { token }
  );
};

/**
 * Complete serving token consultation at counter.
 */
export const completeToken = async (
  tokenLabelOrId?: string,
  token?: string
): Promise<{ success: boolean; tokenLabel: string; status: string }> => {
  const endpoint = tokenLabelOrId
    ? `/api/reception/queue/${encodeURIComponent(tokenLabelOrId)}/complete`
    : '/api/reception/queue/complete';
  return api.post<{ success: boolean; tokenLabel: string; status: string }>(
    endpoint,
    {},
    { token }
  );
};

// ─────────────────────────────────────────────────────────
// Doctor Schedule Management API
// ─────────────────────────────────────────────────────────

/**
 * Create a new doctor schedule.
 */
export const createSchedule = async (
  data: CreateDoctorSchedulePayload,
  token?: string
): Promise<ScheduleResponse> => {
  return api.post<ScheduleResponse>('/api/reception/schedules', data, { token });
};

/**
 * List doctor schedules filtered by date and/or doctorId.
 */
export const getSchedules = async (
  params?: string | GetSchedulesParams,
  token?: string
): Promise<SchedulesResponse> => {
  const query = new URLSearchParams();
  if (typeof params === 'string') {
    if (params) query.append('date', params);
  } else if (params) {
    if (params.date) query.append('date', params.date);
    if (params.doctorId) query.append('doctorId', params.doctorId);
  }
  const qs = query.toString() ? `?${query.toString()}` : '';
  return api.get<SchedulesResponse>(`/api/reception/schedules${qs}`, { token });
};

/**
 * Update an existing doctor schedule (times, slotMinutes, maxPatients, status, notes).
 */
export const updateSchedule = async (
  id: string,
  data: UpdateDoctorSchedulePayload,
  token?: string
): Promise<ScheduleResponse> => {
  return api.put<ScheduleResponse>(
    `/api/reception/schedules/${encodeURIComponent(id)}`,
    data,
    { token }
  );
};

/**
 * Delete a doctor schedule (only if no active appointments exist in range).
 */
export const deleteSchedule = async (
  id: string,
  token?: string
): Promise<DeleteScheduleResponse> => {
  return api.delete<DeleteScheduleResponse>(
    `/api/reception/schedules/${encodeURIComponent(id)}`,
    { token }
  );
};

export default api;
