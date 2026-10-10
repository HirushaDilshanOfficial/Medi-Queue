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
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DoctorTopBar } from '../../components/doctor';
import { useTheme } from '../../theme/ThemeContext';
import { BASE_URL } from '../../config';
import {
  PatientRecord,
  getHospitalRecords,
  fetchDoctorRecordsResponseApi,
  savePatientVitalsApi,
  updateDoctorReportStatusApi,
} from '../../services/patientRecordsService';
import { fetchDoctorDashboard, callNextPatientApi } from '../../services/doctorService';

export const EHR_TOKENS = {
  bg: '#F3F6F7',
  card: '#FFFFFF',
  line: '#E3EAEC',
  ink: '#10272B',
  sub: '#5F7478',
  teal: '#0E7C86',
  tealDeep: '#0A5A62',
  tint: '#E4F3F4',
  ok: '#1E9E5A',
  okTint: '#E6F6EC',
  alert: '#E5484D',
  alertTint: '#FDECEC',
  alertText: '#B4232A',
  radius: 18,
};

export default function DoctorEhrDetailsScreen() {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const params = useLocalSearchParams<{
    tokenNumber?: string;
    patientName?: string;
    patientId?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [currentHospital, setCurrentHospital] = useState('City General Hospital');
  const [doctorInfo, setDoctorInfo] = useState({
    name: 'Namal Perera',
    room: 'Room 3B · Online',
  });

  // Elapsed time (minutes live timer)
  const [elapsedMinutes, setElapsedMinutes] = useState(6);
  const [bookedTime, setBookedTime] = useState('01:20 PM');

  // Clinical notes state
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [isNotesFocused, setIsNotesFocused] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // Vitals record modal
  const [isVitalsModalOpen, setIsVitalsModalOpen] = useState(false);
  const [editBp, setEditBp] = useState('');
  const [editHr, setEditHr] = useState('');
  const [editTemp, setEditTemp] = useState('');
  const [editSpo2, setEditSpo2] = useState('');
  const [isSavingVitals, setIsSavingVitals] = useState(false);

  // Add medication modal
  const [isAddMedModalOpen, setIsAddMedModalOpen] = useState(false);
  const [newMedName, setNewMedName] = useState('');
  const [newMedDose, setNewMedDose] = useState('');
  const [newMedFreq, setNewMedFreq] = useState('');

  // Medical report viewer modal state
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isUpdatingReportStatus, setIsUpdatingReportStatus] = useState(false);

  // Past consultation history modal state
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [showAllVisits, setShowAllVisits] = useState(false);

  // Live timer for consultation elapsed time: updates every minute, cleaned up on unmount
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedMinutes((prev) => prev + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Load patient data
  const loadPatientData = useCallback(async () => {
    try {
      setLoading(true);

      let storedHosp = await AsyncStorage.getItem('doctor_current_hospital');
      if (!storedHosp && typeof window !== 'undefined' && (window as any).localStorage) {
        storedHosp = (window as any).localStorage.getItem('doctor_current_hospital');
      }
      const activeHosp = storedHosp || currentHospital || 'City General Hospital';
      setCurrentHospital(activeHosp);

      // 1. Fetch dashboard to get doctor info
      try {
        const dash = await fetchDoctorDashboard(undefined, activeHosp);
        if (dash?.doctor) {
          const dName = dash.doctor.name || 'Namal Perera';
          const dRoom = dash.doctor.room ? `${dash.doctor.room} · Online` : 'Room 3B · Online';
          setDoctorInfo({ name: dName, room: dRoom });
        }
        if ((dash?.currentPatient as any)?.slotTime) {
          setBookedTime((dash?.currentPatient as any).slotTime);
        }
      } catch (e) {}

      // 2. Fetch doctor records
      const targetTokenStr = params?.tokenNumber || (await AsyncStorage.getItem('active_record_patient_token'));
      const targetNameStr = params?.patientName || (await AsyncStorage.getItem('active_record_patient_name'));
      const targetIdStr = params?.patientId;

      const pToken = targetTokenStr ? parseInt(String(targetTokenStr).replace(/\D/g, ''), 10) : null;
      const pName = targetNameStr ? targetNameStr.trim().toLowerCase() : null;

      let recordList: PatientRecord[] = [];
      try {
        const resp = await fetchDoctorRecordsResponseApi('', activeHosp);
        if (resp?.records && resp.records.length > 0) {
          recordList = resp.records;
        }
      } catch (e) {}

      if (recordList.length === 0) {
        recordList = getHospitalRecords(activeHosp);
      }

      // Match target patient
      let matched = recordList.find((p) => {
        if (targetIdStr && p.id === targetIdStr) return true;
        if (pToken && p.tokenNumber === pToken) return true;
        if (pName && (p.name.toLowerCase().includes(pName) || pName.includes(p.name.toLowerCase()))) return true;
        return false;
      });

      if (!matched) {
        matched = recordList.find((p) => p.status === 'In consultation') || recordList[0];
      }

      if (matched) {
        setPatient(matched);
        setEditBp(matched.vitals?.bloodPressure || '120/80');
        setEditHr(matched.vitals?.heartRate ? String(matched.vitals.heartRate).replace(/\D/g, '') : '74');
        setEditTemp(matched.vitals?.bodyTemp ? String(matched.vitals.bodyTemp).replace(/[^\d.]/g, '') : '36.8');
        setEditSpo2(matched.vitals?.spO2 ? String(matched.vitals.spO2).replace(/\D/g, '') : '99');

        // Load cached clinical notes
        try {
          const cachedNotesKey = `@medi_queue_clinical_notes_${matched.id || matched.tokenNumber}`;
          let savedNotes = await AsyncStorage.getItem(cachedNotesKey);
          if (!savedNotes && typeof window !== 'undefined' && (window as any).localStorage) {
            savedNotes = (window as any).localStorage.getItem(cachedNotesKey);
          }
          if (savedNotes) {
            setClinicalNotes(savedNotes);
          }
        } catch (e) {}
      }
    } catch (err) {
      console.log('Error loading patient EHR:', err);
    } finally {
      setLoading(false);
    }
  }, [currentHospital, params?.tokenNumber, params?.patientName, params?.patientId]);

  useEffect(() => {
    loadPatientData();
  }, [loadPatientData]);

  // Handle saving clinical notes
  const handleNotesChange = async (text: string) => {
    setClinicalNotes(text);
    if (patient) {
      const key = `@medi_queue_clinical_notes_${patient.id || patient.tokenNumber}`;
      try {
        await AsyncStorage.setItem(key, text);
        if (typeof window !== 'undefined' && (window as any).localStorage) {
          (window as any).localStorage.setItem(key, text);
        }
      } catch (e) {}
    }
  };

  // Handle save vitals
  const handleSaveVitals = async () => {
    if (!patient) return;
    setIsSavingVitals(true);
    try {
      const updatedVitals = {
        ...patient.vitals,
        bloodPressure: editBp.trim() || patient.vitals?.bloodPressure || '120/80',
        heartRate: editHr.trim() ? `${editHr.trim()} bpm` : (patient.vitals?.heartRate || '74 bpm'),
        bodyTemp: editTemp.trim() ? `${editTemp.trim()} °C` : (patient.vitals?.bodyTemp || '36.8 °C'),
        spO2: editSpo2.trim() ? `${editSpo2.trim()}%` : (patient.vitals?.spO2 || '99%'),
      };

      setPatient({
        ...patient,
        vitals: updatedVitals as any,
      });

      await savePatientVitalsApi({
        patientId: patient.id,
        bloodPressure: updatedVitals.bloodPressure,
        heartRate: editHr.trim() ? `${editHr} bpm` : '74 bpm',
        temperature: editTemp.trim() ? Number(editTemp) : 36.8,
        spO2: editSpo2.trim() ? Number(editSpo2) : 99,
        weight: (patient.vitals as any)?.weightNum || 65,
        height: (patient.vitals as any)?.heightNum || 170,
      });

      setIsVitalsModalOpen(false);
      Alert.alert(t('Vitals Recorded'), t('Patient vitals updated successfully.'));
    } catch (e) {
      setIsVitalsModalOpen(false);
    } finally {
      setIsSavingVitals(false);
    }
  };

  // Handle add medication
  const handleAddMedication = () => {
    if (!newMedName.trim() || !patient) return;
    const newMed = {
      name: newMedName.trim(),
      dose: newMedDose.trim() || '1 tab',
      frequency: newMedFreq.trim() || 'Twice daily after meals',
    };
    const updatedMeds = [...(patient.medications || []), newMed as any];
    setPatient({
      ...patient,
      medications: updatedMeds,
    });
    setNewMedName('');
    setNewMedDose('');
    setNewMedFreq('');
    setIsAddMedModalOpen(false);
  };

  // Start Prescription action
  const handleStartPrescription = () => {
    if (!patient) {
      router.push('/(doctor)/prescription' as any);
      return;
    }
    router.push({
      pathname: '/(doctor)/prescription',
      params: {
        tokenNumber: String(patient.tokenNumber || '2'),
        patientName: patient.name,
        patientId: patient.id,
      },
    } as any);
  };

  // Complete consultation action
  const handleCompleteConsultation = async () => {
    Alert.alert(
      t('Complete Consultation'),
      t('Are you sure you want to complete this consultation?'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Complete'),
          style: 'default',
          onPress: async () => {
            setIsCompleting(true);
            try {
              await callNextPatientApi();
            } catch (e) {}
            setIsCompleting(false);
            router.push('/(doctor)/schedule' as any);
          },
        },
      ]
    );
  };

  // Helper: Patient initials
  const initials = useMemo(() => {
    if (!patient?.name) return 'HW';
    const parts = patient.name.trim().split(' ');
    if (parts.length > 1) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return patient.name.slice(0, 2).toUpperCase();
  }, [patient?.name]);

  // Allergy details
  const allergyInfo = useMemo(() => {
    if (!patient) return { hasAllergy: false, name: '', reaction: '', instruction: '' };
    if (patient.allergy?.hasAllergy) {
      return {
        hasAllergy: true,
        name: patient.allergy.title || 'Penicillin',
        reaction: (patient.allergy as any).reaction || 'Skin rash & hives',
        instruction: (patient.allergy as any).notes || 'Avoid penicillin-class antibiotics',
      };
    }
    if (patient.allergies && patient.allergies.length > 0) {
      const first = patient.allergies[0];
      return {
        hasAllergy: true,
        name: typeof first === 'string' ? first : ((first as any).name || (first as any).allergen || 'Allergy'),
        reaction: typeof first === 'object' ? ((first as any).reaction || 'Mild rash') : 'Mild rash',
        instruction: typeof first === 'object' ? ((first as any).instruction || (first as any).notes || 'Avoid known allergens') : 'Avoid known allergens',
      };
    }
    return { hasAllergy: false, name: '', reaction: '', instruction: '' };
  }, [patient]);

  // Helper to open file/attachment URL
  const handleOpenFileUrl = useCallback((url?: string) => {
    if (!url) return;
    const full = url.startsWith('http') ? url : `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    Linking.openURL(full).catch(() => {
      Alert.alert(t('Cannot Open Document'), t('Could not launch the document viewer.'));
    });
  }, [t]);

  // Handle toggling report status (reviewed / pending)
  const handleToggleReportStatus = useCallback(async () => {
    if (!selectedReport) return;
    const currentStatus = selectedReport.status || 'pending';
    const newStatus = currentStatus === 'reviewed' ? 'pending' : 'reviewed';
    setIsUpdatingReportStatus(true);
    try {
      if (selectedReport.id && !selectedReport.id.startsWith('diag-img-')) {
        await updateDoctorReportStatusApi(selectedReport.id, newStatus);
      }
      setSelectedReport((prev: any) => prev ? { ...prev, status: newStatus } : null);
      if (patient) {
        const updatedReports = (patient.reports || []).map((r: any) =>
          r.id === selectedReport.id ? { ...r, status: newStatus } : r
        );
        setPatient({ ...patient, reports: updatedReports });
      }
    } catch (e) {
      console.warn('Failed to update report status:', e);
    } finally {
      setIsUpdatingReportStatus(false);
    }
  }, [selectedReport, patient]);

  // Unified reports list (combines patient reports and diagnostic imaging)
  const reportsList = useMemo(() => {
    if (!patient) return [];
    const list: any[] = Array.isArray(patient.reports) ? [...patient.reports] : [];
    if (patient.imaging?.hasImaging) {
      const alreadyHas = list.some(
        (r) => r.title === patient.imaging?.title || r.id === (patient.imaging as any).id
      );
      if (!alreadyHas) {
        list.unshift({
          id: (patient.imaging as any).id || 'diag-img-1',
          title: patient.imaging.title || 'Diagnostic Imaging',
          category: 'Radiology',
          reportDate: (patient.imaging.subtitle || 'Recent').replace(/\s*•.*/, ''),
          uploadDateTime: patient.imaging.subtitle || 'Recent',
          fileName: (patient.imaging as any).fileName || 'Diagnostic_Imaging.jpg',
          fileMimeType: (patient.imaging as any).fileMimeType || 'image/jpeg',
          fileUrl: (patient.imaging as any).fileUrl || ((patient.imaging as any).id ? `/api/v1/doctor/reports/${(patient.imaging as any).id}/file` : undefined),
          imageUrl: patient.imaging.imageUrl,
          notes: patient.imaging.reportSummary || patient.imaging.description || '',
          status: 'reviewed',
        });
      }
    }
    return list;
  }, [patient?.reports, patient?.imaging]);

  // All visits list and displayed visits
  const allVisits = useMemo(() => {
    if (!patient?.recentVisits || patient.recentVisits.length === 0) return [];
    return patient.recentVisits;
  }, [patient?.recentVisits]);

  const displayedVisits = useMemo(() => {
    return showAllVisits ? allVisits : allVisits.slice(0, 3);
  }, [allVisits, showAllVisits]);

  return (
    <SafeAreaView style={[styles.safeArea, isDark && { backgroundColor: '#091012' }]}>
      <StatusBar barStyle="light-content" backgroundColor={EHR_TOKENS.teal} />

      {/* 1. SHARED TEAL TOP BAR */}
      <DoctorTopBar
        doctorName={doctorInfo.name}
        room={doctorInfo.room}
        unreadCount={2}
      />

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={EHR_TOKENS.teal} />
          <Text style={styles.loadingText}>{t('Loading patient record…')}</Text>
        </View>
      ) : (
        <View style={[styles.container, isDark && { backgroundColor: '#091012' }]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* 2. HEADER ROW */}
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => router.push('/(doctor)/schedule' as any)}
                activeOpacity={0.75}
                accessibilityLabel={t('Back to schedule')}
              >
                <Ionicons name="arrow-back" size={20} color={EHR_TOKENS.ink} />
              </TouchableOpacity>

              <View style={styles.headerTextCol}>
                <Text style={styles.headerSubtitle}>{t('Electronic health record')}</Text>
                <Text style={styles.headerTitle}>{t('Patient record')}</Text>
              </View>
            </View>

            {/* 3. PATIENT CARD (WHITE) */}
            <View style={styles.patientCard}>
              <View style={styles.patientCardTopRow}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>

                <View style={styles.patientCardInfoCol}>
                  <Text style={styles.patientNameText} numberOfLines={1}>
                    {patient?.name || 'Heshani Wickramasinghe'}
                  </Text>
                  <Text style={styles.patientMetaText} numberOfLines={1}>
                    {t(patient?.gender || 'Female')} · {patient?.age || 22} {t('yrs')} · {t('Blood')} {patient?.bloodGroup || 'B+'}
                  </Text>
                  <Text style={styles.patientNicText} numberOfLines={1}>
                    {patient?.nic ? `NIC: ${patient.nic}` : 'NIC: 200382013019'}
                  </Text>
                </View>

                <View style={styles.tokenBox}>
                  <Text style={styles.tokenLabel}>{t('Token')}</Text>
                  <Text style={styles.tokenNumber}>
                    #{String(patient?.tokenNumber || 2).padStart(3, '0')}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.patientCardBottomRow}>
                <View style={styles.inRoomPill}>
                  <Text style={styles.inRoomText}>{t('In room')}</Text>
                </View>

                <View style={styles.elapsedRow}>
                  <Ionicons name="time-outline" size={14} color={EHR_TOKENS.sub} style={{ marginRight: 4 }} />
                  <Text style={styles.elapsedText}>
                    {t('Elapsed')} {elapsedMinutes} {t('min')} · {t('Booked')} {bookedTime}
                  </Text>
                </View>
              </View>
            </View>

            {/* 4. ALLERGY BANNER */}
            {allergyInfo.hasAllergy ? (
              <View style={styles.allergyBannerAlert}>
                <View style={styles.alertIconBox}>
                  <Ionicons name="warning-outline" size={18} color={EHR_TOKENS.alert} />
                </View>
                <View style={styles.alertTextCol}>
                  <Text style={styles.allergyTitleAlert}>
                    {t('Allergy: {value0}', { value0: allergyInfo.name })}
                  </Text>
                  <Text style={styles.allergySubAlert}>
                    {t('Reaction: {value0} · Avoid {value1}', {
                      value0: allergyInfo.reaction,
                      value1: allergyInfo.instruction,
                    })}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.allergyBannerOk}>
                <Ionicons name="shield-checkmark" size={18} color={EHR_TOKENS.ok} style={{ marginRight: 8 }} />
                <Text style={styles.allergyTextOk}>{t('No known allergies')}</Text>
              </View>
            )}

            {/* 5. VITALS (2x2 GRID) */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>{t('Vitals')}</Text>
              <TouchableOpacity
                style={styles.recordChip}
                onPress={() => setIsVitalsModalOpen(true)}
                activeOpacity={0.75}
              >
                <Ionicons name="add" size={14} color={EHR_TOKENS.teal} style={{ marginRight: 2 }} />
                <Text style={styles.recordChipText}>{t('Record')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.vitalsGrid}>
              {/* Tile 1: Blood pressure */}
              <View style={styles.vitalTile}>
                <Text style={styles.vitalTileLabel}>{t('Blood pressure')}</Text>
                <Text style={styles.vitalTileValue}>
                  {patient?.vitals?.bloodPressure || '--'}
                </Text>
                <Text style={styles.vitalTileUnit}>mmHg</Text>
              </View>

              {/* Tile 2: Heart rate (value in teal) */}
              <View style={styles.vitalTile}>
                <Text style={styles.vitalTileLabel}>{t('Heart rate')}</Text>
                <Text style={[styles.vitalTileValue, { color: EHR_TOKENS.teal }]}>
                  {patient?.vitals?.heartRate ? String(patient.vitals.heartRate).replace(/\D/g, '') : '--'}
                </Text>
                <Text style={styles.vitalTileUnit}>bpm</Text>
              </View>

              {/* Tile 3: Temperature */}
              <View style={styles.vitalTile}>
                <Text style={styles.vitalTileLabel}>{t('Temperature')}</Text>
                <Text style={styles.vitalTileValue}>
                  {patient?.vitals?.bodyTemp ? String(patient.vitals.bodyTemp).replace(/[^\d.]/g, '') : '--'}
                </Text>
                <Text style={styles.vitalTileUnit}>°C</Text>
              </View>

              {/* Tile 4: SpO2 */}
              <View style={styles.vitalTile}>
                <Text style={styles.vitalTileLabel}>{t('SpO₂')}</Text>
                <Text style={styles.vitalTileValue}>
                  {patient?.vitals?.spO2 ? String(patient.vitals.spO2).replace(/\D/g, '') : '--'}
                </Text>
                <Text style={styles.vitalTileUnit}>%</Text>
              </View>
            </View>

            {/* 6. CHRONIC CONDITIONS CARD */}
            <View style={styles.cardContainer}>
              <View style={styles.cardHeaderRow}>
                <MaterialCommunityIcons name="stethoscope" size={18} color={EHR_TOKENS.teal} style={{ marginRight: 6 }} />
                <Text style={styles.cardHeaderTitle}>{t('Chronic conditions')}</Text>
              </View>
              {patient?.chronicConditions && patient.chronicConditions.length > 0 ? (
                <View style={styles.tagsWrapRow}>
                  {patient.chronicConditions.map((cond, i) => (
                    <View key={i} style={styles.conditionTag}>
                      <Text style={styles.conditionTagText}>{t(cond)}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyCardText}>{t('None recorded.')}</Text>
              )}
            </View>

            {/* 7. CURRENT MEDICATIONS CARD */}
            <View style={styles.cardContainer}>
              <View style={styles.cardHeaderRowBetween}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="pill" size={18} color={EHR_TOKENS.teal} style={{ marginRight: 6 }} />
                  <Text style={styles.cardHeaderTitle}>{t('Current medications')}</Text>
                </View>
                <TouchableOpacity
                  style={styles.addMedChip}
                  onPress={() => setIsAddMedModalOpen(true)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="add" size={13} color={EHR_TOKENS.teal} style={{ marginRight: 2 }} />
                  <Text style={styles.addMedChipText}>{t('Add')}</Text>
                </TouchableOpacity>
              </View>

              {patient?.medications && patient.medications.length > 0 ? (
                <View style={styles.medsList}>
                  {patient.medications.map((med: any, i: number) => (
                    <View key={i} style={[styles.medItemRow, i > 0 && styles.medItemBorder]}>
                      <Text style={styles.medNameText}>
                        {med.name} {med.dose ? `· ${med.dose}` : ''}
                      </Text>
                      <Text style={styles.medFreqText}>
                        {t(med.frequency || 'As prescribed')}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyCardText}>{t('No active medications.')}</Text>
              )}
            </View>

            {/* 8. MEDICAL & LAB REPORTS */}
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="file-document-outline" size={18} color={EHR_TOKENS.teal} style={{ marginRight: 6 }} />
                <Text style={styles.sectionHeading}>{t('Medical & Lab Reports')}</Text>
              </View>
              {reportsList.length > 0 && (
                <View style={styles.reportCountPill}>
                  <Text style={styles.reportCountPillText}>
                    {reportsList.length} {t(reportsList.length === 1 ? 'Report' : 'Reports')}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.cardContainer}>
              {reportsList.length > 0 ? (
                <View style={styles.reportsList}>
                  {reportsList.map((rep: any, idx: number) => {
                    const isPdf = Boolean(
                      rep.fileMimeType?.includes('pdf') ||
                      (rep.fileName && rep.fileName.toLowerCase().endsWith('.pdf'))
                    );
                    const isImg = Boolean(
                      rep.fileMimeType?.startsWith('image/') ||
                      (rep.fileName && /\.(png|jpg|jpeg|webp)$/i.test(rep.fileName)) ||
                      rep.imageUrl
                    );
                    const isReviewed = rep.status === 'reviewed';

                    return (
                      <TouchableOpacity
                        key={rep.id || idx}
                        style={[styles.reportItemRow, idx > 0 && styles.medItemBorder]}
                        activeOpacity={0.7}
                        onPress={() => {
                          setSelectedReport(rep);
                          setIsReportModalOpen(true);
                        }}
                      >
                        <View style={[styles.reportTypeIconBox, { backgroundColor: isPdf ? '#fee2e2' : (isImg ? '#e0f2fe' : '#f0fdfa') }]}>
                          <Ionicons
                            name={isPdf ? 'document-text' : (isImg ? 'image' : 'flask')}
                            size={20}
                            color={isPdf ? '#dc2626' : (isImg ? '#0284c7' : EHR_TOKENS.teal)}
                          />
                        </View>

                        <View style={{ flex: 1, paddingRight: 6 }}>
                          <View style={styles.reportTitleRow}>
                            <Text style={styles.reportTitleText} numberOfLines={1}>
                              {rep.title || t('Diagnostic Report')}
                            </Text>
                            <View style={[styles.categoryTag, { backgroundColor: isPdf ? '#fef2f2' : '#f0f9ff' }]}>
                              <Text style={[styles.categoryTagText, { color: isPdf ? '#b91c1c' : '#0369a1' }]}>
                                {t(rep.category || 'General')}
                              </Text>
                            </View>
                          </View>

                          <Text style={styles.reportDateMeta} numberOfLines={1}>
                            <Ionicons name="calendar-outline" size={11} color={EHR_TOKENS.sub} />{' '}
                            {rep.reportDate || rep.uploadDateTime || t('Recent')} {rep.fileName ? `· ${rep.fileName}` : ''}
                          </Text>

                          {Boolean(rep.notes) && (
                            <Text style={styles.reportNotesLine} numberOfLines={1}>
                              {rep.notes}
                            </Text>
                          )}
                        </View>

                        <View style={styles.reportRightCol}>
                          <View style={[styles.statusBadgePill, { backgroundColor: isReviewed ? '#dcfce7' : '#fef3c7' }]}>
                            <Text style={[styles.statusBadgePillText, { color: isReviewed ? '#15803d' : '#b45309' }]}>
                              {isReviewed ? t('Reviewed') : t('Pending')}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={15} color={EHR_TOKENS.sub} style={{ marginTop: 4, alignSelf: 'flex-end' }} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyReportsBox}>
                  <Ionicons name="document-text-outline" size={28} color={EHR_TOKENS.sub} style={{ marginBottom: 4 }} />
                  <Text style={styles.emptyCardText}>{t('No medical reports lodged by patient yet.')}</Text>
                  <Text style={styles.emptyReportsSubText}>{t('Patient uploaded lab results, scans, and documents appear here when lodged.')}</Text>
                </View>
              )}
            </View>

            {/* 9. PREVIOUS VISITS & MEDICAL HISTORY */}
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="time-outline" size={18} color={EHR_TOKENS.teal} style={{ marginRight: 6 }} />
                <Text style={styles.sectionHeading}>{t('Previous visits & history')}</Text>
              </View>
              {allVisits.length > 3 && (
                <TouchableOpacity
                  onPress={() => setShowAllVisits((prev) => !prev)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.seeAllText}>
                    {showAllVisits ? t('Show less') : t('See all ({value0})', { value0: String(allVisits.length) })}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.cardContainer}>
              {displayedVisits.length > 0 ? (
                <View style={styles.visitsList}>
                  {displayedVisits.map((vis: any, idx: number) => (
                    <TouchableOpacity
                      key={vis.id || idx}
                      style={[styles.visitItemRow, idx > 0 && styles.medItemBorder]}
                      activeOpacity={0.75}
                      onPress={() => {
                        setSelectedVisit(vis);
                        setIsVisitModalOpen(true);
                      }}
                    >
                      <View style={styles.visitDotWrap}>
                        <View style={styles.visitDot} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                          <Text style={styles.visitReasonText}>{vis.title || t('General OPD Consultation')}</Text>
                          {Boolean(vis.statusBadge) && (
                            <View style={styles.visitStatusPill}>
                              <Text style={styles.visitStatusPillText}>{t(vis.statusBadge)}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.visitMetaText}>
                          {vis.date || '2026-10-01'} · {vis.details || currentHospital}
                        </Text>
                        {Boolean(vis.clinicalNotes || vis.diagnosis) && (
                          <Text style={styles.visitSnippetText} numberOfLines={1}>
                            {vis.clinicalNotes || vis.diagnosis}
                          </Text>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={15} color={EHR_TOKENS.sub} style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyCardText}>{t('No prior consultation records.')}</Text>
              )}
            </View>

            {/* 9. CLINICAL NOTES CARD */}
            <View style={styles.cardContainer}>
              <View style={styles.cardHeaderRowBetween}>
                <Text style={styles.cardHeaderTitle}>{t('Clinical notes')}</Text>
                <Text style={styles.confidentialText}>{t('Confidential')}</Text>
              </View>

              <TextInput
                style={[
                  styles.notesInput,
                  isNotesFocused && styles.notesInputFocused,
                ]}
                multiline
                numberOfLines={4}
                value={clinicalNotes}
                onChangeText={handleNotesChange}
                onFocus={() => setIsNotesFocused(true)}
                onBlur={() => setIsNotesFocused(false)}
                placeholder={t('Write symptoms, findings or advice…')}
                placeholderTextColor={EHR_TOKENS.sub}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>

          {/* 10. FIXED BOTTOM ACTION BAR */}
          <View style={styles.bottomActionBar}>
            {/* Secondary Complete button with check icon (auto width) */}
            <TouchableOpacity
              style={styles.completeBtn}
              onPress={handleCompleteConsultation}
              disabled={isCompleting}
              activeOpacity={0.75}
            >
              {isCompleting ? (
                <ActivityIndicator size="small" color={EHR_TOKENS.tealDeep} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color={EHR_TOKENS.tealDeep} />
                  <Text style={styles.completeBtnText}>{t('Complete')}</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Primary Start Prescription button (takes remaining width) */}
            <TouchableOpacity
              style={styles.startPrescriptionBtn}
              onPress={handleStartPrescription}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="clipboard-edit-outline" size={19} color="#FFFFFF" />
              <Text style={styles.startPrescriptionText}>{t('Start prescription')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* RECORD VITALS MODAL */}
      <Modal
        visible={isVitalsModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsVitalsModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsVitalsModalOpen(false)}
        >
          <TouchableOpacity style={styles.modalContent} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('Record Vitals')}</Text>

            <Text style={styles.inputLabel}>{t('Blood Pressure (mmHg)')}</Text>
            <TextInput
              style={styles.modalInput}
              value={editBp}
              onChangeText={setEditBp}
              placeholder="e.g. 120/80"
              placeholderTextColor={EHR_TOKENS.sub}
            />

            <Text style={styles.inputLabel}>{t('Heart Rate (bpm)')}</Text>
            <TextInput
              style={styles.modalInput}
              value={editHr}
              onChangeText={setEditHr}
              keyboardType="numeric"
              placeholder="e.g. 74"
              placeholderTextColor={EHR_TOKENS.sub}
            />

            <Text style={styles.inputLabel}>{t('Temperature (°C)')}</Text>
            <TextInput
              style={styles.modalInput}
              value={editTemp}
              onChangeText={setEditTemp}
              keyboardType="numeric"
              placeholder="e.g. 36.8"
              placeholderTextColor={EHR_TOKENS.sub}
            />

            <Text style={styles.inputLabel}>{t('SpO₂ (%)')}</Text>
            <TextInput
              style={styles.modalInput}
              value={editSpo2}
              onChangeText={setEditSpo2}
              keyboardType="numeric"
              placeholder="e.g. 99"
              placeholderTextColor={EHR_TOKENS.sub}
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsVitalsModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>{t('Cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveVitals}
                disabled={isSavingVitals}
              >
                {isSavingVitals ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveText}>{t('Save vitals')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ADD MEDICATION MODAL */}
      <Modal
        visible={isAddMedModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAddMedModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsAddMedModalOpen(false)}
        >
          <TouchableOpacity style={styles.modalContent} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('Add Current Medication')}</Text>

            <Text style={styles.inputLabel}>{t('Medication Name *')}</Text>
            <TextInput
              style={styles.modalInput}
              value={newMedName}
              onChangeText={setNewMedName}
              placeholder={t("e.g. Metformin")}
              placeholderTextColor={EHR_TOKENS.sub}
            />

            <Text style={styles.inputLabel}>{t('Dose')}</Text>
            <TextInput
              style={styles.modalInput}
              value={newMedDose}
              onChangeText={setNewMedDose}
              placeholder={t("e.g. 500 mg")}
              placeholderTextColor={EHR_TOKENS.sub}
            />

            <Text style={styles.inputLabel}>{t('Frequency')}</Text>
            <TextInput
              style={styles.modalInput}
              value={newMedFreq}
              onChangeText={setNewMedFreq}
              placeholder={t("e.g. Twice daily after meals")}
              placeholderTextColor={EHR_TOKENS.sub}
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsAddMedModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>{t('Cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleAddMedication}
              >
                <Text style={styles.modalSaveText}>{t('Add medication')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* MEDICAL REPORT DETAILS MODAL */}
      <Modal
        visible={isReportModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsReportModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsReportModalOpen(false)}
        >
          <TouchableOpacity
            style={[styles.modalContent, { maxHeight: '90%' }]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHandle} />

            <View style={styles.modalHeaderRowBetween}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.modalReportTitle} numberOfLines={2}>
                  {selectedReport?.title || t('Medical Report')}
                </Text>
                <View style={styles.modalCategoryRow}>
                  <View style={styles.modalCategoryBadge}>
                    <Text style={styles.modalCategoryBadgeText}>
                      {t(selectedReport?.category || 'General')}
                    </Text>
                  </View>
                  <Text style={styles.modalReportDate}>
                    {selectedReport?.reportDate || selectedReport?.uploadDateTime || 'Recent'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsReportModalOpen(false)}
              >
                <Ionicons name="close" size={20} color={EHR_TOKENS.ink} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 12 }}>
              {/* Status & Review Toggle */}
              <View style={styles.reportStatusCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons
                      name={selectedReport?.status === 'reviewed' ? 'checkmark-circle' : 'time-outline'}
                      size={20}
                      color={selectedReport?.status === 'reviewed' ? '#15803d' : '#b45309'}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: EHR_TOKENS.ink }}>
                      {selectedReport?.status === 'reviewed' ? t('Report Reviewed by Clinician') : t('Pending Review')}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.toggleReviewBtn,
                      selectedReport?.status === 'reviewed' ? styles.toggleReviewedActive : styles.togglePendingActive,
                    ]}
                    onPress={handleToggleReportStatus}
                    disabled={isUpdatingReportStatus}
                    activeOpacity={0.8}
                  >
                    {isUpdatingReportStatus ? (
                      <ActivityIndicator size="small" color={EHR_TOKENS.teal} />
                    ) : (
                      <Text
                        style={[
                          styles.toggleReviewBtnText,
                          { color: selectedReport?.status === 'reviewed' ? '#15803d' : EHR_TOKENS.tealDeep },
                        ]}
                      >
                        {selectedReport?.status === 'reviewed' ? t('Mark Pending') : t('Mark Reviewed ✓')}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Document / File Preview Section */}
              {Boolean(
                selectedReport?.imageUrl ||
                (selectedReport?.fileMimeType?.startsWith('image/') && selectedReport?.fileUrl) ||
                (/\.(png|jpg|jpeg|webp)$/i.test(selectedReport?.fileName || '') && selectedReport?.fileUrl)
              ) ? (
                <View style={styles.reportImageContainer}>
                  <Text style={styles.previewSectionTitle}>{t('Image / Scan Preview')}</Text>
                  <Image
                    source={{
                      uri: selectedReport.imageUrl
                        ? selectedReport.imageUrl
                        : selectedReport.fileUrl.startsWith('http')
                        ? selectedReport.fileUrl
                        : `${BASE_URL}${selectedReport.fileUrl.startsWith('/') ? '' : '/'}${selectedReport.fileUrl}`,
                    }}
                    style={styles.reportImagePreview}
                    resizeMode="contain"
                  />
                </View>
              ) : null}

              {/* PDF Document action banner */}
              {Boolean(
                selectedReport?.fileUrl ||
                selectedReport?.fileMimeType?.includes('pdf') ||
                selectedReport?.fileName?.toLowerCase().endsWith('.pdf')
              ) && (
                <View style={styles.documentActionBox}>
                  <View style={styles.pdfIconCircle}>
                    <Ionicons name="document-text" size={24} color="#dc2626" />
                  </View>
                  <View style={{ flex: 1, paddingHorizontal: 10 }}>
                    <Text style={styles.docFileName} numberOfLines={1}>
                      {selectedReport?.fileName || `${selectedReport?.title}.pdf`}
                    </Text>
                    <Text style={styles.docFileMeta}>
                      {selectedReport?.fileMimeType || 'application/pdf'} · {t('Official Clinical Report')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.openDocBtn}
                    onPress={() => handleOpenFileUrl(selectedReport?.fileUrl || `/api/v1/doctor/reports/${selectedReport?.id}/file`)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="open-outline" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.openDocBtnText}>{t('Open')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Clinical Notes / Patient Lodgement Notes */}
              <View style={styles.reportNotesCard}>
                <Text style={styles.reportNotesHeading}>{t('Clinical Observations & Notes')}</Text>
                <Text style={styles.reportNotesBody}>
                  {selectedReport?.notes
                    ? selectedReport.notes
                    : t('No additional clinical notes attached. Uploaded by patient for doctor consultation review.')}
                </Text>
              </View>

              {/* Metadata Details */}
              <View style={styles.metaInfoGrid}>
                <View style={styles.metaInfoCol}>
                  <Text style={styles.metaInfoLabel}>{t('Lodged Date')}</Text>
                  <Text style={styles.metaInfoValue}>
                    {selectedReport?.uploadDateTime || selectedReport?.reportDate || '10/09/2026'}
                  </Text>
                </View>
                <View style={styles.metaInfoCol}>
                  <Text style={styles.metaInfoLabel}>{t('Category')}</Text>
                  <Text style={styles.metaInfoValue}>{selectedReport?.category || 'Lab Result'}</Text>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.closeFullBtn}
              onPress={() => setIsReportModalOpen(false)}
            >
              <Text style={styles.closeFullBtnText}>{t('Done')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* PAST VISIT CONSULTATION DETAILS MODAL */}
      <Modal
        visible={isVisitModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsVisitModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsVisitModalOpen(false)}
        >
          <TouchableOpacity
            style={[styles.modalContent, { maxHeight: '85%' }]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHandle} />

            <View style={styles.modalHeaderRowBetween}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.modalReportTitle} numberOfLines={2}>
                  {selectedVisit?.title || t('Past OPD Consultation')}
                </Text>
                <Text style={styles.modalReportDate}>
                  <Ionicons name="calendar-outline" size={12} color={EHR_TOKENS.sub} />{' '}
                  {selectedVisit?.date || 'Past Visit'}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsVisitModalOpen(false)}
              >
                <Ionicons name="close" size={20} color={EHR_TOKENS.ink} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 14 }}>
              {/* Facility & Attending Doctor Info */}
              <View style={styles.visitMetaCard}>
                <View style={styles.visitMetaRow}>
                  <Ionicons name="business-outline" size={16} color={EHR_TOKENS.teal} style={{ marginRight: 8 }} />
                  <Text style={styles.visitMetaKey}>{t('Facility / Dept:')}</Text>
                  <Text style={styles.visitMetaVal} numberOfLines={1}>
                    {selectedVisit?.details || currentHospital}
                  </Text>
                </View>
                <View style={[styles.visitMetaRow, { marginTop: 8 }]}>
                  <Ionicons name="medkit-outline" size={16} color={EHR_TOKENS.teal} style={{ marginRight: 8 }} />
                  <Text style={styles.visitMetaKey}>{t('Status:')}</Text>
                  <Text style={[styles.visitMetaVal, { color: EHR_TOKENS.teal, fontWeight: '700' }]}>
                    {t(selectedVisit?.statusBadge || 'Consultation Completed')}
                  </Text>
                </View>
              </View>

              {/* Consultation Details & Advice */}
              <View style={styles.reportNotesCard}>
                <Text style={styles.reportNotesHeading}>{t('Diagnosis & Care Provided')}</Text>
                <Text style={styles.reportNotesBody}>
                  {selectedVisit?.details
                    ? selectedVisit.details
                    : t('Clinical examination completed. Medication regimen prescribed and patient advised on symptoms monitoring.')}
                </Text>
              </View>

              {Boolean(selectedVisit?.clinicalNotes) && (
                <View style={styles.reportNotesCard}>
                  <Text style={styles.reportNotesHeading}>{t('Doctor Notes')}</Text>
                  <Text style={styles.reportNotesBody}>{selectedVisit.clinicalNotes}</Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.closeFullBtn}
              onPress={() => setIsVisitModalOpen(false)}
            >
              <Text style={styles.closeFullBtnText}>{t('Close Details')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: EHR_TOKENS.bg,
  },
  container: {
    flex: 1,
    backgroundColor: EHR_TOKENS.bg,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: EHR_TOKENS.sub,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 120, // Enough bottom padding so nothing is hidden by fixed bottom bar
  },

  // Header row
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: EHR_TOKENS.card,
    borderWidth: 1,
    borderColor: EHR_TOKENS.line,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTextCol: {
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: EHR_TOKENS.sub,
    marginBottom: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: EHR_TOKENS.ink,
    letterSpacing: -0.3,
  },

  // Patient Card
  patientCard: {
    backgroundColor: EHR_TOKENS.card,
    borderRadius: EHR_TOKENS.radius,
    borderWidth: 1,
    borderColor: EHR_TOKENS.line,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  patientCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: EHR_TOKENS.tint,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: EHR_TOKENS.teal,
  },
  patientCardInfoCol: {
    flex: 1,
  },
  patientNameText: {
    fontSize: 19,
    fontWeight: '800',
    color: EHR_TOKENS.ink,
    marginBottom: 2,
  },
  patientMetaText: {
    fontSize: 13,
    fontWeight: '500',
    color: EHR_TOKENS.sub,
    marginBottom: 2,
  },
  patientNicText: {
    fontSize: 12,
    fontWeight: '500',
    color: EHR_TOKENS.sub,
  },
  tokenBox: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  tokenLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: EHR_TOKENS.sub,
    marginBottom: 1,
  },
  tokenNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: EHR_TOKENS.teal,
    letterSpacing: -0.5,
  },
  divider: {
    height: 1,
    backgroundColor: EHR_TOKENS.line,
    marginVertical: 12,
  },
  patientCardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inRoomPill: {
    backgroundColor: EHR_TOKENS.okTint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  inRoomText: {
    color: EHR_TOKENS.ok,
    fontSize: 12,
    fontWeight: '700',
  },
  elapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  elapsedText: {
    fontSize: 12,
    fontWeight: '500',
    color: EHR_TOKENS.sub,
  },

  // Allergy banner
  allergyBannerAlert: {
    backgroundColor: EHR_TOKENS.alertTint,
    borderRadius: EHR_TOKENS.radius,
    borderWidth: 1,
    borderColor: '#FCDAD7',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  alertIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(229, 72, 77, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  alertTextCol: {
    flex: 1,
  },
  allergyTitleAlert: {
    fontSize: 13,
    fontWeight: '800',
    color: EHR_TOKENS.alertText,
    marginBottom: 2,
  },
  allergySubAlert: {
    fontSize: 12,
    fontWeight: '600',
    color: EHR_TOKENS.alertText,
    lineHeight: 16,
  },
  allergyBannerOk: {
    backgroundColor: EHR_TOKENS.okTint,
    borderRadius: EHR_TOKENS.radius,
    borderWidth: 1,
    borderColor: '#C6EEDB',
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  allergyTextOk: {
    fontSize: 13,
    fontWeight: '700',
    color: EHR_TOKENS.ok,
  },

  // Section header
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 6,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: EHR_TOKENS.ink,
  },
  recordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: EHR_TOKENS.tint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  recordChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: EHR_TOKENS.teal,
  },

  // Vitals 2x2 grid
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  vitalTile: {
    width: '48.5%',
    backgroundColor: EHR_TOKENS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: EHR_TOKENS.line,
    padding: 12,
  },
  vitalTileLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: EHR_TOKENS.sub,
    marginBottom: 4,
  },
  vitalTileValue: {
    fontSize: 20,
    fontWeight: '800',
    color: EHR_TOKENS.ink,
    letterSpacing: -0.3,
  },
  vitalTileUnit: {
    fontSize: 11,
    fontWeight: '500',
    color: EHR_TOKENS.sub,
    marginTop: 2,
  },

  // General Card Container
  cardContainer: {
    backgroundColor: EHR_TOKENS.card,
    borderRadius: EHR_TOKENS.radius,
    borderWidth: 1,
    borderColor: EHR_TOKENS.line,
    padding: 16,
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardHeaderRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: EHR_TOKENS.ink,
  },
  tagsWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  conditionTag: {
    backgroundColor: EHR_TOKENS.tint,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  conditionTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: EHR_TOKENS.tealDeep,
  },
  emptyCardText: {
    fontSize: 13,
    fontWeight: '500',
    color: EHR_TOKENS.sub,
    fontStyle: 'italic',
  },

  // Medications
  addMedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: EHR_TOKENS.tint,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  addMedChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: EHR_TOKENS.teal,
  },
  medsList: {
    flexDirection: 'column',
  },
  medItemRow: {
    paddingVertical: 8,
  },
  medItemBorder: {
    borderTopWidth: 1,
    borderTopColor: EHR_TOKENS.line,
  },
  medNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: EHR_TOKENS.ink,
    marginBottom: 2,
  },
  medFreqText: {
    fontSize: 12,
    fontWeight: '500',
    color: EHR_TOKENS.sub,
  },

  // Visits
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: EHR_TOKENS.teal,
  },
  visitsList: {
    flexDirection: 'column',
  },
  visitItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  visitDotWrap: {
    marginRight: 12,
    marginTop: 4,
  },
  visitDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: EHR_TOKENS.teal,
    borderWidth: 2,
    borderColor: EHR_TOKENS.tint,
  },
  visitReasonText: {
    fontSize: 14,
    fontWeight: '700',
    color: EHR_TOKENS.ink,
    marginBottom: 2,
  },
  visitMetaText: {
    fontSize: 12,
    fontWeight: '500',
    color: EHR_TOKENS.sub,
  },

  // Notes
  confidentialText: {
    fontSize: 11,
    fontWeight: '600',
    color: EHR_TOKENS.sub,
  },
  notesInput: {
    backgroundColor: '#F8FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: EHR_TOKENS.line,
    minHeight: 90,
    padding: 12,
    fontSize: 13,
    color: EHR_TOKENS.ink,
  },
  notesInputFocused: {
    borderColor: EHR_TOKENS.teal,
    backgroundColor: '#FFFFFF',
  },

  // Fixed Bottom Action Bar
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: EHR_TOKENS.line,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8,
  },
  completeBtn: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#F3F6F7',
    borderWidth: 1,
    borderColor: EHR_TOKENS.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  completeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: EHR_TOKENS.tealDeep,
  },
  startPrescriptionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: EHR_TOKENS.teal,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startPrescriptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 39, 43, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: EHR_TOKENS.line,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: EHR_TOKENS.ink,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: EHR_TOKENS.ink,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: '#F8FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: EHR_TOKENS.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: EHR_TOKENS.ink,
    marginBottom: 12,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F3F6F7',
    borderWidth: 1,
    borderColor: EHR_TOKENS.line,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: EHR_TOKENS.sub,
  },
  modalSaveBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: EHR_TOKENS.teal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Medical Reports Section Styles
  reportCountPill: {
    backgroundColor: EHR_TOKENS.tint,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  reportCountPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: EHR_TOKENS.tealDeep,
  },
  reportsList: {
    flexDirection: 'column',
  },
  reportItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  reportTypeIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reportTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 2,
  },
  reportTitleText: {
    fontSize: 14,
    fontWeight: '700',
    color: EHR_TOKENS.ink,
    maxWidth: '75%',
  },
  categoryTag: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  categoryTagText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  reportDateMeta: {
    fontSize: 12,
    color: EHR_TOKENS.sub,
    marginBottom: 2,
  },
  reportNotesLine: {
    fontSize: 11,
    color: '#475569',
    fontStyle: 'italic',
  },
  reportRightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 4,
  },
  statusBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusBadgePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyReportsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  emptyReportsSubText: {
    fontSize: 12,
    color: EHR_TOKENS.sub,
    textAlign: 'center',
    marginTop: 4,
  },

  // Visit items enhancements
  visitStatusPill: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  visitStatusPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  visitSnippetText: {
    fontSize: 11,
    color: EHR_TOKENS.sub,
    marginTop: 2,
  },

  // Modal Report Details
  modalHeaderRowBetween: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: EHR_TOKENS.line,
  },
  modalReportTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: EHR_TOKENS.ink,
  },
  modalCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  modalCategoryBadge: {
    backgroundColor: EHR_TOKENS.tint,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  modalCategoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: EHR_TOKENS.tealDeep,
  },
  modalReportDate: {
    fontSize: 12,
    color: EHR_TOKENS.sub,
    fontWeight: '500',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F6F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportStatusCard: {
    backgroundColor: '#F8FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: EHR_TOKENS.line,
    padding: 12,
    marginBottom: 12,
  },
  toggleReviewBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  toggleReviewedActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  togglePendingActive: {
    backgroundColor: '#f0fdfa',
    borderColor: '#99f6e4',
  },
  toggleReviewBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  reportImageContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  previewSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 6,
    alignSelf: 'flex-start',
    textTransform: 'uppercase',
  },
  reportImagePreview: {
    width: '100%',
    height: 220,
    borderRadius: 10,
  },
  documentActionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  pdfIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  docFileName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991b1b',
  },
  docFileMeta: {
    fontSize: 11,
    color: '#b91c1c',
    marginTop: 2,
  },
  openDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  openDocBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  reportNotesCard: {
    backgroundColor: '#F8FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: EHR_TOKENS.line,
    padding: 12,
    marginBottom: 12,
  },
  reportNotesHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: EHR_TOKENS.ink,
    marginBottom: 4,
  },
  reportNotesBody: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  metaInfoGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  metaInfoCol: {
    flex: 1,
    backgroundColor: '#F8FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: EHR_TOKENS.line,
    padding: 10,
  },
  metaInfoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: EHR_TOKENS.sub,
    marginBottom: 2,
  },
  metaInfoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: EHR_TOKENS.ink,
  },
  closeFullBtn: {
    backgroundColor: EHR_TOKENS.teal,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  closeFullBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  visitMetaCard: {
    backgroundColor: '#F8FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: EHR_TOKENS.line,
    padding: 12,
    marginBottom: 12,
  },
  visitMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  visitMetaKey: {
    fontSize: 12,
    fontWeight: '700',
    color: EHR_TOKENS.ink,
    marginRight: 6,
  },
  visitMetaVal: {
    fontSize: 12,
    color: '#334155',
    flex: 1,
  },
});

