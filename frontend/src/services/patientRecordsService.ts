import { API_URL } from '../config';

export type PatientStatus = 'All' | 'Waiting' | 'In consultation' | 'Seen';

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
  hasAllergy: boolean;
  isHighRisk?: boolean;
  title: string;
  description: string;
}

export interface PatientImaging {
  hasImaging: boolean;
  subtitle?: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  reportSummary?: string;
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
  status: 'Waiting' | 'In consultation' | 'Seen';
  photoUrl?: string;
  allergy: PatientAllergy;
  vitals: PatientVitalsRecord;
  imaging: PatientImaging;
  recentVisits: PatientVisitHistory[];
}

/**
 * 6 DUMMY PATIENTS
 * Separated cleanly from UI components.
 * Includes: patients with allergies, child patient, patients without imaging,
 * and statuses Waiting / In consultation / Seen.
 */
export const ALL_DUMMY_PATIENTS: PatientRecord[] = [
  // 1. Aurelia Sisca (In consultation, has allergy, has imaging)
  {
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
    status: 'In consultation',
    photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
    allergy: {
      hasAllergy: true,
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
      hasImaging: true,
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
        title: 'Sprained Acromioclavicular Joint',
        date: 'Jan 22, 2025',
        details: 'Sling immobilization for 10 days. Full recovery.',
        statusBadge: 'Resolved',
        icon: 'bandage',
      },
    ],
  },

  // 2. Kamal Gunaratne (Waiting, moderate allergy, has imaging)
  {
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
    status: 'Waiting',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
    allergy: {
      hasAllergy: true,
      isHighRisk: false,
      title: 'Moderate Allergy • Penicillin',
      description: 'Mild cutaneous rash with amoxicillin. Use cephalosporins with caution.',
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
      hasImaging: true,
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
        icon: 'account-injury-outline',
      },
      {
        id: 'rec-k2',
        title: 'General Health Screening',
        date: 'Oct 10, 2025',
        details: 'Lipid profile and fasting glucose normal.',
        statusBadge: 'Resolved',
        icon: 'clipboard-check-outline',
      },
    ],
  },

  // 3. Shenaya Fernando (Child patient, 7 yrs, Waiting, no allergy, NO imaging)
  {
    id: 'pat-shenaya-030',
    name: 'Shenaya Fernando',
    shortName: 'Shenaya',
    verified: true,
    age: 7,
    gender: 'Female',
    bloodGroup: 'A+',
    tokenNumber: 30,
    tokenFormatted: '#030',
    nic: '2019-9120441',
    registeredTime: '08:45 AM',
    status: 'Waiting',
    photoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=200',
    allergy: {
      hasAllergy: false,
      title: 'No known allergies',
      description: 'Patient has no documented drug or food allergies on clinical file.',
    },
    vitals: {
      triageTime: 'Triage: 8 min ago',
      bloodPressure: '98/62',
      bloodPressureUnit: 'mmHg',
      heartRate: '88',
      heartRateUnit: 'bpm',
      bodyTemp: '99.1',
      bodyTempUnit: '°F',
      spO2: '99%',
      spO2Status: 'Normal',
    },
    imaging: {
      hasImaging: false,
    },
    recentVisits: [
      {
        id: 'rec-s1',
        title: 'Pediatric Triage & Fever Check',
        date: 'Dec 18, 2025',
        details: 'Mild viral fever with dry cough. Oral hydration and paracetamol syrup advised.',
        statusBadge: 'Resolved',
        icon: 'needle',
      },
    ],
  },

  // 4. Rohan Mendis (Waiting, severe allergy, NO imaging)
  {
    id: 'pat-rohan-031',
    name: 'Rohan Mendis',
    shortName: 'Rohan',
    verified: true,
    age: 54,
    gender: 'Male',
    bloodGroup: 'AB+',
    tokenNumber: 31,
    tokenFormatted: '#031',
    nic: '1972-1123490',
    registeredTime: '09:00 AM',
    status: 'Waiting',
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
    allergy: {
      hasAllergy: true,
      isHighRisk: true,
      title: 'High Risk Allergy • NSAIDs / Aspirin',
      description: 'Severe bronchospasm with Ibuprofen/Aspirin. Avoid all COX-1/2 non-steroidals.',
    },
    vitals: {
      triageTime: 'Triage: 30 min ago',
      bloodPressure: '135/88',
      bloodPressureUnit: 'mmHg',
      heartRate: '80',
      heartRateUnit: 'bpm',
      bodyTemp: '98.2',
      bodyTempUnit: '°F',
      spO2: '97%',
      spO2Status: 'Normal',
    },
    imaging: {
      hasImaging: false,
    },
    recentVisits: [
      {
        id: 'rec-r1',
        title: 'Hypertension Management Review',
        date: 'Nov 28, 2025',
        details: 'Blood pressure maintenance. Dose adjusted for Losartan 50mg daily.',
        icon: 'heart-pulse',
      },
      {
        id: 'rec-r2',
        title: 'Acute Gouty Arthritis Flare',
        date: 'Jul 04, 2025',
        details: 'Colchicine therapy prescribed. Low purine dietary advisory.',
        statusBadge: 'Resolved',
        icon: 'bandage',
      },
    ],
  },

  // 5. Dilshan Madushanka (Waiting, no allergy, has imaging)
  {
    id: 'pat-dilshan-032',
    name: 'Dilshan Madushanka',
    shortName: 'Dilshan',
    verified: true,
    age: 28,
    gender: 'Male',
    bloodGroup: 'O-',
    tokenNumber: 32,
    tokenFormatted: '#032',
    nic: '1998-3391024',
    registeredTime: '09:10 AM',
    status: 'Waiting',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
    allergy: {
      hasAllergy: false,
      title: 'No known allergies',
      description: 'Patient has no documented allergies on clinical record.',
    },
    vitals: {
      triageTime: 'Triage: 15 min ago',
      bloodPressure: '115/72',
      bloodPressureUnit: 'mmHg',
      heartRate: '68',
      heartRateUnit: 'bpm',
      bodyTemp: '98.5',
      bodyTempUnit: '°F',
      spO2: '100%',
      spO2Status: 'Normal',
    },
    imaging: {
      hasImaging: true,
      subtitle: 'Recent (3 days ago)',
      title: 'Ultrasound Whole Abdomen',
      description: 'Abdominal Quadrants • Dr. M. Jayawardena',
      imageUrl: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=300',
      reportSummary: 'Normal liver echo-texture. No gallstones or hydronephrosis detected. Appendix normal caliber.',
    },
    recentVisits: [
      {
        id: 'rec-d1',
        title: 'Abdominal Colic Follow-up',
        date: 'Jan 02, 2026',
        details: 'Antispasmodic therapy initiated. Diet adjusted, symptoms resolved.',
        statusBadge: 'Resolved',
        icon: 'clipboard-check-outline',
      },
    ],
  },

  // 6. Sanduni Perera (Seen, no allergy, NO imaging)
  {
    id: 'pat-sanduni-027',
    name: 'Sanduni Perera',
    shortName: 'Sanduni',
    verified: true,
    age: 41,
    gender: 'Female',
    bloodGroup: 'B-',
    tokenNumber: 27,
    tokenFormatted: '#027',
    nic: '1985-7719280',
    registeredTime: '07:50 AM',
    status: 'Seen',
    photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200',
    allergy: {
      hasAllergy: false,
      title: 'No known allergies',
      description: 'No known drug or environmental allergies documented.',
    },
    vitals: {
      triageTime: 'Triage: 1h 10m ago',
      bloodPressure: '112/70',
      bloodPressureUnit: 'mmHg',
      heartRate: '70',
      heartRateUnit: 'bpm',
      bodyTemp: '98.3',
      bodyTempUnit: '°F',
      spO2: '99%',
      spO2Status: 'Normal',
    },
    imaging: {
      hasImaging: false,
    },
    recentVisits: [
      {
        id: 'rec-sp1',
        title: 'Tension-type Headache Review',
        date: 'Dec 10, 2025',
        details: 'Stress reduction counseling & low-dose prophylactic prescribed.',
        statusBadge: 'Resolved',
        icon: 'shield-plus-outline',
      },
      {
        id: 'rec-sp2',
        title: 'Post-viral Asthenia Check',
        date: 'Aug 20, 2025',
        details: 'Complete blood count normal, full resolution of symptoms.',
        statusBadge: 'Resolved',
        icon: 'clipboard-check-outline',
      },
    ],
  },
];

