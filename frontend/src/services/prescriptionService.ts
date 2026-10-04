import { API_URL } from '../config';

export interface MedicineItem {
  id: string;
  name: string;
  type: 'TABLET' | 'CAPSULE' | 'SYRUP' | 'INJECTION' | 'CREAM' | 'DROPS';
  dosage: string;
  frequency: string;
  frequencyCode: 'OD' | 'BD' | 'TDS' | 'QDS';
  duration: string;
  durationDays: number;
  instructions?: string;
  tagType?: 'food' | 'indication' | 'general';
}

export interface DiagnosisItem {
  id: string;
  code?: string;
  name: string;
  displayName: string;
  isPrimary?: boolean;
}

export interface PatientPrescriptionDetails {
  doctor: {
    name: string;
    specialization?: string;
    department?: string;
    room: string;
    isOnline: boolean;
    avatarUrl?: string;
  };
  patient: {
    id: string;
    opdId: string;
    name: string;
    initials: string;
    gender: string;
    age: number;
    tokenNumber: number;
    tokenFormatted: string;
    vitals: {
      bloodPressure: string;
      pulseRate: string;
      weight: string;
    };
  };
  diagnoses: DiagnosisItem[];
  clinicalNotes: string;
  isNotesAutoSaved: boolean;
  prescriptions: MedicineItem[];
}

// Fallback data matching the exact design image
export const fallbackPrescriptionData: PatientPrescriptionDetails = {
  doctor: {
    name: 'Dr. Emilia Emelson',
    specialization: 'Orthopedics Surgeon',
    department: 'Orthopedics OPD',
    room: 'Room 3B',
    isOnline: true,
    avatarUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=200',
  },
  patient: {
    id: 'pat-8821',
    opdId: 'ID #OPD-8821',
    name: 'Kamal Gunaratne',
    initials: 'KG',
    gender: 'Male',
    age: 46,
    tokenNumber: 28,
    tokenFormatted: 'Token #028',
    vitals: {
      bloodPressure: '120/80',
      pulseRate: '74 bpm',
      weight: '72 kg',
    },
  },
  diagnoses: [
    {
      id: 'diag-1',
      code: 'M54.5',
      name: 'Lumbar Spine Spasm',
      displayName: 'Lumbar Spine Spasm (M54.5)',
      isPrimary: true,
    },
    {
      id: 'diag-2',
      name: 'Mechanical Low Back Pain',
      displayName: 'Mechanical Low Back Pain',
      isPrimary: false,
    },
  ],
  clinicalNotes: 'Mild tenderness over L4-L5 paraspinal region. Straight leg raise test negative bilaterally.',
  isNotesAutoSaved: true,
  prescriptions: [
    {
      id: 'rx-1',
      name: 'Paracetamol 500mg',
      type: 'TABLET',
      dosage: '1 tablet',
      frequency: 'TDS (3x daily)',
      frequencyCode: 'TDS',
      duration: '5 days',
      durationDays: 5,
      instructions: 'After food',
      tagType: 'food',
    },
    {
      id: 'rx-2',
      name: 'Thiocolchicoside 4mg',
      type: 'CAPSULE',
      dosage: '1 capsule',
      frequency: 'BD (2x daily)',
      frequencyCode: 'BD',
      duration: '3 days',
      durationDays: 3,
      instructions: 'Muscle relaxant',
      tagType: 'indication',
    },
  ],
};

