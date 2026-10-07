import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  aureliaPrescriptionData,
} from '../../services/prescriptionService';
import { ALL_DUMMY_PATIENTS } from '../../services/patientRecordsService';
import { downloadPrescription } from '../../utils/prescriptionPdfGenerator';

export default function PatientPrescriptionScreen() {
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ tokenNumber?: string; patientName?: string }>();
  const initialToken = params?.tokenNumber ? parseInt(params.tokenNumber, 10) : 29;
  const isAurelia = !params?.tokenNumber || initialToken === 29 || (params?.patientName ? String(params.patientName).includes('Aurelia') : true);

  const [data, setData] = useState<PatientPrescriptionDetails>(
    isAurelia ? aureliaPrescriptionData : fallbackPrescriptionData
  );
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'queue' | 'records' | 'schedule' | 'rx'>('rx');

  // Interactive Form State
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedFrequency, setSelectedFrequency] = useState<'OD' | 'BD' | 'TDS' | 'QDS'>('BD');
  const [selectedDuration, setSelectedDuration] = useState<number>(5);
  const [mealTiming, setMealTiming] = useState<'After meal' | 'Before meal'>('After meal');
  const [takeMorning, setTakeMorning] = useState(true);
  const [takeLunch, setTakeLunch] = useState(false);
  const [takeDinner, setTakeDinner] = useState(true);
  const [clinicalNotes, setClinicalNotes] = useState(
    isAurelia ? aureliaPrescriptionData.clinicalNotes : fallbackPrescriptionData.clinicalNotes
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
      const tokenNum = params?.tokenNumber ? parseInt(params.tokenNumber, 10) : 29;
      const cacheKey = `@medi_queue_prescription_${tokenNum}`;

      // 1. Immediately read local cache if available
      let localFound = false;
      try {
        let raw = await AsyncStorage.getItem(cacheKey);
        if (!raw && typeof window !== 'undefined' && window.localStorage) {
          raw = window.localStorage.getItem(cacheKey);
        }
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.diagnoses) && Array.isArray(parsed.prescriptions)) {
            // If prescriptions list is empty, populate from patient records
            if (parsed.prescriptions.length === 0) {
              const defaultMeds = getRecordMeds();
              if (defaultMeds.length > 0) {
                parsed.prescriptions = defaultMeds;
              }
            }
            setData(parsed);
            if (parsed.clinicalNotes !== undefined) {
              setClinicalNotes(parsed.clinicalNotes);
            }
            localFound = true;
          }
        }
      } catch (cacheErr) {
        console.log('Error reading local cache:', cacheErr);
      }

      // 2. Fetch from backend API
      const res = await fetchPrescriptionDetails(tokenNum);
      if (res) {
        // If backend prescriptions list is empty, populate from patient records
        if (!res.prescriptions || res.prescriptions.length === 0) {
          const defaultMeds = getRecordMeds();
          if (defaultMeds.length > 0) {
            res.prescriptions = defaultMeds;
          }
        }
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
  }, [params?.tokenNumber, getRecordMeds]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      try {
        router.push('/(doctor)/records' as any);
      } catch (e) {
        router.push('/records' as any);
      }
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          router.push('/(doctor)/records' as any);
        }, 120);
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

  // Remove diagnosis chip
  const handleRemoveDiagnosis = (id: string, name?: string) => {
    const doRemove = () => {
      setData((prev) => {
        const nextDiagnoses = prev.diagnoses.filter((d) => d.id !== id);
        const nextData = { ...prev, diagnoses: nextDiagnoses, clinicalNotes };
        persistPrescription(nextData);
        return nextData;
      });
    };

    // On web, Alert.alert multi-button callbacks don't fire — use window.confirm instead
    if (Platform.OS === 'web') {
      const ok = (window as any).confirm(`Remove "${name || 'this diagnosis'}" from the diagnosis list?`);
      if (!ok) return;
      doRemove();
      return;
    }
    Alert.alert(
      t('Remove Diagnosis'),
      t("Remove \"{value0}\"?", { value0: String(name || 'this diagnosis') }),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Remove'),
          style: 'destructive',
          onPress: doRemove,
        },
      ]
    );
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

  // Remove medicine item
  const handleRemoveMedicine = (id: string, name: string) => {
    const doRemove = () => {
      setData((prev) => {
        const nextPrescriptions = prev.prescriptions.filter((m) => m.id !== id);
        const nextData = { ...prev, prescriptions: nextPrescriptions, clinicalNotes };
        persistPrescription(nextData);
        return nextData;
      });
    };

    // On web, Alert.alert multi-button callbacks don't fire — use window.confirm instead
    if (Platform.OS === 'web') {
      const ok = (window as any).confirm(`Remove ${name} from this prescription?`);
      if (!ok) return;
      doRemove();
      return;
    }
    Alert.alert(
      t('Remove Medicine'),
      t("Are you sure you want to remove {value0} from this prescription?", { value0: String(name) }),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Remove'),
          style: 'destructive',
          onPress: doRemove,
        },
      ]
    );
  };

  // Helper to format medicine instructions with meal timing and times of day
  const formatInstructions = (
    timing: 'After meal' | 'Before meal',
    morning: boolean,
    lunch: boolean,
    dinner: boolean,
    extraNote?: string
  ): string => {
    const times: string[] = [];
    if (morning) times.push('Morning');
    if (lunch) times.push('Lunch');
    if (dinner) times.push('Dinner');

    let res = timing;
    if (times.length > 0) {
      res += ` (${times.join(', ')})`;
    }
    if (extraNote && extraNote.trim()) {
      const clean = extraNote.trim();
      if (!res.toLowerCase().includes(clean.toLowerCase())) {
        res += ` • ${clean}`;
      }
    }
    return res;
  };

  // Helper when selecting frequency in Add Medicine
  const handleSelectFrequency = (freq: 'OD' | 'BD' | 'TDS' | 'QDS') => {
    setSelectedFrequency(freq);
    if (freq === 'OD') {
      setTakeMorning(true);
      setTakeLunch(false);
      setTakeDinner(false);
    } else if (freq === 'BD') {
      setTakeMorning(true);
      setTakeLunch(false);
      setTakeDinner(true);
    } else if (freq === 'TDS' || freq === 'QDS') {
      setTakeMorning(true);
      setTakeLunch(true);
      setTakeDinner(true);
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
    const instructions = formatInstructions(mealTiming, takeMorning, takeLunch, takeDinner);
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

    const nextPrescriptions = [...data.prescriptions, newItem];
    const nextData = { ...data, prescriptions: nextPrescriptions, clinicalNotes };
    setData(nextData);
    persistPrescription(nextData);

    setSearchQuery('');
    setShowSuggestions(false);
  };

  // Save Prescription & Download PDF
  const handleSavePrescription = async () => {
    setIsSaving(true);
    try {
      const nextData = { ...data, clinicalNotes };
      await persistPrescription(nextData);
      downloadPrescription(nextData, clinicalNotes);
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

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#f4f9fc" />

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
          {/* 1. TOP PROFILE BAR                                        */}
          {/* ========================================================= */}
          <View style={styles.topProfileBar}>
            <View style={styles.profileLeft}>
              <View style={styles.avatarContainer}>
                <Image
                  source={{
                    uri:
                      doctor.avatarUrl ||
                      'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=200',
                  }}
                  style={styles.avatarImg}
                />
                <View style={styles.onlineDotOnAvatar} />
              </View>

              <View style={styles.profileTextWrap}>
                <Text style={styles.profileName}>{doctor.name}</Text>
                <View style={styles.onlineBadgeRow}>
                  <View style={styles.onlineGreenDot} />
                  <Text style={styles.onlineBadgeText}>{doctor.room} {t("Online")}</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.bellBtn}
              onPress={() => Alert.alert(t('Notifications'), t('No pending clinical alerts.'))}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={21} color="#334155" />
              <View style={styles.redBadgeDot} />
            </TouchableOpacity>
          </View>

          {/* ========================================================= */}
          {/* 2. PAGE TITLE & OUTPATIENT CONSULTATION HEADER             */}
          {/* ========================================================= */}
          <View style={styles.headerTitleSection}>
            <Text style={styles.kickerText}>{t("OUTPATIENT CONSULTATION")}</Text>
            <View style={styles.titleRow}>
              <Text style={styles.mainTitle}>{t("Prescription & Details")}</Text>
              <View style={styles.roomPillBadge}>
                <View style={styles.roomPillDot} />
                <Text style={styles.roomPillText}>{doctor.room}</Text>
              </View>
            </View>
          </View>

          {/* ========================================================= */}
          {/* 3. PATIENT PROFILE CARD                                    */}
          {/* ========================================================= */}
          <View style={styles.card}>
            {/* Top row with Initials Avatar, Name/ID, and Token Badge */}
            <View style={styles.patientTopRow}>
              <View style={styles.initialsAvatar}>
                <Text style={styles.initialsText}>{patient.initials || 'KG'}</Text>
              </View>

              <View style={styles.patientInfoCol}>
                <Text style={styles.patientName}>{patient.name}</Text>
                <Text style={styles.patientMeta}>
                  {t(patient.gender ?? '')}, {patient.age} {t("yrs •")}{' '}{patient.opdId}
                </Text>
              </View>

              <View style={styles.tokenBadge}>
                <Text style={styles.tokenBadgeText}>{patient.tokenFormatted || t('Token #028')}</Text>
              </View>
            </View>

            {/* Vitals 3-column row */}
            <View style={styles.vitalsRow}>
              {/* Blood Pressure */}
              <View style={styles.vitalBox}>
                <Text style={styles.vitalLabel}>{t("Blood Pressure")}</Text>
                <Text style={styles.vitalValue}>{patient.vitals.bloodPressure}</Text>
              </View>

              {/* Pulse Rate */}
              <View style={styles.vitalBox}>
                <Text style={styles.vitalLabel}>{t("Pulse Rate")}</Text>
                <Text style={styles.vitalValue}>{patient.vitals.pulseRate}</Text>
              </View>

              {/* Weight */}
              <View style={styles.vitalBox}>
                <Text style={styles.vitalLabel}>{t("Weight")}</Text>
                <Text style={styles.vitalValue}>{patient.vitals.weight}</Text>
              </View>
            </View>
          </View>

          {/* ========================================================= */}
          {/* 4. PRIMARY DIAGNOSIS (ICD-10) CARD                        */}
          {/* ========================================================= */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <MaterialCommunityIcons name="stethoscope" size={20} color="#0d6371" style={{ marginRight: 8 }} />
                <Text style={styles.cardSectionTitle}>{t("Primary Diagnosis (ICD-10)")}</Text>
              </View>

              <TouchableOpacity
                onPress={() => setIsAddDiagnosisModalOpen(true)}
                style={styles.addDiagnosisBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={17} color="#0d6371" style={{ marginRight: 2 }} />
                <Text style={styles.addDiagnosisBtnText}>{t("Add Diagnosis")}</Text>
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
                <Text style={styles.emptyNote}>{t("No diagnosis recorded. Tap \"+ Add Diagnosis\".")}</Text>
              )}
            </View>
          </View>

          {/* ========================================================= */}
          {/* 5. CLINICAL NOTES & SYMPTOMS CARD                         */}
          {/* ========================================================= */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <MaterialCommunityIcons
                  name="clipboard-text-outline"
                  size={20}
                  color="#0d6371"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.cardSectionTitle}>{t("Clinical Notes & Symptoms")}</Text>
              </View>
              <Text style={styles.confidentialBadge}>{t("Confidential")}</Text>
            </View>

            {/* Editable Notes Textbox */}
            <View style={styles.notesBox}>
              <TextInput
                style={styles.notesInput}
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
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <MaterialCommunityIcons
                  name="clipboard-edit-outline"
                  size={21}
                  color="#0d6371"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.cardSectionTitle}>{t("Prescription List (Rx)")}</Text>
              </View>

              <View style={styles.itemsCountBadge}>
                <Text style={styles.itemsCountText}>
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
                        <Text style={styles.medNameText}>{med.name}</Text>
                        <View style={styles.medTypeBadge}>
                          <Text style={styles.medTypeBadgeText}>{med.type}</Text>
                        </View>
                      </View>

                      <Text style={styles.medDetailText}>
                        {med.dosage} • {med.frequency} • {med.duration}
                      </Text>

                      {/* Tag pill */}
                      {med.instructions ? (
                        <View style={styles.medInstructionPill}>
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
                          <Text style={styles.medInstructionText}>{med.instructions}</Text>
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
                <View style={styles.emptyPrescriptionBox}>
                  <Text style={styles.emptyPrescriptionText}>{t("No medicines added yet.")}</Text>
                  <Text style={styles.emptyPrescriptionSub}>
                    {t("Use the form below to search and add medications.")}</Text>
                </View>
              )}
            </View>
          </View>

          {/* ========================================================= */}
          {/* 7. ADD MEDICINE CARD                                       */}
          {/* ========================================================= */}
          <View style={styles.card}>
            <View style={styles.addMedHeaderRow}>
              <Ionicons name="add-circle" size={24} color="#064e59" style={{ marginRight: 8 }} />
              <Text style={styles.addMedHeaderTitle}>{t("Add Medicine")}</Text>
            </View>

            {/* Medicine Name & Strength */}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{t("Medicine Name & Strength")}</Text>
              <View style={styles.searchInputWrap}>
                <Ionicons name="search-outline" size={19} color="#64748b" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={t("Search e.g., Amoxicillin, Ibuprofen...")}
                  placeholderTextColor="#94a3b8"
                  value={searchQuery}
                  onChangeText={(text) => {
                    setSearchQuery(text);
                    setShowSuggestions(text.trim().length > 0);
                    if (addMedError) setAddMedError(null);
                  }}
                  onFocus={() => {
                    if (searchQuery.trim().length > 0) setShowSuggestions(true);
                  }}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setSearchQuery('');
                      setShowSuggestions(false);
                    }}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="close-circle" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>

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
                          color="#0d6371"
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

            {/* Dosage Frequency */}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{t("Dosage Frequency")}</Text>
              <View style={styles.segmentedRow}>
                {(['OD', 'BD', 'TDS', 'QDS'] as const).map((freq) => {
                  const labelMap = {
                    OD: 'OD (1x)',
                    BD: 'BD (2x)',
                    TDS: 'TDS (3x)',
                    QDS: 'QDS (4x)',
                  };
                  const isSelected = selectedFrequency === freq;
                  return (
                    <TouchableOpacity
                      key={freq}
                      style={[styles.freqChip, isSelected && styles.freqChipSelected]}
                      onPress={() => handleSelectFrequency(freq)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[styles.freqChipText, isSelected && styles.freqChipTextSelected]}
                      >
                        {labelMap[freq]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Meal Timing (After meal / Before meal) */}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{t("Meal Timing")}</Text>
              <View style={styles.timingRow}>
                <TouchableOpacity
                  style={[styles.timingChip, mealTiming === 'After meal' && styles.timingChipSelected]}
                  onPress={() => setMealTiming('After meal')}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name="silverware-fork-knife"
                    size={15}
                    color={mealTiming === 'After meal' ? '#ffffff' : '#0369a1'}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[styles.timingChipText, mealTiming === 'After meal' && styles.timingChipTextSelected]}
                  >
                    {t("After meal")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.timingChip, mealTiming === 'Before meal' && styles.timingChipSelected]}
                  onPress={() => setMealTiming('Before meal')}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name="clock-time-four-outline"
                    size={15}
                    color={mealTiming === 'Before meal' ? '#ffffff' : '#0369a1'}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[styles.timingChipText, mealTiming === 'Before meal' && styles.timingChipTextSelected]}
                  >
                    {t("Before meal")}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Schedule / Time of Day (Morning, Lunch, Dinner) */}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{t("Take Medicine")}</Text>
              <View style={styles.timeScheduleRow}>
                <TouchableOpacity
                  style={[styles.timeScheduleChip, takeMorning && styles.timeScheduleChipSelected]}
                  onPress={() => setTakeMorning(!takeMorning)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={takeMorning ? 'checkmark-circle' : 'ellipse-outline'}
                    size={15}
                    color={takeMorning ? '#ffffff' : '#0369a1'}
                    style={{ marginRight: 5 }}
                  />
                  <Text
                    style={[
                      styles.timeScheduleChipText,
                      takeMorning && styles.timeScheduleChipTextSelected,
                    ]}
                  >
                    {t("Morning")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.timeScheduleChip, takeLunch && styles.timeScheduleChipSelected]}
                  onPress={() => setTakeLunch(!takeLunch)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={takeLunch ? 'checkmark-circle' : 'ellipse-outline'}
                    size={15}
                    color={takeLunch ? '#ffffff' : '#0369a1'}
                    style={{ marginRight: 5 }}
                  />
                  <Text
                    style={[
                      styles.timeScheduleChipText,
                      takeLunch && styles.timeScheduleChipTextSelected,
                    ]}
                  >
                    {t("Lunch")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.timeScheduleChip, takeDinner && styles.timeScheduleChipSelected]}
                  onPress={() => setTakeDinner(!takeDinner)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={takeDinner ? 'checkmark-circle' : 'ellipse-outline'}
                    size={15}
                    color={takeDinner ? '#ffffff' : '#0369a1'}
                    style={{ marginRight: 5 }}
                  />
                  <Text
                    style={[
                      styles.timeScheduleChipText,
                      takeDinner && styles.timeScheduleChipTextSelected,
                    ]}
                  >
                    {t("Dinner")}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Duration */}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{t("Duration")}</Text>
              <View style={styles.durationRow}>
                {[3, 5, 7].map((days) => {
                  const isSelected = selectedDuration === days;
                  return (
                    <TouchableOpacity
                      key={days}
                      style={[styles.durationChip, isSelected && styles.durationChipSelected]}
                      onPress={() => setSelectedDuration(days)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.durationChipText,
                          isSelected && styles.durationChipTextSelected,
                        ]}
                      >
                        {days} {t("days")}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {addMedError && (
              <View style={styles.addMedErrorWrap}>
                <Ionicons name="alert-circle" size={16} color="#ef4444" style={{ marginRight: 6 }} />
                <Text style={styles.addMedErrorText}>{addMedError}</Text>
              </View>
            )}

            {/* Add to Prescription Button */}
            <TouchableOpacity
              style={styles.addToPrescriptionBtn}
              onPress={handleAddMedicine}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle" size={20} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.addToPrescriptionBtnText}>{t("+ Add Medicine to Prescription")}</Text>
            </TouchableOpacity>
          </View>

          {/* ========================================================= */}
          {/* 8. BOTTOM ACTION BUTTONS                                   */}
          {/* ========================================================= */}
          <View style={styles.actionsWrap}>
            {/* Primary Action Button: Save Prescription and Download */}
            <TouchableOpacity
              style={styles.saveDigitalRxBtn}
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
                    size={20}
                    color="#ffffff"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.saveDigitalRxBtnText}>
                    {t("Save Prescription and Download")}</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Secondary Referral Button */}
            <TouchableOpacity
              style={styles.referralBtn}
              onPress={() => setIsReferralModalOpen(true)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="crosshairs-gps"
                size={18}
                color="#064e59"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.referralBtnText}>{t("Refer to Physiotherapy / Lab")}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ========================================================= */}
      {/* 9. BOTTOM NAVIGATION BAR (5 TABS)                         */}
      {/* ========================================================= */}
      <View style={styles.bottomTabBar}>
        {/* Home */}
        <TouchableOpacity style={styles.tabItem} onPress={() => handleTabPress('home')}>
          <Ionicons name="home-outline" size={22} color={activeTab === 'home' ? '#0d6371' : '#64748b'} />
          <Text style={[styles.tabLabel, activeTab === 'home' && styles.tabLabelActive]}>{t("Home")}</Text>
        </TouchableOpacity>

        {/* Queue */}
        <TouchableOpacity style={styles.tabItem} onPress={() => handleTabPress('queue')}>
          <MaterialCommunityIcons
            name="ticket-confirmation-outline"
            size={23}
            color={activeTab === 'queue' ? '#0d6371' : '#64748b'}
          />
          <Text style={[styles.tabLabel, activeTab === 'queue' && styles.tabLabelActive]}>{t("Queue")}</Text>
        </TouchableOpacity>

        {/* Records */}
        <TouchableOpacity style={styles.tabItem} onPress={() => handleTabPress('records')}>
          <MaterialCommunityIcons
            name="folder-account-outline"
            size={22}
            color={activeTab === 'records' ? '#0d6371' : '#64748b'}
          />
          <Text style={[styles.tabLabel, activeTab === 'records' && styles.tabLabelActive]}>{t("Records")}</Text>
        </TouchableOpacity>

        {/* Schedule */}
        <TouchableOpacity style={styles.tabItem} onPress={() => handleTabPress('schedule')}>
          <MaterialCommunityIcons
            name="calendar-month-outline"
            size={22}
            color={activeTab === 'schedule' ? '#0d6371' : '#64748b'}
          />
          <Text style={[styles.tabLabel, activeTab === 'schedule' && styles.tabLabelActive]}>{t("Schedule")}</Text>
        </TouchableOpacity>

        {/* Prescription (ACTIVE) */}
        <TouchableOpacity style={styles.tabItem} onPress={() => handleTabPress('rx')}>
          <MaterialCommunityIcons
            name="clipboard-edit-outline"
            size={23}
            color={activeTab === 'rx' ? '#0d6371' : '#64748b'}
          />
          <Text
            numberOfLines={1}
            style={[styles.tabLabel, activeTab === 'rx' && styles.tabLabelActive]}
          >
            {t("Prescription")}</Text>
        </TouchableOpacity>
      </View>

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
              <Text style={styles.fieldLabel}>{t("Custom Diagnosis Name")}</Text>
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
                <Text style={styles.fieldLabel}>{t("Medicine Name & Strength")}</Text>
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
              onPress={() => downloadPrescription(data, clinicalNotes)}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#f4f9fc',
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
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
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

  // 4. PRIMARY DIAGNOSIS (ICD-10) CARD
  addDiagnosisBtn: {
    flexDirection: 'row',
    alignItems: 'center',
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

  // 7. ADD MEDICINE CARD
  addMedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  addMedHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  fieldBlock: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e0f2fe',
    paddingHorizontal: 12,
    height: 44,
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 6,
    overflow: 'hidden',
    elevation: 3,
  },
  suggestionItem: {
    paddingVertical: 9,
    paddingHorizontal: 12,
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
    gap: 8,
  },
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
  timingRow: {
    flexDirection: 'row',
    gap: 8,
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
  addMedErrorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  addMedErrorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ef4444',
  },
  addToPrescriptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d6371',
    borderRadius: 22,
    paddingVertical: 13,
    marginTop: 6,
    shadowColor: '#0d6371',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  addToPrescriptionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },

  // 8. BOTTOM ACTION BUTTONS
  actionsWrap: {
    gap: 10,
    marginTop: 4,
    marginBottom: 10,
  },
  saveDigitalRxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#064e59',
    borderRadius: 25,
    paddingVertical: 14,
    elevation: 3,
    shadowColor: 'rgba(6, 78, 89, 0.25)',
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  saveDigitalRxBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  downloadRxActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 25,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: '#064e59',
    elevation: 2,
    shadowColor: 'rgba(6, 78, 89, 0.12)',
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  downloadRxActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#064e59',
  },
  referralBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0f7fa',
    borderRadius: 25,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  referralBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#064e59',
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
});
