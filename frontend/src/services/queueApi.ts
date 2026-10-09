import { http } from './http';
import type { LiveDepartment, LiveQueueState, QueueBoard, QueuePass } from '../types/patient';

export const queueApi = {
  // Returns `pass: null` when the patient holds no active pass, which is the
  // normal state rather than an error.
  myPass: () => http.get<{ pass: QueuePass | null; passes: QueuePass[]; message?: string }>('/queue/my-pass'),

  // Lightweight endpoint used for polling; returns nulls when there is no pass.
  live: () =>
    http.get<{
      pass: { id: string; tokenNumber: number; status: string; calledAt: string | null; department: string } | null;
      live: LiveQueueState | null;
      serverTime: string;
    }>('/queue/my-pass/live'),

  checkIn: (appointmentId: string, priority: 'normal' | 'urgent' = 'normal') =>
    http.post<{ pass: QueuePass }>('/queue/check-in', { appointmentId, priority }),

  leave: () => http.delete<{ pass: null; released: boolean }>('/queue/my-pass'),

  board: (department: string) => http.get<QueueBoard>('/queue/board', { department }),

  departments: () =>
    http.get<{ queueDate: string; departments: LiveDepartment[] }>('/queue/departments'),
};
