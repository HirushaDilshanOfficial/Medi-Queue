import { API_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  systolic: number;
  diastolic: number;
  heartRateNum: number;
  tempNum: number;
  spO2Num: number;
  weight?: string;
  weightNum?: number;
  height?: string;
  heightNum?: number;
  bmi?: string;
  bmiNum?: number;
  bmiStatus?: string;
  pulseRate?: string;
}

export interface VitalHistoryReading {
  id: string;
  dateLabel: string; // e.g. "Mar 02", "Jun 18", "Aug 20", "Oct 04", "Now"
  timestamp: string; // e.g. "Nov 04, 2025" or "Today, 08:30 AM"
  systolic: number;
  diastolic: number;
  heartRate: number;
  bodyTemp: number;
  spO2: number;
  weight?: number;
  bmi?: number;
}

export type AllergySeverity = 'mild' | 'moderate' | 'severe' | 'life-threatening';
export type AllergyReaction =
  | 'Angioedema'
  | 'Anaphylaxis'
  | 'Rash / hives'
  | 'Breathing difficulty'
  | 'Nausea / vomiting'
  | 'Other';

export interface AllergyItem {
  id: string;
  allergen: string;
  reaction: AllergyReaction | string;
  severity: AllergySeverity;
  note?: string;
}

export interface PatientAllergy {
  hasAllergy: boolean;
  isHighRisk?: boolean;
  title: string;
  description: string;
}

export interface MedicationItem {
  id: string;
  drugName: string;
  dose: string;
  frequency: string;
  duration?: string;
  sinceDate: string;
  hasAllergyOverride?: boolean;
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
  statusBadge?: string; // e.g. "Resolved"
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
  allergies?: AllergyItem[];
  chronicConditions: string[];
  medications: MedicationItem[];
  hasVitals?: boolean;
  vitals: PatientVitalsRecord;
  vitalsHistory: VitalHistoryReading[];
  imaging: PatientImaging;
  recentVisits: PatientVisitHistory[];
  hospitalName?: string;
  reports?: any[];
}

// ─────────────────────────────────────────────────────────────
// VITALS STATUS CALCULATORS
// ─────────────────────────────────────────────────────────────

export interface VitalStatusResult {
  label: string;
  isAbnormal: boolean;
}

export const getBPStatus = (systolic: number, diastolic: number): VitalStatusResult => {
  if (systolic >= 140 || diastolic >= 90) {
    return { label: 'High', isAbnormal: true };
  }
  if (systolic < 90 || diastolic < 60) {
    return { label: 'Low', isAbnormal: true };
  }
  return { label: 'Normal', isAbnormal: false };
};

export const getHRStatus = (hr: number): VitalStatusResult => {
  if (hr > 100) return { label: 'High', isAbnormal: true };
  if (hr < 60) return { label: 'Low', isAbnormal: true };
  return { label: 'Normal', isAbnormal: false };
};

export const formatTempCelsius = (temp: number | string): { tempC: number; display: string } => {
  const num = typeof temp === 'string' ? parseFloat(temp) : temp;
  if (isNaN(num)) return { tempC: 37.0, display: '37.0' };
  // If temp is in Fahrenheit (> 50), convert to Celsius: (F - 32) * 5 / 9
  const c = num > 50 ? ((num - 32) * 5) / 9 : num;
  const rounded = Math.round(c * 10) / 10;
  return { tempC: rounded, display: rounded.toFixed(1) };
};

export const getTempStatus = (temp: number): VitalStatusResult => {
  // If temp is in Fahrenheit (> 50), convert to Celsius
  const tempC = temp > 50 ? ((temp - 32) * 5) / 9 : temp;
  if (tempC >= 38.0) return { label: 'Fever', isAbnormal: true };
  if (tempC < 35.5) return { label: 'Low', isAbnormal: true };
  return { label: 'Normal', isAbnormal: false };
};

export const getBMIStatus = (bmi: number): VitalStatusResult => {
  if (bmi <= 0) return { label: 'N/A', isAbnormal: false };
  if (bmi < 18.5) return { label: 'Underweight', isAbnormal: true };
  if (bmi <= 24.9) return { label: 'Normal', isAbnormal: false };
  if (bmi <= 29.9) return { label: 'Overweight', isAbnormal: true };
  return { label: 'Obese', isAbnormal: true };
};

export const calculateBMI = (
  weightKg: number,
  heightCm: number
): { bmi: number; status: VitalStatusResult } => {
  if (!weightKg || !heightCm || heightCm <= 0) {
    return { bmi: 0, status: { label: 'N/A', isAbnormal: false } };
  }
  const heightM = heightCm / 100;
  const bmi = Math.round((weightKg / (heightM * heightM)) * 10) / 10;
  return {
    bmi,
    status: getBMIStatus(bmi),
  };
};

export const getSpO2Status = (spo2: number): VitalStatusResult => {
  if (spo2 < 95) return { label: 'Low', isAbnormal: true };
  return { label: 'Normal', isAbnormal: false };
};

// ─────────────────────────────────────────────────────────────
// ALLERGY CHECK LOGIC
// ─────────────────────────────────────────────────────────────
export const SULFA_KEYWORDS = [
  'sulfa',
  'sulfonamide',
  'trimethoprim',
  'tmp-smx',
  'co-trimoxazole',
  'bactrim',
  'septrin',
];

export const PENICILLIN_KEYWORDS = [
  'penicillin',
  'amoxicillin',
  'amoxiclav',
  'augmentin',
  'ampicillin',
  'cloxacillin',
];

