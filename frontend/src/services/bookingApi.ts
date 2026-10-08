import { http } from './http';
import type { Appointment, BookableDay, BookingSummary, QueuePass, SlotOption } from '../types/patient';

export type BookingScope = 'upcoming' | 'past' | 'all';

export const bookingApi = {
  summary: () => http.get<BookingSummary>('/bookings/summary'),

  list: (scope: BookingScope = 'upcoming') =>
    http.get<{ appointments: Appointment[]; scope: string }>('/bookings', { scope }),

  bookableDays: (doctorId: string) =>
    http.get<{
      days: BookableDay[];
      horizonDays: number;
      scheduleConfigured: boolean;
    }>(`/bookings/doctors/${doctorId}/days`),

  slots: (doctorId: string, date: string) =>
    http.get<{ date: string; slots: SlotOption[] }>(`/bookings/doctors/${doctorId}/slots`, { date }),

  create: (input: { doctorId: string; date: string; slotTime: string; reason?: string }) =>
    http.post<{
      appointment: Appointment;
      tokenNumber: number;
      queueNumber: number;
      tokenLabel: string;
      queueEntryId: string;
      pass: QueuePass;
    }>('/bookings', input),

  cancel: (id: string, reason?: string) =>
    http.patch<{ appointment: Appointment; tokenReleased: boolean }>(`/bookings/${id}/cancel`, {
      reason,
    }),

  reschedule: (id: string, date: string, slotTime: string) =>
    http.patch<{ appointment: Appointment; tokenPreserved: boolean }>(
      `/bookings/${id}/reschedule`,
      { date, slotTime },
    ),
};