export const fallbackAureliaRecord: PatientRecord = ALL_DUMMY_PATIENTS[0];
export const fallbackKamalRecord: PatientRecord = ALL_DUMMY_PATIENTS[1];

/**
 * Filter patients by search text and status
 * Matches name, token (with or without #), and NIC
 */
export const filterPatientsList = (
  patients: PatientRecord[],
  query: string,
  statusFilter: PatientStatus
): PatientRecord[] => {
  const cleanQuery = query.trim().toLowerCase().replace(/^#/, '');

  return patients.filter((patient) => {
    // 1. Status Filter
    if (statusFilter !== 'All' && patient.status !== statusFilter) {
      return false;
    }

    // 2. Search query filter
    if (!cleanQuery) return true;

    const matchesName = patient.name.toLowerCase().includes(cleanQuery);
    const matchesNic = patient.nic.toLowerCase().includes(cleanQuery);
    const matchesToken =
      String(patient.tokenNumber).includes(cleanQuery) ||
      patient.tokenFormatted.toLowerCase().includes(cleanQuery);

    return matchesName || matchesNic || matchesToken;
  });
};

/**
 * Fetch patient health records from backend or return local dummy records
 */
export const fetchPatientRecordsApi = async (query: string = 'Aurelia'): Promise<PatientRecord> => {
  try {
    const url = `${API_URL}/doctor/records?query=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    return json.data || fallbackAureliaRecord;
  } catch (err) {
    const cleanQuery = query.toLowerCase().trim().replace(/^#/, '');
    const matched = ALL_DUMMY_PATIENTS.find(
      (p) =>
        p.name.toLowerCase().includes(cleanQuery) ||
        p.shortName.toLowerCase().includes(cleanQuery) ||
        String(p.tokenNumber) === cleanQuery ||
        p.nic.toLowerCase().includes(cleanQuery)
    );
    return matched || fallbackAureliaRecord;
  }
};