export const NSAID_KEYWORDS = [
  'aspirin',
  'ibuprofen',
  'diclofenac',
  'mefenamic',
  'naproxen',
  'celecoxib',
];

export interface AllergyCheckResult {
  status: 'conflict' | 'similar' | 'safe' | 'short';
  allergen?: string;
  note?: string;
}

export const getDefaultAllergiesForPatient = (patient: PatientRecord): AllergyItem[] => {
  if (patient.allergies && patient.allergies.length > 0) {
    return patient.allergies;
  }
  if (!patient.allergy || !patient.allergy.hasAllergy) {
    return [];
  }
  const isHighRisk = patient.allergy.isHighRisk;
  let reaction: AllergyReaction = 'Other';
  const desc = (patient.allergy.title + ' ' + patient.allergy.description).toLowerCase();
  if (desc.includes('angioedema')) reaction = 'Angioedema';
  else if (desc.includes('anaphylaxis')) reaction = 'Anaphylaxis';
  else if (desc.includes('rash') || desc.includes('hives')) reaction = 'Rash / hives';
  else if (desc.includes('breathing') || desc.includes('bronchospasm')) reaction = 'Breathing difficulty';
  else if (desc.includes('nausea') || desc.includes('vomit')) reaction = 'Nausea / vomiting';

  let allergen = patient.allergy.title.replace(/.*Allergy\s*•?\s*/i, '').trim();
  if (patient.allergy.description) {
    const firstPart = patient.allergy.description.split('.')[0];
    if (firstPart && firstPart.length < 50) allergen = firstPart.trim();
  }

  return [
    {
      id: `alg-${patient.id}-1`,
      allergen: allergen || 'Sulfa Drugs',
      reaction,
      severity: isHighRisk ? 'life-threatening' : 'moderate',
      note: patient.allergy.description,
    },
  ];
};

export const checkMedicationAllergyWithList = (
  drugNameInput: string,
  allergiesList: AllergyItem[],
  medications: MedicationItem[] = []
): AllergyCheckResult => {
  const query = drugNameInput.trim().toLowerCase();
  if (query.length < 3) {
    return { status: 'short' };
  }

  // 1. Check patient allergies list
  for (const item of allergiesList) {
    const allergenLower = item.allergen.toLowerCase();
    const noteLower = (item.note || '').toLowerCase();
    const combined = allergenLower + ' ' + noteLower;

    if (combined.includes('sulfa')) {
      const match = SULFA_KEYWORDS.find((kw) => query.includes(kw));
      if (match) {
        return {
          status: 'conflict',
          allergen: item.allergen,
          note: item.note || `Documented ${item.severity} reaction: ${item.reaction}`,
        };
      }
    }

    if (combined.includes('penicillin') || combined.includes('amoxicillin')) {
      const match = PENICILLIN_KEYWORDS.find((kw) => query.includes(kw));
      if (match) {
        return {
          status: 'conflict',
          allergen: item.allergen,
          note: item.note || `Documented ${item.severity} reaction: ${item.reaction}`,
        };
      }
    }

    if (combined.includes('nsaid') || combined.includes('aspirin') || combined.includes('ibuprofen')) {
      const match = NSAID_KEYWORDS.find((kw) => query.includes(kw));
      if (match) {
        return {
          status: 'conflict',
          allergen: item.allergen,
          note: item.note || `Documented ${item.severity} reaction: ${item.reaction}`,
        };
      }
    }

    // Direct substring match
    if (query.includes(allergenLower) || allergenLower.includes(query)) {
      return {
        status: 'conflict',
        allergen: item.allergen,
        note: item.note || `Documented ${item.severity} reaction: ${item.reaction}`,
      };
    }
  }

  // 2. Check similar drug in active medications
  const isSimilar = medications.some((m) => {
    const existingName = m.drugName.toLowerCase();
    return existingName.includes(query) || query.includes(existingName.split(' ')[0]);
  });

  if (isSimilar) {
    return {
      status: 'similar',
      note: 'A medication with a similar name or active class is already listed on this chart.',
    };
  }

  return {
    status: 'safe',
    note: 'No known allergy conflicts detected for this medication.',
  };
};

export const checkMedicationAllergy = (
  drugNameInput: string,
  patient: PatientRecord
): AllergyCheckResult => {
  const allergies = getDefaultAllergiesForPatient(patient);
  return checkMedicationAllergyWithList(drugNameInput, allergies, patient.medications);
};

