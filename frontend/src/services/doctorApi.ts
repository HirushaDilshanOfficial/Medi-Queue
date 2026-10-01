import { http } from './http';
import type { Doctor } from '../types/patient';

export type DoctorQuery = {
  department?: string;
  search?: string;
  available?: boolean;
  sort?: 'name' | 'rating';
};

export const doctorApi = {
  list: (query: DoctorQuery = {}) =>
    http.get<{ doctors: Doctor[] }>('/doctors', {
      department: query.department,
      search: query.search,
      available: query.available,
      sort: query.sort,
    }),

  departments: () => http.get<{ departments: string[] }>('/doctors/departments'),

  getById: (id: string) => http.get<{ doctor: Doctor }>(`/doctors/${id}`),
};
