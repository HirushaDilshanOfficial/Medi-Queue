import { http } from './http';
import { API_URL } from '../config';
import { getAuthToken } from './http';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
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

  getReport: (id: string) =>
    http.get<{ report: MedicalReport }>(`/patients/me/reports/${id}`),

  createReport: (draft: ReportDraft) =>
    http.post<{ report: MedicalReport }>('/patients/me/reports', draft),

  uploadReport: (form: FormData) =>
    http.postForm<{ report: MedicalReport }>('/patients/me/reports', form),

  updateReport: (id: string, form: FormData) =>
    http.patchForm<{ report: MedicalReport }>(`/patients/me/reports/${id}`, form),

  openReportFile: async (report: MedicalReport): Promise<void> => {
    if (!report.fileUrl) throw new Error('This report has no attached file.');
    const token = await getAuthToken();
    if (!token) throw new Error('Please sign in again to open this file.');

    const fileUrl = /^https?:\/\//i.test(report.fileUrl)
      ? report.fileUrl
      : `${API_URL}${report.fileUrl.replace(/^\/api\/v1/, '')}`;

    if (typeof window === 'undefined') {
      const baseDirectory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!baseDirectory) throw new Error('File storage is unavailable on this device.');
      const safeName = (report.fileName || `report-${report.id}`).replace(/[^\w.-]/g, '_');
      const target = `${baseDirectory}${safeName}`;
      const result = await FileSystem.downloadAsync(fileUrl, target, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('File sharing is unavailable on this device.');
      }
      await Sharing.shareAsync(result.uri, { mimeType: report.fileMimeType || undefined });
      return;
    }

    const response = await fetch(fileUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('The attached file could not be loaded.');

    if (typeof URL !== 'undefined') {
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      return;
    }
  },

  deleteReport: (id: string) => http.delete<{ message: string }>(`/patients/me/reports/${id}`),
};