// ─────────────────────────────────────────────────────────────
// 6 DUMMY PATIENTS
// Separated cleanly from the UI for easy backend replacement.
// ─────────────────────────────────────────────────────────────
export const ALL_DUMMY_PATIENTS: PatientRecord[] = [
  // 1. Aurelia Sisca (In consultation, has high-risk sulfa allergy, has imaging, 2 active meds)
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
    chronicConditions: ['Asthma (mild)', 'Vitamin D deficiency'],
    medications: [
      {
        id: 'med-aur-1',
        drugName: 'Paracetamol',
        dose: '500 mg',
        frequency: 'Every 6 hours, as needed',
        duration: '5 days',
        sinceDate: 'Since Nov 04',
      },
      {
        id: 'med-aur-2',
        drugName: 'Salbutamol Inhaler',
        dose: '100 mcg',
        frequency: '2 puffs as needed for wheeze',
        sinceDate: 'Since Aug 12',
      },
    ],
    vitals: {
      triageTime: 'Triage: 12 min ago',
      bloodPressure: '118/75',
      bloodPressureUnit: 'mmHg',
      heartRate: '72',
      heartRateUnit: 'bpm',
      bodyTemp: '37.0',
      bodyTempUnit: '°C',
      spO2: '99%',
      spO2Status: 'Normal',
      systolic: 118,
      diastolic: 75,
      heartRateNum: 72,
      tempNum: 37.0,
      spO2Num: 99,
      weight: '58 kg',
      weightNum: 58,
      height: '165 cm',
      heightNum: 165,
      bmi: '21.3',
      bmiNum: 21.3,
      bmiStatus: 'Normal',
    },
    vitalsHistory: [
      {
        id: 'vh-1',
        dateLabel: 'Mar 02',
        timestamp: 'Mar 02, 2025',
        systolic: 124,
        diastolic: 80,
        heartRate: 76,
        bodyTemp: 36.9,
        spO2: 99,
        weight: 59,
        bmi: 21.7,
      },
      {
        id: 'vh-2',
        dateLabel: 'Jun 18',
        timestamp: 'Jun 18, 2025',
        systolic: 120,
        diastolic: 78,
        heartRate: 74,
        bodyTemp: 37.1,
        spO2: 98,
        weight: 58.5,
        bmi: 21.5,
      },
      {
        id: 'vh-3',
        dateLabel: 'Aug 20',
        timestamp: 'Aug 20, 2025',
        systolic: 126,
        diastolic: 82,
        heartRate: 80,
        bodyTemp: 36.9,
        spO2: 99,
        weight: 58.2,
        bmi: 21.4,
      },
      {
        id: 'vh-4',
        dateLabel: 'Oct 04',
        timestamp: 'Oct 04, 2025',
        systolic: 122,
        diastolic: 79,
        heartRate: 75,
        bodyTemp: 37.0,
        spO2: 99,
        weight: 58,
        bmi: 21.3,
      },
      {
        id: 'vh-5',
        dateLabel: 'Now',
        timestamp: 'Today, 08:30 AM',
        systolic: 118,
        diastolic: 75,
        heartRate: 72,
        bodyTemp: 37.0,
        spO2: 99,
        weight: 58,
        bmi: 21.3,
      },
    ],
    imaging: {
      hasImaging: true,
      subtitle: 'Recent (2 days ago)',
      title: 'X-Ray Right Ankle',
      description: 'AP & Lateral Views • Dr. Clara Silva',
      imageUrl: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=300',
      reportSummary: 'Non-displaced distal fibular micro-crack consolidation. Mild soft-tissue swelling around lateral malleolus.',
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

  // 2. Kamal Gunaratne (Waiting, moderate penicillin allergy, has imaging, 2 active meds)
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
    chronicConditions: ['Essential Hypertension', 'Dyslipidemia'],
    medications: [
      {
        id: 'med-kam-1',
        drugName: 'Losartan',
        dose: '50 mg',
        frequency: 'Once daily in morning',
        sinceDate: 'Since Jul 14',
      },
      {
        id: 'med-kam-2',
        drugName: 'Atorvastatin',
        dose: '20 mg',
        frequency: 'Once daily at night',
        sinceDate: 'Since Jul 14',
      },
    ],
    vitals: {
      triageTime: 'Triage: 25 min ago',
      bloodPressure: '138/88',
      bloodPressureUnit: 'mmHg',
      heartRate: '78',
      heartRateUnit: 'bpm',
      bodyTemp: '36.9',
      bodyTempUnit: '°C',
      spO2: '98%',
      spO2Status: 'Normal',
      systolic: 138,
      diastolic: 88,
      heartRateNum: 78,
      tempNum: 36.9,
      spO2Num: 98,
      weight: '78 kg',
      weightNum: 78,
      height: '172 cm',
      heightNum: 172,
      bmi: '26.4',
      bmiNum: 26.4,
      bmiStatus: 'Overweight',
    },
    vitalsHistory: [
      {
        id: 'vhk-1',
        dateLabel: 'Jan 15',
        timestamp: 'Jan 15, 2025',
        systolic: 142,
        diastolic: 92,
        heartRate: 82,
        bodyTemp: 36.8,
        spO2: 97,
        weight: 80,
        bmi: 27.0,
      },
      {
        id: 'vhk-2',
        dateLabel: 'Apr 10',
        timestamp: 'Apr 10, 2025',
        systolic: 140,
        diastolic: 90,
        heartRate: 79,
        bodyTemp: 37.0,
        spO2: 98,
        weight: 79,
        bmi: 26.7,
      },
      {
        id: 'vhk-3',
        dateLabel: 'Jul 14',
        timestamp: 'Jul 14, 2025',
        systolic: 136,
        diastolic: 86,
        heartRate: 76,
        bodyTemp: 36.9,
        spO2: 99,
        weight: 78.5,
        bmi: 26.5,
      },
      {
        id: 'vhk-4',
        dateLabel: 'Now',
        timestamp: 'Today, 08:15 AM',
        systolic: 138,
        diastolic: 88,
        heartRate: 78,
        bodyTemp: 36.9,
        spO2: 98,
        weight: 78,
        bmi: 26.4,
      },
    ],
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

  // 3. Shenaya Fernando (Child patient 7 yrs, Waiting, no allergy, NO imaging, NO active medications)
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
    chronicConditions: [], // None recorded
    medications: [], // No active medications
    vitals: {
      triageTime: 'Triage: 8 min ago',
      bloodPressure: '98/62',
      bloodPressureUnit: 'mmHg',
      heartRate: '92',
      heartRateUnit: 'bpm',
      bodyTemp: '38.2',
      bodyTempUnit: '°C',
      spO2: '99%',
      spO2Status: 'Normal',
      systolic: 98,
      diastolic: 62,
      heartRateNum: 92,
      tempNum: 38.2,
      spO2Num: 99,
      weight: '22 kg',
      weightNum: 22,
      height: '118 cm',
      heightNum: 118,
      bmi: '15.8',
      bmiNum: 15.8,
      bmiStatus: 'Normal',
    },
    vitalsHistory: [
      {
        id: 'vhs-1',
        dateLabel: 'May 12',
        timestamp: 'May 12, 2025',
        systolic: 96,
        diastolic: 60,
        heartRate: 88,
        bodyTemp: 36.9,
        spO2: 100,
        weight: 21,
        bmi: 15.3,
      },
      {
        id: 'vhs-2',
        dateLabel: 'Dec 18',
        timestamp: 'Dec 18, 2025',
        systolic: 98,
        diastolic: 64,
        heartRate: 94,
        bodyTemp: 37.7,
        spO2: 99,
        weight: 21.5,
        bmi: 15.5,
      },
      {
        id: 'vhs-3',
        dateLabel: 'Now',
        timestamp: 'Today, 08:45 AM',
        systolic: 98,
        diastolic: 62,
        heartRate: 92,
        bodyTemp: 38.2,
        spO2: 99,
        weight: 22,
        bmi: 15.8,
      },
    ],
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

  // 4. Rashmi Wickramasinghe (Pregnant patient 28 yrs, 24 wks, Waiting, no allergy, prenatal vitamins)
  {
    id: 'pat-rashmi-031',
    name: 'Rashmi Wickramasinghe',
    shortName: 'Rashmi',
    verified: true,
    age: 28,
    gender: 'Female',
    bloodGroup: 'AB+',
    tokenNumber: 31,
    tokenFormatted: '#031',
    nic: '1998-1123490',
    registeredTime: '09:00 AM',
    status: 'Waiting',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
    allergy: {
      hasAllergy: false,
      title: 'No known allergies',
      description: 'No known drug allergies reported.',
    },
    chronicConditions: ['Gestational Iron Deficiency', 'Morning Sickness'],
    medications: [
      {
        id: 'med-rw-1',
        drugName: 'Ferrous Fumarate',
        dose: '200 mg',
        frequency: 'Once daily after breakfast',
        sinceDate: 'Since Sep 01',
      },
      {
        id: 'med-rw-2',
        drugName: 'Folic Acid',
        dose: '5 mg',
        frequency: 'Once daily',
        sinceDate: 'Since Jul 15',
      },
    ],
    vitals: {
      triageTime: 'Triage: 18 min ago',
      bloodPressure: '110/68',
      bloodPressureUnit: 'mmHg',
      heartRate: '84',
      heartRateUnit: 'bpm',
      bodyTemp: '37.0',
      bodyTempUnit: '°C',
      spO2: '99%',
      spO2Status: 'Normal',
      systolic: 110,
      diastolic: 68,
      heartRateNum: 84,
      tempNum: 37.0,
      spO2Num: 99,
      weight: '64 kg',
      weightNum: 64,
      height: '160 cm',
      heightNum: 160,
      bmi: '25.0',
      bmiNum: 25.0,
      bmiStatus: 'Normal',
    },
    vitalsHistory: [
      {
        id: 'vhr-1',
        dateLabel: 'Jul 15',
        timestamp: 'Jul 15, 2025',
        systolic: 108,
        diastolic: 66,
        heartRate: 80,
        bodyTemp: 36.9,
        spO2: 99,
        weight: 60,
        bmi: 23.4,
      },
      {
        id: 'vhr-2',
        dateLabel: 'Sep 01',
        timestamp: 'Sep 01, 2025',
        systolic: 112,
        diastolic: 70,
        heartRate: 82,
        bodyTemp: 37.0,
        spO2: 100,
        weight: 62,
        bmi: 24.2,
      },
      {
        id: 'vhr-3',
        dateLabel: 'Now',
        timestamp: 'Today, 09:00 AM',
        systolic: 110,
        diastolic: 68,
        heartRate: 84,
        bodyTemp: 37.0,
        spO2: 99,
        weight: 64,
        bmi: 25.0,
      },
    ],
    imaging: {
      hasImaging: false,
    },
    recentVisits: [
      {
        id: 'rec-rw1',
        title: 'Obstetric 2nd Trimester Ultrasound',
        date: 'Oct 02, 2025',
        details: 'Fetal anatomy scan within normal parameters. Fetal heart rate 142 bpm.',
        statusBadge: 'Resolved',
        icon: 'heart-pulse',
      },
    ],
  },

  // 5. Rohan Mendis (Waiting, severe NSAID/Aspirin allergy, NO imaging, active meds)
  {
    id: 'pat-rohan-033',
    name: 'Rohan Mendis',
    shortName: 'Rohan',
    verified: true,
    age: 54,
    gender: 'Male',
    bloodGroup: 'AB+',
    tokenNumber: 33,
    tokenFormatted: '#033',
    nic: '1972-3391024',
    registeredTime: '09:15 AM',
    status: 'Waiting',
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
    allergy: {
      hasAllergy: true,
      isHighRisk: true,
      title: 'High Risk Allergy • NSAIDs / Aspirin',
      description: 'Severe bronchospasm with Ibuprofen/Aspirin. Avoid all COX-1/2 non-steroidals.',
    },
    chronicConditions: ['Type 2 Diabetes Mellitus', 'Chronic Gouty Diathesis'],
    medications: [
      {
        id: 'med-roh-1',
        drugName: 'Metformin',
        dose: '500 mg',
        frequency: 'Twice daily with meals',
        sinceDate: 'Since Jun 10',
      },
      {
        id: 'med-roh-2',
        drugName: 'Allopurinol',
        dose: '100 mg',
        frequency: 'Once daily after food',
        sinceDate: 'Since Jul 04',
      },
    ],
    vitals: {
      triageTime: 'Triage: 30 min ago',
      bloodPressure: '145/94',
      bloodPressureUnit: 'mmHg',
      heartRate: '82',
      heartRateUnit: 'bpm',
      bodyTemp: '36.8',
      bodyTempUnit: '°C',
      spO2: '96%',
      spO2Status: 'Normal',
      systolic: 145,
      diastolic: 94,
      heartRateNum: 82,
      tempNum: 36.8,
      spO2Num: 96,
      weight: '84 kg',
      weightNum: 84,
      height: '170 cm',
      heightNum: 170,
      bmi: '29.1',
      bmiNum: 29.1,
      bmiStatus: 'Overweight',
    },
    vitalsHistory: [
      {
        id: 'vhro-1',
        dateLabel: 'Jun 10',
        timestamp: 'Jun 10, 2025',
        systolic: 148,
        diastolic: 96,
        heartRate: 86,
        bodyTemp: 36.8,
        spO2: 95,
        weight: 86,
        bmi: 29.8,
      },
      {
        id: 'vhro-2',
        dateLabel: 'Jul 04',
        timestamp: 'Jul 04, 2025',
        systolic: 144,
        diastolic: 92,
        heartRate: 84,
        bodyTemp: 36.9,
        spO2: 96,
        weight: 85,
        bmi: 29.4,
      },
      {
        id: 'vhro-3',
        dateLabel: 'Now',
        timestamp: 'Today, 09:15 AM',
        systolic: 145,
        diastolic: 94,
        heartRate: 82,
        bodyTemp: 36.8,
        spO2: 96,
        weight: 84,
        bmi: 29.1,
      },
    ],
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

  // 6. Sanduni Perera (Seen, no allergy, has imaging, 1 medication)
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
    chronicConditions: ['Migraine with aura'],
    medications: [
      {
        id: 'med-san-1',
        drugName: 'Propranolol',
        dose: '40 mg',
        frequency: 'Once daily in morning',
        sinceDate: 'Since Dec 10',
      },
    ],
    vitals: {
      triageTime: 'Triage: 1h 10m ago',
      bloodPressure: '112/70',
      bloodPressureUnit: 'mmHg',
      heartRate: '70',
      heartRateUnit: 'bpm',
      bodyTemp: '36.8',
      bodyTempUnit: '°C',
      spO2: '99%',
      spO2Status: 'Normal',
      systolic: 112,
      diastolic: 70,
      heartRateNum: 70,
      tempNum: 36.8,
      spO2Num: 99,
      weight: '55 kg',
      weightNum: 55,
      height: '158 cm',
      heightNum: 158,
      bmi: '22.0',
      bmiNum: 22.0,
      bmiStatus: 'Normal',
    },
    vitalsHistory: [
      {
        id: 'vhsp-1',
        dateLabel: 'Aug 20',
        timestamp: 'Aug 20, 2025',
        systolic: 114,
        diastolic: 72,
        heartRate: 72,
        bodyTemp: 36.9,
        spO2: 99,
        weight: 56,
        bmi: 22.4,
      },
      {
        id: 'vhsp-2',
        dateLabel: 'Dec 10',
        timestamp: 'Dec 10, 2025',
        systolic: 110,
        diastolic: 68,
        heartRate: 68,
        bodyTemp: 36.8,
        spO2: 100,
        weight: 55.5,
        bmi: 22.2,
      },
      {
        id: 'vhsp-3',
        dateLabel: 'Now',
        timestamp: 'Today, 07:50 AM',
        systolic: 112,
        diastolic: 70,
        heartRate: 70,
        bodyTemp: 36.8,
        spO2: 99,
        weight: 55,
        bmi: 22.0,
      },
    ],
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

  // 7. Dilshan Madushanka (Token 31, Walk-in, 28 yrs, Male, X-Ray Ready, Acute knee sprain)
  {
    id: 'pat-dilshan-031',
    name: 'Dilshan Madushanka',
    shortName: 'Dilshan',
    verified: true,
    age: 28,
    gender: 'Male',
    bloodGroup: 'A+',
    tokenNumber: 31,
    tokenFormatted: '#031',
    nic: '1998-3210945',
    registeredTime: '10:32 AM',
    status: 'Waiting',
    photoUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=200',
    allergy: {
      hasAllergy: false,
      title: 'No known allergies',
      description: 'No known drug or environmental allergies reported on clinical intake.',
    },
    chronicConditions: [],
    medications: [
      {
        id: 'med-dil-1',
        drugName: 'Paracetamol',
        dose: '500 mg',
        frequency: 'Every 6 hours as needed for knee pain',
        duration: '5 days',
        sinceDate: 'Today, 10:40 AM',
      },
    ],
    vitals: {
      triageTime: 'Triage: 15 min ago',
      bloodPressure: '120/80',
      bloodPressureUnit: 'mmHg',
      heartRate: '74',
      heartRateUnit: 'bpm',
      bodyTemp: '36.9',
      bodyTempUnit: '°C',
      spO2: '99%',
      spO2Status: 'Normal',
      systolic: 120,
      diastolic: 80,
      heartRateNum: 74,
      tempNum: 36.9,
      spO2Num: 99,
      weight: '72 kg',
      weightNum: 72,
      height: '176 cm',
      heightNum: 176,
      bmi: '23.2',
      bmiNum: 23.2,
      bmiStatus: 'Normal',
    },
    vitalsHistory: [
      {
        id: 'vh-dil-1',
        dateLabel: 'Now',
        timestamp: 'Today, 10:35 AM',
        systolic: 120,
        diastolic: 80,
        heartRate: 74,
        bodyTemp: 36.9,
        spO2: 99,
        weight: 72,
        bmi: 23.2,
      },
    ],
    imaging: {
      hasImaging: true,
      subtitle: 'Recent (Today, 10:32 AM)',
      title: 'X-Ray Right Knee',
      description: 'AP & Lateral Views • Radiology returned (X-Ray Ready)',
      imageUrl: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=300',
      reportSummary: 'No acute bony fracture or dislocation. Mild joint effusion and soft tissue swelling around medial collateral ligament.',
    },
    recentVisits: [
      {
        id: 'rec-dil-1',
        title: 'Acute Right Knee Sprain',
        date: 'Today',
        details: 'Twisted knee during badminton. Ice compression, elevation, and radiology ordered.',
        icon: 'account-injury-outline',
      },
    ],
  },
];

// Tag initial dummy patients with Colombo Teaching Hospital 1
ALL_DUMMY_PATIENTS.forEach((p) => {
  if (!p.hospitalName) {
    p.hospitalName = 'Colombo Teaching Hospital 1';
  }
});

export const makeHospitalRecord = (
  id: string,
  name: string,
  tokenNumber: number,
  hospitalName: string,
  status: 'Waiting' | 'In consultation' | 'Seen',
  age: number,
  gender: 'Male' | 'Female',
  bloodGroup: string,
  nic: string,
  reason: string,
  bp: string,
  hr: number,
  temp: number,
  spO2: number,
  allergyTitle?: string,
  allergyDesc?: string,
  medName?: string,
  medDose?: string,
  photoUrl?: string
): PatientRecord => {
  const shortName = name.split(' ')[0];
  const [sysStr, diaStr] = bp.split('/');
  const systolic = Number(sysStr) || 120;
  const diastolic = Number(diaStr) || 80;

  return {
    id,
    name,
    shortName,
    verified: true,
    age,
    gender,
    bloodGroup,
    tokenNumber,
    tokenFormatted: `#${String(tokenNumber).padStart(3, '0')}`,
    nic,
    registeredTime: '08:30 AM',
    status,
    hospitalName,
    photoUrl:
      photoUrl ||
      (gender === 'Female'
        ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200'
        : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200'),
    allergy: allergyTitle
      ? {
          hasAllergy: true,
          isHighRisk: allergyTitle.toLowerCase().includes('severe') || allergyTitle.toLowerCase().includes('high'),
          title: allergyTitle,
          description: allergyDesc || 'Clinical allergy on intake.',
        }
      : {
          hasAllergy: false,
          isHighRisk: false,
          title: 'No known allergies (NKDA)',
          description: 'No known adverse drug reactions recorded.',
        },
    chronicConditions: [reason],
    medications: medName
      ? [
          {
            id: `med-${id}`,
            drugName: medName,
            dose: medDose || '500 mg',
            frequency: 'Twice daily',
            sinceDate: 'Recent',
          },
        ]
      : [],
    hasVitals: true,
    vitals: {
      triageTime: 'Triage: 20 min ago',
      bloodPressure: bp,
      bloodPressureUnit: 'mmHg',
      heartRate: `${hr}`,
      heartRateUnit: 'bpm',
      bodyTemp: `${temp}`,
      bodyTempUnit: '°C',
      spO2: `${spO2}%`,
      spO2Status: spO2 >= 95 ? 'Normal' : 'Low',
      systolic,
      diastolic,
      heartRateNum: hr,
      tempNum: temp,
      spO2Num: spO2,
      weight: '68 kg',
      weightNum: 68,
      height: '170 cm',
      heightNum: 170,
      bmi: '23.5',
      bmiNum: 23.5,
      bmiStatus: 'Normal',
    },
    vitalsHistory: [
      {
        id: `vh-${id}`,
        dateLabel: 'Now',
        timestamp: 'Today, 08:30 AM',
        systolic,
        diastolic,
        heartRate: hr,
        bodyTemp: temp,
        spO2,
      },
    ],
    imaging: {
      hasImaging: false,
    },
    recentVisits: [
      {
        id: `rec-${id}`,
        title: `${reason} Consultation`,
        date: 'Today',
        details: `Clinical review at ${hospitalName}.`,
        statusBadge: status === 'Seen' ? 'Resolved' : 'Active',
      },
    ],
  };
};

// Records for City General Hospital
const CITY_GENERAL_PATIENTS: PatientRecord[] = [
  makeHospitalRecord(
    'pat-cg-004',
    'Imantha kaniska',
    4,
    'City General Hospital',
    'In consultation',
    28,
    'Male',
    'B+',
    '1998-1029384',
    'General OPD Consultation',
    '118/76',
    72,
    36.9,
    99,
    undefined,
    undefined,
    'Paracetamol',
    '500 mg'
  ),
  makeHospitalRecord(
    'pat-cg-005',
    'Nihal Jayawardena',
    5,
    'City General Hospital',
    'Waiting',
    60,
    'Male',
    'O+',
    '1966-2938475',
    'Chest Discomfort Checkup',
    '138/88',
    82,
    37.1,
    98,
    'Aspirin Sensitivity',
    'Mild gastric irritation from NSAIDs',
    'Atorvastatin',
    '20 mg'
  ),
  makeHospitalRecord(
    'pat-cg-006',
    'Anoma Wickramasinghe',
    6,
    'City General Hospital',
    'Waiting',
    39,
    'Female',
    'A+',
    '1987-9283741',
    'Migraine Consultation',
    '118/76',
    70,
    36.8,
    99,
    undefined,
    undefined,
    'Propranolol',
    '40 mg'
  ),
  makeHospitalRecord(
    'pat-cg-007',
    'Dhammika Perera',
    7,
    'City General Hospital',
    'Waiting',
    50,
    'Male',
    'AB+',
    '1976-3829104',
    'Cholesterol Review',
    '128/84',
    75,
    36.7,
    99,
    undefined,
    undefined,
    'Rosuvastatin',
    '10 mg'
  ),
  makeHospitalRecord(
    'pat-cg-008',
    'Sujatha Alwis',
    8,
    'City General Hospital',
    'Waiting',
    57,
    'Female',
    'O-',
    '1969-4829103',
    'Thyroid Medication Review',
    '120/78',
    71,
    36.8,
    99,
    undefined,
    undefined,
    'Levothyroxine',
    '50 mcg'
  ),
  makeHospitalRecord(
    'pat-cg-009',
    'Sanduni Perera',
    9,
    'City General Hospital',
    'Seen',
    41,
    'Female',
    'A-',
    '1985-5829102',
    'Routine Ortho Review',
    '115/75',
    68,
    36.6,
    100
  ),
];

// Records for National Hospital Sri Lanka
const NATIONAL_HOSPITAL_PATIENTS: PatientRecord[] = [
  makeHospitalRecord(
    'pat-nh-101',
    'Sarath Fonseka',
    101,
    'National Hospital Sri Lanka',
    'In consultation',
    55,
    'Male',
    'A+',
    '1971-8472910',
    'Blood Sugar Monitoring',
    '124/82',
    76,
    36.8,
    99,
    undefined,
    undefined,
    'Metformin',
    '500 mg'
  ),
  makeHospitalRecord(
    'pat-nh-102',
    'Gamini Senanayake',
    102,
    'National Hospital Sri Lanka',
    'Waiting',
    66,
    'Male',
    'B+',
    '1960-7382910',
    'Arthritis Follow-up',
    '135/86',
    78,
    37.0,
    98,
    'High Risk • Penicillin',
    'Anaphylaxis risk to Penicillin derivatives',
    'Glucosamine',
    '1500 mg'
  ),
  makeHospitalRecord(
    'pat-nh-103',
    'Rohini Jayasuriya',
    103,
    'National Hospital Sri Lanka',
    'Waiting',
    48,
    'Female',
    'O+',
    '1978-6291048',
    'Gastritis & Acid Reflux',
    '122/80',
    74,
    36.9,
    99,
    undefined,
    undefined,
    'Omeprazole',
    '20 mg'
  ),
  makeHospitalRecord(
    'pat-nh-104',
    'Prasanna Fernando',
    104,
    'National Hospital Sri Lanka',
    'Waiting',
    35,
    'Male',
    'AB+',
    '1991-5192837',
    'Lower Back Strain',
    '120/80',
    72,
    36.7,
    99,
    undefined,
    undefined,
    'Paracetamol',
    '500 mg'
  ),
  makeHospitalRecord(
    'pat-nh-105',
    'Chitra Samaranayake',
    105,
    'National Hospital Sri Lanka',
    'Waiting',
    59,
    'Female',
    'A-',
    '1967-4081928',
    'Osteoporosis Consultation',
    '126/82',
    75,
    36.8,
    99,
    undefined,
    undefined,
    'Calcium + Vit D',
    '600 mg'
  ),
  makeHospitalRecord(
    'pat-nh-106',
    'Mahinda Abeyrathne',
    106,
    'National Hospital Sri Lanka',
    'Waiting',
    63,
    'Male',
    'O+',
    '1963-3972810',
    'Post-CABG Routine Check',
    '130/80',
    70,
    36.7,
    98,
    undefined,
    undefined,
    'Aspirin',
    '75 mg'
  ),
  makeHospitalRecord(
    'pat-nh-107',
    'Kumari Weerasinghe',
    107,
    'National Hospital Sri Lanka',
    'Seen',
    41,
    'Female',
    'B-',
    '1985-2861902',
    'Allergy & Sinus Review',
    '118/74',
    69,
    36.9,
    99,
    'Dust Mites',
    'Seasonal allergic rhinitis'
  ),
];

// Records for Colombo South Teaching Hospital
const COLOMBO_SOUTH_PATIENTS: PatientRecord[] = [
  makeHospitalRecord(
    'pat-cs-201',
    'Upul Tharanga',
    201,
    'Colombo South Teaching Hospital',
    'In consultation',
    38,
    'Male',
    'O+',
    '1988-1928374',
    'Ankle Sprain Bandage Check',
    '120/80',
    71,
    36.8,
    99,
    undefined,
    undefined,
    'Paracetamol',
    '500 mg'
  ),
  makeHospitalRecord(
    'pat-cs-202',
    'Shirani Nanayakkara',
    202,
    'Colombo South Teaching Hospital',
    'Waiting',
    53,
    'Female',
    'A+',
    '1973-8273918',
    'Insomnia & Anxiety Consultation',
    '124/82',
    75,
    36.9,
    99,
    undefined,
    undefined,
    'Melatonin',
    '3 mg'
  ),
  makeHospitalRecord(
    'pat-cs-203',
    'Chandana Karunaratne',
    203,
    'Colombo South Teaching Hospital',
    'Waiting',
    49,
    'Male',
    'B+',
    '1977-7182930',
    'Urine Culture Follow-up',
    '122/78',
    73,
    37.1,
    98,
    'Sulfa Antibiotics',
    'Skin hives on co-trimoxazole intake',
    'Nitrofurantoin',
    '100 mg'
  ),
  makeHospitalRecord(
    'pat-cs-204',
    'Indrani Cooray',
    204,
    'Colombo South Teaching Hospital',
    'Waiting',
    65,
    'Female',
    'AB+',
    '1961-6091827',
    'Joint Pain & Physiotherapy',
    '130/84',
    76,
    36.8,
    99,
    undefined,
    undefined,
    'Paracetamol',
    '500 mg'
  ),
  makeHospitalRecord(
    'pat-cs-205',
    'Ranil Wickramatunga',
    205,
    'Colombo South Teaching Hospital',
    'Waiting',
    56,
    'Male',
    'O-',
    '1970-5982716',
    'Cardiac Wellness Check',
    '128/82',
    74,
    36.8,
    99,
    undefined,
    undefined,
    'Bisoprolol',
    '2.5 mg'
  ),
  makeHospitalRecord(
    'pat-cs-206',
    'Menaka Hettiarachchi',
    206,
    'Colombo South Teaching Hospital',
    'Seen',
    34,
    'Female',
    'A-',
    '1992-4871625',
    'Vitamin D Deficiency Follow-up',
    '114/74',
    68,
    36.7,
    100,
    undefined,
    undefined,
    'Cholecalciferol',
    '60,000 IU'
  ),
];

// Append all hospital patients to ALL_DUMMY_PATIENTS
ALL_DUMMY_PATIENTS.push(
  ...CITY_GENERAL_PATIENTS,
  ...NATIONAL_HOSPITAL_PATIENTS,
  ...COLOMBO_SOUTH_PATIENTS
);

export const getHospitalRecords = (hospitalName?: string): PatientRecord[] => {
  const targetHosp = hospitalName || 'Colombo Teaching Hospital 1';
  return ALL_DUMMY_PATIENTS.filter(
    (p) => (p.hospitalName || 'Colombo Teaching Hospital 1') === targetHosp
  );
};

export const fallbackAureliaRecord: PatientRecord = ALL_DUMMY_PATIENTS[0];

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

export interface DoctorRecordsResponseData {
  records: PatientRecord[];
  doctor?: {
    name: string;
    room: string;
    department: string;
  };
  currentPatientId?: string;
}

export const fetchDoctorRecordsResponseApi = async (
  query?: string,
  hospitalName?: string
): Promise<DoctorRecordsResponseData> => {
  let activeHosp = hospitalName;
  if (!activeHosp) {
    try {
      activeHosp = (await AsyncStorage.getItem('doctor_current_hospital')) || undefined;
      if (!activeHosp && typeof window !== 'undefined' && (window as any).localStorage) {
        activeHosp = (window as any).localStorage.getItem('doctor_current_hospital') || undefined;
      }
    } catch (e) {}
  }
  const currentTargetHospital = activeHosp || 'Colombo Teaching Hospital 1';
  let hospitalRecordsFallback = getHospitalRecords(currentTargetHospital);
  if (query && query.trim()) {
    hospitalRecordsFallback = filterPatientsList(hospitalRecordsFallback, query, 'All');
  }

  try {
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (currentTargetHospital) params.append('hospitalName', currentTargetHospital);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_URL}/doctor/records${qs}`);
    if (response.ok) {
      const json = await response.json();
      if (Array.isArray(json.data) && json.data.length > 0) {
        const matchingRecords = json.data
          .filter((item: any) => !item.hospitalName || item.hospitalName === currentTargetHospital)
          .map((item: any) => ({
            ...item,
            status: item.status || 'Waiting',
            hasVitals: Boolean(item.hasVitals),
            chronicConditions: item.chronicConditions || [],
            medications: item.medications || [],
            imaging: item.imaging || { hasImaging: false },
            recentVisits: item.recentVisits || [],
            vitalsHistory: Array.isArray(item.vitalsHistory) ? item.vitalsHistory : [],
            hospitalName: item.hospitalName || currentTargetHospital,
            reports: item.reports || [],
          }));
        if (matchingRecords.length > 0) {
          return {
            records: matchingRecords,
            doctor: json.doctor,
            currentPatientId: json.currentPatientId,
          };
        }
      }
    }
    return { records: hospitalRecordsFallback };
  } catch (error) {
    console.log('Error fetching patient records, fallback to local:', error);
    return { records: hospitalRecordsFallback };
  }
};

export const fetchPatientRecordsApi = async (
  query?: string,
  hospitalName?: string
): Promise<PatientRecord[]> => {
  const result = await fetchDoctorRecordsResponseApi(query, hospitalName);
  return result.records;
};

export const savePatientVitalsApi = async (data: {
  patientId: string;
  tokenNumber?: number;
  bloodPressure: string;
  heartRate: string;
  temperature: number;
  spO2: number;
  weight: number;
  height: number;
}): Promise<boolean> => {
  try {
    const res = await fetch(`${API_URL}/doctor/vitals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
};
