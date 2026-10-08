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
    http.get<Doctor[]>('/doctors', {
      department: query.department,
      hospitalId: query.hospitalId,
      search: query.search,
      available: query.available,
      sort: query.sort,
    }).then((doctors: any[]) => ({ doctors: doctors.map(d => ({ ...d, id: d._id || d.id })) })),

  departments: () => http.get<string[]>('/doctors/departments').then(departments => ({ departments })),

  getById: (id: string) => http.get<any>(`/doctors/${id}`).then(doctor => ({ doctor: { ...doctor, id: doctor._id || doctor.id } })),
};
