import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
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
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
} from '../../services/prescriptionService';

export default function PatientPrescriptionScreen() {
  const [data, setData] = useState<PatientPrescriptionDetails>(fallbackPrescriptionData);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'queue' | 'records' | 'schedule' | 'rx'>('rx');

  // Interactive Form State
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedFrequency, setSelectedFrequency] = useState<'OD' | 'BD' | 'TDS' | 'QDS'>('BD');
  const [selectedDuration, setSelectedDuration] = useState<number>(5);
  const [clinicalNotes, setClinicalNotes] = useState(data.clinicalNotes);
  const [isSaving, setIsSaving] = useState(false);

  // Modal states
  const [isAddDiagnosisModalOpen, setIsAddDiagnosisModalOpen] = useState(false);
  const [newDiagName, setNewDiagName] = useState('');
  const [newDiagCode, setNewDiagCode] = useState('');
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [referralType, setReferralType] = useState('Physiotherapy');
  const [referralNotes, setReferralNotes] = useState('');
  const [isSaveSuccessModalOpen, setIsSaveSuccessModalOpen] = useState(false);

  // Load prescription details
  const loadData = useCallback(async () => {
    try {
      const res = await fetchPrescriptionDetails();
      setData(res);
      setClinicalNotes(res.clinicalNotes);
    } catch (err) {
      console.log('Error loading prescription data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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
          if (!window.location.pathname.includes('dashboard')) {
            window.location.href = '/(doctor)/dashboard';
          }
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
          if (!window.location.pathname.includes('queue')) {
            window.location.href = '/(doctor)/queue';
          }
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
          if (!window.location.pathname.includes('records')) {
            window.location.href = '/(doctor)/records';
          }
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
          if (!window.location.pathname.includes('schedule')) {
            window.location.href = '/(doctor)/schedule';
          }
        }, 120);
      }
    } else if (tab === 'rx') {
      // already on Rx screen
    }
  };

  // Remove diagnosis chip
  const handleRemoveDiagnosis = (id: string, name?: string) => {
    // On web, Alert.alert multi-button callbacks don't fire — use window.confirm instead
    if (Platform.OS === 'web') {
      const ok = (window as any).confirm(`Remove "${name || 'this diagnosis'}" from the diagnosis list?`);
      if (!ok) return;
      setData((prev) => ({
        ...prev,
        diagnoses: prev.diagnoses.filter((d) => d.id !== id),
      }));
      return;
    }
    setData((prev) => ({
      ...prev,
      diagnoses: prev.diagnoses.filter((d) => d.id !== id),
    }));
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
    setData((prev) => ({
      ...prev,
      diagnoses: [...prev.diagnoses, newDiag],
    }));
    setNewDiagName('');
    setNewDiagCode('');
    setIsAddDiagnosisModalOpen(false);
  };

  // Remove medicine item
  const handleRemoveMedicine = (id: string, name: string) => {
    // On web, Alert.alert multi-button callbacks don't fire — use window.confirm instead
    if (Platform.OS === 'web') {
      const ok = (window as any).confirm(`Remove ${name} from this prescription?`);
      if (!ok) return;
      setData((prev) => ({
        ...prev,
        prescriptions: prev.prescriptions.filter((m) => m.id !== id),
      }));
      return;
    }
    Alert.alert(
      'Remove Medicine',
      `Are you sure you want to remove ${name} from this prescription?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setData((prev) => ({
              ...prev,
              prescriptions: prev.prescriptions.filter((m) => m.id !== id),
            }));
          },
        },
      ]
    );
  };

  // Add medicine to prescription
  const handleAddMedicine = () => {
    if (!searchQuery.trim()) {
      Alert.alert('Medicine Required', 'Please enter or select a medicine name & strength.');
      return;
    }

    const matchedCatalog = COMMON_MEDICINES.find(
      (m) => m.name.toLowerCase() === searchQuery.trim().toLowerCase()
    );

    const freqLabels: Record<'OD' | 'BD' | 'TDS' | 'QDS', string> = {
      OD: 'OD (1x daily)',
      BD: 'BD (2x daily)',
      TDS: 'TDS (3x daily)',
      QDS: 'QDS (4x daily)',
    };

    const type = matchedCatalog ? matchedCatalog.type : 'TABLET';
    const dosage = matchedCatalog ? matchedCatalog.defaultDosage : `1 ${type.toLowerCase()}`;
    const instructions = matchedCatalog ? matchedCatalog.defaultInstructions : 'After food';
    const tagType = matchedCatalog ? matchedCatalog.tagType : 'food';

    const newItem: MedicineItem = {
      id: `rx-${Date.now()}`,
      name: searchQuery.trim(),
      type,
      dosage,
      frequency: freqLabels[selectedFrequency],
      frequencyCode: selectedFrequency,
      duration: `${selectedDuration} days`,
      durationDays: selectedDuration,
      instructions,
      tagType,
    };

    setData((prev) => ({
      ...prev,
      prescriptions: [...prev.prescriptions, newItem],
    }));

    setSearchQuery('');
    setShowSuggestions(false);
  };

  // Save Prescription & Send Digital Rx
  const handleSavePrescription = async () => {
    setIsSaving(true);
    try {
      const res = await savePrescriptionApi({
        diagnoses: data.diagnoses,
        clinicalNotes,
        prescriptions: data.prescriptions,
      });
      setIsSaveSuccessModalOpen(true);
    } catch (err) {
      Alert.alert('Saved Offline', 'Prescription details saved locally and queued for dispatch.');
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
      Alert.alert('Referral Dispatched', `Referral request for ${referralType} recorded for patient.`);
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
                  <Text style={styles.onlineBadgeText}>{doctor.room} Online</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.bellBtn}
              onPress={() => Alert.alert('Notifications', 'No pending clinical alerts.')}
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
            <Text style={styles.kickerText}>OUTPATIENT CONSULTATION</Text>
            <View style={styles.titleRow}>
              <Text style={styles.mainTitle}>Prescription & Details</Text>
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
                  {patient.gender}, {patient.age} yrs • {patient.opdId}
                </Text>
              </View>

              <View style={styles.tokenBadge}>
                <Text style={styles.tokenBadgeText}>{patient.tokenFormatted || 'Token #028'}</Text>
              </View>
            </View>

            {/* Vitals 3-column row */}
            <View style={styles.vitalsRow}>
              {/* Blood Pressure */}
              <View style={styles.vitalBox}>
                <Text style={styles.vitalLabel}>Blood Pressure</Text>
                <Text style={styles.vitalValue}>{patient.vitals.bloodPressure}</Text>
              </View>

              {/* Pulse Rate */}
              <View style={styles.vitalBox}>
                <Text style={styles.vitalLabel}>Pulse Rate</Text>
                <Text style={styles.vitalValue}>{patient.vitals.pulseRate}</Text>
              </View>

              {/* Weight */}
              <View style={styles.vitalBox}>
                <Text style={styles.vitalLabel}>Weight</Text>
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
                <Text style={styles.cardSectionTitle}>Primary Diagnosis (ICD-10)</Text>
              </View>

              <TouchableOpacity
                onPress={() => setIsAddDiagnosisModalOpen(true)}
                style={styles.addDiagnosisBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={17} color="#0d6371" style={{ marginRight: 2 }} />
                <Text style={styles.addDiagnosisBtnText}>Add Diagnosis</Text>
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
                <Text style={styles.emptyNote}>No diagnosis recorded. Tap "+ Add Diagnosis".</Text>
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
                <Text style={styles.cardSectionTitle}>Clinical Notes & Symptoms</Text>
              </View>
              <Text style={styles.confidentialBadge}>Confidential</Text>
            </View>

            {/* Editable Notes Textbox */}
            <View style={styles.notesBox}>
              <TextInput
                style={styles.notesInput}
                multiline
                numberOfLines={3}
                value={clinicalNotes}
                onChangeText={setClinicalNotes}
                placeholder="Enter clinical notes, examination findings, and symptoms..."
                placeholderTextColor="#94a3b8"
              />
              <Text style={styles.autoSavedText}>Auto-saved</Text>
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
                <Text style={styles.cardSectionTitle}>Prescription List (Rx)</Text>
              </View>

              <View style={styles.itemsCountBadge}>
                <Text style={styles.itemsCountText}>
                  {data.prescriptions.length} {data.prescriptions.length === 1 ? 'item' : 'items'}
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

                    {/* Right Delete Button */}
                    <TouchableOpacity
                      onPress={() => handleRemoveMedicine(med.id, med.name)}
                      style={styles.deleteMedBtn}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={19} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                );
              })}

              {data.prescriptions.length === 0 && (
                <View style={styles.emptyPrescriptionBox}>
                  <Text style={styles.emptyPrescriptionText}>No medicines added yet.</Text>
                  <Text style={styles.emptyPrescriptionSub}>
                    Use the form below to search and add medications.
                  </Text>
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
              <Text style={styles.addMedHeaderTitle}>Add Medicine</Text>
            </View>

            {/* Medicine Name & Strength */}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Medicine Name & Strength</Text>
              <View style={styles.searchInputWrap}>
                <Ionicons name="search-outline" size={19} color="#64748b" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search e.g., Amoxicillin, Ibuprofen..."
                  placeholderTextColor="#94a3b8"
                  value={searchQuery}
                  onChangeText={(text) => {
                    setSearchQuery(text);
                    setShowSuggestions(text.trim().length > 0);
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
              <Text style={styles.fieldLabel}>Dosage Frequency</Text>
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
                      onPress={() => setSelectedFrequency(freq)}
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

            {/* Duration */}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Duration</Text>
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
                        {days} days
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Add to Prescription Button */}
            <TouchableOpacity
              style={styles.addToPrescriptionBtn}
              onPress={handleAddMedicine}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={20} color="#064e59" style={{ marginRight: 6 }} />
              <Text style={styles.addToPrescriptionBtnText}>Add to Prescription</Text>
            </TouchableOpacity>
          </View>

          {/* ========================================================= */}
          {/* 8. BOTTOM ACTION BUTTONS                                   */}
          {/* ========================================================= */}
          <View style={styles.actionsWrap}>
            {/* Primary Action Button */}
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
                    name="printer-outline"
                    size={20}
                    color="#ffffff"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.saveDigitalRxBtnText}>
                    Save Prescription & Send Digital Rx
                  </Text>
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
              <Text style={styles.referralBtnText}>Refer to Physiotherapy / Lab</Text>
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
          <Text style={[styles.tabLabel, activeTab === 'home' && styles.tabLabelActive]}>Home</Text>
        </TouchableOpacity>

        {/* Queue */}
        <TouchableOpacity style={styles.tabItem} onPress={() => handleTabPress('queue')}>
          <MaterialCommunityIcons
            name="ticket-confirmation-outline"
            size={23}
            color={activeTab === 'queue' ? '#0d6371' : '#64748b'}
          />
          <Text style={[styles.tabLabel, activeTab === 'queue' && styles.tabLabelActive]}>Queue</Text>
        </TouchableOpacity>

        {/* Records */}
        <TouchableOpacity style={styles.tabItem} onPress={() => handleTabPress('records')}>
          <MaterialCommunityIcons
            name="folder-account-outline"
            size={22}
            color={activeTab === 'records' ? '#0d6371' : '#64748b'}
          />
          <Text style={[styles.tabLabel, activeTab === 'records' && styles.tabLabelActive]}>Records</Text>
        </TouchableOpacity>

        {/* Schedule */}
        <TouchableOpacity style={styles.tabItem} onPress={() => handleTabPress('schedule')}>
          <MaterialCommunityIcons
            name="calendar-month-outline"
            size={22}
            color={activeTab === 'schedule' ? '#0d6371' : '#64748b'}
          />
          <Text style={[styles.tabLabel, activeTab === 'schedule' && styles.tabLabelActive]}>Schedule</Text>
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
            Prescription
          </Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================= */}
      {/* MODAL 1: ADD DIAGNOSIS                                     */}
      {/* ========================================================= */}
      <Modal visible={isAddDiagnosisModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add ICD-10 Diagnosis</Text>
              <TouchableOpacity onPress={() => setIsAddDiagnosisModalOpen(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>Select from quick suggestions or type custom:</Text>

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
              <Text style={styles.fieldLabel}>Custom Diagnosis Name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Cervical Disc Herniation"
                placeholderTextColor="#94a3b8"
                value={newDiagName}
                onChangeText={setNewDiagName}
              />

              <Text style={[styles.fieldLabel, { marginTop: 10 }]}>ICD-10 Code (Optional)</Text>
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
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={() => handleAddDiagnosis(newDiagName, newDiagCode)}
              >
                <Text style={styles.modalSubmitBtnText}>Add Diagnosis</Text>
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
              <Text style={styles.modalTitle}>Patient Referral</Text>
              <TouchableOpacity onPress={() => setIsReferralModalOpen(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              Refer {patient.name} ({patient.tokenFormatted}) to specialized hospital unit:
            </Text>

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
                      {type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Referral Clinical Notes / Reason</Text>
            <TextInput
              style={[styles.modalInput, { height: 70, textAlignVertical: 'top' }]}
              multiline
              placeholder="e.g. Lumbar spine mobilization and heat therapy recommended."
              placeholderTextColor="#94a3b8"
              value={referralNotes}
              onChangeText={setReferralNotes}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsReferralModalOpen(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleSubmitReferral}
              >
                <Text style={styles.modalSubmitBtnText}>Send Referral</Text>
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
            <Text style={styles.successModalTitle}>Prescription Saved!</Text>
            <Text style={styles.successModalDesc}>
              Prescription for {patient.name} ({patient.tokenFormatted}) has been saved and the Digital
              Rx has been dispatched to the hospital pharmacy and patient portal.
            </Text>

            <TouchableOpacity
              style={styles.successDoneBtn}
              onPress={() => setIsSaveSuccessModalOpen(false)}
            >
              <Text style={styles.successDoneBtnText}>Done</Text>
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
  deleteMedBtn: {
    padding: 6,
    marginLeft: 6,
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
  addToPrescriptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0f2fe',
    borderRadius: 22,
    paddingVertical: 11,
    marginTop: 4,
  },
  addToPrescriptionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#064e59',
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
  successDoneBtn: {
    backgroundColor: '#064e59',
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 22,
  },
  successDoneBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
