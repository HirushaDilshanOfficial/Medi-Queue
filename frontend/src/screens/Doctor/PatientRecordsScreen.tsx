import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Modal,
  StatusBar,
  useColorScheme,
  Platform,
  Animated,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { savePrescriptionApi } from '../../services/prescriptionService';
import {
  PatientRecord,
  PatientStatus,
  ALL_DUMMY_PATIENTS,
  filterPatientsList,
  getBPStatus,
  getHRStatus,
  getTempStatus,
  getSpO2Status,
  formatTempCelsius,
  getBMIStatus,
  calculateBMI,
  checkMedicationAllergy,
  MedicationItem,
  VitalHistoryReading,
} from '../../services/patientRecordsService';

type ActiveVitalType = 'bp' | 'hr' | 'temp' | 'spo2' | 'weight' | 'bmi';

export default function PatientRecordsScreen({ navigation }: { navigation?: any } = {}) {
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ tokenNumber?: string; patientName?: string; patientId?: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Theme definition adhering to clean clinic aesthetics
  const theme = useMemo(() => {
    if (isDark) {
      return {
        isDark: true,
        background: '#0e191b',
        pageBg: '#091012',
        card: '#16272a',
        cardBorder: '#1f383c',
        primary: '#146370',
        primaryDeep: '#0b4f5a',
        accent: '#22aab8',
        tint: '#1a373d',
        textDark: '#eef8fa',
        textMedium: '#b2c8cb',
        textMuted: '#7a969a',
        divider: '#20393d',
        inputBg: '#142326',
        modalOverlay: 'rgba(0, 0, 0, 0.75)',
        sheetBg: '#142427',
      };
    }
    return {
      isDark: false,
      background: '#eef6f8',
      pageBg: '#e2e8f0',
      card: '#ffffff',
      cardBorder: '#e1eff1',
      primary: '#0b4f5a',
      primaryDeep: '#0b4f5a',
      accent: '#0e8a96',
      tint: '#d9f2f5',
      textDark: '#08252b',
      textMedium: '#31555c',
      textMuted: '#688990',
      divider: '#e2eff1',
      inputBg: '#ffffff',
      modalOverlay: 'rgba(8, 37, 43, 0.45)',
      sheetBg: '#ffffff',
    };
  }, [isDark]);

  // Inject Google Font Lexend on web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      if (!document.getElementById('lexend-google-font')) {
        const link = document.createElement('link');
        link.id = 'lexend-google-font';
        link.rel = 'stylesheet';
        link.href =
          'https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;800&display=swap';
        document.head.appendChild(link);
      }
    }
  }, []);

  // ─────────────────────────────────────────────────────────
  // STATE MANAGEMENT
  // ─────────────────────────────────────────────────────────
  const [patients, setPatients] = useState<PatientRecord[]>(ALL_DUMMY_PATIENTS);
  const [currentPatientId, setCurrentPatientId] = useState<string>(() => {
    const pToken = params?.tokenNumber ? Number(params.tokenNumber) : null;
    const pName = params?.patientName ? params.patientName.trim().toLowerCase() : null;
    const pId = params?.patientId;

    if (pId) {
      const match = ALL_DUMMY_PATIENTS.find((p) => p.id === pId);
      if (match) return match.id;
    }
    if (pName) {
      const match = ALL_DUMMY_PATIENTS.find(
        (p) =>
          p.name.toLowerCase().includes(pName) ||
          pName.includes(p.name.toLowerCase()) ||
          p.shortName.toLowerCase().includes(pName) ||
          pName.includes(p.shortName.toLowerCase())
      );
      if (match) return match.id;
    }
    if (pToken) {
      const match = ALL_DUMMY_PATIENTS.find((p) => p.tokenNumber === pToken);
      if (match) return match.id;
    }
    return ALL_DUMMY_PATIENTS[0].id;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PatientStatus>('All');
  const [activeTab, setActiveTab] = useState<'home' | 'queue' | 'records' | 'schedule' | 'rx'>('records');

  // Currently active patient record
  const currentPatient = useMemo(() => {
    return patients.find((p) => p.id === currentPatientId) || patients[0];
  }, [patients, currentPatientId]);

  // Scroll reference for smooth scrolling to top on patient selection
  const scrollViewRef = useRef<ScrollView>(null);

  // Sync when route parameters change
  useEffect(() => {
    const pToken = params?.tokenNumber ? Number(params.tokenNumber) : null;
    const pName = params?.patientName ? params.patientName.trim().toLowerCase() : null;
    const pId = params?.patientId;

    if (!pToken && !pName && !pId) return;

    let matched: PatientRecord | undefined;
    if (pId) {
      matched = patients.find((p) => p.id === pId);
    }
    if (!matched && pName) {
      matched = patients.find(
        (p) =>
          p.name.toLowerCase().includes(pName) ||
          pName.includes(p.name.toLowerCase()) ||
          p.shortName.toLowerCase().includes(pName) ||
          pName.includes(p.shortName.toLowerCase())
      );
    }
    if (!matched && pToken) {
      matched = patients.find((p) => p.tokenNumber === pToken);
    }

    if (matched) {
      setCurrentPatientId(matched.id);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [params?.tokenNumber, params?.patientName, params?.patientId, patients]);

  // Sync from AsyncStorage if active patient was set by other screens
  useEffect(() => {
    (async () => {
      try {
        const storedToken = await AsyncStorage.getItem('active_record_patient_token');
        const storedName = await AsyncStorage.getItem('active_record_patient_name');
        if (storedToken || storedName) {
          const num = storedToken ? Number(storedToken) : null;
          const sName = storedName ? storedName.trim().toLowerCase() : null;
          const matched = patients.find((p) => {
            if (sName && (p.name.toLowerCase().includes(sName) || sName.includes(p.name.toLowerCase()))) {
              return true;
            }
            if (num && p.tokenNumber === num) {
              return true;
            }
            return false;
          });
          if (matched) {
            setCurrentPatientId(matched.id);
          }
        }
      } catch (e) {}
    })();
  }, [patients]);

  // Sync allergies from storage for the currently active patient
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const token = currentPatient?.tokenNumber;
        if (!token) return;
        const key = `@medi_queue_patient_allergies_${token}`;
        let raw = await AsyncStorage.getItem(key);
        if (!raw && typeof window !== 'undefined' && window.localStorage) {
          raw = window.localStorage.getItem(key);
        }
        if (raw && isMounted) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setPatients((prev) =>
              prev.map((p) => {
                if (p.tokenNumber !== token) return p;
                if (parsed.length === 0) {
                  return {
                    ...p,
                    allergies: [],
                    allergy: {
                      hasAllergy: false,
                      title: 'No known allergies',
                      description: 'Patient has no documented medication allergies.',
                    },
                  };
                }
                const first = parsed[0];
                return {
                  ...p,
                  allergies: parsed,
                  allergy: {
                    hasAllergy: true,
                    isHighRisk: first.severity === 'life-threatening' || first.severity === 'severe',
                    title: `Allergy alert • ${first.reaction}`,
                    description: `${first.allergen}${first.note ? ' – ' + first.note : ''}`,
                  },
                };
              })
            );
          }
        }
      } catch (e) {}
    })();
    return () => {
      isMounted = false;
    };
  }, [currentPatientId, currentPatient?.tokenNumber]);

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastFade = useRef(new Animated.Value(0)).current;

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    Animated.sequence([
      Animated.timing(toastFade, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.delay(2200),
      Animated.timing(toastFade, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToastMessage(null);
    });
  }, [toastFade]);

  // Spin animation for Refresh button
  const spinAnim = useRef(new Animated.Value(0)).current;

  const triggerSpin = useCallback(() => {
    spinAnim.setValue(0);
    Animated.timing(spinAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [spinAnim]);

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Reset / Refresh back to the current active consultation patient
  const handleResetToCurrentPatient = useCallback(async () => {
    triggerSpin();
    try {
      await AsyncStorage.removeItem('active_record_patient_token');
      await AsyncStorage.removeItem('active_record_patient_name');
    } catch (e) {}

    // Find the primary in-consultation patient (default #029 Aurelia Sisca)
    const inConsultationPatient =
      patients.find((p) => p.status === 'In consultation') || patients[0];

    setCurrentPatientId(inConsultationPatient.id);
    setSearchQuery('');
    showToast(`Refreshed: ${inConsultationPatient.name} (${inConsultationPatient.tokenFormatted})`);
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }, [patients, showToast, triggerSpin]);

  // ─────────────────────────────────────────────────────────
  // 1. ADD MEDICATION BOTTOM SHEET STATE & LOGIC
  // ─────────────────────────────────────────────────────────
  const [isAddMedicationOpen, setIsAddMedicationOpen] = useState(false);
  const [medDrugName, setMedDrugName] = useState('');
  const [medDose, setMedDose] = useState('');
  const [medFrequency, setMedFrequency] = useState('Once daily');
  const [medDuration, setMedDuration] = useState('');
  const [medNameError, setMedNameError] = useState<string | null>(null);
  const [hasAllergyConflictAcknowledged, setHasAllergyConflictAcknowledged] = useState(false);

  const medDrugInputRef = useRef<TextInput>(null);

  const allergyCheck = useMemo(() => {
    return checkMedicationAllergy(medDrugName, currentPatient);
  }, [medDrugName, currentPatient]);

  const handleOpenAddMedication = () => {
    try {
      router.push({
        pathname: '/(doctor)/prescription' as any,
        params: {
          tokenNumber: String(currentPatient.tokenNumber || 29),
          patientName: currentPatient.name,
        },
      });
    } catch (e) {
      if (navigation?.navigate) {
        navigation.navigate('Prescription', {
          tokenNumber: String(currentPatient.tokenNumber || 29),
          patientName: currentPatient.name,
        });
      } else {
        try {
          router.push('/(doctor)/prescription' as any);
        } catch (err) {
          if (typeof window !== 'undefined') {
            router.push('/(doctor)/prescription' as any);
          }
        }
      }
    }
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        router.push(`/(doctor)/prescription?tokenNumber=${encodeURIComponent(String(currentPatient.tokenNumber || 29))}&patientName=${encodeURIComponent(currentPatient.name)}` as any);
      }, 120);
    }
  };

  const handleCloseAddMedication = () => {
    setIsAddMedicationOpen(false);
    setMedNameError(null);
    setHasAllergyConflictAcknowledged(false);
  };

  const handleSaveMedication = () => {
    const trimmedName = medDrugName.trim();
    if (!trimmedName) {
      setMedNameError('Enter a drug name');
      medDrugInputRef.current?.focus();
      return;
    }

    // Check allergy conflict
    if (allergyCheck.status === 'conflict' && !hasAllergyConflictAcknowledged) {
      setHasAllergyConflictAcknowledged(true);
      return; // Do not save on first tap; button switches to "Add anyway"
    }

    const isOverride = allergyCheck.status === 'conflict' && hasAllergyConflictAcknowledged;

    const newMed: MedicationItem = {
      id: `med-${Date.now()}`,
      drugName: trimmedName,
      dose: medDose.trim() || '500 mg',
      frequency: medFrequency,
      duration: medDuration.trim() || undefined,
      sinceDate: 'Today',
      hasAllergyOverride: isOverride,
    };

    setPatients((prevList) =>
      prevList.map((p) => {
        if (p.id === currentPatient.id) {
          return {
            ...p,
            medications: [newMed, ...p.medications],
          };
        }
        return p;
      })
    );

    setIsAddMedicationOpen(false);
    showToast(isOverride ? 'Added with allergy override' : 'Medication added');

    // Sync newly added medication to prescription cache and backend
    const cacheKey = `@medi_queue_prescription_${currentPatient.tokenNumber || 29}`;
    const rxItem = {
      id: `rx-${newMed.id}`,
      name: `${newMed.drugName} ${newMed.dose}`.trim(),
      type: (newMed.drugName.toLowerCase().includes('inhaler') ? 'INHALER' : 'TABLET') as any,
      dosage: newMed.dose,
      frequency: newMed.frequency,
      frequencyCode: (newMed.frequency.toLowerCase().includes('every 6') ? 'TDS' : 'BD') as any,
      duration: newMed.duration || '5 days',
      durationDays: 5,
      instructions: newMed.sinceDate,
      tagType: (newMed.drugName.toLowerCase().includes('inhaler') ? 'indication' : 'food') as any,
    };
    (async () => {
      try {
        let existingPrescriptions: any[] = [];
        const raw = await AsyncStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          existingPrescriptions = parsed.prescriptions || [];
        }
        const updatedPrescriptions = [rxItem, ...existingPrescriptions];
        await AsyncStorage.setItem(cacheKey, JSON.stringify({ prescriptions: updatedPrescriptions }));
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(cacheKey, JSON.stringify({ prescriptions: updatedPrescriptions }));
        }
        await savePrescriptionApi({
          diagnoses: [],
          clinicalNotes: '',
          prescriptions: updatedPrescriptions,
          tokenNumber: currentPatient.tokenNumber || 29,
        });
      } catch (e) {}
    })();
  };

  // ─────────────────────────────────────────────────────────
  // 2. VITALS TREND BOTTOM SHEET STATE & LOGIC
  // ─────────────────────────────────────────────────────────
  const [isVitalsTrendOpen, setIsVitalsTrendOpen] = useState(false);
  const [activeTrendVital, setActiveTrendVital] = useState<ActiveVitalType>('bp');

  const handleOpenVitalsTrend = (vitalType: ActiveVitalType) => {
    setActiveTrendVital(vitalType);
    setIsVitalsTrendOpen(true);
  };

  const handleCloseVitalsTrend = () => {
    setIsVitalsTrendOpen(false);
  };

  // ─────────────────────────────────────────────────────────
  // 3. EDIT VITALS BOTTOM SHEET STATE & LOGIC
  // ─────────────────────────────────────────────────────────
  const [isEditVitalsOpen, setIsEditVitalsOpen] = useState(false);
  const [formSystolic, setFormSystolic] = useState('');
  const [formDiastolic, setFormDiastolic] = useState('');
  const [formHeartRate, setFormHeartRate] = useState('');
  const [formBodyTemp, setFormBodyTemp] = useState('');
  const [formSpO2, setFormSpO2] = useState('');
  const [formWeight, setFormWeight] = useState('');
  const [formHeight, setFormHeight] = useState('');

  const [fieldErrors, setFieldErrors] = useState<{
    systolic?: string;
    diastolic?: string;
    heartRate?: string;
    bodyTemp?: string;
    spO2?: string;
    weight?: string;
    height?: string;
  }>({});

  const systolicInputRef = useRef<TextInput>(null);
  const diastolicInputRef = useRef<TextInput>(null);
  const heartRateInputRef = useRef<TextInput>(null);
  const bodyTempInputRef = useRef<TextInput>(null);
  const spO2InputRef = useRef<TextInput>(null);
  const weightInputRef = useRef<TextInput>(null);
  const heightInputRef = useRef<TextInput>(null);

  const handleOpenEditVitals = () => {
    setFormSystolic(String(currentPatient.vitals.systolic));
    setFormDiastolic(String(currentPatient.vitals.diastolic));
    setFormHeartRate(String(currentPatient.vitals.heartRateNum));
    const tempC = formatTempCelsius(currentPatient.vitals.tempNum).display;
    setFormBodyTemp(tempC);
    setFormSpO2(String(currentPatient.vitals.spO2Num));
    const rawWeight = currentPatient.vitals.weightNum
      ? String(currentPatient.vitals.weightNum)
      : (currentPatient.vitals.weight || '65').replace(/[^0-9.]/g, '');
    const rawHeight = currentPatient.vitals.heightNum
      ? String(currentPatient.vitals.heightNum)
      : (currentPatient.vitals.height || '170').replace(/[^0-9.]/g, '');
    setFormWeight(rawWeight);
    setFormHeight(rawHeight);
    setFieldErrors({});
    setIsEditVitalsOpen(true);
    setTimeout(() => {
      systolicInputRef.current?.focus();
    }, 150);
  };

  const handleCloseEditVitals = () => {
    setIsEditVitalsOpen(false);
    setFieldErrors({});
  };

  const handleSaveVitals = () => {
    const sys = parseFloat(formSystolic);
    const dia = parseFloat(formDiastolic);
    const hr = parseFloat(formHeartRate);
    let temp = parseFloat(formBodyTemp);
    const spo2 = parseFloat(formSpO2);
    const weightVal = parseFloat(formWeight);
    const heightVal = parseFloat(formHeight);

    const errors: typeof fieldErrors = {};

    // 1. Systolic validation: 50 to 260
    if (isNaN(sys) || sys < 50 || sys > 260) {
      errors.systolic = 'Enter systolic from 50 to 260 mmHg';
    }

    // 2. Diastolic validation: 30 to 160
    if (isNaN(dia) || dia < 30 || dia > 160) {
      errors.diastolic = 'Enter diastolic from 30 to 160 mmHg';
    }

    // 3. Systolic must be higher than diastolic
    if (!errors.systolic && !errors.diastolic && sys <= dia) {
      errors.systolic = 'Systolic must be higher than diastolic';
    }

    // 4. Heart rate: 20 to 250
    if (isNaN(hr) || hr < 20 || hr > 250) {
      errors.heartRate = 'Enter a heart rate from 20 to 250 bpm';
    }

    // 5. Body temp: 34 to 43 °C (auto-convert if entered in Fahrenheit > 50)
    if (temp > 50 && temp <= 110) {
      temp = Math.round(((temp - 32) * (5 / 9)) * 10) / 10;
    } else if (isNaN(temp) || temp < 34 || temp > 43) {
      errors.bodyTemp = 'Enter temperature from 34.0 to 43.0 °C';
    }

    // 6. SpO2: 50 to 100
    if (isNaN(spo2) || spo2 < 50 || spo2 > 100) {
      errors.spO2 = 'Enter SpO2 from 50 to 100%';
    }

    // 7. Weight validation
    if (formWeight.trim() && (isNaN(weightVal) || weightVal < 1 || weightVal > 300)) {
      errors.weight = 'Enter valid weight (1 - 300 kg)';
    }

    // 8. Height validation
    if (formHeight.trim() && (isNaN(heightVal) || heightVal < 30 || heightVal > 250)) {
      errors.height = 'Enter valid height (30 - 250 cm)';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      if (errors.systolic) systolicInputRef.current?.focus();
      else if (errors.diastolic) diastolicInputRef.current?.focus();
      else if (errors.heartRate) heartRateInputRef.current?.focus();
      else if (errors.bodyTemp) bodyTempInputRef.current?.focus();
      else if (errors.spO2) spO2InputRef.current?.focus();
      else if (errors.weight) weightInputRef.current?.focus();
      else if (errors.height) heightInputRef.current?.focus();
      return;
    }

    const finalWeight = !isNaN(weightVal) ? weightVal : (currentPatient.vitals.weightNum || 65);
    const finalHeight = !isNaN(heightVal) ? heightVal : (currentPatient.vitals.heightNum || 170);
    const bmiCalc = calculateBMI(finalWeight, finalHeight);

    // New history item
    const newHistoryItem: VitalHistoryReading = {
      id: `vh-${Date.now()}`,
      dateLabel: 'Now',
      timestamp: 'Today, Just now',
      systolic: sys,
      diastolic: dia,
      heartRate: hr,
      bodyTemp: temp,
      spO2: spo2,
      weight: finalWeight,
      bmi: bmiCalc.bmi,
    };

    setPatients((prevList) =>
      prevList.map((p) => {
        if (p.id === currentPatient.id) {
          // Keep last 5 history readings
          const updatedHistory = [
            ...p.vitalsHistory.map((item) =>
              item.dateLabel === 'Now' ? { ...item, dateLabel: 'Prev' } : item
            ),
            newHistoryItem,
          ].slice(-5);

          return {
            ...p,
            vitals: {
              ...p.vitals,
              triageTime: 'Triage: Just now',
              bloodPressure: `${sys}/${dia}`,
              heartRate: String(hr),
              bodyTemp: temp.toFixed(1),
              bodyTempUnit: '°C',
              spO2: `${spo2}%`,
              systolic: sys,
              diastolic: dia,
              heartRateNum: hr,
              tempNum: temp,
              spO2Num: spo2,
              weight: `${finalWeight} kg`,
              weightNum: finalWeight,
              height: `${finalHeight} cm`,
              heightNum: finalHeight,
              bmi: bmiCalc.bmi > 0 ? bmiCalc.bmi.toFixed(1) : p.vitals.bmi,
              bmiNum: bmiCalc.bmi > 0 ? bmiCalc.bmi : p.vitals.bmiNum,
              bmiStatus: bmiCalc.status.label,
            },
            vitalsHistory: updatedHistory,
          };
        }
        return p;
      })
    );

    setIsEditVitalsOpen(false);
    showToast('Vitals updated');
  };

  // Keyboard Escape listener on web for all modals
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleCloseAddMedication();
          handleCloseVitalsTrend();
          handleCloseEditVitals();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, []);

  // Filtered patients list based on search and status
  const filteredPatients = useMemo(() => {
    return filterPatientsList(patients, searchQuery, statusFilter);
  }, [patients, searchQuery, statusFilter]);

  const handleSelectPatient = (patient: PatientRecord) => {
    setCurrentPatientId(patient.id);
    showToast(`Switched active record to ${patient.name}`);
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleStartConsultation = () => {
    showToast(`Starting consultation with ${currentPatient.name}`);
    try {
      router.push({
        pathname: '/(doctor)/prescription' as any,
        params: {
          tokenNumber: String(currentPatient.tokenNumber || 29),
          patientName: currentPatient.name,
        },
      });
    } catch (e) {}
  };

  // ─────────────────────────────────────────────────────────
  // BOTTOM TAB NAVIGATION
  // Preserved exact original icons:
  // Home: Ionicons 'home-outline'
  // Queue: MaterialCommunityIcons 'ticket-confirmation-outline'
  // Records: MaterialCommunityIcons 'folder-account-outline' (Active)
  // Schedule: MaterialCommunityIcons 'calendar-month-outline'
  // Prescription: MaterialCommunityIcons 'clipboard-edit-outline'
  // ─────────────────────────────────────────────────────────
  const handleTabPress = (tab: 'home' | 'queue' | 'records' | 'schedule' | 'rx') => {
    setActiveTab(tab);
    if (tab === 'records') {
      showToast('Viewing Patient Records');
      return;
    }
    if (tab === 'home') {
      try {
        router.push('/(doctor)/dashboard' as any);
      } catch (e) {
        showToast('Switched to Home');
      }
    } else if (tab === 'queue') {
      try {
        router.push('/(doctor)/queue' as any);
      } catch (e) {
        showToast('Switched to Queue');
      }
    } else if (tab === 'schedule') {
      try {
        router.push('/(doctor)/schedule' as any);
      } catch (e) {
        showToast('Switched to Schedule');
      }
    } else if (tab === 'rx') {
      try {
        router.push('/(doctor)/prescription' as any);
      } catch (e) {
        showToast('Switched to Prescription');
      }
    }
  };

  // Calculated vital status labels
  const bpStatus = getBPStatus(currentPatient.vitals.systolic, currentPatient.vitals.diastolic);
  const hrStatus = getHRStatus(currentPatient.vitals.heartRateNum);
  const currentTempC = formatTempCelsius(currentPatient.vitals.tempNum);
  const tempStatus = getTempStatus(currentTempC.tempC);
  const spO2Status = getSpO2Status(currentPatient.vitals.spO2Num);

  // Weight and BMI calculations
  const currentWeightNum =
    currentPatient.vitals.weightNum ||
    (currentPatient.vitals.weight ? parseFloat(currentPatient.vitals.weight.replace(/[^0-9.]/g, '')) : 65);
  const currentHeightNum =
    currentPatient.vitals.heightNum ||
    (currentPatient.vitals.height ? parseFloat(currentPatient.vitals.height.replace(/[^0-9.]/g, '')) : 170);

  const fallbackBmi = calculateBMI(currentWeightNum, currentHeightNum);
  const bmiDisplay = currentPatient.vitals.bmi || fallbackBmi.bmi.toFixed(1);
  const bmiStatusResult = currentPatient.vitals.bmiNum
    ? getBMIStatus(currentPatient.vitals.bmiNum)
    : fallbackBmi.status;

  // Trend summary helper
  const trendInfo = useMemo(() => {
    const history = currentPatient.vitalsHistory;
    const count = history.length;
    const latest = history[count - 1];
    const prev = count > 1 ? history[count - 2] : null;

    if (activeTrendVital === 'bp') {
      const diffSys = prev ? latest.systolic - prev.systolic : 0;
      const changeText =
        diffSys > 0
          ? `Up ${diffSys} mmHg since previous reading`
          : diffSys < 0
          ? `Down ${Math.abs(diffSys)} mmHg since previous reading`
          : 'Stable compared to previous reading';
      return {
        title: 'Blood pressure',
        unit: 'mmHg',
        latestText: `${latest.systolic}/${latest.diastolic} mmHg`,
        statusResult: bpStatus,
        changeText,
        normalRangeLabel: 'Normal range: 90/60 to 139/89 mmHg',
      };
    } else if (activeTrendVital === 'hr') {
      const diff = prev ? latest.heartRate - prev.heartRate : 0;
      const changeText =
        diff > 0
          ? `Up ${diff} bpm since previous reading`
          : diff < 0
          ? `Down ${Math.abs(diff)} bpm since previous reading`
          : 'Stable compared to previous reading';
      return {
        title: 'Heart rate',
        unit: 'bpm',
        latestText: `${latest.heartRate} bpm`,
        statusResult: hrStatus,
        changeText,
        normalRangeLabel: 'Normal range: 60 to 100 bpm',
      };
    } else if (activeTrendVital === 'temp') {
      const latestC = formatTempCelsius(latest.bodyTemp).tempC;
      const prevC = prev ? formatTempCelsius(prev.bodyTemp).tempC : latestC;
      const diff = prev ? (latestC - prevC).toFixed(1) : '0.0';
      const changeText =
        parseFloat(diff) > 0
          ? `Up ${diff} °C since previous reading`
          : parseFloat(diff) < 0
          ? `Down ${Math.abs(parseFloat(diff))} °C since previous reading`
          : 'Stable compared to previous reading';
      return {
        title: 'Body temperature',
        unit: '°C',
        latestText: `${latestC.toFixed(1)} °C`,
        statusResult: tempStatus,
        changeText,
        normalRangeLabel: 'Normal range: 36.1 to 37.2 °C',
      };
    } else if (activeTrendVital === 'weight') {
      const latestW = latest.weight || currentWeightNum;
      const prevW = prev?.weight || latestW;
      const diff = prev ? (latestW - prevW).toFixed(1) : '0.0';
      const changeText =
        parseFloat(diff) > 0
          ? `Up ${diff} kg since previous reading`
          : parseFloat(diff) < 0
          ? `Down ${Math.abs(parseFloat(diff))} kg since previous reading`
          : 'Stable compared to previous reading';
      return {
        title: 'Body weight',
        unit: 'kg',
        latestText: `${latestW} kg`,
        statusResult: { label: `Height: ${currentHeightNum} cm`, isAbnormal: false },
        changeText,
        normalRangeLabel: 'Standard clinic measured weight in kilograms',
      };
    } else if (activeTrendVital === 'bmi') {
      return {
        title: 'Body Mass Index (BMI)',
        unit: 'kg/m²',
        latestText: `${bmiDisplay} kg/m²`,
        statusResult: bmiStatusResult,
        changeText: `Category: ${bmiStatusResult.label}`,
        normalRangeLabel: 'Normal BMI range: 18.5 to 24.9 kg/m²',
      };
    } else {
      const diff = prev ? latest.spO2 - prev.spO2 : 0;
      const changeText =
        diff > 0
          ? `Up ${diff}% since previous reading`
          : diff < 0
          ? `Down ${Math.abs(diff)}% since previous reading`
          : 'Stable compared to previous reading';
      return {
        title: 'Oxygen saturation (SpO2)',
        unit: '%',
        latestText: `${latest.spO2}%`,
        statusResult: spO2Status,
        changeText,
        normalRangeLabel: 'Normal range: 95% to 100%',
      };
    }
  }, [currentPatient, activeTrendVital, bpStatus, hrStatus, tempStatus, spO2Status, currentWeightNum, currentHeightNum, bmiDisplay, bmiStatusResult]);

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: isDark ? theme.pageBg : theme.pageBg },
      ]}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      {/* Centered responsive frame: 440px max width on desktop, full width on mobile */}
      <View
        style={[
          styles.outerFrame,
          { backgroundColor: isDark ? theme.pageBg : theme.pageBg },
        ]}
      >
        <View
          style={[
            styles.mobileContainer,
            { backgroundColor: theme.background },
          ]}
        >
          {/* Main Scroll Content */}
          <ScrollView
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* ─────────────────────────────────────────────────────────
                1. HEADER
                Doctor avatar with green online dot, "Dr. Emilia Emelson",
                "Room 3B online" in teal, notification bell with red dot
               ───────────────────────────────────────────────────────── */}
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <View style={styles.avatarWrapper}>
                  <View
                    style={[
                      styles.avatarBadge,
                      { backgroundColor: theme.primaryDeep },
                    ]}
                  >
                    <Text style={styles.avatarInitials}>EE</Text>
                  </View>
                  <View style={styles.onlineDot} />
                </View>

                <View style={styles.doctorInfo}>
                  <Text
                    style={[styles.doctorName, { color: theme.textDark }]}
                    numberOfLines={1}
                  >
                    Dr. Emilia Emelson
                  </Text>
                  <View style={styles.doctorSubRow}>
                    <View style={styles.onlineMiniDot} />
                    <Text
                      style={[styles.doctorSubtitle, { color: theme.accent }]}
                    >
                      Room 3B online
                    </Text>
                  </View>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {/* Top Bar Refresh Button */}
                <TouchableOpacity
                  style={[
                    styles.topRefreshButton,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                  activeOpacity={0.7}
                  onPress={handleResetToCurrentPatient}
                  accessibilityLabel="Refresh Current Patient"
                >
                  <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
                    <Ionicons
                      name="refresh-outline"
                      size={20}
                      color={theme.accent}
                    />
                  </Animated.View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.bellButton,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => showToast('Notifications: No new alerts')}
                >
                  <Ionicons
                    name="notifications-outline"
                    size={20}
                    color={theme.textDark}
                  />
                  <View style={styles.redDot} />
                </TouchableOpacity>
              </View>
            </View>

            {/* ─────────────────────────────────────────────────────────
                2. SEARCH BAR (Pill Shape)
                "Search patient name, token or NIC..."
               ───────────────────────────────────────────────────────── */}
            <View
              style={[
                styles.searchPill,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <Ionicons
                name="search-outline"
                size={18}
                color={theme.accent}
                style={{ marginRight: 10 }}
              />
              <TextInput
                style={[styles.searchInput, { color: theme.textDark }]}
                placeholder="Search patient name, token or NIC..."
                placeholderTextColor={theme.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  style={styles.searchClearBtn}
                >
                  <Ionicons
                    name="close-circle"
                    size={16}
                    color={theme.textMuted}
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* ─────────────────────────────────────────────────────────
                3. CURRENT PATIENT SECTION (Top, always visible in exact order)
               ───────────────────────────────────────────────────────── */}
            <View style={styles.currentPatientSection}>
              {/* a. Heading Row */}
              <View style={styles.sectionHeaderRow}>
                <Text
                  style={[styles.sectionHeadingTitle, { color: theme.textDark }]}
                >
                  CURRENT PATIENT
                </Text>

                <View
                  style={[
                    styles.currentStatusBadge,
                    {
                      backgroundColor:
                        currentPatient.status === 'In consultation'
                          ? isDark
                            ? '#1a2e33'
                            : '#e6f7f9'
                          : currentPatient.status === 'Waiting'
                          ? isDark
                            ? '#302613'
                            : '#fffbeb'
                          : isDark
                          ? '#142b23'
                          : '#ecfdf5',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.currentStatusBadgeText,
                      {
                        color:
                          currentPatient.status === 'In consultation'
                            ? theme.accent
                            : currentPatient.status === 'Waiting'
                            ? '#d97706'
                            : '#059669',
                      },
                    ]}
                  >
                    {currentPatient.status}
                  </Text>
                </View>
              </View>

              {/* b. Patient Card */}
              <View
                style={[
                  styles.patientCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.cardBorder,
                  },
                ]}
              >
                <View style={styles.patientCardTop}>
                  <View
                    style={[
                      styles.patientInitialsAvatar,
                      { backgroundColor: theme.tint },
                    ]}
                  >
                    <Text
                      style={[
                        styles.patientInitialsText,
                        { color: theme.primaryDeep },
                      ]}
                    >
                      {currentPatient.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.patientMetaBlock}>
                    <View style={styles.nameVerifiedRow}>
                      <Text
                        style={[styles.patientCardName, { color: theme.textDark }]}
                        numberOfLines={1}
                      >
                        {currentPatient.name}
                      </Text>
                      {currentPatient.verified && (
                        <View style={styles.verifiedBadge}>
                          <Ionicons
                            name="checkmark-circle"
                            size={14}
                            color="#10b981"
                          />
                          <Text style={styles.verifiedBadgeText}>Verified</Text>
                        </View>
                      )}
                    </View>

                    <Text
                      style={[
                        styles.patientCardDemographics,
                        { color: theme.textMuted },
                      ]}
                    >
                      {currentPatient.age} yrs • {currentPatient.gender} • Blood:{' '}
                      {currentPatient.bloodGroup}
                    </Text>
                  </View>

                  {/* Dark Teal Token Box */}
                  <View
                    style={[
                      styles.tokenBox,
                      { backgroundColor: theme.primaryDeep },
                    ]}
                  >
                    <Text style={styles.tokenBoxLabel}>TOKEN</Text>
                    <Text style={styles.tokenBoxNum}>
                      {currentPatient.tokenFormatted}
                    </Text>
                  </View>
                </View>

                <View
                  style={[styles.cardDivider, { backgroundColor: theme.divider }]}
                />

                <View style={styles.patientCardBottom}>
                  <View style={styles.cardInfoPill}>
                    <Ionicons
                      name="card-outline"
                      size={14}
                      color={theme.accent}
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[styles.cardInfoText, { color: theme.textMuted }]}
                    >
                      NIC: {currentPatient.nic}
                    </Text>
                  </View>

                  <View style={styles.cardInfoPill}>
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color={theme.accent}
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[styles.cardInfoText, { color: theme.textMuted }]}
                    >
                      Reg: {currentPatient.registeredTime}
                    </Text>
                  </View>
                </View>
              </View>

              {/* c. Allergy Alert Card */}
              {currentPatient.allergy.hasAllergy ? (
                <View style={styles.allergyCard}>
                  <View style={styles.allergyIconCol}>
                    <Ionicons name="warning" size={20} color="#dc2626" />
                  </View>
                  <View style={styles.allergyTextCol}>
                    <Text style={styles.allergyTitle}>
                      {currentPatient.allergy.title}
                    </Text>
                    <Text style={styles.allergyDesc}>
                      {currentPatient.allergy.description}
                    </Text>
                  </View>
                </View>
              ) : (
                <View
                  style={[
                    styles.noAllergyCard,
                    {
                      backgroundColor: isDark ? '#12261e' : '#f0fdf4',
                      borderColor: isDark ? '#1c3e31' : '#bbf7d0',
                    },
                  ]}
                >
                  <Ionicons
                    name="shield-checkmark"
                    size={18}
                    color="#16a34a"
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={[
                      styles.noAllergyText,
                      { color: isDark ? '#86efac' : '#15803d' },
                    ]}
                  >
                    No known drug allergies reported
                  </Text>
                </View>
              )}

              {/* d. Chronic conditions Heading with Small Chips */}
              <View style={styles.sectionBlock}>
                <Text
                  style={[styles.subSectionTitle, { color: theme.textDark, marginBottom: 8 }]}
                >
                  Chronic conditions
                </Text>
                {currentPatient.chronicConditions.length > 0 ? (
                  <View style={styles.chronicChipsWrap}>
                    {currentPatient.chronicConditions.map((cond, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.chronicChip,
                          {
                            backgroundColor: theme.card,
                            borderColor: theme.cardBorder,
                          },
                        ]}
                      >
                        <View style={styles.chronicDot} />
                        <Text
                          style={[styles.chronicChipText, { color: theme.textDark }]}
                        >
                          {cond}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.noneRecordedText, { color: theme.textMuted }]}>
                    None recorded.
                  </Text>
                )}
              </View>

              {/* e. Current Medications Heading with Add Button */}
              <View style={styles.sectionBlock}>
                <View style={styles.subSectionHeaderRow}>
                  <Text
                    style={[styles.subSectionTitle, { color: theme.textDark }]}
                  >
                    Current medications
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.addMedicationPill,
                      {
                        backgroundColor: theme.tint,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                    activeOpacity={0.8}
                    onPress={handleOpenAddMedication}
                  >
                    <Ionicons
                      name="add"
                      size={14}
                      color={theme.primaryDeep}
                      style={{ marginRight: 3 }}
                    />
                    <Text
                      style={[
                        styles.addMedicationPillText,
                        { color: theme.primaryDeep },
                      ]}
                    >
                      Add
                    </Text>
                  </TouchableOpacity>
                </View>

                {currentPatient.medications.length > 0 ? (
                  <View
                    style={[
                      styles.medicationsCard,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                  >
                    {currentPatient.medications.map((med, index) => {
                      const isLast = index === currentPatient.medications.length - 1;
                      return (
                        <View
                          key={med.id}
                          style={[
                            styles.medicationRow,
                            !isLast && [
                              styles.medicationRowBorder,
                              { borderBottomColor: theme.divider },
                            ],
                          ]}
                        >
                          <View
                            style={[
                              styles.medPillIconBox,
                              { backgroundColor: theme.tint },
                            ]}
                          >
                            <MaterialCommunityIcons
                              name="pill"
                              size={18}
                              color={theme.primaryDeep}
                            />
                          </View>

                          <View style={{ flex: 1, marginRight: 8 }}>
                            <View style={styles.medTitleRow}>
                              <Text
                                style={[styles.medNameText, { color: theme.textDark }]}
                              >
                                {med.drugName}{' '}
                                <Text style={styles.medDoseText}>{med.dose}</Text>
                              </Text>

                              {med.hasAllergyOverride && (
                                <View style={styles.allergyOverrideTag}>
                                  <Text style={styles.allergyOverrideTagText}>
                                    Allergy override
                                  </Text>
                                </View>
                              )}
                            </View>

                            <Text
                              style={[styles.medFrequencyText, { color: theme.textMuted }]}
                            >
                              {med.frequency}
                              {med.duration ? ` · ${med.duration}` : ''}
                            </Text>
                          </View>

                          <Text
                            style={[styles.medSinceDateText, { color: theme.textMuted }]}
                          >
                            {med.sinceDate}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View
                    style={[
                      styles.emptySubState,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.emptySubStateText, { color: theme.textMuted }]}
                    >
                      No active medications.
                    </Text>
                  </View>
                )}
              </View>

              {/* f. Current Vitals Heading with Triage Time & Edit Button */}
              <View style={styles.vitalsHeaderRow}>
                <View style={styles.vitalsTitleGroup}>
                  <Text
                    style={[styles.subSectionTitle, { color: theme.textDark }]}
                  >
                    Current vitals
                  </Text>
                  <Text
                    style={[styles.triageTimeLabel, { color: theme.textMuted }]}
                  >
                    {currentPatient.vitals.triageTime}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.editVitalsPill,
                    {
                      backgroundColor: theme.tint,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                  activeOpacity={0.8}
                  onPress={handleOpenEditVitals}
                >
                  <Ionicons
                    name="pencil"
                    size={12}
                    color={theme.primaryDeep}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.editVitalsText,
                      { color: theme.primaryDeep },
                    ]}
                  >
                    Edit
                  </Text>
                </TouchableOpacity>
              </View>

              {/* g. Grid of Vital Cards (6 cards: BP, HR, Temp, SpO2, Weight, BMI - Tappable for Trend) */}
              <View style={styles.vitalsGrid}>
                {/* 1. Blood Pressure */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleOpenVitalsTrend('bp')}
                  style={[
                    styles.vitalCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <View style={styles.vitalCardTop}>
                    <View
                      style={[styles.vitalIconCircle, { backgroundColor: '#fee2e2' }]}
                    >
                      <MaterialCommunityIcons
                        name="heart-pulse"
                        size={16}
                        color="#ef4444"
                      />
                    </View>
                    <Text
                      style={[styles.vitalLabel, { color: theme.textMuted }]}
                    >
                      Blood Pressure
                    </Text>
                  </View>
                  <Text style={[styles.vitalValue, { color: theme.textDark }]}>
                    {currentPatient.vitals.bloodPressure}{' '}
                    <Text style={styles.vitalUnit}>mmHg</Text>
                  </Text>
                  <Text
                    style={[
                      styles.vitalCalculatedStatus,
                      { color: bpStatus.isAbnormal ? '#ef4444' : '#10b981' },
                    ]}
                  >
                    {bpStatus.label}
                  </Text>
                </TouchableOpacity>

                {/* 2. Heart Rate */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleOpenVitalsTrend('hr')}
                  style={[
                    styles.vitalCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <View style={styles.vitalCardTop}>
                    <View
                      style={[styles.vitalIconCircle, { backgroundColor: '#fef3c7' }]}
                    >
                      <Ionicons name="pulse" size={16} color="#d97706" />
                    </View>
                    <Text
                      style={[styles.vitalLabel, { color: theme.textMuted }]}
                    >
                      Heart Rate
                    </Text>
                  </View>
                  <Text style={[styles.vitalValue, { color: theme.textDark }]}>
                    {currentPatient.vitals.heartRate}{' '}
                    <Text style={styles.vitalUnit}>bpm</Text>
                  </Text>
                  <Text
                    style={[
                      styles.vitalCalculatedStatus,
                      { color: hrStatus.isAbnormal ? '#ef4444' : '#10b981' },
                    ]}
                  >
                    {hrStatus.label}
                  </Text>
                </TouchableOpacity>

                {/* 3. Body Temp (Celsius) */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleOpenVitalsTrend('temp')}
                  style={[
                    styles.vitalCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <View style={styles.vitalCardTop}>
                    <View
                      style={[styles.vitalIconCircle, { backgroundColor: '#e0f2fe' }]}
                    >
                      <Ionicons
                        name="thermometer-outline"
                        size={16}
                        color="#0284c7"
                      />
                    </View>
                    <Text
                      style={[styles.vitalLabel, { color: theme.textMuted }]}
                    >
                      Body Temp
                    </Text>
                  </View>
                  <Text style={[styles.vitalValue, { color: theme.textDark }]}>
                    {currentTempC.display}{' '}
                    <Text style={styles.vitalUnit}>°C</Text>
                  </Text>
                  <Text
                    style={[
                      styles.vitalCalculatedStatus,
                      { color: tempStatus.isAbnormal ? '#ef4444' : '#10b981' },
                    ]}
                  >
                    {tempStatus.label}
                  </Text>
                </TouchableOpacity>

                {/* 4. Oxygen Sat SpO2 */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleOpenVitalsTrend('spo2')}
                  style={[
                    styles.vitalCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <View style={styles.vitalCardTop}>
                    <View
                      style={[styles.vitalIconCircle, { backgroundColor: '#dcfce7' }]}
                    >
                      <MaterialCommunityIcons
                        name="water-percent"
                        size={16}
                        color="#16a34a"
                      />
                    </View>
                    <Text
                      style={[styles.vitalLabel, { color: theme.textMuted }]}
                    >
                      Oxygen Sat
                    </Text>
                  </View>
                  <Text style={[styles.vitalValue, { color: theme.textDark }]}>
                    {currentPatient.vitals.spO2}
                  </Text>
                  <Text
                    style={[
                      styles.vitalCalculatedStatus,
                      { color: spO2Status.isAbnormal ? '#ef4444' : '#10b981' },
                    ]}
                  >
                    {spO2Status.label}
                  </Text>
                </TouchableOpacity>

                {/* 5. Weight */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleOpenVitalsTrend('weight')}
                  style={[
                    styles.vitalCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <View style={styles.vitalCardTop}>
                    <View
                      style={[styles.vitalIconCircle, { backgroundColor: '#f3e8ff' }]}
                    >
                      <MaterialCommunityIcons
                        name="scale-bathroom"
                        size={16}
                        color="#9333ea"
                      />
                    </View>
                    <Text
                      style={[styles.vitalLabel, { color: theme.textMuted }]}
                    >
                      Weight
                    </Text>
                  </View>
                  <Text style={[styles.vitalValue, { color: theme.textDark }]}>
                    {currentWeightNum}{' '}
                    <Text style={styles.vitalUnit}>kg</Text>
                  </Text>
                  <Text
                    style={[
                      styles.vitalCalculatedStatus,
                      { color: theme.textMuted },
                    ]}
                  >
                    Ht: {currentHeightNum} cm
                  </Text>
                </TouchableOpacity>

                {/* 6. BMI (Body Mass Index) */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleOpenVitalsTrend('bmi')}
                  style={[
                    styles.vitalCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <View style={styles.vitalCardTop}>
                    <View
                      style={[styles.vitalIconCircle, { backgroundColor: '#ccfbf1' }]}
                    >
                      <MaterialCommunityIcons
                        name="calculator-variant-outline"
                        size={16}
                        color="#0d9488"
                      />
                    </View>
                    <Text
                      style={[styles.vitalLabel, { color: theme.textMuted }]}
                    >
                      BMI Index
                    </Text>
                  </View>
                  <Text style={[styles.vitalValue, { color: theme.textDark }]}>
                    {bmiDisplay}{' '}
                    <Text style={styles.vitalUnit}>kg/m²</Text>
                  </Text>
                  <Text
                    style={[
                      styles.vitalCalculatedStatus,
                      { color: bmiStatusResult.isAbnormal ? '#ef4444' : '#10b981' },
                    ]}
                  >
                    {bmiStatusResult.label}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Small Hint under vitals grid */}
              <View style={styles.vitalsHintRow}>
                <Ionicons
                  name="analytics-outline"
                  size={12}
                  color={theme.accent}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.vitalsHintText, { color: theme.textMuted }]}>
                  Tap a card to see its trend.
                </Text>
              </View>

              {/* i. Diagnostic Imaging Section */}
              <View style={styles.sectionBlock}>
                <View style={styles.subSectionHeaderRow}>
                  <Text
                    style={[styles.subSectionTitle, { color: theme.textDark }]}
                  >
                    Diagnostic imaging
                  </Text>
                  {currentPatient.imaging.hasImaging && (
                    <Text
                      style={[styles.subSectionSubLabel, { color: theme.textMuted }]}
                    >
                      {currentPatient.imaging.subtitle}
                    </Text>
                  )}
                </View>

                {currentPatient.imaging.hasImaging ? (
                  <View
                    style={[
                      styles.imagingCard,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                  >
                    <View style={styles.imagingLeft}>
                      <View
                        style={[
                          styles.imagingIconBox,
                          { backgroundColor: theme.tint },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="radiology-box"
                          size={24}
                          color={theme.primaryDeep}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.imagingTitle,
                            { color: theme.textDark },
                          ]}
                        >
                          {currentPatient.imaging.title}
                        </Text>
                        <Text
                          style={[
                            styles.imagingDesc,
                            { color: theme.textMuted },
                          ]}
                          numberOfLines={1}
                        >
                          {currentPatient.imaging.description}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.viewReportPill,
                        {
                          backgroundColor: theme.tint,
                          borderColor: theme.cardBorder,
                        },
                      ]}
                      activeOpacity={0.8}
                      onPress={() =>
                        showToast(
                          `Viewing report for ${currentPatient.imaging.title}`
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.viewReportText,
                          { color: theme.primaryDeep },
                        ]}
                      >
                        View report
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.emptySubState,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.emptySubStateText,
                        { color: theme.textMuted },
                      ]}
                    >
                      No diagnostic imaging records found
                    </Text>
                  </View>
                )}
              </View>

              {/* j. Recent Visits & History Section */}
              <View style={styles.sectionBlock}>
                <View style={styles.subSectionHeaderRow}>
                  <Text
                    style={[styles.subSectionTitle, { color: theme.textDark }]}
                  >
                    Recent visits & history
                  </Text>
                  <Text
                    style={[styles.subSectionSubLabel, { color: theme.textMuted }]}
                  >
                    All {currentPatient.recentVisits.length} Records
                  </Text>
                </View>

                <View
                  style={[
                    styles.historyCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  {currentPatient.recentVisits.map((visit, index) => {
                    const isLast = index === currentPatient.recentVisits.length - 1;
                    return (
                      <View
                        key={visit.id}
                        style={[
                          styles.historyRow,
                          !isLast && [
                            styles.historyRowBorder,
                            { borderBottomColor: theme.divider },
                          ],
                        ]}
                      >
                        <View style={styles.historyRowHeader}>
                          <View
                            style={[
                              styles.historyIconBox,
                              { backgroundColor: theme.tint },
                            ]}
                          >
                            <MaterialCommunityIcons
                              name={(visit.icon as any) || 'clipboard-text-outline'}
                              size={16}
                              color={theme.primaryDeep}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={styles.historyTitleDateRow}>
                              <Text
                                style={[
                                  styles.historyTitle,
                                  { color: theme.textDark },
                                ]}
                              >
                                {visit.title}
                              </Text>
                              <Text
                                style={[
                                  styles.historyDate,
                                  { color: theme.textMuted },
                                ]}
                              >
                                {visit.date}
                              </Text>
                            </View>

                            <Text
                              style={[
                                styles.historyDetails,
                                { color: theme.textMuted },
                              ]}
                            >
                              {visit.details}
                            </Text>

                            {visit.statusBadge && (
                              <View style={styles.resolvedPill}>
                                <Ionicons
                                  name="checkmark-circle"
                                  size={12}
                                  color="#10b981"
                                  style={{ marginRight: 3 }}
                                />
                                <Text style={styles.resolvedPillText}>
                                  {visit.statusBadge}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* k. Start Consultation Button */}
              <TouchableOpacity
                style={[
                  styles.startConsultationBtn,
                  { backgroundColor: theme.primaryDeep },
                ]}
                activeOpacity={0.85}
                onPress={handleStartConsultation}
              >
                <MaterialCommunityIcons
                  name="stethoscope"
                  size={20}
                  color="#ffffff"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.startConsultationText}>
                  Start consultation with {currentPatient.shortName}
                </Text>
              </TouchableOpacity>
            </View>


            <View style={{ height: 100 }} />
          </ScrollView>

          {/* ─────────────────────────────────────────────────────────
              5. FIXED BOTTOM NAVIGATION
              User instruction: "mage araginal navigation bar eke icon change karanna epa"
              EXACT ORIGINAL 5 ICONS & LABELS PRESERVED:
              1. Home: Ionicons 'home-outline'
              2. Queue: MaterialCommunityIcons 'ticket-confirmation-outline'
              3. Records: MaterialCommunityIcons 'folder-account-outline' (Active)
              4. Schedule: MaterialCommunityIcons 'calendar-month-outline'
              5. Prescription: MaterialCommunityIcons 'clipboard-edit-outline'
             ───────────────────────────────────────────────────────── */}
          <View
            style={[
              styles.bottomTabBar,
              {
                backgroundColor: theme.card,
                borderTopColor: theme.cardBorder,
              },
            ]}
          >
            {/* 1. Home */}
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => handleTabPress('home')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="home-outline"
                size={22}
                color={activeTab === 'home' ? theme.accent : theme.textMuted}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: activeTab === 'home' ? theme.accent : theme.textMuted },
                  activeTab === 'home' && styles.tabLabelActive,
                ]}
              >
                Home
              </Text>
            </TouchableOpacity>

            {/* 2. Queue */}
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => handleTabPress('queue')}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="ticket-confirmation-outline"
                size={23}
                color={activeTab === 'queue' ? theme.accent : theme.textMuted}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: activeTab === 'queue' ? theme.accent : theme.textMuted },
                  activeTab === 'queue' && styles.tabLabelActive,
                ]}
              >
                Queue
              </Text>
            </TouchableOpacity>

            {/* 3. Records (ACTIVE) */}
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => handleTabPress('records')}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="folder-account-outline"
                size={22}
                color={theme.accent}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: theme.accent },
                  styles.tabLabelActive,
                ]}
              >
                Records
              </Text>
            </TouchableOpacity>

            {/* 4. Schedule */}
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => handleTabPress('schedule')}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="calendar-month-outline"
                size={22}
                color={activeTab === 'schedule' ? theme.accent : theme.textMuted}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: activeTab === 'schedule' ? theme.accent : theme.textMuted },
                  activeTab === 'schedule' && styles.tabLabelActive,
                ]}
              >
                Schedule
              </Text>
            </TouchableOpacity>

            {/* 5. Prescription */}
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => handleTabPress('rx')}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="clipboard-edit-outline"
                size={22}
                color={activeTab === 'rx' ? theme.accent : theme.textMuted}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.tabLabel,
                  { color: activeTab === 'rx' ? theme.accent : theme.textMuted },
                  activeTab === 'rx' && styles.tabLabelActive,
                ]}
              >
                Prescription
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ─────────────────────────────────────────────────────────
          BOTTOM SHEET 1: ADD MEDICATION (WITH ALLERGY CHECK)
         ───────────────────────────────────────────────────────── */}
      <Modal
        visible={isAddMedicationOpen}
        transparent
        animationType="slide"
        onRequestClose={handleCloseAddMedication}
      >
        <TouchableOpacity
          style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}
          activeOpacity={1}
          onPress={handleCloseAddMedication}
        >
          <TouchableOpacity
            style={[
              styles.sheetContainer,
              {
                backgroundColor: theme.sheetBg,
                borderColor: theme.cardBorder,
              },
            ]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={[styles.sheetHandle, { backgroundColor: theme.cardBorder }]}
            />

            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: theme.textDark }]}>
                  Add medication
                </Text>
                <Text style={[styles.sheetSubTitle, { color: theme.textMuted }]}>
                  {currentPatient.name} ·{' '}
                  {currentPatient.allergy.hasAllergy
                    ? currentPatient.allergy.title
                    : 'No known allergies'}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.sheetCloseBtn,
                  { backgroundColor: theme.cardBorder },
                ]}
                onPress={handleCloseAddMedication}
              >
                <Ionicons name="close" size={20} color={theme.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetFormContent}
            >
              {/* Live Allergy Conflict / Status Card above form */}
              {allergyCheck.status === 'conflict' ? (
                <View style={styles.allergyConflictCard}>
                  <Ionicons
                    name="alert-circle"
                    size={20}
                    color="#dc2626"
                    style={{ marginRight: 8, marginTop: 1 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.allergyConflictTitle}>
                      Allergy conflict detected: {allergyCheck.allergen}
                    </Text>
                    <Text style={styles.allergyConflictNote}>
                      {allergyCheck.note}
                    </Text>
                  </View>
                </View>
              ) : allergyCheck.status === 'similar' ? (
                <View style={styles.allergySimilarCard}>
                  <Ionicons
                    name="information-circle"
                    size={20}
                    color="#d97706"
                    style={{ marginRight: 8, marginTop: 1 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.allergySimilarTitle}>
                      Similar drug already listed
                    </Text>
                    <Text style={styles.allergySimilarNote}>
                      {allergyCheck.note}
                    </Text>
                  </View>
                </View>
              ) : allergyCheck.status === 'safe' ? (
                <View style={styles.allergySafeCard}>
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color="#16a34a"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.allergySafeText}>
                    No allergy conflict found
                  </Text>
                </View>
              ) : null}

              {/* Field 1: Drug Name */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.textDark }]}>
                  Drug name *
                </Text>
                <TextInput
                  ref={medDrugInputRef}
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: medNameError
                        ? '#ef4444'
                        : allergyCheck.status === 'conflict'
                        ? '#ef4444'
                        : theme.cardBorder,
                      color: theme.textDark,
                    },
                  ]}
                  placeholder="e.g. Paracetamol, Amoxicillin, Bactrim..."
                  placeholderTextColor={theme.textMuted}
                  value={medDrugName}
                  onChangeText={(val) => {
                    setMedDrugName(val);
                    if (medNameError) setMedNameError(null);
                    setHasAllergyConflictAcknowledged(false);
                  }}
                />
                {medNameError && (
                  <Text style={styles.fieldErrorText}>{medNameError}</Text>
                )}
              </View>

              {/* Field 2: Dose */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.textDark }]}>
                  Dose (e.g. 500 mg, 10 ml)
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: theme.cardBorder,
                      color: theme.textDark,
                    },
                  ]}
                  placeholder="e.g. 500 mg"
                  placeholderTextColor={theme.textMuted}
                  value={medDose}
                  onChangeText={setMedDose}
                />
              </View>

              {/* Field 3: Frequency */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.textDark }]}>
                  Frequency
                </Text>
                <View style={styles.frequencyPillsWrap}>
                  {[
                    'Once daily',
                    'Twice daily',
                    'Three times daily',
                    'Every 6 hours',
                    'As needed',
                  ].map((freq) => {
                    const isSelected = medFrequency === freq;
                    return (
                      <TouchableOpacity
                        key={freq}
                        style={[
                          styles.freqOptionPill,
                          isSelected && [
                            styles.freqOptionPillActive,
                            { backgroundColor: theme.primaryDeep },
                          ],
                          !isSelected && {
                            backgroundColor: theme.card,
                            borderColor: theme.cardBorder,
                          },
                        ]}
                        onPress={() => setMedFrequency(freq)}
                      >
                        <Text
                          style={[
                            styles.freqOptionText,
                            isSelected
                              ? styles.freqOptionTextActive
                              : { color: theme.textDark },
                          ]}
                        >
                          {freq}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Field 4: Duration */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.textDark }]}>
                  Duration (optional)
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: theme.cardBorder,
                      color: theme.textDark,
                    },
                  ]}
                  placeholder="e.g. 5 days, 1 week, Ongoing"
                  placeholderTextColor={theme.textMuted}
                  value={medDuration}
                  onChangeText={setMedDuration}
                />
              </View>

              {/* Action Buttons: Cancel and Add medication */}
              <View style={styles.sheetActionRow}>
                <TouchableOpacity
                  style={[
                    styles.sheetCancelBtn,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                  onPress={handleCloseAddMedication}
                >
                  <Text
                    style={[
                      styles.sheetCancelBtnText,
                      { color: theme.textDark },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.sheetSaveBtn,
                    {
                      backgroundColor:
                        allergyCheck.status === 'conflict' &&
                        hasAllergyConflictAcknowledged
                          ? '#dc2626'
                          : allergyCheck.status === 'conflict'
                          ? '#b45309'
                          : theme.primaryDeep,
                    },
                  ]}
                  onPress={handleSaveMedication}
                >
                  <Text style={styles.sheetSaveBtnText}>
                    {allergyCheck.status === 'conflict'
                      ? hasAllergyConflictAcknowledged
                        ? 'Confirm Override & Add'
                        : 'Add anyway'
                      : 'Add medication'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ─────────────────────────────────────────────────────────
          BOTTOM SHEET 2: VITALS TREND
         ───────────────────────────────────────────────────────── */}
      <Modal
        visible={isVitalsTrendOpen}
        transparent
        animationType="slide"
        onRequestClose={handleCloseVitalsTrend}
      >
        <TouchableOpacity
          style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}
          activeOpacity={1}
          onPress={handleCloseVitalsTrend}
        >
          <TouchableOpacity
            style={[
              styles.sheetContainer,
              {
                backgroundColor: theme.sheetBg,
                borderColor: theme.cardBorder,
              },
            ]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={[styles.sheetHandle, { backgroundColor: theme.cardBorder }]}
            />

            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: theme.textDark }]}>
                  {trendInfo.title}
                </Text>
                <Text style={[styles.sheetSubTitle, { color: theme.textMuted }]}>
                  {currentPatient.name} · Last {currentPatient.vitalsHistory.length} readings
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.sheetCloseBtn,
                  { backgroundColor: theme.cardBorder },
                ]}
                onPress={handleCloseVitalsTrend}
              >
                <Ionicons name="close" size={20} color={theme.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetFormContent}
            >
              {/* Trend Chart Card with Shaded Green Normal Range Band */}
              <View
                style={[
                  styles.trendChartCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.cardBorder,
                  },
                ]}
              >
                <View style={styles.chartHeaderRow}>
                  <Text style={[styles.chartNormalLabel, { color: '#059669' }]}>
                    {trendInfo.normalRangeLabel}
                  </Text>
                  {activeTrendVital === 'bp' && (
                    <View style={styles.chartLegendRow}>
                      <View style={[styles.legendDot, { backgroundColor: '#0e8a96' }]} />
                      <Text style={[styles.legendText, { color: theme.textMuted }]}>
                        Sys
                      </Text>
                      <View style={[styles.legendDot, { backgroundColor: '#d97706', marginLeft: 8 }]} />
                      <Text style={[styles.legendText, { color: theme.textMuted }]}>
                        Dia
                      </Text>
                    </View>
                  )}
                </View>

                {/* Simulated Visual Multi-Point Line Chart Area */}
                <View style={styles.chartCanvasArea}>
                  {/* Shaded normal range band */}
                  <View style={styles.chartNormalBand} />

                  {/* Horizontal Guide Lines */}
                  <View style={styles.chartGuideLine1} />
                  <View style={styles.chartGuideLine2} />

                  {/* Plotted Data Columns */}
                  <View style={styles.chartColumnsWrap}>
                    {currentPatient.vitalsHistory.map((item, idx) => {
                      const isLatest = idx === currentPatient.vitalsHistory.length - 1;

                      // Calculate normalized height for bars/points
                      let val1: number | string = item.systolic;
                      let val2: number | string = item.diastolic;
                      if (activeTrendVital === 'hr') val1 = item.heartRate;
                      if (activeTrendVital === 'temp') val1 = formatTempCelsius(item.bodyTemp).display;
                      if (activeTrendVital === 'weight') val1 = item.weight || currentWeightNum;
                      if (activeTrendVital === 'bmi') val1 = item.bmi || parseFloat(bmiDisplay);
                      if (activeTrendVital === 'spo2') val1 = item.spO2;

                      return (
                        <View key={item.id} style={styles.chartPointColumn}>
                          {/* Point Indicator */}
                          <View style={styles.pointTrack}>
                            {activeTrendVital === 'bp' ? (
                              <View style={styles.bpDoublePointContainer}>
                                <View
                                  style={[
                                    styles.pointDot,
                                    { backgroundColor: '#0e8a96' },
                                    isLatest && styles.pointDotLatest,
                                  ]}
                                />
                                <View
                                  style={[
                                    styles.pointDot,
                                    { backgroundColor: '#d97706', marginTop: 12 },
                                    isLatest && styles.pointDotLatest,
                                  ]}
                                />
                              </View>
                            ) : (
                              <View
                                style={[
                                  styles.pointDot,
                                  { backgroundColor: theme.accent },
                                  isLatest && styles.pointDotLatest,
                                ]}
                              />
                            )}
                          </View>

                          {/* Value Display */}
                          <Text
                            style={[
                              styles.chartValText,
                              { color: isLatest ? theme.primaryDeep : theme.textMuted },
                              isLatest && { fontWeight: '800' },
                            ]}
                          >
                            {activeTrendVital === 'bp'
                              ? `${val1}/${val2}`
                              : String(val1)}
                          </Text>

                          {/* Date Label */}
                          <Text
                            style={[
                              styles.chartDateLabel,
                              { color: isLatest ? theme.primaryDeep : theme.textMuted },
                              isLatest && { fontWeight: '800' },
                            ]}
                          >
                            {item.dateLabel}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Summary Row under Chart */}
                <View
                  style={[
                    styles.trendSummaryRow,
                    { borderTopColor: theme.divider },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.trendSummaryChange, { color: theme.textDark }]}>
                      {trendInfo.changeText}
                    </Text>
                    <Text style={[styles.trendSummarySub, { color: theme.textMuted }]}>
                      Current: {trendInfo.latestText}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.trendStatusBadge,
                      {
                        backgroundColor: trendInfo.statusResult.isAbnormal
                          ? '#fef2f2'
                          : '#ecfdf5',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.trendStatusBadgeText,
                        {
                          color: trendInfo.statusResult.isAbnormal
                            ? '#ef4444'
                            : '#059669',
                        },
                      ]}
                    >
                      {trendInfo.statusResult.label}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Second Card: List of all readings, newest first */}
              <View style={styles.sectionBlock}>
                <Text
                  style={[styles.subSectionTitle, { color: theme.textDark, marginBottom: 8 }]}
                >
                  All Recorded Readings
                </Text>

                <View
                  style={[
                    styles.historyReadingsCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  {[...currentPatient.vitalsHistory].reverse().map((r, idx) => {
                    const isLast = idx === currentPatient.vitalsHistory.length - 1;

                    let readingVal = `${r.systolic}/${r.diastolic} mmHg`;
                    let isAbnormal =
                      getBPStatus(r.systolic, r.diastolic).isAbnormal;

                    if (activeTrendVital === 'hr') {
                      readingVal = `${r.heartRate} bpm`;
                      isAbnormal = getHRStatus(r.heartRate).isAbnormal;
                    } else if (activeTrendVital === 'temp') {
                      const c = formatTempCelsius(r.bodyTemp);
                      readingVal = `${c.display} °C`;
                      isAbnormal = getTempStatus(c.tempC).isAbnormal;
                    } else if (activeTrendVital === 'weight') {
                      readingVal = `${r.weight || currentWeightNum} kg`;
                      isAbnormal = false;
                    } else if (activeTrendVital === 'bmi') {
                      const b = r.bmi || parseFloat(bmiDisplay);
                      readingVal = `${b} kg/m²`;
                      isAbnormal = getBMIStatus(b).isAbnormal;
                    } else if (activeTrendVital === 'spo2') {
                      readingVal = `${r.spO2}%`;
                      isAbnormal = getSpO2Status(r.spO2).isAbnormal;
                    }

                    return (
                      <View
                        key={r.id}
                        style={[
                          styles.historyReadingRow,
                          !isLast && [
                            styles.historyReadingRowBorder,
                            { borderBottomColor: theme.divider },
                          ],
                        ]}
                      >
                        <View>
                          <Text
                            style={[styles.readingTimestamp, { color: theme.textDark }]}
                          >
                            {r.timestamp}
                          </Text>
                          <Text
                            style={[styles.readingLabelSub, { color: theme.textMuted }]}
                          >
                            {r.dateLabel}
                          </Text>
                        </View>

                        <View style={styles.readingValueRight}>
                          <Text
                            style={[
                              styles.readingValueText,
                              { color: theme.textDark },
                            ]}
                          >
                            {readingVal}
                          </Text>
                          <View
                            style={[
                              styles.readingStatusPill,
                              {
                                backgroundColor: isAbnormal ? '#fee2e2' : '#dcfce7',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.readingStatusPillText,
                                { color: isAbnormal ? '#dc2626' : '#16a34a' },
                              ]}
                            >
                              {isAbnormal ? 'Alert' : 'Normal'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Action Buttons: Close and Record New Reading */}
              <View style={styles.sheetActionRow}>
                <TouchableOpacity
                  style={[
                    styles.sheetCancelBtn,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                  onPress={handleCloseVitalsTrend}
                >
                  <Text
                    style={[
                      styles.sheetCancelBtnText,
                      { color: theme.textDark },
                    ]}
                  >
                    Close
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.sheetSaveBtn,
                    { backgroundColor: theme.primaryDeep },
                  ]}
                  onPress={() => {
                    handleCloseVitalsTrend();
                    setTimeout(() => {
                      handleOpenEditVitals();
                    }, 200);
                  }}
                >
                  <Text style={styles.sheetSaveBtnText}>Record new reading</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ─────────────────────────────────────────────────────────
          BOTTOM SHEET 3: EDIT VITALS
         ───────────────────────────────────────────────────────── */}
      <Modal
        visible={isEditVitalsOpen}
        transparent
        animationType="slide"
        onRequestClose={handleCloseEditVitals}
      >
        <TouchableOpacity
          style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}
          activeOpacity={1}
          onPress={handleCloseEditVitals}
        >
          <TouchableOpacity
            style={[
              styles.sheetContainer,
              {
                backgroundColor: theme.sheetBg,
                borderColor: theme.cardBorder,
              },
            ]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={[styles.sheetHandle, { backgroundColor: theme.cardBorder }]}
            />

            <View style={styles.sheetHeader}>
              <View>
                <Text style={[styles.sheetTitle, { color: theme.textDark }]}>
                  Edit vitals
                </Text>
                <Text style={[styles.sheetSubTitle, { color: theme.textMuted }]}>
                  {currentPatient.name} • {currentPatient.tokenFormatted}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.sheetCloseBtn,
                  { backgroundColor: theme.cardBorder },
                ]}
                onPress={handleCloseEditVitals}
              >
                <Ionicons name="close" size={20} color={theme.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetFormContent}
            >
              {/* Systolic */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.textDark }]}>
                  Systolic (mmHg)
                </Text>
                <TextInput
                  ref={systolicInputRef}
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: fieldErrors.systolic
                        ? '#ef4444'
                        : theme.cardBorder,
                      color: theme.textDark,
                    },
                  ]}
                  placeholder="e.g. 118"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="numeric"
                  value={formSystolic}
                  onChangeText={(val) => {
                    setFormSystolic(val);
                    if (fieldErrors.systolic) {
                      setFieldErrors((prev) => ({ ...prev, systolic: undefined }));
                    }
                  }}
                />
                {fieldErrors.systolic && (
                  <Text style={styles.fieldErrorText}>
                    {fieldErrors.systolic}
                  </Text>
                )}
              </View>

              {/* Diastolic */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.textDark }]}>
                  Diastolic (mmHg)
                </Text>
                <TextInput
                  ref={diastolicInputRef}
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: fieldErrors.diastolic
                        ? '#ef4444'
                        : theme.cardBorder,
                      color: theme.textDark,
                    },
                  ]}
                  placeholder="e.g. 75"
                  keyboardType="numeric"
                  value={formDiastolic}
                  onChangeText={(val) => {
                    setFormDiastolic(val);
                    if (fieldErrors.diastolic) {
                      setFieldErrors((prev) => ({ ...prev, diastolic: undefined }));
                    }
                  }}
                />
                {fieldErrors.diastolic && (
                  <Text style={styles.fieldErrorText}>
                    {fieldErrors.diastolic}
                  </Text>
                )}
              </View>

              {/* Heart Rate */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.textDark }]}>
                  Heart rate (bpm)
                </Text>
                <TextInput
                  ref={heartRateInputRef}
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: fieldErrors.heartRate
                        ? '#ef4444'
                        : theme.cardBorder,
                      color: theme.textDark,
                    },
                  ]}
                  placeholder="e.g. 72"
                  keyboardType="numeric"
                  value={formHeartRate}
                  onChangeText={(val) => {
                    setFormHeartRate(val);
                    if (fieldErrors.heartRate) {
                      setFieldErrors((prev) => ({ ...prev, heartRate: undefined }));
                    }
                  }}
                />
                {fieldErrors.heartRate && (
                  <Text style={styles.fieldErrorText}>
                    {fieldErrors.heartRate}
                  </Text>
                )}
              </View>

              {/* Body Temp */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.textDark }]}>
                  Body temp (°C)
                </Text>
                <TextInput
                  ref={bodyTempInputRef}
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: fieldErrors.bodyTemp
                        ? '#ef4444'
                        : theme.cardBorder,
                      color: theme.textDark,
                    },
                  ]}
                  placeholder="e.g. 37.0"
                  keyboardType="decimal-pad"
                  value={formBodyTemp}
                  onChangeText={(val) => {
                    setFormBodyTemp(val);
                    if (fieldErrors.bodyTemp) {
                      setFieldErrors((prev) => ({ ...prev, bodyTemp: undefined }));
                    }
                  }}
                />
                {fieldErrors.bodyTemp && (
                  <Text style={styles.fieldErrorText}>
                    {fieldErrors.bodyTemp}
                  </Text>
                )}
              </View>

              {/* SpO2 */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.textDark }]}>
                  Oxygen sat SpO2 (%)
                </Text>
                <TextInput
                  ref={spO2InputRef}
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: fieldErrors.spO2
                        ? '#ef4444'
                        : theme.cardBorder,
                      color: theme.textDark,
                    },
                  ]}
                  placeholder="e.g. 99"
                  keyboardType="numeric"
                  value={formSpO2}
                  onChangeText={(val) => {
                    setFormSpO2(val);
                    if (fieldErrors.spO2) {
                      setFieldErrors((prev) => ({ ...prev, spO2: undefined }));
                    }
                  }}
                />
                {fieldErrors.spO2 && (
                  <Text style={styles.fieldErrorText}>{fieldErrors.spO2}</Text>
                )}
              </View>

              {/* Weight & Height Row */}
              <View style={styles.formRowTwoCols}>
                {/* Weight */}
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={[styles.formLabel, { color: theme.textDark }]}>
                    Weight (kg)
                  </Text>
                  <TextInput
                    ref={weightInputRef}
                    style={[
                      styles.formInput,
                      {
                        backgroundColor: theme.inputBg,
                        borderColor: fieldErrors.weight
                          ? '#ef4444'
                          : theme.cardBorder,
                        color: theme.textDark,
                      },
                    ]}
                    placeholder="e.g. 68"
                    keyboardType="decimal-pad"
                    value={formWeight}
                    onChangeText={(val) => {
                      setFormWeight(val);
                      if (fieldErrors.weight) {
                        setFieldErrors((prev) => ({ ...prev, weight: undefined }));
                      }
                    }}
                  />
                  {fieldErrors.weight && (
                    <Text style={styles.fieldErrorText}>{fieldErrors.weight}</Text>
                  )}
                </View>

                {/* Height */}
                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={[styles.formLabel, { color: theme.textDark }]}>
                    Height (cm)
                  </Text>
                  <TextInput
                    ref={heightInputRef}
                    style={[
                      styles.formInput,
                      {
                        backgroundColor: theme.inputBg,
                        borderColor: fieldErrors.height
                          ? '#ef4444'
                          : theme.cardBorder,
                        color: theme.textDark,
                      },
                    ]}
                    placeholder="e.g. 172"
                    keyboardType="numeric"
                    value={formHeight}
                    onChangeText={(val) => {
                      setFormHeight(val);
                      if (fieldErrors.height) {
                        setFieldErrors((prev) => ({ ...prev, height: undefined }));
                      }
                    }}
                  />
                  {fieldErrors.height && (
                    <Text style={styles.fieldErrorText}>{fieldErrors.height}</Text>
                  )}
                </View>
              </View>

              {/* Live calculated BMI hint if weight and height entered */}
              {(() => {
                const w = parseFloat(formWeight);
                const h = parseFloat(formHeight);
                if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
                  const preview = calculateBMI(w, h);
                  return (
                    <View
                      style={{
                        backgroundColor: isDark ? 'rgba(34, 170, 184, 0.15)' : '#e0f7fa',
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 10,
                        marginBottom: 14,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 12, color: theme.primaryDeep, fontWeight: '600' }}>
                        Calculated BMI: {preview.bmi} kg/m²
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: preview.status.isAbnormal ? '#ef4444' : '#059669',
                        }}
                      >
                        {preview.status.label}
                      </Text>
                    </View>
                  );
                }
                return null;
              })()}

              <View style={styles.sheetActionRow}>
                <TouchableOpacity
                  style={[
                    styles.sheetCancelBtn,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                  onPress={handleCloseEditVitals}
                >
                  <Text
                    style={[
                      styles.sheetCancelBtnText,
                      { color: theme.textDark },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.sheetSaveBtn,
                    { backgroundColor: theme.primaryDeep },
                  ]}
                  onPress={handleSaveVitals}
                >
                  <Text style={styles.sheetSaveBtnText}>Save vitals</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ─────────────────────────────────────────────────────────
          FLOATING TOAST NOTIFICATION
         ───────────────────────────────────────────────────────── */}
      {toastMessage && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              opacity: toastFade,
              backgroundColor: isDark ? '#1a3338' : '#0b4f5a',
            },
          ]}
        >
          <Ionicons
            name="information-circle-outline"
            size={18}
            color="#ffffff"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLESHEET
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  outerFrame: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
  },
  mobileContainer: {
    width: '100%',
    maxWidth: 440,
    flex: 1,
    position: 'relative',
    ...Platform.select({
      web: {
        fontFamily:
          'Lexend, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        boxShadow: '0 4px 24px rgba(11, 79, 90, 0.08)',
      },
    }),
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },

  // 1. Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatarBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  doctorInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  doctorSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineMiniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  doctorSubtitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  topRefreshButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  redDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#ef4444',
  },

  // 2. Search Bar
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 18,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    paddingVertical: 0,
  },
  searchClearBtn: {
    padding: 4,
  },

  // 3. Current Patient Section
  currentPatientSection: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionHeadingTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  currentStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currentStatusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },

  // Patient Card
  patientCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  patientCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  patientInitialsAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  patientInitialsText: {
    fontSize: 17,
    fontWeight: '800',
  },
  patientMetaBlock: {
    flex: 1,
  },
  nameVerifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  patientCardName: {
    fontSize: 16,
    fontWeight: '800',
    marginRight: 6,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  verifiedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    marginLeft: 3,
  },
  patientCardDemographics: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
  },
  tokenBox: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: 'center',
  },
  tokenBoxLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tokenBoxNum: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 1,
  },
  cardDivider: {
    height: 1,
    marginVertical: 12,
  },
  patientCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardInfoPill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardInfoText: {
    fontSize: 11,
    fontWeight: '500',
  },

  // Allergy Card
  allergyCard: {
    flexDirection: 'row',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 18,
    padding: 12,
    marginBottom: 16,
  },
  allergyIconCol: {
    marginRight: 10,
    paddingTop: 1,
  },
  allergyTextCol: {
    flex: 1,
  },
  allergyTitle: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '800',
  },
  allergyDesc: {
    color: '#991b1b',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  noAllergyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  noAllergyText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Chronic Conditions
  chronicChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chronicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  chronicDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0e8a96',
    marginRight: 6,
  },
  chronicChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  noneRecordedText: {
    fontSize: 12,
    fontStyle: 'italic',
  },

  // Current Medications Card
  medicationsCard: {
    borderRadius: 20,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  medicationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  medicationRowBorder: {
    borderBottomWidth: 1,
  },
  medPillIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  medTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  medNameText: {
    fontSize: 13,
    fontWeight: '800',
  },
  medDoseText: {
    fontWeight: '600',
    color: '#64748b',
  },
  allergyOverrideTag: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  allergyOverrideTagText: {
    color: '#b91c1c',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  medFrequencyText: {
    fontSize: 11,
    marginTop: 2,
  },
  medSinceDateText: {
    fontSize: 11,
    fontWeight: '500',
  },
  addMedicationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  addMedicationPillText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Vitals Header
  vitalsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 10,
  },
  vitalsTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginRight: 8,
  },
  triageTimeLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  editVitalsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  editVitalsText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // 2x2 Grid of Vital Cards
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  vitalCard: {
    width: '48%',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
  },
  vitalCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  vitalIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  vitalLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  vitalValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  vitalUnit: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
  },
  vitalCalculatedStatus: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
  },
  vitalsHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 2,
    paddingLeft: 2,
  },
  vitalsHintText: {
    fontSize: 11,
    fontStyle: 'italic',
  },

  // Section Block
  sectionBlock: {
    marginBottom: 16,
  },
  subSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  subSectionSubLabel: {
    fontSize: 11,
    fontWeight: '500',
  },

  // Diagnostic Imaging Card
  imagingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
  },
  imagingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  imagingIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  imagingTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  imagingDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  viewReportPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    marginLeft: 8,
  },
  viewReportText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptySubState: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptySubStateText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // History Card
  historyCard: {
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
  },
  historyRow: {
    paddingVertical: 10,
  },
  historyRowBorder: {
    borderBottomWidth: 1,
  },
  historyRowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  historyIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  historyTitleDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  historyDate: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 6,
  },
  historyDetails: {
    fontSize: 11,
    lineHeight: 16,
  },
  resolvedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 5,
  },
  resolvedPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },

  // Start Consultation Button
  startConsultationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 22,
    elevation: 3,
    shadowColor: '#0b4f5a',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  startConsultationText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // 4. All Patients Section
  allPatientsSection: {
    marginTop: 10,
    marginBottom: 16,
  },
  allPatientsHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  allPatientsSubCount: {
    fontSize: 11,
    fontWeight: '600',
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterChipActive: {
    borderWidth: 0,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  allPatientsList: {
    gap: 10,
  },
  patientRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
    padding: 12,
  },
  patientRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  patientRowAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  patientRowAvatarText: {
    fontSize: 14,
    fontWeight: '800',
  },
  patientRowMeta: {
    flex: 1,
  },
  patientRowNameGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  patientRowName: {
    fontSize: 14,
    fontWeight: '800',
  },
  patientRowSub: {
    fontSize: 11,
    marginTop: 2,
  },
  patientRowRight: {
    alignItems: 'flex-end',
  },
  patientRowToken: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  statusPillSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusPillSmallText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptySearchBox: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySearchTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptySearchDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },

  // 5. Bottom Navigation Bar
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    borderTopWidth: 1,
    elevation: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 3,
  },
  tabLabelActive: {
    fontWeight: '700',
  },

  // Bottom Sheets Shared
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheetContainer: {
    width: '100%',
    maxWidth: 440,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  sheetSubTitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetFormContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  formGroup: {
    marginBottom: 14,
  },
  formRowTwoCols: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  formInput: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: '600',
  },
  fieldErrorText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  sheetActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    marginBottom: 16,
  },
  sheetCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 18,
    borderWidth: 1,
  },
  sheetCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  sheetSaveBtn: {
    flex: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 18,
  },
  sheetSaveBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Add Medication Sheet
  allergyConflictCard: {
    flexDirection: 'row',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 14,
    padding: 10,
    marginBottom: 14,
  },
  allergyConflictTitle: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '800',
  },
  allergyConflictNote: {
    color: '#991b1b',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  allergySimilarCard: {
    flexDirection: 'row',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 14,
    padding: 10,
    marginBottom: 14,
  },
  allergySimilarTitle: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '800',
  },
  allergySimilarNote: {
    color: '#92400e',
    fontSize: 11,
    marginTop: 2,
  },
  allergySafeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 14,
    padding: 10,
    marginBottom: 14,
  },
  allergySafeText: {
    color: '#15803d',
    fontSize: 12,
    fontWeight: '700',
  },
  frequencyPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  freqOptionPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  freqOptionPillActive: {
    borderWidth: 0,
  },
  freqOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  freqOptionTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },

  // Vitals Trend Sheet
  trendChartCard: {
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  chartNormalLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  chartLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
  },
  chartCanvasArea: {
    height: 140,
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 8,
  },
  chartNormalBand: {
    position: 'absolute',
    top: 25,
    bottom: 25,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 8,
  },
  chartGuideLine1: {
    position: 'absolute',
    top: 35,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  chartGuideLine2: {
    position: 'absolute',
    top: 85,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  chartColumnsWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: '100%',
    paddingHorizontal: 8,
    zIndex: 2,
  },
  chartPointColumn: {
    alignItems: 'center',
    width: 52,
  },
  pointTrack: {
    height: 85,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bpDoublePointContainer: {
    alignItems: 'center',
  },
  pointDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  pointDotLatest: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: '#ffffff',
    elevation: 3,
  },
  chartValText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  chartDateLabel: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
  },
  trendSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  trendSummaryChange: {
    fontSize: 13,
    fontWeight: '800',
  },
  trendSummarySub: {
    fontSize: 11,
    marginTop: 2,
  },
  trendStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  trendStatusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  historyReadingsCard: {
    borderRadius: 20,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  historyReadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  historyReadingRowBorder: {
    borderBottomWidth: 1,
  },
  readingTimestamp: {
    fontSize: 13,
    fontWeight: '700',
  },
  readingLabelSub: {
    fontSize: 11,
    marginTop: 1,
  },
  readingValueRight: {
    alignItems: 'flex-end',
  },
  readingValueText: {
    fontSize: 13,
    fontWeight: '800',
  },
  readingStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 3,
  },
  readingStatusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Toast
  toastContainer: {
    position: 'absolute',
    bottom: 84,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 999,
    elevation: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  toastText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});
