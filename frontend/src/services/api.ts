/**
 * API service configuration and typed receptionist endpoint functions.
 * Reads backend API URL from EXPO_PUBLIC_API_URL. Never uses localhost.
 */

import {
  Patient,
  Doctor,
  Appointment,
  QueueToken,
  DashboardData,
  ShiftSummary,
} from '../types';

const FALLBACK_IP_URL = 'http://10.240.7.66:5001';

export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL || FALLBACK_IP_URL;

// Helper to normalize path and prepend API_BASE_URL
const resolveUrl = (path: string): string => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const base = API_BASE_URL.replace(/\/+$/, '');
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

const getHeaders = (
  customHeaders?: HeadersInit,
  explicitToken?: string
): HeadersInit => {
  const token = explicitToken || storedAuthToken;
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
    const headers = getHeaders(options?.headers, options?.token);
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
    const headers = getHeaders(options?.headers, options?.token);
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
    const headers = getHeaders(options?.headers, options?.token);
    const response = await fetch(targetUrl, {
      method: 'PATCH',
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
    const headers = getHeaders(options?.headers, options?.token);
    const response = await fetch(targetUrl, {
      method: 'DELETE',
      headers,
      ...options,
    });
    return handleResponse<T>(response, targetUrl);
  },
};

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
  department: string;
  doctorId: string;
  date: string;
  slotTime?: string;
  priority?: 'normal' | 'senior' | 'urgent';
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
    department: string;
    room?: string;
  };
  estimatedWaitMinutes?: number;
}

export interface GetQueueParams {
  date?: string;
  department?: string;
  doctorId?: string;
  status?: string;
}

export interface QueueResponse {
  date: string;
  total: number;
  waiting: number;
  serving: number;
  queue: QueueToken[];
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
 * Get the live ordered queue with totals and wait times.
 */
export const getQueue = async (
  params?: GetQueueParams,
  token?: string
): Promise<QueueResponse> => {
  const query = new URLSearchParams();
  if (params?.date) query.append('date', params.date);
  if (params?.department) query.append('department', params.department);
  if (params?.doctorId) query.append('doctorId', params.doctorId);
  if (params?.status) query.append('status', params.status);
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
  filter?: 'visited_today' | 'recent' | 'all',
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

export default api;
