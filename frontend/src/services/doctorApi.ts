import { http } from './http';
import type { Doctor } from '../types/patient';

export type DoctorQuery = {
  department?: string;
  hospitalId?: string;
  search?: string;
  available?: boolean;
  sort?: 'name' | 'rating';
};

export const doctorApi = {
  list: (query: DoctorQuery = {}) =>
    http.get<{ doctors: Doctor[] }>('/doctors', {
      department: query.department,
      hospitalId: query.hospitalId,
      search: query.search,
      available: query.available,
      sort: query.sort,
    }),

  departments: () => http.get<{ departments: string[] }>('/doctors/departments'),

  getById: (id: string) => http.get<{ doctor: Doctor }>(`/doctors/${id}`),
};
