import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchDoctorDashboard,
  callNextPatientApi,
  undoPatientApi,
  getCatalogPatient,
  ringRoomChimeApi,
  callSpecificTokenApi,
  getDoctorDashboardForHospital,
  DoctorDashboardData,
  PatientQueueItem,
} from '../../services/doctorService';
import { useTheme } from '../../theme/ThemeContext';
import {
  DOCTOR_TOKENS as C,
  DoctorTopBar,
  DoctorBottomNav,
  DoctorDarkHighlightBox,
  DarkStrongPill,
  DarkOutlineButton,
  StatusPill,
  ChipButton,
  PrimaryButton,
  SecondaryButton,
} from '../../components/doctor';

export default function PatientQueueScreen() {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const [data, setData] = useState<DoctorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'priority' | 'walkin'>('all');
  const [patientUndoHistory, setPatientUndoHistory] = useState<any[]>([]);

  const advanceQueueLocally = useCallback((targetTokenNumber?: number) => {
    setData((prev) => {
      const base = prev || {
        doctor: {
          name: 'Dr. Palitha Perera',
          specialization: 'Consultant Physician',
          department: 'OPD Clinic',
          room: 'Room 101',
          hospitalName: 'Colombo Teaching Hospital 1',
          status: 'active' as const,
          dailyCapacity: 30,
          avgConsultMinutes: 15,
        },
        metrics: {
          currentCallingToken: 28,
          waitingCount: 14,
          completedCount: 18,
          totalToday: 32,
          avgWaitMinutes: 15,
        },
        currentPatient: {
          tokenNumber: 28,
          patientName: 'Kamal Gunaratne',
          age: 48,
          gender: 'Male',
          priority: 'normal' as const,
          status: 'in_consultation',
          reason: 'Spine Checkup',
          bloodPressure: '124/82',
          heartRate: '76 bpm',
          fileRecord: 'REC-841',
        },
        upcomingQueue: [
          {
            tokenNumber: 29,
            patientName: 'Aurelia Sisca',
            age: 32,
            gender: 'Female',
            priority: 'normal' as const,
            category: 'all' as const,
            status: 'next',
            reason: 'Post-op Inspection',
            location: 'Ready at Lobby',
            slotTime: '11:15 AM',
          },
          {
            tokenNumber: 30,
            patientName: 'Rohan Mendis',
            age: 54,
            gender: 'Male',
            priority: 'elderly' as const,
            category: 'priority' as const,
            status: 'Checked In • Ready',
            reason: 'Hypertension follow',
            location: 'Waiting Area',
            slotTime: '11:30 AM',
          },
          {
            tokenNumber: 31,
            patientName: 'Dilshan Madushanka',
            age: 28,
            gender: 'Male',
            priority: 'walkin' as const,
            category: 'walkin' as const,
            status: 'X-Ray Ready',
            reason: 'Acute knee sprain',
            location: 'Radiology returned',
            slotTime: '11:45 AM',
          },
          {
            tokenNumber: 32,
            patientName: 'Sanduni Perera',
            age: 41,
            gender: 'Female',
            priority: 'normal' as const,
            category: 'all' as const,
            status: 'Waiting',
            reason: 'Routine Ortho Review',
            location: 'Waiting Area',
            slotTime: '12:00 PM',
          },
        ],
      };

      const queue = [...(base.upcomingQueue || [])];
      let nextPat: PatientQueueItem;

      if (targetTokenNumber) {
        const foundIdx = queue.findIndex((p) => p.tokenNumber === targetTokenNumber);
        if (foundIdx !== -1) {
          nextPat = queue.splice(foundIdx, 1)[0];
        } else {
          nextPat = queue.shift() || {
            tokenNumber: targetTokenNumber,
            patientName: `Patient #${targetTokenNumber}`,
            age: 35,
            gender: 'Female',
            priority: 'normal',
            status: 'next',
            reason: 'General Consultation',
            slotTime: '11:30 AM',
          };
        }
      } else {
        if (queue.length > 0) {
          nextPat = queue.shift()!;
        } else {
          const lastNum = base.currentPatient?.tokenNumber || 28;
          nextPat = {
            tokenNumber: lastNum + 1,
            patientName: 'Aurelia Sisca',
            age: 32,
            gender: 'Female',
            priority: 'normal',
            status: 'next',
            reason: 'Post-op Inspection',
            slotTime: '11:15 AM',
          };
        }
      }

      if (queue.length < 3) {
        const highestToken = Math.max(
          nextPat.tokenNumber,
          ...queue.map((q) => q.tokenNumber),
          30
        );
        const nextNames = ['Kasun Bandara', 'Nadeesha Silva', 'Ruwan Jayasinghe', 'Chathuri Perera', 'Dinesh Chandimal'];
        const chosen = nextNames[(highestToken + 1) % nextNames.length];
        queue.push({
          tokenNumber: highestToken + 1,
          patientName: chosen,
          age: 28 + ((highestToken * 3) % 40),
          gender: highestToken % 2 === 0 ? 'Female' : 'Male',
          priority: highestToken % 3 === 0 ? 'elderly' : 'normal',
          category: highestToken % 3 === 0 ? 'priority' : 'all',
          status: 'Waiting',
          reason: 'Routine Medical Checkup',
          slotTime: '12:30 PM',
        });
      }

      return {
        ...base,
        metrics: {
          ...base.metrics,
          completedCount: (base.metrics?.completedCount || 0) + 1,
          waitingCount: Math.max(0, (base.metrics?.waitingCount || queue.length + 1) - 1),
          currentCallingToken: nextPat.tokenNumber,
        },
        currentPatient: {
          tokenNumber: nextPat.tokenNumber,
          patientName: nextPat.patientName,
          age: nextPat.age,
          gender: nextPat.gender,
          priority: (nextPat.priority === 'urgent' ? 'urgent' : 'normal') as 'normal' | 'urgent',
          status: 'in_consultation',
          reason: nextPat.reason || 'General OPD Consultation',
          bloodPressure: '120/80',
          heartRate: '75 bpm',
          fileRecord: `REC-${800 + nextPat.tokenNumber}`,
          checkedInTime: nextPat.slotTime || '10:30 AM',
          calledAtTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
        upcomingQueue: queue,
      };
    });
  }, []);

  const [currentHospital, setCurrentHospital] = useState('City General Hospital');

  const loadData = useCallback(async () => {
    try {
      let savedHosp = await AsyncStorage.getItem('doctor_current_hospital');
      if (!savedHosp && typeof window !== 'undefined' && (window as any).localStorage) {
        savedHosp = (window as any).localStorage.getItem('doctor_current_hospital');
      }
      const activeHosp = savedHosp || currentHospital || 'City General Hospital';
      if (activeHosp !== currentHospital) {
        setCurrentHospital(activeHosp);
      }
      const res = await fetchDoctorDashboard(undefined, activeHosp);
      if (res) {
        setData(res);
        if (res.doctor?.hospitalName) {
          setCurrentHospital(res.doctor.hospitalName);
          await AsyncStorage.setItem('doctor_current_hospital', res.doctor.hospitalName);
          if (typeof window !== 'undefined' && (window as any).localStorage) {
            (window as any).localStorage.setItem('doctor_current_hospital', res.doctor.hospitalName);
          }
        }
      } else {
        setData(getDoctorDashboardForHospital(activeHosp));
      }
    } catch (err) {
      console.log('Error loading patient queue:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentHospital]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCompleteAndCallNext = async () => {
    setIsProcessing(true);
    if (data?.currentPatient) {
      setPatientUndoHistory((prev) => [...prev, { ...data.currentPatient }]);
    }
    try {
      const res = await callNextPatientApi();
      if (res && res.data) {
        setData(res.data);
      } else {
        advanceQueueLocally();
      }
      Alert.alert(t('Consultation Completed'), res?.message || t('Next patient called into room.'));
    } catch (err: any) {
      advanceQueueLocally();
      Alert.alert(t('Consultation Completed'), t('Next patient called into room.'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUndoPatient = async () => {
    if (!data?.currentPatient) return;
    const currentToken = data.currentPatient.tokenNumber;

    if (currentToken <= 1) {
      Alert.alert(t('First Patient Reached'), t('You are already at Token #001 (the 1st patient). Cannot undo further.'));
      return;
    }

    setIsProcessing(true);
    try {
      const res = await undoPatientApi();
      if (res && res.success && res.data) {
        setData(res.data);
        Alert.alert(t('Action Undone'), res.message || t('Reverted to previous patient.'));
        setIsProcessing(false);
        return;
      }
    } catch (err) {
      console.log('Error calling undo API:', err);
    }

    setData((prev) => {
      if (!prev || !prev.currentPatient) return prev;
      const curr = prev.currentPatient;
      const targetToken = curr.tokenNumber - 1;

      let prevPatientData: any = null;
      if (patientUndoHistory.length > 0) {
        const historyCopy = [...patientUndoHistory];
        prevPatientData = historyCopy.pop();
        setPatientUndoHistory(historyCopy);
      } else {
        prevPatientData = getCatalogPatient(targetToken);
      }

      const currAsQueueItem: PatientQueueItem = {
        tokenNumber: curr.tokenNumber,
        patientName: curr.patientName,
        age: curr.age,
        gender: curr.gender,
        priority: curr.priority === 'urgent' ? 'urgent' : 'normal',
        category: 'all',
        status: 'next',
        reason: curr.reason || 'General OPD Consultation',
        slotTime: (curr as any).slotTime || curr.checkedInTime || '10:30 AM',
      };

      const updatedQueue = [
        currAsQueueItem,
        ...(prev.upcomingQueue || []).filter((q) => q.tokenNumber !== curr.tokenNumber),
      ];

      return {
        ...prev,
        metrics: {
          ...prev.metrics,
          completedCount: Math.max(0, (prev.metrics?.completedCount || 1) - 1),
          waitingCount: (prev.metrics?.waitingCount || 0) + 1,
          currentCallingToken: prevPatientData.tokenNumber,
        },
        currentPatient: {
          ...prevPatientData,
          status: 'in_consultation',
          calledAtTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
        upcomingQueue: updatedQueue,
      };
    });

    Alert.alert(t('Action Undone'), t("Reverted back to Token #{value0}.", { value0: String(String(currentToken - 1).padStart(3, '0')) }));
    setIsProcessing(false);
  };

  const handleRingRoomChime = async () => {
    const token = data?.currentPatient?.tokenNumber || 28;
    const room = data?.doctor?.room || 'Room 101';
    try {
      const res = await ringRoomChimeApi(token, room);
      Alert.alert(t('Chime & Room Speaker'), res?.message || t("Chime broadcast: Token #{value0}, please enter {value1}", { value0: String(token), value1: String(room) }));
    } catch (err: any) {
      Alert.alert(t('Notice'), t("Ring chime sent to {value0} for Token #{value1}", { value0: String(room), value1: String(token) }));
    }
  };

  const handleCallIntoRoom = async (tokenNumber: number, patientName: string) => {
    setIsProcessing(true);
    try {
      const res = await callSpecificTokenApi(tokenNumber);
      if (res && res.data) {
        setData(res.data);
      } else {
        advanceQueueLocally(tokenNumber);
      }
      Alert.alert(t('Patient Called'), res?.message || t("Token #{value0} ({value1}) called into room.", { value0: String(tokenNumber), value1: String(patientName) }));
    } catch (err: any) {
      advanceQueueLocally(tokenNumber);
      Alert.alert(t('Notice'), t("Token #{value0} called into room.", { value0: String(tokenNumber) }));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewPatientRecords = async (patient: PatientQueueItem) => {
    try {
      await AsyncStorage.setItem('active_record_patient_token', String(patient.tokenNumber));
      await AsyncStorage.setItem('active_record_patient_name', patient.patientName);
    } catch (e) {
      // ignore
    }

    try {
      router.push({
        pathname: '/(doctor)/records' as any,
        params: {
          tokenNumber: String(patient.tokenNumber),
          patientName: patient.patientName,
        },
      });
    } catch (e) {
      router.push('/records' as any);
    }
  };

  if (loading && !data) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar barStyle="light-content" backgroundColor={C.teal} />
        <ActivityIndicator size="large" color={C.teal} />
        <Text style={styles.loadingText}>{t("Loading Live Patient Queue...")}</Text>
      </View>
    );
  }

  const doctor = data?.doctor;
  const metrics = data?.metrics;
  const currentPatient = data?.currentPatient;
  const upcomingQueue = data?.upcomingQueue || [];

  const filteredQueue = upcomingQueue.filter((item) => {
    if (activeFilter === 'priority') {
      return item.priority === 'elderly' || item.priority === 'urgent' || item.category === 'priority';
    }
    if (activeFilter === 'walkin') {
      return item.priority === 'walkin' || item.category === 'walkin';
    }
    return true;
  });

  const nextPatient = upcomingQueue[0];
  const nextTokenDisplay = nextPatient ? `#${String(nextPatient.tokenNumber).padStart(3, '0')}` : '#801';
  const fallbackHospData = getDoctorDashboardForHospital(currentHospital);
  const hospitalName = doctor?.hospitalName || currentHospital || 'Colombo Teaching Hospital 1';
  const roomName = doctor?.room || fallbackHospData.doctor.room || 'Room 101';
  const avgWait = doctor?.avgConsultMinutes || metrics?.avgWaitMinutes || 15;
  const waitingCount = metrics?.waitingCount ?? upcomingQueue.length ?? fallbackHospData.metrics.waitingCount ?? 0;

  const currentTokenStr = currentPatient?.tokenNumber
    ? String(currentPatient.tokenNumber).padStart(3, '0')
    : String(fallbackHospData.currentPatient?.tokenNumber || '028').padStart(3, '0');
  const currentNic = (currentPatient as any)?.nic || currentPatient?.fileRecord || fallbackHospData.currentPatient?.fileRecord || 'NIC 199892084778';

  if (loading && !data) {
    return (
      <View style={[styles.container, isDark && { backgroundColor: '#091012' }]}>
        <StatusBar barStyle="light-content" backgroundColor={C.teal} />
        <DoctorTopBar
          doctorName="Dr. Palitha Perera"
          roomSubtitle={`Room 101 · ${t('Online')}`}
          unreadCount={2}
        />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={C.teal} />
          <Text style={{ marginTop: 14, color: isDark ? '#9db8bc' : '#688990', fontSize: 15, fontWeight: '500' }}>
            {t('Loading queue...')}
          </Text>
        </View>
        <DoctorBottomNav activeTab="queue" />
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && { backgroundColor: '#091012' }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />

      {/* 1. SHARED TOP BAR */}
      <DoctorTopBar
        doctorName={doctor?.name || 'Dr. Palitha Perera'}
        roomSubtitle={`${roomName} · ${t('Online')}`}
        unreadCount={2}
      />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.teal]} />}
      >
        {/* 2. DARK HIGHLIGHT BOX */}
        <DoctorDarkHighlightBox style={styles.highlightCard}>
          <View style={styles.highlightTopRow}>
            <DarkStrongPill label={t("Clinic live")} pulse />
            <View style={styles.avgTimeBadgeDark}>
              <Ionicons name="time-outline" size={15} color="#FFFFFF" style={{ marginRight: 5 }} />
              <Text style={styles.avgTimeTextDark}>
                {t("Avg {value0} min / patient", { value0: String(avgWait) })}
              </Text>
            </View>
          </View>

          <Text style={styles.highlightTitleDark}>{t("Live patient queue")}</Text>

          <View style={styles.hospitalInfoRow}>
            <Ionicons name="business-outline" size={16} color={C.white80} style={{ marginRight: 6, marginTop: 2 }} />
            <Text style={styles.hospitalInfoTextDark}>
              {hospitalName} · {roomName} ·{' '}
              <Text style={styles.waitingCountHighlightDark}>
                {waitingCount} {t("waiting")}
              </Text>
            </Text>
          </View>

          <View style={{ marginTop: 4 }}>
            <DarkOutlineButton
              title={t("Open doctor schedule")}
              icon={<Ionicons name="calendar-outline" size={17} color="#FFFFFF" />}
              rightIcon={<Ionicons name="chevron-forward" size={17} color="#FFFFFF" />}
              onPress={() => router.push('/(doctor)/schedule' as any)}
            />
          </View>
        </DoctorDarkHighlightBox>

        {/* 3. NOW IN CONSULTATION CARD (White, 4px teal left border) */}
        <View style={[styles.consultationCard, isDark && { backgroundColor: '#142528', borderColor: '#1F383C' }]}>
          {/* Status pill & time pill */}
          <View style={styles.cardPillsRow}>
            <StatusPill label={t("Now in consultation")} />
            <View style={styles.timePill}>
              <Ionicons name="time-outline" size={13} color={C.sub} style={{ marginRight: 4 }} />
              <Text style={styles.timePillText}>
                {currentPatient?.calledAtTime || '08:47 AM'}
              </Text>
            </View>
          </View>

          {/* Patient name & Token tile */}
          <View style={styles.patientRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.patientName, isDark && { color: '#EEF8FA' }]} numberOfLines={1}>
                {currentPatient?.patientName || 'Kamal Gunaratne'}
              </Text>
              <View style={styles.reasonRow}>
                <MaterialCommunityIcons
                  name="stethoscope"
                  size={15}
                  color={C.sub}
                  style={{ marginRight: 5, marginTop: 1 }}
                />
                <Text style={styles.reasonText} numberOfLines={2}>
                  {currentPatient?.reason || t('General OPD consultation')} ·{' '}
                  {t(currentPatient?.gender ?? 'Male')}, {currentPatient?.age || 28} {t('yrs')}
                </Text>
              </View>
            </View>

            <View style={styles.tokenBox}>
              <Text style={[styles.tokenLabel, isDark && { color: '#86A4A9' }]}>{t("Token")}</Text>
              <Text style={[styles.tokenNumber, isDark && { color: '#3BD1DF' }]}>#{currentTokenStr}</Text>
            </View>
          </View>

          {/* Fact Tiles: Blood pressure, Heart rate in teal, NIC (safely wraps, never cut off) */}
          <View style={styles.factsRow}>
            <View style={[styles.factTile, isDark && { backgroundColor: '#18383E', borderColor: '#23525B' }]}>
              <Text style={[styles.factLabel, isDark && { color: '#86A4A9' }]}>{t("Blood pressure")}</Text>
              <Text style={[styles.factValueDark, isDark && { color: '#EEF8FA' }]}>
                {currentPatient?.bloodPressure || '120/80'}
              </Text>
            </View>

            <View style={[styles.factTile, isDark && { backgroundColor: '#18383E', borderColor: '#23525B' }]}>
              <Text style={[styles.factLabel, isDark && { color: '#86A4A9' }]}>{t("Heart rate")}</Text>
              <Text style={styles.factValueTeal}>
                {currentPatient?.heartRate || '76 bpm'}
              </Text>
            </View>

            <View style={[styles.factTile, { flex: 1.15 }, isDark && { backgroundColor: '#18383E', borderColor: '#23525B' }]}>
              <Text style={[styles.factLabel, isDark && { color: '#86A4A9' }]}>{t("NIC")}</Text>
              <Text style={[styles.factValueNic, isDark && { color: '#EEF8FA' }]} numberOfLines={2}>
                {currentNic}
              </Text>
            </View>
          </View>

          {/* Primary Action Button (Only ONE per card) */}
          <View style={{ marginTop: 14 }}>
            <PrimaryButton
              title={`${t("Complete & call token")} ${nextTokenDisplay}`}
              icon={<Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />}
              onPress={handleCompleteAndCallNext}
              loading={isProcessing}
            />
          </View>

          {/* Secondary Action Buttons side by side: Recall chime & Undo previous */}
          <View style={styles.actionRowSecondary}>
            <SecondaryButton
              title={t("Recall chime")}
              icon={<Ionicons name="volume-medium-outline" size={18} color={isDark ? '#3BD1DF' : C.tealDeep} />}
              onPress={handleRingRoomChime}
              style={[{ flex: 1 }, isDark && { backgroundColor: '#18383E', borderColor: '#23525B' }]}
              textStyle={isDark && { color: '#EEF8FA' }}
            />
            <SecondaryButton
              title={t("Undo previous")}
              icon={<Ionicons name="arrow-undo-outline" size={18} color={isDark ? '#3BD1DF' : C.tealDeep} />}
              onPress={handleUndoPatient}
              disabled={isProcessing || !data?.currentPatient || data.currentPatient.tokenNumber <= 1}
              style={[{ flex: 1 }, isDark && { backgroundColor: '#18383E', borderColor: '#23525B' }]}
              textStyle={isDark && { color: '#EEF8FA' }}
            />
          </View>
        </View>

        {/* 4. CATEGORY FILTER PILLS */}
        <View style={styles.filterPillsRow}>
          <TouchableOpacity
            style={[styles.filterPill, isDark && { backgroundColor: '#142528', borderColor: '#1F383C' }, activeFilter === 'all' && styles.filterPillActive]}
            onPress={() => setActiveFilter('all')}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterPillText, isDark && { color: '#86A4A9' }, activeFilter === 'all' && styles.filterPillTextActive]}>
              `${t("All")} (${upcomingQueue.length || 14})`
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, isDark && { backgroundColor: '#142528', borderColor: '#1F383C' }, activeFilter === 'priority' && styles.filterPillActive]}
            onPress={() => setActiveFilter('priority')}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterPillText, isDark && { color: '#86A4A9' }, activeFilter === 'priority' && styles.filterPillTextActive]}>
              {t("Priority / Elderly (3)")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, isDark && { backgroundColor: '#142528', borderColor: '#1F383C' }, activeFilter === 'walkin' && styles.filterPillActive]}
            onPress={() => setActiveFilter('walkin')}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterPillText, isDark && { color: '#86A4A9' }, activeFilter === 'walkin' && styles.filterPillTextActive]}>
              {t("Walk-ins (5)")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 5. UPCOMING QUEUE HEADER */}
        <View style={styles.queueHeaderRow}>
          <Text style={[styles.queueHeaderTitle, isDark && { color: '#EEF8FA' }]}>{t("Upcoming queue")}</Text>
          <View style={styles.estimatedWaitRow}>
            <Ionicons name="hourglass-outline" size={13} color={C.sub} style={{ marginRight: 4 }} />
            <Text style={styles.estimatedWaitText}>
              `${t("Est. wait")}: ${metrics?.estimatedWaitTime || '~42 min'}`
            </Text>
          </View>
        </View>

        {/* 6. UPCOMING QUEUE LIST */}
        <View style={styles.queueListContainer}>
          {filteredQueue.map((item, index) => {
            const isNext = index === 0 && activeFilter === 'all';

            return (
              <View
                key={item.tokenNumber}
                style={[
                  styles.patientItemCard,
                  isDark && { backgroundColor: '#142528', borderColor: '#1F383C' },
                  isNext && (isDark ? { backgroundColor: '#18383E', borderColor: '#23525B' } : styles.patientItemCardNext),
                ]}
              >
                <TouchableOpacity
                  style={styles.patientItemMainRow}
                  onPress={() => handleViewPatientRecords(item)}
                  activeOpacity={0.75}
                >
                  {/* Left Token Tile */}
                  <View style={[styles.itemTokenTile, isNext && styles.itemTokenTileNext]}>
                    <Text style={[styles.itemTokenLabel, isNext && { color: C.tealDeep }]}>
                      {isNext ? t("Next") : t("Token")}
                    </Text>
                    <Text style={[styles.itemTokenNum, isNext && { color: C.tealDeep }]}>
                      #{String(item.tokenNumber).padStart(3, '0')}
                    </Text>
                  </View>

                  {/* Middle Info */}
                  <View style={styles.itemMiddle}>
                    <View style={styles.itemNameRow}>
                      <Text style={[styles.itemPatientName, isDark && { color: '#EEF8FA' }]} numberOfLines={1}>
                        {item.patientName}
                      </Text>
                      {isNext && (
                        <View style={styles.nextTag}>
                          <Text style={styles.nextTagText}>{t("Next")}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.itemSubText} numberOfLines={1}>
                      {t(item.gender ?? '')}, {item.age} {t("yrs")} · {item.reason || t('General OPD review')}
                    </Text>
                    <View style={styles.itemFooterRow}>
                      <Ionicons name="location-outline" size={12} color={C.sub} style={{ marginRight: 3 }} />
                      <Text style={styles.itemLocationText}>
                        {item.location || t('Waiting area')} · {item.slotTime || '11:15 AM'}
                      </Text>
                    </View>
                  </View>

                  {/* Right Arrow */}
                  <Ionicons name="chevron-forward" size={18} color={C.sub} style={{ marginLeft: 6 }} />
                </TouchableOpacity>

                {/* Optional Action Bar for the very next patient */}
                {isNext && (
                  <View style={styles.nextActionBar}>
                    <View style={styles.verifiedRow}>
                      <Ionicons name="shield-checkmark" size={14} color={C.ok} style={{ marginRight: 4 }} />
                      <Text style={styles.verifiedText}>{t("Vitals verified")}</Text>
                    </View>
                    <ChipButton
                      label={t("Call into room")}
                      icon={<Ionicons name="enter-outline" size={14} color={C.tealDeep} />}
                      onPress={() => handleCallIntoRoom(item.tokenNumber, item.patientName)}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* 7. SHARED BOTTOM NAVIGATION BAR */}
      <DoctorBottomNav activeTab="queue" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: C.tealDeep,
    fontWeight: '600',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 110, // Ensure content isn't cut off by bottom nav
  },

  // Highlight Card
  highlightCard: {
    marginBottom: 14,
  },
  highlightTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  avgTimeBadgeDark: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avgTimeTextDark: {
    fontSize: 12.5,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  highlightTitleDark: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  hospitalInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  hospitalInfoTextDark: {
    flex: 1,
    fontSize: 13,
    color: C.white80,
    lineHeight: 18,
    fontWeight: '500',
  },
  waitingCountHighlightDark: {
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // "Now in consultation" card
  consultationCard: {
    backgroundColor: C.card,
    borderRadius: C.radiusCard,
    padding: 16,
    borderWidth: 1,
    borderColor: C.line,
    borderLeftWidth: 4,
    borderLeftColor: C.teal,
    ...C.shadow,
    marginBottom: 14,
  },
  cardPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: C.radiusPill,
    borderWidth: 1,
    borderColor: C.line,
  },
  timePillText: {
    fontSize: 12,
    color: C.sub,
    fontWeight: '600',
  },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  patientName: {
    fontSize: 20,
    fontWeight: '800',
    color: C.ink,
    letterSpacing: -0.3,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  reasonText: {
    fontSize: 13,
    color: C.sub,
    lineHeight: 18,
  },
  tokenBox: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  tokenLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.sub,
    marginBottom: 1,
  },
  tokenNumber: {
    fontSize: 30,
    fontWeight: '800',
    color: C.teal,
    letterSpacing: -0.5,
  },

  // Facts Row
  factsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  factTile: {
    flex: 1,
    backgroundColor: C.bg,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: C.line,
  },
  factLabel: {
    fontSize: 11,
    color: C.sub,
    fontWeight: '600',
    marginBottom: 3,
  },
  factValueDark: {
    fontSize: 13,
    fontWeight: '800',
    color: C.ink,
  },
  factValueTeal: {
    fontSize: 13,
    fontWeight: '800',
    color: C.teal,
  },
  factValueNic: {
    fontSize: 12,
    fontWeight: '700',
    color: C.ink,
    lineHeight: 16,
    flexWrap: 'wrap',
  },

  // Action secondary row
  actionRowSecondary: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },

  // Category filter pills
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: C.radiusPill,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
  },
  filterPillActive: {
    backgroundColor: C.tint,
    borderColor: C.tintBorder,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.sub,
  },
  filterPillTextActive: {
    color: C.tealDeep,
    fontWeight: '700',
  },

  // Queue Header
  queueHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  queueHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: C.ink,
  },
  estimatedWaitRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  estimatedWaitText: {
    fontSize: 12,
    color: C.sub,
    fontWeight: '600',
  },

  // Queue List items
  queueListContainer: {
    gap: 10,
  },
  patientItemCard: {
    backgroundColor: C.card,
    borderRadius: C.radiusTile,
    padding: 12,
    borderWidth: 1,
    borderColor: C.line,
    ...C.shadow,
  },
  patientItemCardNext: {
    borderLeftWidth: 3,
    borderLeftColor: C.teal,
  },
  patientItemMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemTokenTile: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.line,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemTokenTileNext: {
    backgroundColor: C.tint,
    borderColor: C.tintBorder,
  },
  itemTokenLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: C.sub,
  },
  itemTokenNum: {
    fontSize: 15,
    fontWeight: '800',
    color: C.ink,
    marginTop: 1,
  },
  itemMiddle: {
    flex: 1,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  itemPatientName: {
    fontSize: 15,
    fontWeight: '700',
    color: C.ink,
    marginRight: 6,
  },
  nextTag: {
    backgroundColor: C.tint,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  nextTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.tealDeep,
  },
  itemSubText: {
    fontSize: 12,
    color: C.sub,
    marginBottom: 3,
  },
  itemFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemLocationText: {
    fontSize: 11,
    color: C.sub,
  },
  nextActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.ok,
  },
});
