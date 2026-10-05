import { API_URL } from '../config';

export interface PatientVitalsRecord {
  triageTime: string;
  bloodPressure: string;
  bloodPressureUnit: string;
  heartRate: string;
  heartRateUnit: string;
  bodyTemp: string;
  bodyTempUnit: string;
  spO2: string;
  spO2Status: string;
}

export interface PatientAllergy {
  isHighRisk: boolean;
  title: string;
  description: string;
}

export interface PatientImaging {
  subtitle: string;
  title: string;
  description: string;
  imageUrl: string;
  reportSummary: string;
}

export interface PatientVisitHistory {
  id: string;
  title: string;
  date: string;
  details: string;
  statusBadge?: string;
  icon?: string;
}

export interface PatientRecord {
  id: string;
  name: string;
  shortName: string;
  verified: boolean;
  age: number;
  gender: string;
  bloodGroup: string;
  tokenNumber: number;
  tokenFormatted: string;
  nic: string;
  registeredTime: string;
  photoUrl: string;
  allergy: PatientAllergy;
  vitals: PatientVitalsRecord;
  imaging: PatientImaging;
  recentVisits: PatientVisitHistory[];
}

export const fallbackAureliaRecord: PatientRecord = {
  id: 'pat-aurelia-029',
  name: 'Aurelia Sisca',
  shortName: 'Aurelia',
  verified: true,
  age: 32,
  gender: 'Female',
  bloodGroup: 'B+',
  tokenNumber: 29,
  tokenFormatted: '#029',
  nic: '1993-8472901',
  registeredTime: '08:30 AM',
  photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
  allergy: {
    isHighRisk: true,
    title: 'High Risk Allergy • Angioedema',
    description: 'Sulfa Drugs (Sulfonamides, TMP-SMX). Do not administer.',
  },
  vitals: {
    triageTime: 'Triage: 12 min ago',
    bloodPressure: '118/75',
    bloodPressureUnit: 'mmHg',
    heartRate: '72',
    heartRateUnit: 'bpm',
    bodyTemp: '98.6',
    bodyTempUnit: '°F',
    spO2: '99%',
    spO2Status: 'Normal',
  },
  imaging: {
    subtitle: 'Recent (2 days ago)',
    title: 'X-Ray Right Ankle',
    description: 'AP & Lateral Views • Dr. Clara Silva',
    imageUrl: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=300',
    reportSummary: 'Non-displaced distal fibular micro-crack consolidation. Mild soft-tissue swelling around lateral malleolus. No acute displacement.',
  },
  recentVisits: [
    {
      id: 'rec-1',
      title: 'Closed fracture distal fibula',
      date: 'Nov 04, 2025',
      details: 'Orthopedic Suite • Short-leg cast applied, non-weight bearing advice.',
      icon: 'account-injury-outline',
    },
    {
      id: 'rec-2',
      title: 'Acute viral pharyngitis',
      date: 'Sept 12, 2025',
      details: 'Symptomatic care prescribed.',
      statusBadge: 'Resolved',
      icon: 'shield-plus-outline',
    },
    {
      id: 'rec-3',
      title: 'Annual Physical & CBC',
      date: 'May 18, 2025',
      details: 'All parameters normal. Vitamin D supplementation advised.',
      statusBadge: 'Completed',
      icon: 'clipboard-check-outline',
    },
    {
      id: 'rec-4',
      title: 'Sprained Acromioclavicular Joint',
      date: 'Jan 22, 2025',
      details: 'Sling immobilization for 10 days. Full recovery.',
      statusBadge: 'Resolved',
      icon: 'bandage',
    },
    {
      id: 'rec-5',
      title: 'Dermatitis Contact Review',
      date: 'Aug 14, 2024',
      details: 'Topical hydrocortisone cream prescribed.',
      statusBadge: 'Resolved',
      icon: 'needle',
    },
    {
      id: 'rec-6',
      title: 'Initial Hospital Registration',
      date: 'Mar 02, 2024',
      details: 'Baseline records entered into Colombo National Hospital OPD.',
      statusBadge: 'Archived',
      icon: 'folder-check-outline',
    },
  ],
};

export const fallbackKamalRecord: PatientRecord = {
  id: 'pat-kamal-028',
  name: 'Kamal Gunaratne',
  shortName: 'Kamal',
  verified: true,
  age: 46,
  gender: 'Male',
  bloodGroup: 'O+',
  tokenNumber: 28,
  tokenFormatted: '#028',
  nic: '1978-5521940',
  registeredTime: '08:15 AM',
  photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
  allergy: {
    isHighRisk: false,
    title: 'Mild Allergy • Penicillin',
    description: 'Mild cutaneous rash reported in 2018. Prefer Cephalosporins / Macrolides.',
  },
  vitals: {
    triageTime: 'Triage: 25 min ago',
    bloodPressure: '120/80',
    bloodPressureUnit: 'mmHg',
    heartRate: '74',
    heartRateUnit: 'bpm',
    bodyTemp: '98.4',
    bodyTempUnit: '°F',
    spO2: '98%',
    spO2Status: 'Normal',
  },
  imaging: {
    subtitle: 'Recent (1 week ago)',
    title: 'MRI Lumbar Spine',
    description: 'L4-L5 Axial & Sagittal • Dr. K. Silva',
    imageUrl: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=300',
    reportSummary: 'Mild L4-L5 disc protrusion without significant nerve root impingement.',
  },
  recentVisits: [
    {
      id: 'rec-k1',
      title: 'Lumbar Spine Spasm follow-up',
      date: 'Jan 15, 2026',
      details: 'Orthopedic Suite • Physiotherapy exercises prescribed.',
      statusBadge: 'Active',
      icon: 'account-injury-outline',
    },
    {
      id: 'rec-k2',
      title: 'General Health Screening',
      date: 'Oct 10, 2025',
      details: 'Lipid profile and fasting glucose normal.',
      statusBadge: 'Completed',
      icon: 'clipboard-check-outline',
    },
  ],
};

export const QUICK_PATIENTS_LIST = [
  { name: 'Aurelia Sisca', token: '#029', age: 32, gender: 'Female' },
  { name: 'Kamal Gunaratne', token: '#028', age: 46, gender: 'Male' },
  { name: 'Rohan Mendis', token: '#030', age: 54, gender: 'Male' },
  { name: 'Dilshan Madushanka', token: '#031', age: 28, gender: 'Male' },
  { name: 'Sanduni Perera', token: '#032', age: 41, gender: 'Female' },
];

/**
 * Fetch patient health records from backend or return design fallback
 */
export const fetchPatientRecordsApi = async (query: string = 'Aurelia'): Promise<PatientRecord> => {
  try {
    const url = `${API_URL}/doctor/records?query=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    return json.data || fallbackAureliaRecord;
  } catch (err) {
    console.log('Error fetching records, using local fallback:', err);
    const cleanQuery = query.toLowerCase().trim();
    if (cleanQuery.includes('kamal') || cleanQuery.includes('28')) {
      return fallbackKamalRecord;
    }
    return fallbackAureliaRecord;
  }
};
