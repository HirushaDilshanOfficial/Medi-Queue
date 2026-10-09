import type { Doctor } from '../types/patient';

const normalize = (value: string) => value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();

/** Search display fields only; translated labels do not change stored doctor data. */
export function filterDoctorDirectory(doctors: Doctor[], search: string, translate: (label: string) => string): Doctor[] {
  const words = normalize(search).split(' ').filter(Boolean);
  if (!words.length) return doctors;
  return doctors.filter(doctor => {
    const fields = [doctor.name, doctor.displayName, doctor.specialization, doctor.department,
      translate(doctor.specialization ?? ''), translate(doctor.department ?? '')];
    const text = fields.map(value => normalize(value ?? '')).join(' ');
    return words.every(word => text.includes(word));
  });
}
