import { http } from './http';
import type { Doctor } from '../types/patient';

export type DoctorQuery = {
  department?: string;
  hospitalId?: string;
  search?: string;
  available?: boolean;
  sort?: 'name' | 'rating';
};

type DoctorListResponse = { doctors: Doctor[] } | Doctor[];
type DoctorResponse = { doctor: Doctor } | Doctor;

function normalizeDoctor(doctor: Doctor): Doctor {
  const raw = doctor as Doctor & { _id?: string; name?: string };
  const name = raw.name ?? 'Doctor';
  const id = raw.id ?? raw._id ?? name;
  const firstName = name.replace(/^dr\.?\s+/i, '').split(/\s+/)[0] || 'Doctor';

  return {
    ...doctor,
    id,
    name,
    displayName: doctor.displayName ?? name,
    firstName: doctor.firstName ?? firstName,
    title: doctor.title ?? 'Dr.',
    initials: doctor.initials ?? 'DR',
    avatarUrl: doctor.avatarUrl ?? null,
    qualifications: doctor.qualifications ?? '',
    languages: doctor.languages ?? [],
    about: doctor.about ?? '',
    isAvailable: doctor.isAvailable ?? doctor.status === 'active',
    dailyCapacity: doctor.dailyCapacity ?? 30,
    avgConsultMinutes: doctor.avgConsultMinutes ?? 10,
    workingHours: doctor.workingHours ?? { start: null, end: null },
    rating: doctor.rating ?? null,
    reviewCount: doctor.reviewCount ?? 0,
    fee: doctor.fee ?? null,
    createdAt: doctor.createdAt ?? null,
  };
}

function normalizeDoctorList(response: DoctorListResponse): { doctors: Doctor[] } {
  const doctors = Array.isArray(response) ? response : response.doctors;
  return { doctors: doctors.map(normalizeDoctor) };
}

function normalizeDoctorResponse(response: DoctorResponse): { doctor: Doctor } {
  const doctor = 'doctor' in response ? response.doctor : response;
  return { doctor: normalizeDoctor(doctor) };
}

export const doctorApi = {
  list: (query: DoctorQuery = {}) =>
    http.get<DoctorListResponse>('/doctors', {
      department: query.department,
      hospitalId: query.hospitalId,
      search: query.search,
      available: query.available,
      sort: query.sort,
    }).then(normalizeDoctorList),

  departments: () => http.get<string[]>('/doctors/departments').then(departments => ({ departments })),

  getById: (id: string) =>
    http.get<DoctorResponse>(`/doctors/${id}`).then(normalizeDoctorResponse),
};