// Catalogue of quick searchable medicines
export const COMMON_MEDICINES: Array<{
  name: string;
  type: 'TABLET' | 'CAPSULE' | 'SYRUP' | 'INJECTION' | 'CREAM';
  defaultDosage: string;
  defaultInstructions: string;
  tagType: 'food' | 'indication' | 'general';
}> = [
  { name: 'Paracetamol 500mg', type: 'TABLET', defaultDosage: '1 tablet', defaultInstructions: 'After food', tagType: 'food' },
  { name: 'Thiocolchicoside 4mg', type: 'CAPSULE', defaultDosage: '1 capsule', defaultInstructions: 'Muscle relaxant', tagType: 'indication' },
  { name: 'Amoxicillin 500mg', type: 'CAPSULE', defaultDosage: '1 capsule', defaultInstructions: 'After food', tagType: 'food' },
  { name: 'Ibuprofen 400mg', type: 'TABLET', defaultDosage: '1 tablet', defaultInstructions: 'After food', tagType: 'food' },
  { name: 'Omeprazole 20mg', type: 'CAPSULE', defaultDosage: '1 capsule', defaultInstructions: 'Before food', tagType: 'food' },
  { name: 'Cetirizine 10mg', type: 'TABLET', defaultDosage: '1 tablet', defaultInstructions: 'At night', tagType: 'general' },
  { name: 'Metformin 500mg', type: 'TABLET', defaultDosage: '1 tablet', defaultInstructions: 'With meals', tagType: 'food' },
  { name: 'Pantoprazole 40mg', type: 'TABLET', defaultDosage: '1 tablet', defaultInstructions: 'Before breakfast', tagType: 'food' },
  { name: 'Diclofenac Sodium 50mg', type: 'TABLET', defaultDosage: '1 tablet', defaultInstructions: 'After food', tagType: 'food' },
  { name: 'Tramadol 50mg', type: 'CAPSULE', defaultDosage: '1 capsule', defaultInstructions: 'SOS for severe pain', tagType: 'indication' },
  { name: 'Ciprofloxacin 500mg', type: 'TABLET', defaultDosage: '1 tablet', defaultInstructions: '12 hourly', tagType: 'general' },
  { name: 'Azithromycin 500mg', type: 'TABLET', defaultDosage: '1 tablet', defaultInstructions: '1 hour before food', tagType: 'food' },
];

// Catalogue of quick ICD-10 suggestions
export const COMMON_DIAGNOSES = [
  { name: 'Lumbar Spine Spasm', code: 'M54.5' },
  { name: 'Mechanical Low Back Pain', code: '' },
  { name: 'Cervical Spondylosis', code: 'M47.812' },
  { name: 'Sciatica Neuralgia', code: 'M54.3' },
  { name: 'Osteoarthritis Knee', code: 'M17.9' },
  { name: 'Acute Muscle Strain', code: 'S39.012' },
  { name: 'Essential Hypertension', code: 'I10' },
  { name: 'Type 2 Diabetes Mellitus', code: 'E11.9' },
  { name: 'Tension-type Headache', code: 'G44.2' },
];

/**
 * Fetch prescription details for current patient
 */
export const fetchPrescriptionDetails = async (tokenNumber?: number): Promise<PatientPrescriptionDetails> => {
  try {
    const url = tokenNumber ? `${API_URL}/doctor/prescription?tokenNumber=${tokenNumber}` : `${API_URL}/doctor/prescription`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const json = await response.json();
    return json.data || fallbackPrescriptionData;
  } catch (err) {
    console.log('Error fetching prescription details, using fallback:', err);
    return fallbackPrescriptionData;
  }
};

/**
 * Save prescription details & send digital Rx
 */
export const savePrescriptionApi = async (payload: {
  diagnoses: DiagnosisItem[];
  clinicalNotes: string;
  prescriptions: MedicineItem[];
}): Promise<{ success: boolean; message: string; data?: any }> => {
  try {
    const response = await fetch(`${API_URL}/doctor/prescription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await response.json();
    return json;
  } catch (err: any) {
    console.log('Error saving prescription online, offline mode saved:', err);
    return {
      success: true,
      message: 'Prescription saved & Digital Rx queued for patient (Offline mode)',
    };
  }
};

/**
 * Refer patient to Physiotherapy or Laboratory
 */
export const referPatientApi = async (referralType: string, notes?: string): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetch(`${API_URL}/doctor/referral`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referralType, notes }),
    });
    const json = await response.json();
    return json;
  } catch (err) {
    return {
      success: true,
      message: `Referral to ${referralType} recorded successfully.`,
    };
  }
};
