import { http } from './http';

export type Clinic = {
  id?: string;
  _id: string;
  name: string;
  description: string;
  department: string;
  hospital?: { _id: string; name: string; location?: string };
  status: 'active' | 'inactive';
  clinicDays: string[];
  startTime: string;
  endTime: string;
  maxPatients: number;
};

export const clinicApi = {
  list: (hospitalId?: string) =>
    http.get<{ clinics: Clinic[] }>('/clinics', hospitalId ? { hospitalId } : undefined),
};
