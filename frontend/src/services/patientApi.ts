import { http } from './http';
import type { DashboardPayload, PatientProfile } from '../types/patient';

export const patientApi = {
  getProfile: () => http.get<{ patient: PatientProfile }>('/patients/me'),

  getDashboard: () => http.get<DashboardPayload>('/patients/me/dashboard'),
};
