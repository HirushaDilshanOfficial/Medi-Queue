import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Image,
  Alert,
  Modal,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DoctorTopBar, DoctorBottomNav } from '../../components/doctor';
import { useTheme } from '../../theme/ThemeContext';
import { fetchDoctorDashboard } from '../../services/doctorService';
import {
  fetchPrescriptionDetails,
  savePrescriptionApi,
  referPatientApi,
  PatientPrescriptionDetails,
  MedicineItem,
  DiagnosisItem,
  COMMON_MEDICINES,
  COMMON_DIAGNOSES,
  fallbackPrescriptionData,
  blankPrescriptionData,
  aureliaPrescriptionData,
} from '../../services/prescriptionService';
import {
  ALL_DUMMY_PATIENTS,
  checkMedicationAllergy,
  checkMedicationAllergyWithList,
  getDefaultAllergiesForPatient,
  AllergyItem,
} from '../../services/patientRecordsService';
import AllergyAlertSection from '../../components/doctor/AllergyAlertSection';
import { downloadPrescription } from '../../utils/prescriptionPdfGenerator';

export default function PatientPrescriptionScreen() {
  const { t } = useLanguage();
  const { isDark } = useTheme();

  const params = useLocalSearchParams<{ tokenNumber?: string; patientName?: string; patientId?: string }>();
  const initialToken = params?.tokenNumber ? parseInt(params.tokenNumber, 10) : undefined;
  const isAurelia = params?.patientName
    ? String(params.patientName).toLowerCase().includes('aurelia')
    : initialToken === 29;

  const [data, setData] = useState<PatientPrescriptionDetails>(() => {
    const base = isAurelia ? { ...aureliaPrescriptionData } : { ...blankPrescriptionData };
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const uStr = window.localStorage.getItem('user');
        if (uStr) {
          const u = JSON.parse(uStr);
          if (u.fullName || u.name) {
            base.doctor = {
              ...base.doctor,
              name: u.fullName || u.name,
              room: u.room || 'Room 3B',
            };
          }
        }
      }
    } catch (e) {}

    if (params?.patientName) {
      base.patient = {
        ...base.patient,
        name: params.patientName,
        initials: params.patientName
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2) || 'PT',
      };
    }
    if (initialToken) {
      base.patient = {
        ...base.patient,
        tokenNumber: initialToken,
        tokenFormatted: `Token #${String(initialToken).padStart(3, '0')}`,
      };
    }
    return base;
  });
  const [currentHospital, setCurrentHospital] = useState<string>('Colombo Teaching Hospital 1');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'queue' | 'records' | 'schedule' | 'rx'>('rx');

  // Interactive Form State
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedFrequency, setSelectedFrequency] = useState<'OD' | 'BD' | 'TDS' | 'QDS'>('BD');
  const [selectedDuration, setSelectedDuration] = useState<number>(5);
  const [mealTiming, setMealTiming] = useState<'After meal' | 'Before meal'>('After meal');
  const [takeMorning, setTakeMorning] = useState(true);
  const [takeAfternoon, setTakeAfternoon] = useState(false);
  const [takeNight, setTakeNight] = useState(true);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [clinicalNotes, setClinicalNotes] = useState(
    isAurelia ? aureliaPrescriptionData.clinicalNotes : ''
  );
  const [isSaving, setIsSaving] = useState(false);
  const [addMedError, setAddMedError] = useState<string | null>(null);

  // Modal states
  const [isAddDiagnosisModalOpen, setIsAddDiagnosisModalOpen] = useState(false);
  const [newDiagName, setNewDiagName] = useState('');
  const [newDiagCode, setNewDiagCode] = useState('');
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [referralType, setReferralType] = useState('Physiotherapy');
  const [referralNotes, setReferralNotes] = useState('');
  const [isSaveSuccessModalOpen, setIsSaveSuccessModalOpen] = useState(false);

  // In-app confirmation dialog states (no browser window.confirm)
  const [deleteMedTarget, setDeleteMedTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteDiagTarget, setDeleteDiagTarget] = useState<{ id: string; name: string } | null>(null);
  const [pendingAllergyConflictMed, setPendingAllergyConflictMed] = useState<{
    med: MedicineItem;
    allergen: string;
    note: string;
  } | null>(null);

  // Edit Medicine Modal State
  const [isEditMedModalOpen, setIsEditMedModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<MedicineItem | null>(null);
  const [editMedName, setEditMedName] = useState('');
  const [editMedType, setEditMedType] = useState<MedicineItem['type']>('TABLET');
  const [editMedDosage, setEditMedDosage] = useState('');
  const [editMedFrequency, setEditMedFrequency] = useState<'OD' | 'BD' | 'TDS' | 'QDS'>('BD');
  const [editMedDuration, setEditMedDuration] = useState<number>(5);
  const [editMealTiming, setEditMealTiming] = useState<'After meal' | 'Before meal'>('After meal');
  const [editTakeMorning, setEditTakeMorning] = useState(true);
  const [editTakeLunch, setEditTakeLunch] = useState(false);
  const [editTakeDinner, setEditTakeDinner] = useState(true);
  const [editCustomNotes, setEditCustomNotes] = useState('');

  // Persistent auto-sync helper: writes to AsyncStorage and backend API
  const persistPrescription = useCallback(async (updatedData: PatientPrescriptionDetails) => {
    const tokenNum = updatedData.patient?.tokenNumber || (params?.tokenNumber ? parseInt(params.tokenNumber, 10) : 29);
    const cacheKey = `@medi_queue_prescription_${tokenNum}`;

    // 1. Immediately cache locally
    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify(updatedData));
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(cacheKey, JSON.stringify(updatedData));
      }
    } catch (e) {
      console.log('Error caching prescription:', e);
    }

    // 2. Sync to Backend API
    try {
      await savePrescriptionApi({
        diagnoses: updatedData.diagnoses,
        clinicalNotes: updatedData.clinicalNotes,
        prescriptions: updatedData.prescriptions,
        tokenNumber: tokenNum,
      });
    } catch (e) {
      console.log('Error syncing prescription with backend:', e);
    }
  }, [params?.tokenNumber]);

  // Helper to extract patient's current medications from patient records
  const getRecordMeds = useCallback((): MedicineItem[] => {
    const tokenNum = params?.tokenNumber ? parseInt(params.tokenNumber, 10) : 29;
    const patRecord = ALL_DUMMY_PATIENTS.find(
      (p) => p.tokenNumber === tokenNum || (params?.patientName && p.name.includes(params.patientName))
    );
    if (patRecord && patRecord.medications && patRecord.medications.length > 0) {
      return patRecord.medications.map((m, idx) => ({
        id: m.id ? `rx-${m.id}` : `rx-rec-${idx}`,
        name: `${m.drugName} ${m.dose}`.trim(),
        type: m.drugName.toLowerCase().includes('inhaler') ? ('INHALER' as any) : 'TABLET',
        dosage: m.dose || '1 tablet',
        frequency: m.frequency || 'Every 6 hours, as needed',
        frequencyCode: m.frequency.toLowerCase().includes('every 6') ? 'TDS' : m.frequency.toLowerCase().includes('2 puff') ? 'BD' : 'BD',
        duration: m.duration || (m.drugName.toLowerCase().includes('inhaler') ? 'As needed' : '5 days'),
        durationDays: 5,
        instructions: m.sinceDate ? `${m.sinceDate}` : 'After food',
        tagType: m.drugName.toLowerCase().includes('inhaler') ? 'indication' : 'food',
      }));
    }
    return [];
  }, [params?.tokenNumber, params?.patientName]);

  // Load prescription details
  const loadData = useCallback(async () => {
    try {
      let tokenNum = params?.tokenNumber ? parseInt(params.tokenNumber, 10) : undefined;
      let patientName = params?.patientName;
      let patientId = params?.patientId;

      // Check current doctor dashboard to identify active consultation patient
      try {
        const dash = await fetchDoctorDashboard();
        if (dash?.currentPatient) {
          if (!tokenNum && !patientName && !patientId) {
            tokenNum = dash.currentPatient.tokenNumber;
            patientName = dash.currentPatient.patientName;
            patientId = dash.currentPatient.patientId;
          }
          // Immediately sync patient card header if current data has a placeholder or mismatched patient
          setData((prev) => {
            const isOutdatedOrPlaceholder =
              !prev?.patient?.name ||
              prev.patient.name === 'Patient Normal' ||
              prev.patient.name.toLowerCase().includes('walkin') ||
              (dash.currentPatient && prev.patient.name !== dash.currentPatient.patientName && !params?.patientName);

            if (isOutdatedOrPlaceholder && dash.currentPatient) {
              const cp = dash.currentPatient;
              const nameParts = (cp.patientName || 'Patient').split(' ');
              const initials = nameParts.map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'PT';
              return {
                ...prev,
                patient: {
                  ...prev.patient,
                  id: cp.patientId || prev.patient.id,
                  name: cp.patientName,
                  tokenNumber: cp.tokenNumber,
                  tokenFormatted: `Token #${String(cp.tokenNumber).padStart(3, '0')}`,
                  initials,
                  gender: cp.gender || prev.patient.gender,
                  age: cp.age || prev.patient.age,
                  opdId: (cp as any)?.nic ? `ID #${(cp as any).nic}` : (cp.fileRecord || prev.patient.opdId),
                  vitals: {
                    bloodPressure: cp.bloodPressure || '120/80',
                    pulseRate: cp.heartRate || '74 bpm',
                    weight: prev.patient.vitals?.weight || '-- kg',
                  },
                },
              };
            }
            return prev;
          });
        }

        // Sync doctor info from logged in user and dashboard
        let loggedDocName = '';
        let loggedDocRoom = '';
        const userStr = await AsyncStorage.getItem('user');
        if (userStr) {
          const u = JSON.parse(userStr);
          loggedDocName = u.fullName || u.name || '';
          loggedDocRoom = u.room || '';
        }
        if (!loggedDocName && dash?.doctor?.name) {
          loggedDocName = dash.doctor.name;
        }
        if (!loggedDocRoom && dash?.doctor?.room) {
          loggedDocRoom = dash.doctor.room;
        }
        if (loggedDocName || loggedDocRoom) {
          setData((prev) => ({
            ...prev,
            doctor: {
              ...prev.doctor,
              ...(loggedDocName ? { name: loggedDocName } : {}),
              ...(loggedDocRoom ? { room: loggedDocRoom } : {}),
            },
          }));
        }
      } catch (e) {}

      if (!tokenNum && !patientName && !patientId) {
        try {
          const cachedToken = await AsyncStorage.getItem('active_record_patient_token');
          if (cachedToken) tokenNum = parseInt(cachedToken, 10);
          const cachedName = await AsyncStorage.getItem('active_record_patient_name');
          if (cachedName && !patientName) patientName = cachedName;
        } catch (e) {}
      }

      const cacheKey = tokenNum ? `@medi_queue_prescription_${tokenNum}` : '@medi_queue_prescription_active';

      // 0. Read active hospital assigned to doctor
      try {
        const storedHosp = await AsyncStorage.getItem('doctor_current_hospital');
        if (storedHosp) {
          setCurrentHospital(storedHosp);
        }
      } catch (hospErr) {}

      // 1. Read local cache if available (skip stale mock walk-ins)
      try {
        let raw = await AsyncStorage.getItem(cacheKey);
        if (!raw && typeof window !== 'undefined' && window.localStorage) {
          raw = window.localStorage.getItem(cacheKey);
        }
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.diagnoses) && Array.isArray(parsed.prescriptions)) {
            const cachedPName = parsed.patient?.name || '';
            const isNameMismatch = Boolean(
              patientName &&
              cachedPName &&
              !cachedPName.toLowerCase().includes(patientName.toLowerCase()) &&
              !patientName.toLowerCase().includes(cachedPName.toLowerCase())
            );
            const isStaleWalkin =
              cachedPName.toLowerCase().includes('walkin') ||
              cachedPName === 'Patient Normal' ||
              isNameMismatch;
            if (!isStaleWalkin) {
              setData(parsed);
              if (parsed.clinicalNotes !== undefined) {
                setClinicalNotes(parsed.clinicalNotes);
              }
            }
          }
        }
      } catch (cacheErr) {
        console.log('Error reading local cache:', cacheErr);
      }

      // 2. Fetch from backend API
      const res = await fetchPrescriptionDetails(tokenNum, patientName, patientId);
      if (res && res.patient) {
        setData(res);
        setClinicalNotes(res.clinicalNotes || '');
        await AsyncStorage.setItem(cacheKey, JSON.stringify(res));
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(cacheKey, JSON.stringify(res));
        }
      }
    } catch (err) {
      console.log('Error loading prescription data:', err);
    } finally {
      setLoading(false);
    }
  }, [params?.tokenNumber, params?.patientName, params?.patientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Tab Navigation Handler
  const handleTabPress = (tab: 'home' | 'queue' | 'records' | 'schedule' | 'rx') => {
    setActiveTab(tab);
    if (tab === 'home') {
      try {
        router.push('/(doctor)/dashboard' as any);
      } catch (e) {
        router.push('/dashboard' as any);
      }
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          router.push('/(doctor)/dashboard' as any);
        }, 120);
      }
    } else if (tab === 'queue') {
      try {
        router.push('/(doctor)/queue' as any);
      } catch (e) {
        router.push('/queue' as any);
      }
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          router.push('/(doctor)/queue' as any);
        }, 120);
      }
    } else if (tab === 'records') {
      const p = data?.patient;
      if (p) {
        try {
          router.push({
            pathname: '/(doctor)/records' as any,
            params: {
              patientId: (p as any).patientId || '',
              patientName: p.name,
              tokenNumber: String(p.tokenNumber),
            },
          });
        } catch (e) {
          router.push('/(doctor)/records' as any);
        }
      } else {
        try {
          router.push('/(doctor)/records' as any);
        } catch (e) {
          router.push('/records' as any);
        }
      }
    } else if (tab === 'schedule') {
      try {
        router.push('/(doctor)/schedule' as any);
      } catch (e) {
        router.push('/schedule' as any);
      }
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          router.push('/(doctor)/schedule' as any);
        }, 120);
      }
    } else if (tab === 'rx') {
      // already on Rx screen
    }
  };

  // Remove diagnosis chip (triggers custom in-app modal)
  const handleRemoveDiagnosis = (id: string, name?: string) => {
    setDeleteDiagTarget({ id, name: name || 'this diagnosis' });
  };

  const confirmRemoveDiagnosis = () => {
    if (!deleteDiagTarget) return;
    const { id } = deleteDiagTarget;
    setData((prev) => {
      const nextDiagnoses = prev.diagnoses.filter((d) => d.id !== id);
      const nextData = { ...prev, diagnoses: nextDiagnoses, clinicalNotes };
      persistPrescription(nextData);
      return nextData;
    });
    setDeleteDiagTarget(null);
  };

  // Add diagnosis
  const handleAddDiagnosis = (name: string, code?: string) => {
    if (!name.trim()) return;
    const displayName = code && code.trim() ? `${name.trim()} (${code.trim()})` : name.trim();
    const newDiag: DiagnosisItem = {
      id: `diag-${Date.now()}`,
      name: name.trim(),
      code: code ? code.trim() : undefined,
      displayName,
      isPrimary: data.diagnoses.length === 0,
    };
    setData((prev) => {
      const nextDiagnoses = [...prev.diagnoses, newDiag];
      const nextData = { ...prev, diagnoses: nextDiagnoses, clinicalNotes };
      persistPrescription(nextData);
      return nextData;
    });
    setNewDiagName('');
    setNewDiagCode('');
    setIsAddDiagnosisModalOpen(false);
  };

  // Remove medicine item (triggers custom in-app modal)
  const handleRemoveMedicine = (id: string, name: string) => {
    setDeleteMedTarget({ id, name });
  };

  const confirmRemoveMedicine = () => {
    if (!deleteMedTarget) return;
    const { id } = deleteMedTarget;
    setData((prev) => {
      const nextPrescriptions = prev.prescriptions.filter((m) => m.id !== id);
      const nextData = { ...prev, prescriptions: nextPrescriptions, clinicalNotes };
      persistPrescription(nextData);
      return nextData;
    });
    setDeleteMedTarget(null);
  };

  // Helper to format medicine instructions with meal timing and times of day
  const formatInstructions = (
    timing: 'After meal' | 'Before meal',
    morning: boolean,
    slot2: boolean,
    slot3: boolean,
    nightOrNote?: boolean | string,
    extraNote?: string
  ): string => {
    let note: string | undefined = undefined;
    const times: string[] = [];
    if (morning) times.push('Morning');

    if (typeof nightOrNote === 'boolean') {
      // Legacy call: morning, lunch/afternoon, dinner, night
      if (slot2) times.push('Afternoon');
      if (slot3) times.push('Dinner');
      if (nightOrNote) times.push('Night');
      note = extraNote;
    } else {
      // 3-time-of-day slots: morning, afternoon (slot2), night (slot3)
      if (slot2) times.push('Afternoon');
      if (slot3) times.push('Night');
      if (typeof nightOrNote === 'string') {
        note = nightOrNote;
      }
    }

    let res = timing;
    if (times.length > 0) {
      res += ` (${times.join(', ')})`;
    }
    if (note && note.trim()) {
      const clean = note.trim();
      if (!res.toLowerCase().includes(clean.toLowerCase())) {
        res += ` • ${clean}`;
      }
    }
    return res;
  };

  // Helper when selecting frequency in Add Medicine (auto-fills suggested slots)
  const handleSelectFrequency = (freq: 'OD' | 'BD' | 'TDS' | 'QDS') => {
    setSelectedFrequency(freq);
    if (freq === 'OD') {
      setTakeMorning(true);
      setTakeAfternoon(false);
      setTakeNight(false);
    } else if (freq === 'BD') {
      setTakeMorning(true);
      setTakeAfternoon(false);
      setTakeNight(true);
    } else if (freq === 'TDS') {
      setTakeMorning(true);
      setTakeAfternoon(true);
      setTakeNight(true);
    } else if (freq === 'QDS') {
      setTakeMorning(true);
      setTakeAfternoon(true);
      setTakeNight(true);
    }
  };

  // Helper when selecting frequency in Edit Medicine
  const handleSelectEditFrequency = (freq: 'OD' | 'BD' | 'TDS' | 'QDS') => {
    setEditMedFrequency(freq);
    if (freq === 'OD') {
      setEditTakeMorning(true);
      setEditTakeLunch(false);
      setEditTakeDinner(false);
    } else if (freq === 'BD') {
      setEditTakeMorning(true);
      setEditTakeLunch(false);
      setEditTakeDinner(true);
    } else if (freq === 'TDS' || freq === 'QDS') {
      setEditTakeMorning(true);
      setEditTakeLunch(true);
      setEditTakeDinner(true);
    }
  };

  // Start editing medicine
  const handleStartEditMedicine = (med: MedicineItem) => {
    setEditingMed(med);
    setEditMedName(med.name);
    setEditMedType(med.type || 'TABLET');
    setEditMedDosage(med.dosage || '');
    const freq = med.frequencyCode || 'BD';
    setEditMedFrequency(freq);
    setEditMedDuration(med.durationDays || 5);

    const rawInstr = med.instructions || '';
    const isBefore = rawInstr.toLowerCase().includes('before');
    setEditMealTiming(isBefore ? 'Before meal' : 'After meal');

    const hasMorn = rawInstr.toLowerCase().includes('morning') || rawInstr.toLowerCase().includes('breakfast');
    const hasLun = rawInstr.toLowerCase().includes('lunch') || rawInstr.toLowerCase().includes('noon');
    const hasDin = rawInstr.toLowerCase().includes('dinner') || rawInstr.toLowerCase().includes('night');

    if (hasMorn || hasLun || hasDin) {
      setEditTakeMorning(hasMorn);
      setEditTakeLunch(hasLun);
      setEditTakeDinner(hasDin);
    } else {
      setEditTakeMorning(true);
      setEditTakeLunch(freq === 'TDS' || freq === 'QDS');
      setEditTakeDinner(freq === 'BD' || freq === 'TDS' || freq === 'QDS');
    }

    // Clean out timing keywords to keep only extra indications/notes
    const cleanedNote = rawInstr
      .replace(/before\s*(meal|food)/gi, '')
      .replace(/after\s*(meal|food)/gi, '')
      .replace(/\(?(morning|lunch|dinner|night|breakfast|noon|,\s*)+\)?/gi, '')
      .replace(/^[\s•\-,]+|[\s•\-,]+$/g, '')
      .trim();
    setEditCustomNotes(cleanedNote);
    setIsEditMedModalOpen(true);
  };

  // Update existing medicine
  const handleUpdateMedicine = () => {
    if (!editingMed || !editMedName.trim()) return;

    const freqLabels: Record<'OD' | 'BD' | 'TDS' | 'QDS', string> = {
      OD: 'OD (1x daily)',
      BD: 'BD (2x daily)',
      TDS: 'TDS (3x daily)',
      QDS: 'QDS (4x daily)',
    };

    const instructions = formatInstructions(
      editMealTiming,
      editTakeMorning,
      editTakeLunch,
      editTakeDinner,
      editCustomNotes
    );

    const updatedMed: MedicineItem = {
      ...editingMed,
      name: editMedName.trim(),
      type: editMedType,
      dosage: editMedDosage.trim() || editingMed.dosage,
      frequency: freqLabels[editMedFrequency] || editMedFrequency,
      frequencyCode: editMedFrequency,
      duration: `${editMedDuration} days`,
      durationDays: editMedDuration,
      instructions,
    };

    const nextPrescriptions = data.prescriptions.map((m) =>
      m.id === editingMed.id ? updatedMed : m
    );
    const nextData = { ...data, prescriptions: nextPrescriptions, clinicalNotes };
    setData(nextData);
    persistPrescription(nextData);
    setIsEditMedModalOpen(false);
    setEditingMed(null);
  };

  const tokenNum = params?.tokenNumber ? parseInt(params.tokenNumber, 10) : (data?.patient?.tokenNumber || 1);
  const currentPatientRecord = useMemo(() => {
    return (
      ALL_DUMMY_PATIENTS.find(
        (p) =>
          p.tokenNumber === tokenNum ||
          (params?.patientName && p.name.includes(params.patientName)) ||
          (data?.patient && p.name === data.patient.name)
      ) || undefined
    );
  }, [tokenNum, params?.patientName, data?.patient]);

  const patientAllergy = data?.patient?.allergy || currentPatientRecord?.allergy;

  const [currentAllergies, setCurrentAllergies] = useState<AllergyItem[]>(() => {
    return (data?.patient as any)?.allergies || (currentPatientRecord ? getDefaultAllergiesForPatient(currentPatientRecord) : []);
  });

  useEffect(() => {
    if (data?.patient) {
      const pAllergies = (data.patient as any)?.allergies;
      if (Array.isArray(pAllergies)) {
        setCurrentAllergies(pAllergies);
      } else if (currentPatientRecord) {
        setCurrentAllergies(getDefaultAllergiesForPatient(currentPatientRecord));
      } else {
        setCurrentAllergies([]);
      }
    }
  }, [data?.patient?.tokenNumber, data?.patient?.name, currentPatientRecord]);

  const handleAllergiesChange = useCallback((updatedList: AllergyItem[]) => {
    setCurrentAllergies(updatedList);
    if (updatedList.length > 0) {
      const topAllergy = updatedList[0];
      setData((prev) => ({
        ...prev,
        patient: {
          ...prev.patient,
          allergy: {
            hasAllergy: true,
            isHighRisk: topAllergy.severity === 'life-threatening' || topAllergy.severity === 'severe',
            title: `Allergy alert • ${topAllergy.reaction}`,
            description: `${topAllergy.allergen}${topAllergy.note ? ' – ' + topAllergy.note : ''}`,
          },
        },
      }));
    } else {
      setData((prev) => ({
        ...prev,
        patient: {
          ...prev.patient,
          allergy: {
            hasAllergy: false,
            title: 'No known allergies',
            description: 'Patient has no documented medication allergies.',
          },
        },
      }));
    }
  }, []);

  const allergyConflict = useMemo(() => {
    if (!searchQuery.trim()) return null;
    if (currentAllergies && currentAllergies.length > 0) {
      const check = checkMedicationAllergyWithList(searchQuery, currentAllergies);
      if (check.status === 'conflict') {
        return check;
      }
      return null;
    }
    if (!currentPatientRecord) return null;
    const check = checkMedicationAllergy(searchQuery, currentPatientRecord);
    if (check.status === 'conflict') {
      return check;
    }
    return null;
  }, [searchQuery, currentAllergies, currentPatientRecord]);

  // Commit a new medicine to prescription
  const commitAddMedicine = (itemToSave: MedicineItem) => {
    setData((prev) => {
      const nextPrescriptions = [...prev.prescriptions, itemToSave];
      const nextData = { ...prev, prescriptions: nextPrescriptions, clinicalNotes };
      persistPrescription(nextData);
      return nextData;
    });
    setSearchQuery('');
    setShowSuggestions(false);
  };

  // Add medicine to prescription
  const handleAddMedicine = () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setAddMedError('Please enter a medicine name & strength');
      if (Platform.OS === 'web') {
        window.alert('Please enter or select a medicine name & strength.');
      } else {
        Alert.alert(t('Medicine Required'), t('Please enter or select a medicine name & strength.'));
      }
      return;
    }
    setAddMedError(null);

    const selectedSlotsCount = [takeMorning, takeAfternoon, takeNight].filter(Boolean).length;
    if (selectedSlotsCount === 0) {
      setAddMedError('Please select at least one time of day');
      return;
    }
    if (selectedDuration <= 0) {
      setAddMedError('Duration must be greater than 0');
      return;
    }

    const matchedCatalog = COMMON_MEDICINES.find(
      (m) => m.name.toLowerCase() === trimmed.toLowerCase()
    );

    const freqLabels: Record<'OD' | 'BD' | 'TDS' | 'QDS', string> = {
      OD: 'OD (1x daily)',
      BD: 'BD (2x daily)',
      TDS: 'TDS (3x daily)',
      QDS: 'QDS (4x daily)',
    };

    const type = matchedCatalog
      ? matchedCatalog.type
      : trimmed.toLowerCase().includes('inhaler')
      ? ('INHALER' as any)
      : 'TABLET';
    const dosage = matchedCatalog ? matchedCatalog.defaultDosage : '1 dose';
    const instructions = formatInstructions(mealTiming, takeMorning, takeAfternoon, takeNight);
    const tagType = 'food';

    const newItem: MedicineItem = {
      id: `rx-${Date.now()}`,
      name: trimmed,
      type,
      dosage,
      frequency: freqLabels[selectedFrequency],
      frequencyCode: selectedFrequency,
      duration: `${selectedDuration} days`,
      durationDays: selectedDuration,
      instructions,
      tagType,
    };

    if (allergyConflict) {
      setPendingAllergyConflictMed({
        med: newItem,
        allergen: allergyConflict.allergen || 'Known Allergen',
        note: allergyConflict.note || '',
      });
      return;
    }

    commitAddMedicine(newItem);
  };

  const confirmOverrideAllergyConflict = () => {
    if (!pendingAllergyConflictMed) return;
    commitAddMedicine(pendingAllergyConflictMed.med);
    setPendingAllergyConflictMed(null);
  };

  // Save Prescription & Download PDF
  const handleSavePrescription = async () => {
    setIsSaving(true);
    try {
      let activeHospital = currentHospital;
      try {
        const h = await AsyncStorage.getItem('doctor_current_hospital');
        if (h) activeHospital = h;
      } catch (e) {}

      const nextData: PatientPrescriptionDetails = {
        ...data,
        clinicalNotes,
        hospitalName: activeHospital,
        doctor: {
          ...data.doctor,
          hospitalName: activeHospital,
        },
      };
      await persistPrescription(nextData);
      await downloadPrescription(nextData, clinicalNotes);
      setIsSaveSuccessModalOpen(true);
    } catch (err) {
      Alert.alert(t('Saved Offline'), t('Prescription details saved locally and queued for dispatch.'));
    } finally {
      setIsSaving(false);
    }
  };

  // Submit Referral
  const handleSubmitReferral = async () => {
    setIsSaving(true);
    try {
      await referPatientApi(referralType, referralNotes);
      setIsReferralModalOpen(false);
      setReferralNotes('');
      Alert.alert(t('Referral Dispatched'), t("Referral request for {value0} recorded for patient.", { value0: String(referralType) }));
    } catch (e) {
      setIsReferralModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered medicine suggestions
  const filteredSuggestions = searchQuery.trim()
    ? COMMON_MEDICINES.filter((m) =>
        m.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : [];

  const patient = data.patient;
  const doctor = data.doctor;

  if (loading && (!data?.patient?.name || data.patient.name === 'Patient Normal')) {
    return (
      <View style={[styles.safeContainer, isDark && { backgroundColor: '#091012' }]}>
        <StatusBar barStyle="light-content" backgroundColor="#0E7C86" />
        <DoctorTopBar
          doctorName={doctor.name}
          room={doctor.room}
          unreadCount={4}
        />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#0E7C86" />
          <Text style={{ marginTop: 14, color: isDark ? '#9db8bc' : '#688990', fontSize: 15, fontWeight: '500' }}>
            {t('Loading consultation details...')}
          </Text>
        </View>
        <DoctorBottomNav activeTab="rx" />
      </View>
    );
  }

  return (
    <View style={[styles.safeContainer, isDark && { backgroundColor: '#091012' }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0E7C86" />

      {/* SHARED TOP BAR */}
      <DoctorTopBar
        doctorName={doctor.name}
        room={doctor.room}
        unreadCount={4}
      />

      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ========================================================= */}
          {/* 2. PAGE TITLE & OUTPATIENT CONSULTATION HEADER             */}
          {/* ========================================================= */}
          <View style={styles.headerTitleSection}>
            <Text style={[styles.kickerText, isDark && { color: "#3BD1DF" }]}>{t("Outpatient consultation")}</Text>
            <View style={styles.titleRow}>
              <Text style={[styles.mainTitle, isDark && { color: '#EEF8FA' }]}>{t("Prescription & details")}</Text>
              <View style={[styles.roomPillBadge, isDark && { backgroundColor: "#18383E", borderColor: "#23525B" }]}>
                <View style={styles.roomPillDot} />
                <Text style={[styles.roomPillText, isDark && { color: "#3BD1DF" }]}>{doctor.room}</Text>
              </View>
            </View>
          </View>

          {/* ========================================================= */}
          {/* 3. PATIENT PROFILE CARD                                    */}
          {/* ========================================================= */}
          <View style={[styles.card, isDark && { backgroundColor: '#142528', borderColor: '#1F383C' }]}>
            {/* Top row with Initials Avatar, Name/ID, and Token Badge */}
            <View style={styles.patientTopRow}>
              <View style={[styles.initialsAvatar, isDark && { backgroundColor: "#18383E", borderColor: "#23525B" }]}>
                <Text style={[styles.initialsText, isDark && { color: "#3BD1DF" }]}>{patient.initials || "KG"}</Text>
              </View>

              <View style={styles.patientInfoCol}>
                <Text style={[styles.patientName, isDark && { color: '#EEF8FA' }]}>{patient.name}</Text>
                <Text style={[styles.patientMeta, isDark && { color: "#86A4A9" }]}>
                  {t(patient.gender ?? '')}, {patient.age} {t("yrs •")}{' '}{patient.opdId}
                </Text>
              </View>

              <View style={[styles.tokenBadge, isDark && { backgroundColor: "#18383E", borderColor: "#23525B" }]}>
                <Text style={[styles.tokenBadgeText, isDark && { color: "#3BD1DF" }]}>{patient.tokenFormatted || t("Token #028")}</Text>
              </View>
            </View>

            {/* Vitals 3-column row */}
            <View style={styles.vitalsRow}>
              {/* Blood Pressure */}
              <View style={[styles.vitalBox, isDark && { backgroundColor: '#18383E', borderColor: '#23525B' }]}>
                <Text style={[styles.vitalLabel, isDark && { color: '#86A4A9' }]}>{t("Blood Pressure")}</Text>
                <Text style={[styles.vitalValue, isDark && { color: '#EEF8FA' }]}>{patient.vitals.bloodPressure}</Text>
              </View>

              {/* Pulse Rate */}
              <View style={[styles.vitalBox, isDark && { backgroundColor: '#18383E', borderColor: '#23525B' }]}>
                <Text style={[styles.vitalLabel, isDark && { color: '#86A4A9' }]}>{t("Pulse Rate")}</Text>
                <Text style={[styles.vitalValue, isDark && { color: '#EEF8FA' }]}>{patient.vitals.pulseRate}</Text>
              </View>

              {/* Weight */}
              <View style={[styles.vitalBox, isDark && { backgroundColor: '#18383E', borderColor: '#23525B' }]}>
                <Text style={[styles.vitalLabel, isDark && { color: '#86A4A9' }]}>{t("Weight")}</Text>
                <Text style={[styles.vitalValue, isDark && { color: '#EEF8FA' }]}>{patient.vitals.weight || (currentPatientRecord?.vitals?.weightNum ? `${currentPatientRecord.vitals.weightNum} kg` : '-- kg')}</Text>
              </View>
            </View>
          </View>

          {/* ========================================================= */}
          {/* 3.1 REDESIGNED ALLERGY ALERT SECTION                       */}
          {/* ========================================================= */}
          <AllergyAlertSection
            patientId={patient.id}
            tokenNumber={patient.tokenNumber}
            patientName={patient.name}
            patientRecord={currentPatientRecord}
            initialAllergies={currentAllergies}
            onAllergiesChange={handleAllergiesChange}
          />

          {/* ========================================================= */}
          {/* 4. PRIMARY DIAGNOSIS (ICD-10) CARD                        */}
          {/* ========================================================= */}
          <View style={[styles.card, isDark && { backgroundColor: '#142528', borderColor: '#1F383C' }]}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <MaterialCommunityIcons name="stethoscope" size={20} color="#0d6371" style={{ marginRight: 8 }} />
                <Text style={[styles.cardSectionTitle, isDark && { color: '#EEF8FA' }]}>{t("Primary Diagnosis (ICD-10)")}</Text>
              </View>

              <TouchableOpacity
                onPress={() => setIsAddDiagnosisModalOpen(true)}
                style={[styles.addDiagnosisBtn, isDark && { backgroundColor: "#18383E", borderColor: "#23525B" }]}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={17} color="#0d6371" style={{ marginRight: 2 }} />
                <Text style={[styles.addDiagnosisBtnText, isDark && { color: "#3BD1DF" }]}>{t("Add")}</Text>
              </TouchableOpacity>
            </View>

            {/* Diagnosis Chips Container */}
            <View style={styles.chipsWrap}>
              {data.diagnoses.map((diag, index) => {
                const isFirst = index === 0;
                return (
                  <View
                    key={diag.id}
                    style={[
                      styles.diagnosisChip,
                      isFirst ? styles.diagnosisChipPrimary : styles.diagnosisChipSecondary,
                    ]}
                  >
                    {isFirst && <View style={styles.chipGreenDot} />}
                    <Text
                      style={[
                        styles.chipText,
                        isFirst ? styles.chipTextPrimary : styles.chipTextSecondary,
                      ]}
                    >
                      {diag.displayName}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveDiagnosis(diag.id, diag.displayName)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.chipRemoveBtn}
                    >
                      <Ionicons
                        name="close"
                        size={14}
                        color={isFirst ? '#065f46' : '#64748b'}
                      />
                    </TouchableOpacity>
                  </View>
                );
              })}

              {data.diagnoses.length === 0 && (
                <Text style={[styles.emptyNote, isDark && { color: "#86A4A9" }]}>{t("No diagnosis recorded. Tap \"+ Add Diagnosis\".")}</Text>
              )}
            </View>
          </View>

          {/* ========================================================= */}
          {/* 5. CLINICAL NOTES & SYMPTOMS CARD                         */}
          {/* ========================================================= */}
          <View style={[styles.card, isDark && { backgroundColor: '#142528', borderColor: '#1F383C' }]}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <MaterialCommunityIcons
                  name="clipboard-text-outline"
                  size={20}
                  color="#0d6371"
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.cardSectionTitle, isDark && { color: '#EEF8FA' }]}>{t("Clinical Notes & Symptoms")}</Text>
              </View>
              <Text style={styles.confidentialBadge}>{t("Confidential")}</Text>
            </View>

            {/* Editable Notes Textbox */}
            <View style={[styles.notesBox, isDark && { backgroundColor: "#0F1D20", borderColor: "#1F383C" }]}>
              <TextInput
                style={[styles.notesInput, isDark && { color: "#EEF8FA" }]}
                multiline
                numberOfLines={3}
                value={clinicalNotes}
                onChangeText={setClinicalNotes}
                onBlur={() => persistPrescription({ ...data, clinicalNotes })}
                placeholder={t("Enter clinical notes, examination findings, and symptoms...")}
                placeholderTextColor="#94a3b8"
              />
              <Text style={styles.autoSavedText}>{t("Auto-saved")}</Text>
            </View>
          </View>

          {/* ========================================================= */}
          {/* 6. PRESCRIPTION LIST (Rx) CARD                             */}
          {/* ========================================================= */}
          <View style={[styles.card, isDark && { backgroundColor: '#142528', borderColor: '#1F383C' }]}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <MaterialCommunityIcons
                  name="clipboard-edit-outline"
                  size={21}
                  color="#0d6371"
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.cardSectionTitle, isDark && { color: '#EEF8FA' }]}>{t("Prescription List (Rx)")}</Text>
              </View>

              <View style={[styles.itemsCountBadge, isDark && { backgroundColor: "#18383E", borderColor: "#23525B" }]}>
                <Text style={[styles.itemsCountText, isDark && { color: "#3BD1DF" }]}>
                  {data.prescriptions.length} {data.prescriptions.length === 1 ? t('item') : t('items')}
                </Text>
              </View>
            </View>

            {/* List of Prescribed Medicines */}
            <View style={styles.prescriptionsList}>
              {data.prescriptions.map((med, idx) => {
                const isPill = med.type === 'TABLET';
                return (
                  <View key={med.id} style={styles.medCard}>
                    {/* Left Icon */}
                    <View
                      style={[
                        styles.medIconBox,
                        isPill ? styles.medIconBoxCyan : styles.medIconBoxTeal,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={(isPill ? 'pill' : 'pill-multiple') as any}
                        size={20}
                        color="#ffffff"
                      />
                    </View>

                    {/* Middle Info */}
                    <View style={styles.medInfoWrap}>
                      <View style={styles.medTitleRow}>
                        <Text style={[styles.medNameText, isDark && { color: "#EEF8FA" }]}>{med.name}</Text>
                        <View style={styles.medTypeBadge}>
                          <Text style={styles.medTypeBadgeText}>{med.type}</Text>
                        </View>
                      </View>

                      <Text style={[styles.medDetailText, isDark && { color: "#86A4A9" }]}>
                        {med.dosage} • {med.frequency} • {med.duration}
                      </Text>

                      {/* Tag pill */}
                      {med.instructions ? (
                        <View style={[styles.medInstructionPill, isDark && { backgroundColor: "#18383E" }]}>
                          <MaterialCommunityIcons
                            name={
                              med.tagType === 'food'
                                ? 'silverware-fork-knife'
                                : 'arm-flex-outline'
                            }
                            size={12}
                            color="#0d7685"
                            style={{ marginRight: 4 }}
                          />
                          <Text style={[styles.medInstructionText, isDark && { color: "#3BD1DF" }]}>{med.instructions}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Right Action Buttons: Edit & Delete */}
                    <View style={styles.medActionsRow}>
                      <TouchableOpacity
                        onPress={() => handleStartEditMedicine(med)}
                        style={styles.editMedBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <MaterialCommunityIcons name="pencil-outline" size={17} color="#0d6371" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleRemoveMedicine(med.id, med.name)}
                        style={styles.deleteMedBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={17} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}

              {data.prescriptions.length === 0 && (
                <View style={[styles.emptyPrescriptionBox, isDark && { backgroundColor: "#0F1D20", borderColor: "#1F383C" }]}>
                  <Text style={[styles.emptyPrescriptionText, isDark && { color: "#EEF8FA" }]}>{t("No medicines added yet.")}</Text>
                  <Text style={[styles.emptyPrescriptionSub, isDark && { color: "#86A4A9" }]}>
                    {t("Use the form below to search and add medications.")}</Text>
                </View>
              )}
            </View>
          </View>

          {/* ========================================================= */}
          {/* 7. ADD MEDICINE CARD (REDESIGNED)                          */}
          {/* ========================================================= */}
          <View style={[styles.cardRedesigned, isDark && { backgroundColor: "#142528", borderColor: "#1F383C" }]}>
            {/* Header */}
            <View style={styles.addMedHeaderRow}>
              <View style={styles.addMedHeaderIconWrap}>
                <MaterialCommunityIcons name="pill" size={20} color="#064e59" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.addMedHeaderTitle, isDark && { color: "#EEF8FA" }]}>{t("Add Medicine")}</Text>
                <Text style={[styles.addMedHeaderSub, isDark && { color: "#86A4A9" }]}>{t("Prescribe dosage, timing & duration")}</Text>
              </View>
              <View style={styles.rxBadge}>
                <Text style={styles.rxBadgeText}>{t("Rx Item")}</Text>
              </View>
            </View>

            {/* 1. Medicine Name & Strength */}
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, isDark && { color: "#86A4A9" }]}>{t("MEDICINE NAME & STRENGTH")}</Text>
              <View style={[styles.searchInputWrap, isDark && { backgroundColor: "#0F1D20", borderColor: "#1F383C" }, isSearchFocused && styles.searchInputWrapFocused]}>
                <Ionicons name="search-outline" size={19} color="#64748b" style={styles.searchIcon} />
                <TextInput
                  style={[styles.searchInput, isDark && { color: "#EEF8FA" }]}
                  placeholder={t("Search e.g., Amoxicillin, Ibuprofen...")}
                  placeholderTextColor="#94a3b8"
                  value={searchQuery}
                  onChangeText={(text) => {
                    setSearchQuery(text);
                    setShowSuggestions(text.trim().length > 0);
                    if (addMedError) setAddMedError(null);
                  }}
                  onFocus={() => {
                    setIsSearchFocused(true);
                    if (searchQuery.trim().length > 0) setShowSuggestions(true);
                  }}
                  onBlur={() => setIsSearchFocused(false)}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setSearchQuery('');
                      setShowSuggestions(false);
                    }}
                    style={{ padding: 4 }}
                    accessibilityLabel="Clear medicine search"
                  >
                    <Ionicons name="close-circle" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Allergy Conflict Detected Warning Banner (Red) */}
              {allergyConflict && (
                <View style={styles.allergyConflictCard}>
                  <Ionicons name="alert-circle" size={19} color="#dc2626" style={{ marginRight: 8, marginTop: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.allergyConflictTitle}>
                      {t("Allergy conflict detected:")}{' '}{allergyConflict.allergen}
                    </Text>
                    <Text style={styles.allergyConflictNote}>
                      {allergyConflict.note}
                    </Text>
                  </View>
                </View>
              )}

              {/* Autocomplete suggestions dropdown */}
              {showSuggestions && filteredSuggestions.length > 0 && (
                <View style={styles.suggestionsBox}>
                  {filteredSuggestions.slice(0, 5).map((item) => (
                    <TouchableOpacity
                      key={item.name}
                      style={styles.suggestionItem}
                      onPress={() => {
                        setSearchQuery(item.name);
                        setShowSuggestions(false);
                        if (addMedError) setAddMedError(null);
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons
                          name={(item.type === 'TABLET' ? 'pill' : 'pill-multiple') as any}
                          size={15}
                          color="#064e59"
                          style={{ marginRight: 8 }}
                        />
                        <Text style={styles.suggestionName}>{item.name}</Text>
                      </View>
                      <Text style={styles.suggestionSub}>
                        {item.type} • {item.defaultInstructions}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* 2. How often: 4-Option Segmented Control */}
            <View style={styles.fieldBlock}>
              <View style={styles.fieldHeaderRow}>
                <Text style={[styles.fieldLabel, isDark && { color: "#86A4A9" }]}>{t("HOW OFTEN")}</Text>
                <View style={styles.syncHintRow}>
                  <Ionicons name="time-outline" size={12} color="#0891b2" />
                  <Text style={styles.syncHintText}>{t("Auto-syncs timing")}</Text>
                </View>
              </View>
              <View style={styles.segmentedRow}>
                {([
                  { id: 'OD', title: 'OD', sub: 'Once' },
                  { id: 'BD', title: 'BD', sub: 'Twice' },
                  { id: 'TDS', title: 'TDS', sub: '3 times' },
                  { id: 'QDS', title: 'QDS', sub: '4 times' },
                ] as const).map((item) => {
                  const isSelected = selectedFrequency === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.freqSegment, isSelected && styles.freqSegmentSelected]}
                      onPress={() => handleSelectFrequency(item.id)}
                      activeOpacity={0.8}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text style={[styles.freqSegmentTitle, isSelected && styles.freqSegmentTitleSelected]}>
                        {item.title}
                      </Text>
                      <Text style={[styles.freqSegmentSub, isSelected && styles.freqSegmentSubSelected]}>
                        {item.sub}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 3. With Meals: 2-Option Segmented Control */}
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, isDark && { color: "#86A4A9" }]}>{t("WITH MEALS")}</Text>
              <View style={styles.timingRow}>
                <TouchableOpacity
                  style={[styles.mealSegment, mealTiming === 'Before meal' && styles.mealSegmentSelected]}
                  onPress={() => setMealTiming('Before meal')}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: mealTiming === 'Before meal' }}
                >
                  <MaterialCommunityIcons
                    name="clock-time-four-outline"
                    size={16}
                    color={mealTiming === 'Before meal' ? '#ffffff' : '#64748b'}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.mealSegmentText,
                      mealTiming === 'Before meal' && styles.mealSegmentTextSelected,
                    ]}
                  >
                    {t("Before meal")}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.mealSegment, mealTiming === 'After meal' && styles.mealSegmentSelected]}
                  onPress={() => setMealTiming('After meal')}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: mealTiming === 'After meal' }}
                >
                  <MaterialCommunityIcons
                    name="silverware-fork-knife"
                    size={16}
                    color={mealTiming === 'After meal' ? '#ffffff' : '#64748b'}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.mealSegmentText,
                      mealTiming === 'After meal' && styles.mealSegmentTextSelected,
                    ]}
                  >
                    {t("After meal")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 4. Time of Day: 3 Standalone Cards (Multi-Select, No Icons) */}
            <View style={styles.fieldBlock}>
              {/* Header Row */}
              <View style={styles.todHeaderRow}>
                <Text style={[styles.todHeaderLabel, isDark && styles.todHeaderLabelDark]}>
                  {t("TIME OF DAY")}
                </Text>
                <View style={[styles.todCountPill, isDark && styles.todCountPillDark]}>
                  <Text style={[styles.todCountPillText, isDark && styles.todCountPillTextDark]}>
                    {[takeMorning, takeAfternoon, takeNight].filter(Boolean).length} {t("selected")}
                  </Text>
                </View>
              </View>

              {/* 3 Standalone Cards Row (equal-width 3-column, 10px gap) */}
              <View style={styles.todCardsRow}>
                {/* 1. Morning */}
                <TouchableOpacity
                  style={[
                    styles.todCard,
                    isDark && styles.todCardDark,
                    takeMorning && (isDark ? styles.todCardSelectedDark : styles.todCardSelected),
                  ]}
                  onPress={() => setTakeMorning(!takeMorning)}
                  activeOpacity={0.75}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: takeMorning }}
                  accessibilityLabel={`${t("Morning")}, 8:00 AM`}
                >
                  <View
                    style={[
                      styles.todRadioDot,
                      isDark && styles.todRadioDotDark,
                      takeMorning && (isDark ? styles.todRadioDotSelectedDark : styles.todRadioDotSelected),
                    ]}
                  >
                    {takeMorning && (
                      <View style={[styles.todRadioInnerDot, isDark && styles.todRadioInnerDotDark]} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.todCardTitle,
                      isDark && styles.todCardTitleDark,
                      takeMorning && (isDark ? styles.todCardTitleSelectedDark : styles.todCardTitleSelected),
                    ]}
                    numberOfLines={1}
                  >
                    {t("Morning")}
                  </Text>
                  <Text
                    style={[
                      styles.todCardTime,
                      isDark && styles.todCardTimeDark,
                    ]}
                    numberOfLines={1}
                  >
                    8:00 AM
                  </Text>
                </TouchableOpacity>

                {/* 2. Afternoon */}
                <TouchableOpacity
                  style={[
                    styles.todCard,
                    isDark && styles.todCardDark,
                    takeAfternoon && (isDark ? styles.todCardSelectedDark : styles.todCardSelected),
                  ]}
                  onPress={() => setTakeAfternoon(!takeAfternoon)}
                  activeOpacity={0.75}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: takeAfternoon }}
                  accessibilityLabel={`${t("Afternoon")}, 1:00 PM`}
                >
                  <View
                    style={[
                      styles.todRadioDot,
                      isDark && styles.todRadioDotDark,
                      takeAfternoon && (isDark ? styles.todRadioDotSelectedDark : styles.todRadioDotSelected),
                    ]}
                  >
                    {takeAfternoon && (
                      <View style={[styles.todRadioInnerDot, isDark && styles.todRadioInnerDotDark]} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.todCardTitle,
                      isDark && styles.todCardTitleDark,
                      takeAfternoon && (isDark ? styles.todCardTitleSelectedDark : styles.todCardTitleSelected),
                    ]}
                    numberOfLines={1}
                  >
                    {t("Afternoon")}
                  </Text>
                  <Text
                    style={[
                      styles.todCardTime,
                      isDark && styles.todCardTimeDark,
                    ]}
                    numberOfLines={1}
                  >
                    1:00 PM
                  </Text>
                </TouchableOpacity>

                {/* 3. Night */}
                <TouchableOpacity
                  style={[
                    styles.todCard,
                    isDark && styles.todCardDark,
                    takeNight && (isDark ? styles.todCardSelectedDark : styles.todCardSelected),
                  ]}
                  onPress={() => setTakeNight(!takeNight)}
                  activeOpacity={0.75}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: takeNight }}
                  accessibilityLabel={`${t("Night")}, 9:00 PM`}
                >
                  <View
                    style={[
                      styles.todRadioDot,
                      isDark && styles.todRadioDotDark,
                      takeNight && (isDark ? styles.todRadioDotSelectedDark : styles.todRadioDotSelected),
                    ]}
                  >
                    {takeNight && (
                      <View style={[styles.todRadioInnerDot, isDark && styles.todRadioInnerDotDark]} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.todCardTitle,
                      isDark && styles.todCardTitleDark,
                      takeNight && (isDark ? styles.todCardTitleSelectedDark : styles.todCardTitleSelected),
                    ]}
                    numberOfLines={1}
                  >
                    {t("Night")}
                  </Text>
                  <Text
                    style={[
                      styles.todCardTime,
                      isDark && styles.todCardTimeDark,
                    ]}
                    numberOfLines={1}
                  >
                    9:00 PM
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Summary Line */}
              <View style={styles.todSummaryRow}>
                {[takeMorning, takeAfternoon, takeNight].some(Boolean) ? (
                  <Text style={[styles.todSummaryText, isDark && styles.todSummaryTextDark]}>
                    {t("Take at")}{' '}
                    <Text style={[styles.todSummaryBold, isDark && styles.todSummaryBoldDark]}>
                      {[
                        takeMorning && '8:00 AM',
                        takeAfternoon && '1:00 PM',
                        takeNight && '9:00 PM',
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </Text>
                  </Text>
                ) : (
                  <Text style={[styles.todSummaryText, styles.todSummaryEmpty, isDark && styles.todSummaryEmptyDark]}>
                    {t("Pick at least one time")}
                  </Text>
                )}
              </View>
            </View>

            {/* 5. Duration: Stepper + Quick Chips */}
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, isDark && { color: "#86A4A9" }]}>{t("DURATION")}</Text>
              <View style={styles.durationControlRow}>
                {/* Stepper (1 to 90 days) */}
                <View style={[styles.stepperWrap, isDark && { backgroundColor: "#0F1D20", borderColor: "#1F383C" }]}>
                  <TouchableOpacity
                    style={[styles.stepperBtn, selectedDuration <= 1 && styles.stepperBtnDisabled]}
                    onPress={() => setSelectedDuration((d) => Math.max(1, d - 1))}
                    disabled={selectedDuration <= 1}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="remove" size={18} color={selectedDuration <= 1 ? '#cbd5e1' : '#0f172a'} />
                  </TouchableOpacity>
                  <View style={styles.stepperValueBox}>
                    <Text style={[styles.stepperValueText, isDark && { color: "#EEF8FA" }]}>{selectedDuration}</Text>
                    <Text style={styles.stepperUnitText}>{t("days")}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.stepperBtn, selectedDuration >= 90 && styles.stepperBtnDisabled]}
                    onPress={() => setSelectedDuration((d) => Math.min(90, d + 1))}
                    disabled={selectedDuration >= 90}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={18} color={selectedDuration >= 90 ? '#cbd5e1' : '#0f172a'} />
                  </TouchableOpacity>
                </View>

                {/* Quick Chips */}
                <View style={styles.quickChipsWrap}>
                  {[3, 5, 7, 14].map((days) => {
                    const isChipActive = selectedDuration === days;
                    return (
                      <TouchableOpacity
                        key={days}
                        style={[styles.quickChip, isChipActive && styles.quickChipActive]}
                        onPress={() => setSelectedDuration(days)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.quickChipText, isChipActive && styles.quickChipTextActive]}>
                          {days}d
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* 6. Live Summary Strip - only shown when medicine name is typed/selected */}
            {Boolean(searchQuery.trim()) && (
              <View style={styles.liveSummaryStrip}>
                <View style={styles.liveSummaryIconWrap}>
                  <MaterialCommunityIcons name="pill" size={15} color="#064e59" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.liveSummaryLabel}>{t("PRESCRIPTION PREVIEW")}</Text>
                  <Text style={styles.liveSummaryText} numberOfLines={2}>
                    {`${searchQuery.trim()} – ${selectedFrequency}, ${mealTiming.toLowerCase()} (${[
                      takeMorning && 'Morning',
                      takeAfternoon && 'Afternoon',
                      takeNight && 'Night',
                    ]
                      .filter(Boolean)
                      .join(', ') || 'no times'}), ${selectedDuration} day${selectedDuration > 1 ? 's' : ''}`}
                  </Text>
                </View>
              </View>
            )}

            {addMedError && (
              <View style={styles.addMedErrorWrap}>
                <Ionicons name="alert-circle" size={16} color="#ef4444" style={{ marginRight: 6 }} />
                <Text style={styles.addMedErrorText}>{addMedError}</Text>
              </View>
            )}

            {/* 7. Primary Add Button */}
            <TouchableOpacity
              style={[
                styles.addToPrescriptionBtnRedesigned,
                (!searchQuery.trim() ||
                  [takeMorning, takeAfternoon, takeNight].filter(Boolean).length === 0 ||
                  selectedDuration <= 0) &&
                  styles.addToPrescriptionBtnDisabled,
              ]}
              onPress={handleAddMedicine}
              activeOpacity={0.85}
              disabled={
                !searchQuery.trim() ||
                [takeMorning, takeAfternoon, takeNight].filter(Boolean).length === 0 ||
                selectedDuration <= 0
              }
            >
              <Ionicons
                name="add"
                size={21}
                color={
                  !searchQuery.trim() ||
                  [takeMorning, takeAfternoon, takeNight].filter(Boolean).length === 0 ||
                  selectedDuration <= 0
                    ? '#94a3b8'
                    : '#ffffff'
                }
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.addToPrescriptionBtnTextRedesigned,
                  (!searchQuery.trim() ||
                    [takeMorning, takeAfternoon, takeNight].filter(Boolean).length === 0 ||
                    selectedDuration <= 0) &&
                    styles.addToPrescriptionBtnTextDisabled,
                ]}
              >
                {t("+ Add Medicine to Prescription")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ========================================================= */}
          {/* 8. BOTTOM ACTION BUTTONS                                   */}
          {/* ========================================================= */}
          <View style={styles.actionButtonsRow}>
            {/* Secondary Outline: Refer */}
            <TouchableOpacity
              style={[styles.referralOutlineBtn, isDark && { backgroundColor: "#18383E", borderColor: "#23525B" }]}
              onPress={() => setIsReferralModalOpen(true)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="account-arrow-right-outline"
                size={18}
                color="#064e59"
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.referralOutlineBtnText, isDark && { color: "#EEF8FA" }]}>{t("Refer")}</Text>
            </TouchableOpacity>

              {/* Primary Filled: Save and download (Wider) */}
              <TouchableOpacity
                style={styles.saveFilledBtn}
                onPress={handleSavePrescription}
                activeOpacity={0.85}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="cloud-download-outline"
                      size={19}
                      color="#ffffff"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.saveFilledBtnText}>{t("Save and download")}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Bottom spacing inside scroll view */}
          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ========================================================= */}
      {/* 9. BOTTOM NAVIGATION BAR (5 TABS)                         */}
      {/* ========================================================= */}
      <DoctorBottomNav activeTab="rx" />

      {/* ========================================================= */}
      {/* MODAL 1: ADD DIAGNOSIS                                     */}
      {/* ========================================================= */}
      <Modal visible={isAddDiagnosisModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("Add ICD-10 Diagnosis")}</Text>
              <TouchableOpacity onPress={() => setIsAddDiagnosisModalOpen(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>{t("Select from quick suggestions or type custom:")}</Text>

            {/* Quick suggestions */}
            <View style={styles.modalQuickChips}>
              {COMMON_DIAGNOSES.map((item) => (
                <TouchableOpacity
                  key={item.name}
                  style={styles.modalQuickChip}
                  onPress={() => handleAddDiagnosis(item.name, item.code)}
                >
                  <Text style={styles.modalQuickChipText}>
                    {item.name} {item.code ? `(${item.code})` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ marginTop: 16 }}>
              <Text style={[styles.fieldLabel, isDark && { color: "#86A4A9" }]}>{t("Custom Diagnosis Name")}</Text>
              <TextInput
                style={styles.modalInput}
                placeholder={t("e.g. Cervical Disc Herniation")}
                placeholderTextColor="#94a3b8"
                value={newDiagName}
                onChangeText={setNewDiagName}
              />

              <Text style={[styles.fieldLabel, { marginTop: 10 }]}>{t("ICD-10 Code (Optional)")}</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. M50.2"
                placeholderTextColor="#94a3b8"
                value={newDiagCode}
                onChangeText={setNewDiagCode}
              />
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsAddDiagnosisModalOpen(false)}
              >
                <Text style={styles.modalCancelBtnText}>{t("Cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={() => handleAddDiagnosis(newDiagName, newDiagCode)}
              >
                <Text style={styles.modalSubmitBtnText}>{t("Add Diagnosis")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL: EDIT MEDICINE                                       */}
      {/* ========================================================= */}
      <Modal visible={isEditMedModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="pill" size={22} color="#0d6371" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>{t("Edit Prescription Medicine")}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsEditMedModalOpen(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>{t("Update medicine dosage, frequency, and instructions:")}</Text>

            <ScrollView
              style={{ maxHeight: 450 }}
              contentContainerStyle={{ paddingBottom: 6 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={{ marginTop: 6 }}>
                {/* Medicine Name */}
                <Text style={[styles.fieldLabel, isDark && { color: "#86A4A9" }]}>{t("Medicine Name & Strength")}</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={t("e.g. Paracetamol 500mg")}
                  placeholderTextColor="#94a3b8"
                  value={editMedName}
                  onChangeText={setEditMedName}
                />

                {/* Dosage */}
                <Text style={[styles.fieldLabel, { marginTop: 10 }]}>{t("Dosage")}</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={t("e.g. 500 mg, 1 tablet, 2 puffs")}
                  placeholderTextColor="#94a3b8"
                  value={editMedDosage}
                  onChangeText={setEditMedDosage}
                />

                {/* Frequency */}
                <Text style={[styles.fieldLabel, { marginTop: 10 }]}>{t("Dosage Frequency")}</Text>
                <View style={styles.segmentedRow}>
                  {(['OD', 'BD', 'TDS', 'QDS'] as const).map((freq) => {
                    const labelMap = { OD: 'OD (1x)', BD: 'BD (2x)', TDS: 'TDS (3x)', QDS: 'QDS (4x)' };
                    const isSelected = editMedFrequency === freq;
                    return (
                      <TouchableOpacity
                        key={freq}
                        style={[styles.freqChip, isSelected && styles.freqChipSelected]}
                        onPress={() => handleSelectEditFrequency(freq)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.freqChipText, isSelected && styles.freqChipTextSelected]}>
                          {labelMap[freq]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Meal Timing (After meal / Before meal) */}
                <Text style={[styles.fieldLabel, { marginTop: 10 }]}>{t("Meal Timing")}</Text>
                <View style={styles.timingRow}>
                  <TouchableOpacity
                    style={[styles.timingChip, editMealTiming === 'After meal' && styles.timingChipSelected]}
                    onPress={() => setEditMealTiming('After meal')}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons
                      name="silverware-fork-knife"
                      size={15}
                      color={editMealTiming === 'After meal' ? '#ffffff' : '#0369a1'}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[styles.timingChipText, editMealTiming === 'After meal' && styles.timingChipTextSelected]}
                    >
                      {t("After meal")}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.timingChip, editMealTiming === 'Before meal' && styles.timingChipSelected]}
                    onPress={() => setEditMealTiming('Before meal')}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons
                      name="clock-time-four-outline"
                      size={15}
                      color={editMealTiming === 'Before meal' ? '#ffffff' : '#0369a1'}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[styles.timingChipText, editMealTiming === 'Before meal' && styles.timingChipTextSelected]}
                    >
                      {t("Before meal")}</Text>
                  </TouchableOpacity>
                </View>

                {/* Schedule / Time of Day (Morning, Lunch, Dinner) */}
                <Text style={[styles.fieldLabel, { marginTop: 10 }]}>{t("Take Medicine")}</Text>
                <View style={styles.timeScheduleRow}>
                  <TouchableOpacity
                    style={[styles.timeScheduleChip, editTakeMorning && styles.timeScheduleChipSelected]}
                    onPress={() => setEditTakeMorning(!editTakeMorning)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={editTakeMorning ? 'checkmark-circle' : 'ellipse-outline'}
                      size={15}
                      color={editTakeMorning ? '#ffffff' : '#0369a1'}
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[
                        styles.timeScheduleChipText,
                        editTakeMorning && styles.timeScheduleChipTextSelected,
                      ]}
                    >
                      {t("Morning")}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.timeScheduleChip, editTakeLunch && styles.timeScheduleChipSelected]}
                    onPress={() => setEditTakeLunch(!editTakeLunch)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={editTakeLunch ? 'checkmark-circle' : 'ellipse-outline'}
                      size={15}
                      color={editTakeLunch ? '#ffffff' : '#0369a1'}
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[
                        styles.timeScheduleChipText,
                        editTakeLunch && styles.timeScheduleChipTextSelected,
                      ]}
                    >
                      {t("Lunch")}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.timeScheduleChip, editTakeDinner && styles.timeScheduleChipSelected]}
                    onPress={() => setEditTakeDinner(!editTakeDinner)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={editTakeDinner ? 'checkmark-circle' : 'ellipse-outline'}
                      size={15}
                      color={editTakeDinner ? '#ffffff' : '#0369a1'}
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[
                        styles.timeScheduleChipText,
                        editTakeDinner && styles.timeScheduleChipTextSelected,
                      ]}
                    >
                      {t("Dinner")}</Text>
                  </TouchableOpacity>
                </View>

                {/* Duration */}
                <Text style={[styles.fieldLabel, { marginTop: 10 }]}>{t("Duration (days)")}</Text>
                <View style={styles.durationRow}>
                  {[3, 5, 7, 14, 30].map((days) => {
                    const isSelected = editMedDuration === days;
                    return (
                      <TouchableOpacity
                        key={days}
                        style={[styles.durationChip, isSelected && styles.durationChipSelected]}
                        onPress={() => setEditMedDuration(days)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.durationChipText, isSelected && styles.durationChipTextSelected]}>
                          {days} {t("days")}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Additional Note */}
                <Text style={[styles.fieldLabel, { marginTop: 10 }]}>{t("Additional Notes / Indication (Optional)")}</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={t("e.g. As needed for pain, 2 puffs for wheeze")}
                  placeholderTextColor="#94a3b8"
                  value={editCustomNotes}
                  onChangeText={setEditCustomNotes}
                />
              </View>
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsEditMedModalOpen(false)}
              >
                <Text style={styles.modalCancelBtnText}>{t("Cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleUpdateMedicine}
              >
                <Text style={styles.modalSubmitBtnText}>{t("Update Medicine")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 2: REFERRAL MODAL                                    */}
      {/* ========================================================= */}
      <Modal visible={isReferralModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("Patient Referral")}</Text>
              <TouchableOpacity onPress={() => setIsReferralModalOpen(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              {t("Refer")}{' '}{patient.name} ({patient.tokenFormatted}{t(") to specialized hospital unit:")}</Text>

            <View style={styles.referralOptionsRow}>
              {['Physiotherapy', 'Radiology (X-Ray/MRI)', 'Laboratory / Blood'].map((type) => {
                const isSelected = referralType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.referralTypeChip, isSelected && styles.referralTypeChipSelected]}
                    onPress={() => setReferralType(type)}
                  >
                    <Text
                      style={[
                        styles.referralTypeChipText,
                        isSelected && styles.referralTypeChipTextSelected,
                      ]}
                    >
                      {t(type)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>{t("Referral Clinical Notes / Reason")}</Text>
            <TextInput
              style={[styles.modalInput, { height: 70, textAlignVertical: 'top' }]}
              multiline
              placeholder={t("e.g. Lumbar spine mobilization and heat therapy recommended.")}
              placeholderTextColor="#94a3b8"
              value={referralNotes}
              onChangeText={setReferralNotes}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsReferralModalOpen(false)}
              >
                <Text style={styles.modalCancelBtnText}>{t("Cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleSubmitReferral}
              >
                <Text style={styles.modalSubmitBtnText}>{t("Send Referral")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 3: PRESCRIPTION SAVED SUCCESS MODAL                  */}
      {/* ========================================================= */}
      <Modal visible={isSaveSuccessModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.successModalCard}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-done" size={32} color="#0d6371" />
            </View>
            <Text style={styles.successModalTitle}>{t("Prescription Saved!")}</Text>
            <Text style={styles.successModalDesc}>
              {t("Prescription for")}{' '}{patient.name} ({patient.tokenFormatted}{t(") has been saved and the Digital Rx has been dispatched to the hospital pharmacy and patient portal.")}</Text>

            <TouchableOpacity
              style={styles.downloadRxModalBtn}
              onPress={async () => {
                let activeHospital = currentHospital;
                try {
                  const h = await AsyncStorage.getItem('doctor_current_hospital');
                  if (h) activeHospital = h;
                } catch (e) {}
                downloadPrescription(
                  {
                    ...data,
                    hospitalName: activeHospital,
                    doctor: { ...data.doctor, hospitalName: activeHospital },
                  },
                  clinicalNotes
                );
              }}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons
                name="cloud-download-outline"
                size={20}
                color="#ffffff"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.downloadRxModalBtnText}>
                {t("Download Prescription (PDF)")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.successDoneBtn}
              onPress={() => setIsSaveSuccessModalOpen(false)}
            >
              <Text style={styles.successDoneBtnText}>{t("Done")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL: DELETE MEDICINE IN-APP CONFIRMATION                */}
      {/* ========================================================= */}
      <Modal
        visible={Boolean(deleteMedTarget)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteMedTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmDeleteCard}>
            <View style={styles.confirmDeleteIconCircle}>
              <MaterialCommunityIcons name="trash-can-outline" size={32} color="#ef4444" />
            </View>

            <Text style={styles.confirmDeleteTitle}>{t("Remove Medicine?")}</Text>

            <Text style={styles.confirmDeleteDesc}>
              {t("Are you sure you want to remove")}{' '}
              <Text style={{ fontWeight: '700', color: '#0f172a' }}>
                {deleteMedTarget?.name}
              </Text>{' '}
              {t("from this prescription?")}
            </Text>

            <View style={styles.confirmDeleteButtonsRow}>
              <TouchableOpacity
                style={styles.confirmDeleteCancelBtn}
                onPress={() => setDeleteMedTarget(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmDeleteCancelBtnText}>{t("Cancel")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmDeleteRemoveBtn}
                onPress={confirmRemoveMedicine}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={17} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.confirmDeleteRemoveBtnText}>{t("Remove")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL: DELETE DIAGNOSIS IN-APP CONFIRMATION               */}
      {/* ========================================================= */}
      <Modal
        visible={Boolean(deleteDiagTarget)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteDiagTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmDeleteCard}>
            <View style={styles.confirmDeleteIconCircle}>
              <MaterialCommunityIcons name="close-circle-outline" size={32} color="#ef4444" />
            </View>

            <Text style={styles.confirmDeleteTitle}>{t("Remove Diagnosis?")}</Text>

            <Text style={styles.confirmDeleteDesc}>
              {t("Remove")}{' '}
              <Text style={{ fontWeight: '700', color: '#0f172a' }}>
                {deleteDiagTarget?.name}
              </Text>{' '}
              {t("from the diagnosis list?")}
            </Text>

            <View style={styles.confirmDeleteButtonsRow}>
              <TouchableOpacity
                style={styles.confirmDeleteCancelBtn}
                onPress={() => setDeleteDiagTarget(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmDeleteCancelBtnText}>{t("Cancel")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmDeleteRemoveBtn}
                onPress={confirmRemoveDiagnosis}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={18} color="#ffffff" style={{ marginRight: 4 }} />
                <Text style={styles.confirmDeleteRemoveBtnText}>{t("Remove")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL: ALLERGY CONFLICT IN-APP CONFIRMATION               */}
      {/* ========================================================= */}
      <Modal
        visible={Boolean(pendingAllergyConflictMed)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPendingAllergyConflictMed(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmDeleteCard}>
            <View style={[styles.confirmDeleteIconCircle, { backgroundColor: '#fef2f2' }]}>
              <MaterialCommunityIcons name="alert-decagram" size={34} color="#dc2626" />
            </View>

            <Text style={[styles.confirmDeleteTitle, { color: '#991b1b' }]}>
              {t("Allergy Conflict Warning")}
            </Text>

            <Text style={styles.confirmDeleteDesc}>
              <Text style={{ fontWeight: '700', color: '#b91c1c' }}>
                {pendingAllergyConflictMed?.med?.name}
              </Text>{' '}
              {t("conflicts with known patient allergy:")}{' '}
              <Text style={{ fontWeight: '700', color: '#0f172a' }}>
                {pendingAllergyConflictMed?.allergen}
              </Text>.{'\n'}
              {pendingAllergyConflictMed?.note ? `${pendingAllergyConflictMed.note}\n\n` : '\n'}
              {t("Do you want to override and prescribe this medication anyway?")}
            </Text>

            <View style={styles.confirmDeleteButtonsRow}>
              <TouchableOpacity
                style={styles.confirmDeleteCancelBtn}
                onPress={() => setPendingAllergyConflictMed(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmDeleteCancelBtnText}>{t("Cancel")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmDeleteRemoveBtn, { backgroundColor: '#dc2626' }]}
                onPress={confirmOverrideAllergyConflict}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmDeleteRemoveBtnText}>{t("Override & Prescribe")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#f4f9fc',
    ...Platform.select({
      web: {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      },
    }),
  },
  keyboardWrap: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
  },

  // 1. TOP PROFILE BAR
  homeBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  topProfileBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 6,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: '#e2e8f0',
  },
  onlineDotOnAvatar: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  profileTextWrap: {
    marginLeft: 10,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  onlineBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 5,
  },
  onlineBadgeText: {
    fontSize: 12,
    color: '#0d7685',
    fontWeight: '600',
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    position: 'relative',
    elevation: 2,
    shadowColor: 'rgba(0, 0, 0, 0.04)',
    shadowOpacity: 1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  redBadgeDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },

  // 2. HEADER TITLE SECTION
  headerTitleSection: {
    marginTop: 6,
    marginBottom: 14,
  },
  kickerText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0d7685',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mainTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  roomPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#67e8f9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  roomPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#064e59',
    marginRight: 5,
  },
  roomPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#064e59',
  },

  // CARDS SHARED STYLES
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e9f1f5',
    elevation: 2,
    shadowColor: 'rgba(15, 23, 42, 0.05)',
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  cardSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    flexShrink: 1,
  },

  // 3. PATIENT PROFILE CARD
  patientTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  initialsAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  initialsText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0284c7',
  },
  patientInfoCol: {
    flex: 1,
  },
  patientName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  patientMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  tokenBadge: {
    backgroundColor: '#cffafe',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  tokenBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0e7490',
  },
  vitalsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  vitalBox: {
    flex: 1,
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  vitalLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 3,
  },
  vitalValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0369a1',
  },

  // 3.1 ALLERGY ALERT CARD (RED WARNING BANNER)
  allergyCard: {
    flexDirection: 'row',
    backgroundColor: '#fef2f2',
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  allergyIconCol: {
    marginRight: 12,
  },
  allergyTextCol: {
    flex: 1,
  },
  allergyTitle: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  allergyDesc: {
    color: '#991b1b',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 16,
  },
  allergyConflictCard: {
    flexDirection: 'row',
    backgroundColor: '#fff1f2',
    borderWidth: 1.5,
    borderColor: '#fecdd3',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    alignItems: 'flex-start',
  },
  allergyConflictTitle: {
    color: '#e11d48',
    fontSize: 12,
    fontWeight: '800',
  },
  allergyConflictNote: {
    color: '#be123c',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 15,
  },

  // 4. PRIMARY DIAGNOSIS (ICD-10) CARD
  addDiagnosisBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  addDiagnosisBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0d6371',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  diagnosisChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  diagnosisChipPrimary: {
    backgroundColor: '#cffafe',
  },
  diagnosisChipSecondary: {
    backgroundColor: '#f0f9ff',
  },
  chipGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#065f46',
    marginRight: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 6,
  },
  chipTextPrimary: {
    color: '#065f46',
    fontWeight: '700',
  },
  chipTextSecondary: {
    color: '#334155',
  },
  chipRemoveBtn: {
    padding: 2,
  },
  emptyNote: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
  },

  // 5. CLINICAL NOTES & SYMPTOMS CARD
  confidentialBadge: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
    flexShrink: 0,
    marginLeft: 6,
  },
  notesBox: {
    backgroundColor: '#f0f9ff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  notesInput: {
    fontSize: 13,
    lineHeight: 19,
    color: '#1e293b',
    minHeight: 52,
    textAlignVertical: 'top',
  },
  autoSavedText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '500',
    alignSelf: 'flex-end',
    marginTop: 4,
  },

  // 6. PRESCRIPTION LIST (Rx) CARD
  itemsCountBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  itemsCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369a1',
  },
  prescriptionsList: {
    gap: 10,
  },
  medCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  medIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  medIconBoxCyan: {
    backgroundColor: '#38bdf8',
  },
  medIconBoxTeal: {
    backgroundColor: '#2dd4bf',
  },
  medInfoWrap: {
    flex: 1,
  },
  medTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  medNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  medTypeBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  medTypeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0369a1',
  },
  medDetailText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  medInstructionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  medInstructionText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0d7685',
  },
  medActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 6,
  },
  editMedBtn: {
    padding: 7,
    borderRadius: 8,
    backgroundColor: '#e0f2fe',
  },
  deleteMedBtn: {
    padding: 7,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
  emptyPrescriptionBox: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  emptyPrescriptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  emptyPrescriptionSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },

  // 7. ADD MEDICINE CARD (REDESIGNED)
  cardRedesigned: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: 'rgba(15, 23, 42, 0.06)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 3,
  },
  addMedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  addMedHeaderIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#ecfeff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMedHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  addMedHeaderSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 1,
  },
  rxBadge: {
    backgroundColor: '#ecfeff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cffafe',
  },
  rxBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0e7490',
  },
  fieldBlock: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  syncHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  syncHintText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#0891b2',
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    height: 48,
  },
  searchInputWrapFocused: {
    borderColor: '#064e59',
    backgroundColor: '#ffffff',
    shadowColor: 'rgba(6, 78, 89, 0.15)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
  },
  suggestionsBox: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 6,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  suggestionItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  suggestionName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  suggestionSub: {
    fontSize: 11,
    color: '#64748b',
  },
  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    padding: 4,
    gap: 6,
  },
  freqSegment: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freqSegmentSelected: {
    backgroundColor: '#064e59',
    shadowColor: 'rgba(6, 78, 89, 0.25)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  freqSegmentTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  freqSegmentTitleSelected: {
    color: '#ffffff',
  },
  freqSegmentSub: {
    fontSize: 9,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 2,
  },
  freqSegmentSubSelected: {
    color: '#99f6e4',
  },
  timingRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    padding: 4,
    gap: 6,
  },
  mealSegment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  mealSegmentSelected: {
    backgroundColor: '#064e59',
    shadowColor: 'rgba(6, 78, 89, 0.25)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  mealSegmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  mealSegmentTextSelected: {
    color: '#ffffff',
  },
  slotWarningRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slotWarningText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#d97706',
  },
  slotCountBadge: {
    backgroundColor: '#ecfeff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cffafe',
  },
  slotCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0e7490',
  },
  // TIME OF DAY SECTION
  todHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  todHeaderLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#5B7078',
    textTransform: 'uppercase',
  },
  todHeaderLabelDark: {
    color: '#9DB2B8',
  },
  todCountPill: {
    backgroundColor: '#E6F6F5',
    borderWidth: 1,
    borderColor: '#0E8F9A',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  todCountPillDark: {
    backgroundColor: '#1B3A40',
    borderColor: '#0E8F9A',
  },
  todCountPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0E8F9A',
  },
  todCountPillTextDark: {
    color: '#2AA8B4',
  },
  todCardsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  todCard: {
    flex: 1,
    minHeight: 76,
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 6,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#D5E0E3',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  todCardDark: {
    backgroundColor: '#13262B',
    borderColor: '#2B474D',
  },
  todCardSelected: {
    backgroundColor: '#E6F6F5',
    borderColor: '#0E8F9A',
  },
  todCardSelectedDark: {
    backgroundColor: '#1B3A40',
    borderColor: '#0E8F9A',
  },
  todRadioDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#D5E0E3',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todRadioDotDark: {
    borderColor: '#2B474D',
  },
  todRadioDotSelected: {
    backgroundColor: '#0B4F59',
    borderColor: '#0B4F59',
  },
  todRadioDotSelectedDark: {
    backgroundColor: '#2AA8B4',
    borderColor: '#2AA8B4',
  },
  todRadioInnerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E6F6F5',
  },
  todRadioInnerDotDark: {
    backgroundColor: '#1B3A40',
  },
  todCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F1F24',
    textAlign: 'center',
  },
  todCardTitleDark: {
    color: '#EAF4F6',
  },
  todCardTitleSelected: {
    color: '#0B4F59',
  },
  todCardTitleSelectedDark: {
    color: '#2AA8B4',
  },
  todCardTime: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5B6B73',
    marginTop: 4,
    textAlign: 'center',
  },
  todCardTimeDark: {
    color: '#9DB2B8',
  },
  todSummaryRow: {
    marginTop: 10,
  },
  todSummaryText: {
    fontSize: 12.5,
    color: '#5B6B73',
  },
  todSummaryTextDark: {
    color: '#9DB2B8',
  },
  todSummaryBold: {
    fontWeight: '700',
    color: '#0F1F24',
  },
  todSummaryBoldDark: {
    color: '#EAF4F6',
  },
  todSummaryEmpty: {
    color: '#5B6B73',
  },
  todSummaryEmptyDark: {
    color: '#9DB2B8',
  },
  durationControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    padding: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.05)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 2,
    elevation: 1,
  },
  stepperBtnDisabled: {
    backgroundColor: '#f8fafc',
    opacity: 0.5,
  },
  stepperValueBox: {
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  stepperValueText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  stepperUnitText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748b',
    marginTop: -2,
  },
  quickChipsWrap: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  quickChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChipActive: {
    backgroundColor: '#064e59',
    borderColor: '#064e59',
    shadowColor: 'rgba(6, 78, 89, 0.2)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  quickChipTextActive: {
    color: '#ffffff',
  },
  liveSummaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  liveSummaryIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveSummaryLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0369a1',
    letterSpacing: 0.5,
  },
  liveSummaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 2,
  },
  addMedErrorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  addMedErrorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ef4444',
  },
  addToPrescriptionBtnRedesigned: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#064e59',
    borderRadius: 20,
    paddingVertical: 14,
    shadowColor: 'rgba(6, 78, 89, 0.3)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  addToPrescriptionBtnDisabled: {
    backgroundColor: '#e2e8f0',
    shadowOpacity: 0,
    elevation: 0,
  },
  addToPrescriptionBtnTextRedesigned: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  addToPrescriptionBtnTextDisabled: {
    color: '#94a3b8',
  },
  addDisabledHint: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 6,
  },

  // 8. ACTION BUTTONS ROW (Aligned under Add to Prescription button)
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  referralOutlineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: '#064e59',
  },
  referralOutlineBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#064e59',
  },
  saveFilledBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#064e59',
    borderRadius: 20,
    paddingVertical: 13,
    shadowColor: 'rgba(6, 78, 89, 0.25)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 3,
  },
  saveFilledBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Edit Modal legacy styles
  freqChip: {
    flex: 1,
    backgroundColor: '#e0f2fe',
    borderRadius: 14,
    paddingVertical: 9,
    alignItems: 'center',
  },
  freqChipSelected: {
    backgroundColor: '#064e59',
  },
  freqChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369a1',
  },
  freqChipTextSelected: {
    color: '#ffffff',
  },
  timingChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0f2fe',
    borderRadius: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#bae6fd',
  },
  timingChipSelected: {
    backgroundColor: '#064e59',
    borderColor: '#064e59',
  },
  timingChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369a1',
  },
  timingChipTextSelected: {
    color: '#ffffff',
  },
  timeScheduleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timeScheduleChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0f2fe',
    borderRadius: 14,
    paddingVertical: 9,
    borderWidth: 1.5,
    borderColor: '#bae6fd',
  },
  timeScheduleChipSelected: {
    backgroundColor: '#064e59',
    borderColor: '#064e59',
  },
  timeScheduleChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369a1',
  },
  timeScheduleChipTextSelected: {
    color: '#ffffff',
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  durationChip: {
    flex: 1,
    backgroundColor: '#e0f2fe',
    borderRadius: 14,
    paddingVertical: 9,
    alignItems: 'center',
  },
  durationChipSelected: {
    backgroundColor: '#064e59',
  },
  durationChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369a1',
  },
  durationChipTextSelected: {
    color: '#ffffff',
  },

  // 9. BOTTOM NAVIGATION BAR
  bottomTabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5edf2',
    paddingVertical: 10,
    elevation: 8,
    shadowColor: 'rgba(0, 0, 0, 0.05)',
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
  },
  tabItem: {
    alignItems: 'center',
    flex: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: '#0d6371',
    fontWeight: '700',
  },

  // MODALS
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
  },
  modalQuickChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  modalQuickChip: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  modalQuickChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  modalSubmitBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#064e59',
  },
  modalSubmitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  referralOptionsRow: {
    gap: 8,
  },
  referralTypeChip: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  referralTypeChipSelected: {
    backgroundColor: '#e0f7fa',
    borderColor: '#064e59',
  },
  referralTypeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  referralTypeChipTextSelected: {
    color: '#064e59',
    fontWeight: '700',
  },
  successModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    elevation: 8,
  },
  successIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e0f7fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  successModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  successModalDesc: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  downloadRxModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#064e59',
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 22,
    width: '100%',
    marginBottom: 10,
    elevation: 2,
    shadowColor: 'rgba(6, 78, 89, 0.2)',
    shadowOpacity: 1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  downloadRxModalBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  successDoneBtn: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 22,
    width: '100%',
    alignItems: 'center',
  },
  successDoneBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },

  // IN-APP DELETE / CONFIRMATION DIALOG STYLES
  confirmDeleteCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.15)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
  },
  confirmDeleteIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  confirmDeleteTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmDeleteDesc: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22,
  },
  confirmDeleteButtonsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  confirmDeleteCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeleteCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  confirmDeleteRemoveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: 'rgba(239, 68, 68, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  confirmDeleteRemoveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
