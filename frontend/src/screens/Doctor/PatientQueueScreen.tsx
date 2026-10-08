import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StatusBar,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchDoctorDashboard,
  callNextPatientApi,
  undoPatientApi,
  getCatalogPatient,
  ringRoomChimeApi,
  callSpecificTokenApi,
  DoctorDashboardData,
  PatientQueueItem,
} from '../../services/doctorService';

export default function PatientQueueScreen() {
  const { t } = useLanguage();
  const [data, setData] = useState<DoctorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'priority' | 'walkin'>('all');
  const [activeTab, setActiveTab] = useState<'home' | 'queue' | 'records' | 'schedule' | 'rx'>('queue');
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

      // Replenish upcoming queue if low so testing is unlimited
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

  const loadData = useCallback(async () => {
    try {
      const res = await fetchDoctorDashboard();
      if (res) {
        setData(res);
      }
    } catch (err) {
      console.log('Error loading patient queue:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // 1. Complete & Call Next Token
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

  // Undo previous patient
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

    // Local client-side fallback down to Token #001
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

  // 2. Recall / Ring Room Chime
  const handleRingRoomChime = async () => {
    const token = data?.currentPatient?.tokenNumber || 28;
    const room = data?.doctor?.room || 'Room 3B';
    try {
      const res = await ringRoomChimeApi(token, room);
      Alert.alert(t('Chime & Room Speaker'), res?.message || t("Chime broadcast: Token #{value0}, please enter {value1}", { value0: String(token), value1: String(room) }));
    } catch (err: any) {
      Alert.alert(t('Notice'), t("Ring chime sent to {value0} for Token #{value1}", { value0: String(room), value1: String(token) }));
    }
  };

  // 3. Call into Room directly for NEXT token (e.g. #029)
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

  // 4. Navigate to Patient Records
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

  // 4b. Patient card long press or full action
  const handlePatientAction = (patient: PatientQueueItem) => {
    Alert.alert(
      t("Token #{value0} - {value1}", { value0: String(String(patient.tokenNumber).padStart(3, '0')), value1: String(patient.patientName) }),
      t("Age: {value0}y, {value1}\nReason: {value2}\nStatus: {value3}", { value0: String(patient.age), value1: String(patient.gender), value2: String(patient.reason || 'Consultation'), value3: String(patient.status) }),
      [
        {
          text: 'Call Into Room',
          onPress: () => handleCallIntoRoom(patient.tokenNumber, patient.patientName),
        },
        { text: t('View Records'), onPress: () => handleViewPatientRecords(patient) },
        { text: t('Cancel'), style: 'cancel' },
      ]
    );
  };

  // Navigation tab press
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
    } else if (tab === 'records') {
      const activeP = data?.currentPatient;
      if (activeP) {
        try {
          router.push({
            pathname: '/(doctor)/records' as any,
            params: {
              patientId: (activeP as any).patientId || '',
              patientName: activeP.patientName,
              tokenNumber: String(activeP.tokenNumber),
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
      try {
        router.push('/(doctor)/prescription' as any);
      } catch (e) {
        router.push('/prescription' as any);
      }
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          router.push('/(doctor)/prescription' as any);
        }, 120);
      }
    }
  };

  if (loading && !data) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#0d6371" />
        <Text style={styles.loadingText}>{t("Loading Live Patient Queue...")}</Text>
      </SafeAreaView>
    );
  }

  const doctor = data?.doctor;
  const metrics = data?.metrics;
  const currentPatient = data?.currentPatient;
  const upcomingQueue = data?.upcomingQueue || [];

  // Filter items based on active pill
  const filteredQueue = upcomingQueue.filter((item) => {
    if (activeFilter === 'priority') {
      return item.priority === 'elderly' || item.priority === 'urgent' || item.category === 'priority';
    }
    if (activeFilter === 'walkin') {
      return item.priority === 'walkin' || item.category === 'walkin';
    }
    return true; // 'all'
  });

  // Next patient is the very first one in the queue
  const nextPatient = upcomingQueue[0];
  const nextTokenDisplay = nextPatient ? `#${String(nextPatient.tokenNumber).padStart(3, '0')}` : '#029';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* ---- TOP DOCTOR PROFILE BAR ---- */}
      <View style={styles.topProfileBar}>
        <View style={styles.profileLeft}>
          <View style={styles.avatarWrapper}>
            <Image
              source={{
                uri: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=200',
              }}
              style={styles.avatarImg}
            />
            <View style={styles.onlineStatusDotOnAvatar} />
          </View>
          <View style={styles.profileTextWrap}>
            <Text style={styles.profileName}>{doctor?.name || 'Dr. Emilia Emelson'}</Text>
            <View style={styles.onlineBadgeRow}>
              <View style={styles.onlineGreenDot} />
              <Text style={styles.onlineBadgeText}>{doctor?.room || 'Room 3B'} {t("Online")}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => Alert.alert(t('Notifications'), t('No new queue emergencies at this moment.'))}
        >
          <Ionicons name="notifications-outline" size={22} color="#1e293b" />
          <View style={styles.redBadgeDot} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0d6371']} />}
      >
        {/* ---- TEAL HERO BANNER WITH BADGES & TITLE ---- */}
        <View style={styles.tealBanner}>
          {/* Top badges row */}
          <View style={styles.bannerBadgesRow}>
            <TouchableOpacity
              onPress={() => router.push('/(doctor)/dashboard' as any)}
              style={styles.homeBackBtn}
              activeOpacity={0.7}
              accessibilityLabel={t("Back to Home")}
              accessibilityRole="button"
            >
              <Ionicons name="home" size={18} color="#ffffff" />
            </TouchableOpacity>
            <View style={styles.opdLiveBadge}>
              <View style={styles.mintDot} />
              <Text style={styles.opdLiveText}>{t("OPD CLINIC LIVE")}</Text>
            </View>

            <View style={styles.avgTimeBadge}>
              <Ionicons name="time-outline" size={14} color="#d1fae5" style={{ marginRight: 4 }} />
              <Text style={styles.avgTimeText}>{t("Avg.")}{' '}{doctor?.avgConsultMinutes || 9}{t("m / patient")}</Text>
            </View>
          </View>

          {/* Banner Title */}
          <Text style={styles.bannerTitle}>{t("Live Patient Queue")}</Text>

          {/* Subtitle with Room and Patients Waiting */}
          <View style={styles.bannerSubtitleRow}>
            <Ionicons name="business-outline" size={16} color="#cffafe" style={{ marginRight: 6 }} />
            <Text style={styles.bannerSubtitleText}>
              {doctor?.hospitalName || 'Colombo Teaching Hospital 1'} • {doctor?.room || 'Room 101'} • {metrics?.waitingCount ?? 14} {t("Waiting")}</Text>
          </View>

          {/* Quick Doctor Schedule Link Button */}
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.22)',
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 20,
              alignSelf: 'flex-start',
              marginTop: 10,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.4)',
            }}
            onPress={() => handleTabPress('schedule')}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={15} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={{ fontSize: 12, color: '#ffffff', fontWeight: '700' }}>
              {t("Open Doctor Schedule (Timeline) →")}</Text>
          </TouchableOpacity>
        </View>

        {/* ---- FLOATING "NOW IN CONSULTATION" CARD ---- */}
        <View style={styles.consultationCard}>
          {/* Top Row: Pill & Timer */}
          <View style={styles.cardTopRow}>
            <View style={styles.inConsultationPill}>
              <View style={styles.tealPulseDot} />
              <Text style={styles.inConsultationText}>{t("NOW IN CONSULTATION")}</Text>
            </View>

            <View style={styles.timerPill}>
              <Ionicons name="time-outline" size={14} color="#0d6371" style={{ marginRight: 4 }} />
              <Text style={styles.timerText}>{currentPatient?.calledAtTime || '08:47'}</Text>
            </View>
          </View>

          {/* Patient Details & Token #028 */}
          <View style={styles.patientInfoRow}>
            <View style={styles.patientDetailsCol}>
              <Text style={styles.patientName}>{currentPatient?.patientName || 'Kamal Gunaratne'}</Text>
              <View style={styles.complaintRow}>
                <MaterialCommunityIcons
                  name="stethoscope"
                  size={15}
                  color="#0d6371"
                  style={{ marginRight: 5, marginTop: 1 }}
                />
                <Text style={styles.complaintText}>
                  {currentPatient?.reason || t('Spine Checkup')} • {t(currentPatient?.gender ?? '') || t('Male')},{' '}
                  {currentPatient?.age || 48}y
                </Text>
              </View>
            </View>

            <View style={styles.tokenContainer}>
              <Text style={styles.tokenLabel}>{t("TOKEN")}</Text>
              <Text style={styles.tokenNumber}>
                #{currentPatient?.tokenNumber ? String(currentPatient.tokenNumber).padStart(3, '0') : '028'}
              </Text>
            </View>
          </View>

          {/* 3-Column Vitals Box */}
          <View style={styles.vitalsBox}>
            {/* Blood Pressure */}
            <View style={styles.vitalCol}>
              <Text style={styles.vitalLabel}>{t("Blood Pressure")}</Text>
              <Text style={styles.vitalValueDark}>{currentPatient?.bloodPressure || '124/82'}</Text>
            </View>

            {/* Heart Rate */}
            <View style={styles.vitalCol}>
              <Text style={styles.vitalLabel}>{t("Heart Rate")}</Text>
              <Text style={styles.vitalValueTeal}>{currentPatient?.heartRate || '76 bpm'}</Text>
            </View>

            {/* File REC */}
            <View style={styles.vitalCol}>
              <Text style={styles.vitalLabel}>{t("File")}</Text>
              <Text style={styles.vitalValueNavy}>{currentPatient?.fileRecord || 'REC-841'}</Text>
            </View>
          </View>

          {/* Action 1: Complete & Call Token #029 */}
          <TouchableOpacity
            style={styles.completeCallBtn}
            onPress={handleCompleteAndCallNext}
            disabled={isProcessing}
            activeOpacity={0.88}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="notifications" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.completeCallBtnText}>{t("Complete & Call Token")}{' '}{nextTokenDisplay}</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Action Row: Recall & Undo */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            {/* Action 2: Recall / Ring Room Chime */}
            <TouchableOpacity
              style={[styles.recallChimeBtn, { flex: 1, marginTop: 0 }]}
              onPress={handleRingRoomChime}
              activeOpacity={0.85}
            >
              <Ionicons name="volume-medium-outline" size={18} color="#0d6371" style={{ marginRight: 6 }} />
              <Text style={styles.recallChimeBtnText}>{t("Recall Chime")}</Text>
            </TouchableOpacity>

            {/* Action 3: Undo Previous Patient */}
            <TouchableOpacity
              style={[
                styles.recallChimeBtn,
                {
                  flex: 1,
                  marginTop: 0,
                  backgroundColor: (!data?.currentPatient || data.currentPatient.tokenNumber <= 1) ? '#f8fafc' : '#effbfa',
                  borderColor: (!data?.currentPatient || data.currentPatient.tokenNumber <= 1) ? '#e2e8f0' : '#b2ebf2',
                },
              ]}
              onPress={handleUndoPatient}
              disabled={isProcessing || !data?.currentPatient || data.currentPatient.tokenNumber <= 1}
              activeOpacity={0.85}
            >
              <Ionicons
                name="arrow-undo"
                size={18}
                color={(!data?.currentPatient || data.currentPatient.tokenNumber <= 1) ? '#94a3b8' : '#0d6371'}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.recallChimeBtnText,
                  (!data?.currentPatient || data.currentPatient.tokenNumber <= 1) && { color: '#94a3b8' },
                ]}
              >
                {t("Undo Previous")}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ---- CATEGORY FILTER PILLS ---- */}
        <View style={styles.filterPillsRow}>
          {/* All (14) */}
          <TouchableOpacity
            style={[styles.filterPill, activeFilter === 'all' && styles.filterPillActive]}
            onPress={() => setActiveFilter('all')}
          >
            <Text style={[styles.filterPillText, activeFilter === 'all' && styles.filterPillTextActive]}>
              {t("All (")}{upcomingQueue.length || 14})
            </Text>
          </TouchableOpacity>

          {/* Priority / Elderly (3) */}
          <TouchableOpacity
            style={[styles.filterPill, activeFilter === 'priority' && styles.filterPillActive]}
            onPress={() => setActiveFilter('priority')}
          >
            <Text style={[styles.filterPillText, activeFilter === 'priority' && styles.filterPillTextActive]}>
              {t("Priority / Elderly (3)")}</Text>
          </TouchableOpacity>

          {/* Walk-ins (5) */}
          <TouchableOpacity
            style={[styles.filterPill, activeFilter === 'walkin' && styles.filterPillActive]}
            onPress={() => setActiveFilter('walkin')}
          >
            <Text style={[styles.filterPillText, activeFilter === 'walkin' && styles.filterPillTextActive]}>
              {t("Walk-ins (5)")}</Text>
          </TouchableOpacity>
        </View>

        {/* ---- UPCOMING QUEUE SECTION HEADER ---- */}
        <View style={styles.queueHeaderRow}>
          <Text style={styles.queueHeaderTitle}>{t("Upcoming Queue")}</Text>
          <Text style={styles.estimatedWaitText}>
            {t("Estimated wait:")}{' '}{metrics?.estimatedWaitTime || '~42m'}
          </Text>
        </View>

        {/* ---- UPCOMING QUEUE LIST ---- */}
        <View style={styles.queueListContainer}>
          {filteredQueue.map((item, index) => {
            const isNext = index === 0 && activeFilter === 'all';

            // High-priority NEXT Card (#029 - Aurelia Sisca)
            if (isNext) {
              return (
                <View key={item.tokenNumber} style={styles.nextPatientCard}>
                  {/* Card Main Info Row */}
                  <TouchableOpacity
                    style={styles.nextCardMainRow}
                    onPress={() => handleViewPatientRecords(item)}
                    activeOpacity={0.75}
                  >
                    {/* Left Token Box */}
                    <View style={styles.nextBadgeBox}>
                      <Text style={styles.nextBadgeLabel}>{t("NEXT")}</Text>
                      <Text style={styles.nextBadgeNumber}>
                        #{String(item.tokenNumber).padStart(3, '0')}
                      </Text>
                    </View>

                    {/* Middle Info */}
                    <View style={styles.nextCardMiddle}>
                      <View style={styles.nameWithBadgeRow}>
                        <Text style={styles.nextPatientName}>{item.patientName}</Text>
                        <View style={styles.nextSmallPill}>
                          <Text style={styles.nextSmallPillText}>{t("Next")}</Text>
                        </View>
                      </View>
                      <Text style={styles.nextSubText}>
                        {t(item.gender ?? '')}, {item.age} {t("yrs •")}{' '}{item.reason || t('Post-op Inspection')}
                      </Text>
                    </View>

                    {/* Right Arrived / Lobby */}
                    <View style={styles.nextCardRight}>
                      <Text style={styles.readyLobbyText}>{item.location || t('Ready at Lobby')}</Text>
                      <Text style={styles.arrivedTimeText}>{t("Arrived")}{' '}{item.arrivedTime || '10:14'}</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Card Bottom: Vitals Verified & Call into Room */}
                  <View style={styles.nextCardBottomRow}>
                    <View style={styles.vitalsVerifiedRow}>
                      <Ionicons name="shield-checkmark" size={16} color="#0d9488" style={{ marginRight: 5 }} />
                      <Text style={styles.vitalsVerifiedText}>{t("Vitals Verified")}</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.callIntoRoomBtn}
                      onPress={() => handleCallIntoRoom(item.tokenNumber, item.patientName)}
                      disabled={isProcessing}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="enter-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                      <Text style={styles.callIntoRoomBtnText}>{t("Call into Room")}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }

            // Standard Patient Cards (#030 Rohan Mendis, #031 Dilshan Madushanka, #032 Sanduni Perera, etc.)
            return (
              <TouchableOpacity
                key={item.tokenNumber}
                style={styles.standardCard}
                onPress={() => handleViewPatientRecords(item)}
                activeOpacity={0.7}
              >
                {/* Left Token Box */}
                <View style={styles.standardTokenBox}>
                  <Text style={styles.standardTokenLabel}>{t("TOKEN")}</Text>
                  <Text style={styles.standardTokenNumber}>
                    #{String(item.tokenNumber).padStart(3, '0')}
                  </Text>
                </View>

                {/* Middle Patient Info */}
                <View style={styles.standardMiddle}>
                  <Text style={styles.standardPatientName}>{item.patientName}</Text>
                  <Text style={styles.standardSubText}>
                    {t(item.gender ?? '')}, {item.age} {t("yrs •")}{' '}{item.reason || t('Follow-up')}
                  </Text>

                  {/* Badges based on token */}
                  {item.tokenNumber === 30 || item.status === 'Checked In • Ready' ? (
                    <View style={styles.statusBadgeRow}>
                      <View style={styles.greenDotSmall} />
                      <Text style={styles.statusBadgeText}>{t("Checked In • Ready")}</Text>
                    </View>
                  ) : item.tokenNumber === 31 || item.status === 'X-Ray Ready' ? (
                    <View style={styles.xrayPill}>
                      <Ionicons name="document-text-outline" size={12} color="#0d9488" style={{ marginRight: 4 }} />
                      <Text style={styles.xrayPillText}>{t("X-Ray Ready")}</Text>
                    </View>
                  ) : (
                    <View style={styles.waitingPillRow}>
                      <Ionicons name="time-outline" size={13} color="#64748b" style={{ marginRight: 4 }} />
                      <Text style={styles.waitingPillText}>{t(item.status ?? '') || t('Waiting (18m)')}</Text>
                    </View>
                  )}
                </View>

                {/* Right Arrow Action */}
                <TouchableOpacity
                  style={styles.arrowCircleBtn}
                  onPress={() => handleViewPatientRecords(item)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="chevron-forward" size={18} color="#0284c7" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* ---- BOTTOM NAVIGATION BAR (5 TABS) ---- */}
      <View style={styles.bottomTabBar}>
        {/* Home */}
        <TouchableOpacity style={styles.tabItem} onPress={() => handleTabPress('home')}>
          <Ionicons name="home-outline" size={22} color={activeTab === 'home' ? '#0d6371' : '#64748b'} />
          <Text style={[styles.tabLabel, activeTab === 'home' && styles.tabLabelActive]}>{t("Home")}</Text>
        </TouchableOpacity>

        {/* Queue (Active) */}
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

        {/* Prescription */}
        <TouchableOpacity style={styles.tabItem} onPress={() => handleTabPress('rx')}>
          <MaterialCommunityIcons
            name="clipboard-edit-outline"
            size={22}
            color={activeTab === 'rx' ? '#0d6371' : '#64748b'}
          />
          <Text
            numberOfLines={1}
            style={[styles.tabLabel, activeTab === 'rx' && styles.tabLabelActive]}
          >
            {t("Prescription")}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6fafd',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#0d6371',
    fontWeight: '600',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  // 1. TOP PROFILE BAR
  topProfileBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e2e8f0',
  },
  onlineStatusDotOnAvatar: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  profileTextWrap: {
    marginLeft: 11,
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
    width: 7,
    height: 7,
    borderRadius: 3.5,
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
  },
  redBadgeDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },

  // 2. TEAL BANNER
  tealBanner: {
    backgroundColor: '#0f5b66',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 48,
  },
  homeBackBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  bannerBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  opdLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  mintDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#34d399',
    marginRight: 6,
  },
  opdLiveText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#a7f3d0',
    letterSpacing: 0.5,
  },
  avgTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avgTimeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#e0f2fe',
  },
  bannerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 14,
    letterSpacing: -0.4,
  },
  bannerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  bannerSubtitleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#cffafe',
  },

  // 3. FLOATING NOW IN CONSULTATION CARD
  consultationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 16,
    marginTop: -30,
    elevation: 4,
    shadowColor: 'rgba(15, 23, 42, 0.09)',
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 1,
    borderColor: '#e8f0f3',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  inConsultationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ccfbf1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  tealPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#0d9488',
    marginRight: 6,
  },
  inConsultationText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f766e',
    letterSpacing: 0.5,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f7fa',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0d6371',
  },
  patientInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  patientDetailsCol: {
    flex: 1,
    paddingRight: 10,
  },
  patientName: {
    fontSize: 21,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  complaintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  complaintText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  tokenContainer: {
    alignItems: 'flex-end',
  },
  tokenLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  tokenNumber: {
    fontSize: 27,
    fontWeight: '900',
    color: '#0d6371',
    lineHeight: 30,
    marginTop: 2,
  },
  vitalsBox: {
    backgroundColor: '#f1f8fa',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  vitalCol: {
    flex: 1,
  },
  vitalLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
  },
  vitalValueDark: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  vitalValueTeal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0d9488',
    marginTop: 2,
  },
  vitalValueNavy: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f5b66',
    marginTop: 2,
  },
  completeCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d6371',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 16,
    elevation: 2,
  },
  completeCallBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  recallChimeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0f2f7',
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 10,
  },
  recallChimeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0d6371',
  },

  // 4. FILTER PILLS
  filterPillsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 20,
    marginBottom: 16,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e8eff3',
  },
  filterPillActive: {
    backgroundColor: '#0d6371',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },

  // 5. QUEUE HEADER
  queueHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  queueHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  estimatedWaitText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0d9488',
  },

  // 6. QUEUE LIST
  queueListContainer: {
    paddingHorizontal: 16,
    gap: 10,
  },

  // Highlighted NEXT Patient Card (#029)
  nextPatientCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#0d6371',
    borderLeftWidth: 4,
    borderLeftColor: '#0d6371',
    elevation: 2,
    shadowColor: 'rgba(15, 23, 42, 0.05)',
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  nextCardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextBadgeBox: {
    backgroundColor: '#ccfbf1',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 62,
    marginRight: 12,
  },
  nextBadgeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0f766e',
  },
  nextBadgeNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0d6371',
    marginTop: 2,
  },
  nextCardMiddle: {
    flex: 1,
  },
  nameWithBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextPatientName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  nextSmallPill: {
    backgroundColor: '#e0f2fe',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  nextSmallPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0369a1',
  },
  nextSubText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
    fontWeight: '500',
  },
  nextCardRight: {
    alignItems: 'flex-end',
  },
  readyLobbyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f766e',
  },
  arrivedTimeText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  nextCardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  vitalsVerifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vitalsVerifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0d9488',
  },
  callIntoRoomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d6371',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  callIntoRoomBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Standard patient cards
  standardCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eef2f6',
    elevation: 1,
  },
  standardTokenBox: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
    marginRight: 12,
  },
  standardTokenLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
  },
  standardTokenNumber: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 2,
  },
  standardMiddle: {
    flex: 1,
  },
  standardPatientName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  standardSubText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  greenDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 5,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0d7685',
  },
  xrayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f7fa',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
  },
  xrayPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0d9488',
  },
  waitingPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  waitingPillText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  arrowCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },

  // 7. BOTTOM NAVIGATION BAR
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
});
