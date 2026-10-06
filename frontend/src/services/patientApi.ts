import { http } from './http';
import type {
  DashboardPayload,
  HistoryPayload,
  MedicalReport,
  PatientProfile,
  ProfileDraft,
  ReportDraft,
} from '../types/patient';

export const patientApi = {
  getProfile: () => http.get<{ patient: PatientProfile }>('/patients/me'),

  updateProfile: (draft: ProfileDraft) =>
    http.patch<{ patient: PatientProfile }>('/patients/me', draft),

  getDashboard: () => http.get<DashboardPayload>('/patients/me/dashboard'),

  getHistory: () => http.get<HistoryPayload>('/patients/me/history'),

  getReports: () => http.get<{ reports: MedicalReport[] }>('/patients/me/reports'),

  createReport: (draft: ReportDraft) =>
    http.post<{ report: MedicalReport }>('/patients/me/reports', draft),

  deleteReport: (id: string) => http.delete<{ message: string }>(`/patients/me/reports/${id}`),
};
