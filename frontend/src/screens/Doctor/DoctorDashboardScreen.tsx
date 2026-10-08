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
  Modal,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { notificationApi } from '../../services/notificationApi';
import {
  fetchDoctorDashboard,
  updateDoctorStatusApi,
  updateDoctorHospitalApi,
  fetchDoctorHospitalsApi,
  callNextPatientApi,
  undoPatientApi,
  addWalkInSlotApi,
  getCatalogPatient,
  DoctorDashboardData,
  PatientQueueItem,
} from '../../services/doctorService';

interface DoctorDashboardScreenProps {
  navigation?: any;
}

export default function DoctorDashboardScreen({ navigation }: DoctorDashboardScreenProps) {
  const { t } = useLanguage();
  const [data, setData] = useState<DoctorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'queue' | 'records' | 'schedule' | 'rx'>('home');
  const [currentHospital, setCurrentHospital] = useState<string>('Colombo Teaching Hospital 1');
  const [isHospitalModalOpen, setIsHospitalModalOpen] = useState(false);

  // Walk-in Registration Modal state
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [walkInName, setWalkInName] = useState('');
  const [walkInAge, setWalkInAge] = useState('');
  const [walkInGender, setWalkInGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [walkInPriority, setWalkInPriority] = useState<'walkin' | 'urgent' | 'normal'>('walkin');
  const [walkInReason, setWalkInReason] = useState('');
  const [isSubmittingWalkIn, setIsSubmittingWalkIn] = useState(false);
  const [availableHospitals, setAvailableHospitals] = useState<string[]>([
    'Colombo Teaching Hospital 1',
    'Colombo National Hospital',
    'City General Hospital',
  ]);
  const [patientUndoHistory, setPatientUndoHistory] = useState<any[]>([]);
  const [activeBreak, setActiveBreak] = useState<{
    type: 'tea' | 'lunch' | 'dinner';
    label: string;
    duration: string;
    minutes: number;
    hospitalId: string;
    hospitalName: string;
    shiftName: string;
    startTime: number;
  } | null>(null);

  const [unreadCount, setUnreadCount] = useState(0);

  const checkUnreadNotifications = async () => {
    setUnreadCount(0);
    try {
      setUnreadCount(await notificationApi.unreadCount());
    } catch (e) {
      console.log('Failed to fetch notifications', e);
    }
  };

  const loadActiveBreak = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('@medi_queue_doctor_break');
      if (raw) {
        setActiveBreak(JSON.parse(raw));
      } else {
        setActiveBreak(null);
      }
    } catch (e) {
      setActiveBreak(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadActiveBreak();
    }, [loadActiveBreak])
  );

  const handleEndActiveBreakFromDashboard = async () => {
    try {
      await AsyncStorage.removeItem('@medi_queue_doctor_break');
      setActiveBreak(null);
      if (data) {
        setData({
          ...data,
          doctor: { ...data.doctor, status: 'active' },
        });
        await updateDoctorStatusApi('active', data.doctor._id);
      }
      Alert.alert(t('Break Ended'), t('You have resumed your active shift.'));
    } catch (e) {
      console.log('Error ending break:', e);
    }
  };

  const loadData = useCallback(async () => {
    try {
      loadActiveBreak();
      let savedHospital = '';
      try {
        const storedHosp = await AsyncStorage.getItem('doctor_current_hospital');
        if (storedHosp) savedHospital = storedHosp;
        const userRaw = await AsyncStorage.getItem('user');
        if (userRaw && !savedHospital) {
          const u = JSON.parse(userRaw);
          if (u.hospitalName) savedHospital = u.hospitalName;
        }
      } catch (e) {}

      const res = await fetchDoctorDashboard();
      const hosp = savedHospital || res?.doctor?.hospitalName || 'Colombo Teaching Hospital 1';
      setCurrentHospital(hosp);
      setData(res);

      try {
        const dbHospitals = await fetchDoctorHospitalsApi();
        if (dbHospitals && dbHospitals.length > 0) {
          const names = dbHospitals.map((h: any) => h.name).filter(Boolean);
          setAvailableHospitals((prev) => Array.from(new Set([...names, ...prev])));
        }
      } catch (e) {}

      await checkUnreadNotifications();
    } catch (err) {
      console.log('Error loading dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadActiveBreak]);

  const handleSelectHospital = async (hospName: string) => {
    setCurrentHospital(hospName);
    setIsHospitalModalOpen(false);
    try {
      await AsyncStorage.setItem('doctor_current_hospital', hospName);
      if (data) {
        setData({
          ...data,
          doctor: {
            ...data.doctor,
            hospitalName: hospName,
          },
        });
      }
      await updateDoctorHospitalApi(hospName, undefined, data?.doctor?._id);
    } catch (e) {
      console.log('Error updating hospital:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      checkUnreadNotifications();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleToggleShift = async () => {
    if (!data) return;
    if (activeBreak) {
      await handleEndActiveBreakFromDashboard();
      return;
    }
    const newStatus = data.doctor.status === 'active' ? 'on_break' : 'active';
    setData({
      ...data,
      doctor: { ...data.doctor, status: newStatus },
    });
    await updateDoctorStatusApi(newStatus, data.doctor._id);
  };

  const advanceQueueLocally = useCallback(() => {
    setData((prev) => {
      if (!prev) return prev;
      const queue = [...(prev.upcomingQueue || [])];

      if (queue.length > 0) {
        const nextPat = queue.shift()!;
        return {
          ...prev,
          metrics: {
            ...prev.metrics,
            completedCount: (prev.metrics?.completedCount || 0) + 1,
            waitingCount: queue.length,
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
      }

      // No more patients waiting: Complete the last patient consultation
      return {
        ...prev,
        metrics: {
          ...prev.metrics,
          completedCount: (prev.metrics?.completedCount || 0) + 1,
          waitingCount: 0,
          currentCallingToken: 0,
        },
        currentPatient: null,
        upcomingQueue: [],
      };
    });
  }, []);

  const handleCompleteAndNext = async () => {
    setIsProcessing(true);
    if (data?.currentPatient) {
      setPatientUndoHistory((prev) => [...prev, { ...data.currentPatient! }]);
    }
    const isLast = (data?.upcomingQueue?.length || 0) === 0;
    try {
      const res = await callNextPatientApi();
      if (res && res.data) {
        setData(res.data);
      } else {
        advanceQueueLocally();
      }
      Alert.alert(
        isLast ? t('Queue Completed') : t('Consultation Completed'),
        isLast ? t('All patients completed for today!') : (res?.message || t('Advanced to next patient.'))
      );
    } catch (err: any) {
      advanceQueueLocally();
      Alert.alert(
        isLast ? t('Queue Completed') : t('Consultation Completed'),
        isLast ? t('All patients completed for today!') : t('Advanced to next patient.')
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUndoPatient = async () => {
    if (data?.currentPatient && data.currentPatient.tokenNumber <= 1) {
      Alert.alert('First Patient Reached', 'You are already at Token #001 (the 1st patient). Cannot undo further.');
      return;
    }

    if (!data?.currentPatient && patientUndoHistory.length === 0 && (!data?.metrics?.completedCount || data.metrics.completedCount <= 0)) {
      Alert.alert('Nothing to Undo', 'No completed consultations to undo.');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await undoPatientApi();
      if (res && res.success && res.data) {
        setData(res.data);
        Alert.alert('Action Undone', res.message || 'Reverted to previous patient.');
        setIsProcessing(false);
        return;
      }
    } catch (err) {
      console.log('Error calling undo API:', err);
    }

    // Local client-side fallback (guarantees undo all the way down to Token #001 even offline)
    let restoredToken = 1;
    setData((prev) => {
      if (!prev) return prev;
      const curr = prev.currentPatient;

      let prevPatientData: any = null;
      if (patientUndoHistory.length > 0) {
        const historyCopy = [...patientUndoHistory];
        prevPatientData = historyCopy.pop();
        setPatientUndoHistory(historyCopy);
      } else {
        const targetToken = curr ? curr.tokenNumber - 1 : (prev.metrics?.completedCount || 28);
        prevPatientData = getCatalogPatient(Math.max(1, targetToken));
      }
      restoredToken = prevPatientData.tokenNumber;

      let updatedQueue = [...(prev.upcomingQueue || [])];
      if (curr) {
        const currAsQueueItem: PatientQueueItem = {
          tokenNumber: curr.tokenNumber,
          patientName: curr.patientName,
          age: curr.age,
          gender: curr.gender,
          priority: curr.priority === 'urgent' ? 'urgent' : 'normal',
          category: 'all',
          status: 'next',
          reason: curr.reason || 'General OPD Consultation',
          slotTime: curr.checkedInTime || '10:30 AM',
        };

        updatedQueue = [
          currAsQueueItem,
          ...updatedQueue.filter((q) => q.tokenNumber !== curr.tokenNumber),
        ];
      }

      return {
        ...prev,
        metrics: {
          ...prev.metrics,
          completedCount: Math.max(0, (prev.metrics?.completedCount || 1) - 1),
          waitingCount: updatedQueue.length,
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

    Alert.alert('Action Undone', `Reverted back to Token #${String(restoredToken).padStart(3, '0')}.`);
    setIsProcessing(false);
  };

  const handleCallNext = async () => {
    setIsProcessing(true);
    try {
      const res = await callNextPatientApi();
      if (res && res.data) {
        setData(res.data);
      } else {
        advanceQueueLocally();
      }
      Alert.alert(t('Queue Called'), res?.message || t('Next token called!'));
    } catch (err: any) {
      advanceQueueLocally();
      Alert.alert(t('Queue Called'), t('Next token called!'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenWalkInModal = () => {
    setWalkInName('');
    setWalkInAge('');
    setWalkInGender('Male');
    setWalkInPriority('walkin');
    setWalkInReason('');
    setIsWalkInModalOpen(true);
  };

  const handleRegisterWalkIn = async () => {
    const trimmedName = walkInName.trim();
    if (!trimmedName) {
      Alert.alert('Required Field', 'Please enter patient full name.');
      return;
    }

    setIsSubmittingWalkIn(true);
    try {
      const res = await addWalkInSlotApi({
        patientName: trimmedName,
        age: walkInAge ? Number(walkInAge) : 35,
        gender: walkInGender,
        priority: walkInPriority,
        reason: walkInReason.trim() || 'Walk-in OPD Consultation',
      });

      if (res && res.data) {
        setData(res.data);
      } else {
        // Client-side fallback update
        setData((prev) => {
          if (!prev) return prev;
          const currentTokens = [
            prev.currentPatient?.tokenNumber || 0,
            ...prev.upcomingQueue.map((q) => q.tokenNumber || 0),
          ];
          const nextToken = Math.max(28, ...currentTokens) + 1;
          const newPatient: PatientQueueItem = {
            tokenNumber: nextToken,
            patientName: trimmedName,
            age: walkInAge ? Number(walkInAge) : 35,
            gender: walkInGender,
            priority: walkInPriority === 'urgent' ? 'urgent' : 'walkin',
            category: 'walkin',
            status: 'Waiting',
            reason: walkInReason.trim() || 'Walk-in OPD Consultation',
            slotTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };

          const newQueue =
            walkInPriority === 'urgent'
              ? [newPatient, ...prev.upcomingQueue]
              : [...prev.upcomingQueue, newPatient];

          return {
            ...prev,
            metrics: {
              ...prev.metrics,
              waitingCount: newQueue.length,
            },
            upcomingQueue: newQueue,
          };
        });
      }

      Alert.alert(
        'Walk-in Added',
        res?.message || `Patient ${trimmedName} has been registered and added to the queue.`
      );
      setIsWalkInModalOpen(false);
      setWalkInName('');
      setWalkInAge('');
      setWalkInReason('');
    } catch (err: any) {
      console.log('Error registering walk-in patient:', err);
      Alert.alert('Error', 'Failed to register walk-in patient.');
    } finally {
      setIsSubmittingWalkIn(false);
    }
  };

  const handleRemoveQueuePatient = (tokenNumber: number, patientName: string) => {
    Alert.alert(
      'Remove Patient',
      `Are you sure you want to remove ${patientName} (Token #${String(tokenNumber).padStart(3, '0')}) from today's queue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setData((prev) => {
              if (!prev) return prev;
              const updatedQueue = prev.upcomingQueue.filter((p) => p.tokenNumber !== tokenNumber);
              return {
                ...prev,
                metrics: {
                  ...prev.metrics,
                  waitingCount: updatedQueue.length,
                },
                upcomingQueue: updatedQueue,
              };
            });
            Alert.alert('Patient Removed', `${patientName} has been removed from today's queue.`);
          },
        },
      ]
    );
  };

  const handleTabPress = (tab: 'home' | 'queue' | 'records' | 'schedule' | 'rx') => {
    setActiveTab(tab);
    if (tab === 'queue') {
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
        <Text style={styles.loadingText}>{t("Loading Doctor Dashboard...")}</Text>
      </SafeAreaView>
    );
  }

  const doctor = data?.doctor;
  const metrics = data?.metrics;
  const currentPatient = data?.currentPatient;
  const upcomingQueue = data?.upcomingQueue || [];
  const completedCount = metrics?.completedCount !== undefined ? metrics.completedCount : 18;
  const allSeenCompletedCount = metrics?.completedCount !== undefined && metrics.completedCount > 0 ? metrics.completedCount : 38;
  const totalCapacity = doctor?.dailyCapacity || 32;
  const progressRatio = Math.min(1, completedCount / totalCapacity);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Main Content Area */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0d6371']} />}
      >
        {/* ---- 1. TOP PROFILE APP BAR ---- */}
        <View style={styles.topProfileBar}>
          <View style={styles.profileLeft}>
            <Image
              source={{
                uri: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=200',
              }}
              style={styles.avatarImg}
            />
            <View style={styles.profileTextWrap}>
              <Text style={styles.profileName}>{doctor?.name || 'Dr. Emilia Emelson'}</Text>
              <View style={styles.onlineBadgeRow}>
                <View style={styles.onlineGreenDot} />
                <Text style={styles.onlineBadgeText}>{doctor?.room || 'Room 3B'} {t('Online')}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => router.push('/notifications')}
          >
            <Ionicons name="notifications-outline" size={22} color="#334155" />
            {unreadCount > 0 && (
              <View style={{
                position: 'absolute', top: 4, right: 4, backgroundColor: 'red', borderRadius: 10,
                width: 16, height: 16, justifyContent: 'center', alignItems: 'center', zIndex: 10
              }}>
                <Text style={{ color: 'white', fontSize: 9, fontWeight: 'bold' }}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ---- 2. GREETING & SHIFT STATUS ROW ---- */}
        <View style={styles.greetingRow}>
          <View style={styles.greetingLeft}>
            <Text style={styles.greetingTitle}>
              {t("Good morning, Dr.")}{'\n'}
              {doctor?.name ? doctor.name.replace(/^Dr\.\s*/i, '').split(' ')[0] : 'Palitha'}
            </Text>
            <View style={styles.departmentBadge}>
              <Ionicons name="business-outline" size={14} color="#0d6371" style={{ marginRight: 5 }} />
              <Text style={styles.departmentText}>
                {doctor?.department || t('No department')} • {doctor?.room || 'Room 3B'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.shiftBadgeBtn,
              (activeBreak || doctor?.status !== 'active') && styles.shiftBadgeBtnBreak,
            ]}
            onPress={handleToggleShift}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.shiftDot,
                (activeBreak || doctor?.status !== 'active') && styles.shiftDotBreak,
              ]}
            />
            <Text
              style={[
                styles.shiftBadgeText,
                (activeBreak || doctor?.status !== 'active') && styles.shiftBadgeTextBreak,
              ]}
            >
              {activeBreak
                ? `${activeBreak.label} (${activeBreak.duration})`
                : doctor?.status === 'active'
                  ? t('Active Shift')
                  : t('On Break')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ---- CURRENT ACTIVE HOSPITAL CARD ---- */}
        <TouchableOpacity
          style={styles.hospitalCard}
          activeOpacity={0.88}
          onPress={() => setIsHospitalModalOpen(true)}
        >
          <View style={styles.hospitalIconCircle}>
            <MaterialCommunityIcons name="hospital-building" size={24} color="#0d6371" />
          </View>
          <View style={styles.hospitalInfoWrap}>
            <View style={styles.hospitalLabelRow}>
              <Text style={styles.hospitalLabelText}>CURRENT HOSPITAL</Text>
              <View style={styles.hospitalActivePill}>
                <View style={styles.activeDot} />
                <Text style={styles.hospitalActivePillText}>Active Duty</Text>
              </View>
            </View>
            <Text style={styles.hospitalTitleText} numberOfLines={1}>
              {currentHospital}
            </Text>
            <View style={styles.hospitalDeptRow}>
              <Ionicons name="business-outline" size={13} color="#0d6371" style={{ marginRight: 4 }} />
              <Text style={styles.hospitalDeptText}>
                {doctor?.department || 'General OPD'} • {doctor?.room || 'Room 101'}
              </Text>
            </View>
          </View>
          <View style={styles.hospitalChangeIconWrap}>
            <Ionicons name="swap-horizontal" size={18} color="#0d6371" />
          </View>
        </TouchableOpacity>

        {/* ---- ACTIVE BREAK ALERT CARD ---- */}
        {activeBreak && (
          <View style={styles.dashboardBreakCard}>
            <View style={styles.dashboardBreakLeft}>
              <View style={styles.dashboardBreakIconWrap}>
                <Ionicons
                  name={
                    activeBreak.type === 'lunch' || activeBreak.type === 'dinner'
                      ? 'restaurant'
                      : 'cafe'
                  }
                  size={20}
                  color="#b45309"
                />
              </View>
              <View style={styles.dashboardBreakTextWrap}>
                <View style={styles.dashboardBreakTitleRow}>
                  <Text style={styles.dashboardBreakTitle}>{activeBreak.label}</Text>
                  <View style={styles.dashboardBreakLivePill}>
                    <View style={styles.dashboardBreakLiveDot} />
                    <Text style={styles.dashboardBreakLiveText}>On Break</Text>
                  </View>
                </View>
                <Text style={styles.dashboardBreakSub}>
                  {activeBreak.duration} • {activeBreak.shiftName || 'Morning Shift'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.dashboardEndBreakBtn}
              onPress={handleEndActiveBreakFromDashboard}
              activeOpacity={0.8}
            >
              <Text style={styles.dashboardEndBreakBtnText}>End Break</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ---- 3. METRICS ROW (2 Side-by-Side Cards) ---- */}
        <View style={styles.metricsRow}>
          {/* Patients Waiting */}
          <View style={styles.metricCard}>
            <View style={styles.metricCardTop}>
              <Text style={styles.metricLabel}>{t("Patients Waiting")}</Text>
              <View style={styles.metricIconWrap}>
                <Ionicons name="people-outline" size={18} color="#0d6371" />
              </View>
            </View>
            <View style={styles.metricNumberRow}>
              <Text style={styles.metricBigNumber}>{metrics?.waitingCount ?? 0}</Text>
              <Text style={styles.metricDeltaText}>{metrics?.waitingCount !== undefined ? t("+3 since 10am") : t("From database")}</Text>
            </View>
            <View style={styles.metricFooter}>
              <Ionicons name="time-outline" size={13} color="#64748b" style={{ marginRight: 4 }} />
              <Text style={styles.metricFooterText}>{t("Avg wait")}{' '}{metrics?.avgWaitMinutes ?? 15} {t("min")}</Text>
            </View>
          </View>

          {/* Completed Today */}
          <View style={styles.metricCard}>
            <View style={styles.metricCardTop}>
              <Text style={styles.metricLabel}>{t("Completed Today")}</Text>
              <View style={styles.metricIconWrap}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#0d6371" />
              </View>
            </View>
            <View style={styles.metricNumberRow}>
              <Text style={styles.metricBigNumber}>{completedCount}</Text>
              <Text style={styles.metricTotalText}> / {totalCapacity}</Text>
            </View>
            {/* Progress Bar */}
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${progressRatio * 100}%` }]} />
            </View>
          </View>
        </View>

        {/* ---- 4. IN CONSULTATION / ALL PATIENTS SEEN HERO CARD ---- */}
        {!currentPatient ? (
          <View style={styles.allSeenCard}>
            <View style={styles.allSeenHeader}>
              <View style={styles.allSeenPill}>
                <Ionicons name="checkmark-done-circle" size={14} color="#059669" style={{ marginRight: 5 }} />
                <Text style={styles.allSeenPillText}>{t("ALL PATIENTS SEEN")}</Text>
              </View>

              <TouchableOpacity
                style={styles.headerUndoBadge}
                onPress={handleUndoPatient}
                disabled={isProcessing}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-undo" size={12} color="#0d6371" style={{ marginRight: 3 }} />
                <Text style={styles.headerUndoBadgeText}>{t("Undo")}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.allSeenCenterContent}>
              <View style={styles.allSeenIconCircle}>
                <Ionicons name="checkmark-done" size={32} color="#059669" />
              </View>
              <Text style={styles.allSeenTitle}>✅ {t("All patients seen")}</Text>
              <Text style={styles.allSeenSubtitle}>
                {allSeenCompletedCount} {t("completed today • Queue is empty")}
              </Text>
            </View>

            <View style={styles.allSeenActionsRow}>
              <TouchableOpacity
                style={styles.allSeenUndoButton}
                onPress={handleUndoPatient}
                disabled={isProcessing}
                activeOpacity={0.75}
              >
                <Ionicons name="arrow-undo" size={16} color="#0d6371" style={{ marginRight: 6 }} />
                <Text style={styles.allSeenUndoButtonText}>{t("Undo Last Consultation")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.consultationCard}>
            {/* Card Top Pill & Timer */}
            <View style={styles.consultationHeader}>
              <View style={styles.inConsultationPill}>
                <View style={styles.tealPulseDot} />
                <Text style={styles.inConsultationText}>{t("IN CONSULTATION")}</Text>
              </View>

              <View style={styles.headerRightControls}>
                {currentPatient.tokenNumber > 1 && (
                  <TouchableOpacity
                    style={styles.headerUndoBadge}
                    onPress={handleUndoPatient}
                    disabled={isProcessing}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="arrow-undo" size={12} color="#0d6371" style={{ marginRight: 3 }} />
                    <Text style={styles.headerUndoBadgeText}>{t("Undo")}</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.timerWrap}>
                  <Ionicons name="time-outline" size={14} color="#0d6371" style={{ marginRight: 4 }} />
                  <Text style={styles.timerText}>{currentPatient.calledAtTime || '08:47'}</Text>
                </View>
              </View>
            </View>

            {/* Patient Details & Token Shield */}
            <View style={styles.patientInfoRow}>
              <View style={styles.patientDetailsCol}>
                <View style={styles.patientNameRow}>
                  <Text style={styles.patientNameText}>{currentPatient.patientName || t('Kamal Gunaratne')}</Text>
                  <View style={styles.genderPill}>
                    <Text style={styles.genderText}>{t(currentPatient.gender || 'Male')}</Text>
                  </View>
                </View>
                <Text style={styles.complaintText}>
                  {currentPatient.reason || t('Spine checkup')} • {currentPatient.age || 46} {t("yrs")}
                </Text>

                {/* Vitals Tags */}
                <View style={styles.vitalsRow}>
                  <View style={styles.vitalTag}>
                    <Text style={styles.vitalTagText}>BP: {currentPatient.bloodPressure || '120/80 mmHg'}</Text>
                  </View>
                  <View style={styles.vitalTag}>
                    <Text style={styles.vitalTagText}>HR: {currentPatient.heartRate || '75 bpm'}</Text>
                  </View>
                </View>
              </View>

              {/* Token Badge */}
              <View style={styles.tokenShield}>
                <Text style={styles.tokenShieldLabel}>{t("TOKEN")}</Text>
                <Text style={styles.tokenShieldNumber}>
                  #{String(currentPatient.tokenNumber).padStart(3, '0')}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.consultationActions}>
              {/* Undo Button - allows undoing all the way to Token #001 */}
              <TouchableOpacity
                style={[
                  styles.undoButton,
                  currentPatient.tokenNumber <= 1 && styles.undoButtonDisabled,
                ]}
                onPress={handleUndoPatient}
                disabled={isProcessing || currentPatient.tokenNumber <= 1}
                activeOpacity={0.75}
              >
                <Ionicons
                  name="arrow-undo"
                  size={16}
                  color={currentPatient.tokenNumber <= 1 ? '#94a3b8' : '#0d6371'}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.undoButtonText,
                    currentPatient.tokenNumber <= 1 && styles.undoButtonTextDisabled,
                  ]}
                >
                  {t("Undo")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.rxButton}
                onPress={() => handleTabPress('rx')}
              >
                <Ionicons name="document-text-outline" size={16} color="#0d6371" style={{ marginRight: 5 }} />
                <Text style={styles.rxButtonText}>{t("Rx Prescribe")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.completeNextButton}
                onPress={handleCompleteAndNext}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons
                      name={upcomingQueue.length === 0 ? 'checkmark-circle' : 'checkmark-done-circle'}
                      size={16}
                      color="#ffffff"
                      style={{ marginRight: 5 }}
                    />
                    <Text style={styles.completeNextText}>
                      {upcomingQueue.length === 0 ? t('Complete') : t('Complete & Next')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ---- 5. QUICK ACTIONS SECTION ---- */}
        <Text style={styles.sectionHeaderTitle}>{t("QUICK ACTIONS")}</Text>
        <View style={styles.quickActionsGrid}>
          {/* Call Next */}
          <TouchableOpacity style={styles.quickActionCard} onPress={handleCallNext} disabled={isProcessing}>
            <View style={styles.quickActionIconCircle}>
              <Ionicons name="volume-medium-outline" size={22} color="#0d6371" />
            </View>
            <Text style={styles.quickActionLabel}>{t("Call Next")}</Text>
          </TouchableOpacity>

          {/* Add Walk-in */}
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={handleOpenWalkInModal}
            activeOpacity={0.75}
          >
            <View style={styles.quickActionIconCircle}>
              <Ionicons name="person-add-outline" size={20} color="#0d6371" />
            </View>
            <Text style={styles.quickActionLabel}>{t("Add Walk-in")}</Text>
          </TouchableOpacity>

          {/* Break Action */}
          <TouchableOpacity
            style={[
              styles.quickActionCard,
              activeBreak && { backgroundColor: '#fef3c7', borderColor: '#fcd34d' },
            ]}
            onPress={activeBreak ? handleEndActiveBreakFromDashboard : handleToggleShift}
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.quickActionIconCircle,
                activeBreak && { backgroundColor: '#fde68a' },
              ]}
            >
              <Ionicons
                name={
                  activeBreak?.type === 'lunch' || activeBreak?.type === 'dinner'
                    ? 'restaurant-outline'
                    : 'cafe-outline'
                }
                size={20}
                color={activeBreak ? '#b45309' : '#0d6371'}
              />
            </View>
            <Text
              style={[
                styles.quickActionLabel,
                activeBreak && { color: '#b45309', fontWeight: '700' },
              ]}
              numberOfLines={1}
            >
              {activeBreak ? t('End Break') : t('15m Break')}
            </Text>
          </TouchableOpacity>

          {/* My Schedule */}
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => router.push('/(doctor)/schedule')}
          >
            <View style={[styles.quickActionIconCircle, { backgroundColor: '#e0f6f8' }]}>
              <MaterialCommunityIcons name="calendar-month-outline" size={20} color="#0d6371" />
            </View>
            <Text style={[styles.quickActionLabel, { fontWeight: '700', color: '#0d6371' }]}>{t("Schedule")}</Text>
          </TouchableOpacity>
        </View>

        {/* ---- 6. UP NEXT IN QUEUE SECTION ---- */}
        <View style={styles.queueHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>{t("UP NEXT IN QUEUE")}</Text>
          <TouchableOpacity onPress={() => router.push('/(doctor)/queue')}>
            <Text style={styles.fullQueueLink}>{t("Full Queue >")}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.queueList}>
          {upcomingQueue.length === 0 ? (
            <View style={styles.emptyQueueCard}>
              <View style={styles.emptyQueueIconCircle}>
                <Ionicons name="people-outline" size={24} color="#0d6371" />
              </View>
              <Text style={styles.emptyQueueTitle}>{t("No patients waiting")}</Text>
              <Text style={styles.emptyQueueSubtitle}>
                {t("The queue is empty. Next patients will appear here once registered.")}
              </Text>
            </View>
          ) : (
            upcomingQueue.map((item, index) => (
              <View key={index} style={styles.queueItemCard}>
                {/* TKN Box */}
                <View style={styles.tknBox}>
                  <Text style={styles.tknLabel}>{t("TKN")}</Text>
                  <Text style={styles.tknNumber}>{String(item.tokenNumber).padStart(3, '0')}</Text>
                </View>

                {/* Patient Info */}
                <View style={styles.queueItemInfo}>
                  <Text style={styles.queueItemName}>{item.patientName}</Text>
                  <Text style={styles.queueItemSub}>
                    {index === 0 ? t('Post-op Check') : t('Hypertension Follow-up')} • {item.age} {t("yrs")}
                  </Text>
                </View>

                {/* Time Pill & Options */}
                <View style={styles.queueItemRight}>
                  <View style={styles.timePill}>
                    <Text style={styles.timePillText}>{item.slotTime || (index === 0 ? '11:15 AM' : '11:30 AM')}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      Alert.alert(
                        `${item.patientName} (Token #${String(item.tokenNumber).padStart(3, '0')})`,
                        t('Select an option for this patient in the queue:'),
                        [
                          { text: t('Cancel'), style: 'cancel' },
                          {
                            text: t('Remove from Queue'),
                            style: 'destructive',
                            onPress: () => handleRemoveQueuePatient(item.tokenNumber, item.patientName),
                          },
                        ]
                      )
                    }
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="ellipsis-vertical" size={17} color="#94a3b8" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* ---- 7. BOTTOM NAVIGATION BAR (5 TABS) ---- */}
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

      {/* Hospital Switcher Modal */}
      <Modal
        visible={isHospitalModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsHospitalModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsHospitalModalOpen(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <MaterialCommunityIcons name="hospital-building" size={22} color="#0d6371" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Select Hospital Duty</Text>
              </View>
              <TouchableOpacity onPress={() => setIsHospitalModalOpen(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Select the hospital you are currently stationed at for OPD patient consultations.
            </Text>

            <View style={styles.modalHospitalList}>
              {availableHospitals.map((hosp, idx) => {
                const isSelected = currentHospital === hosp;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.modalHospitalItem, isSelected && styles.modalHospitalItemSelected]}
                    onPress={() => handleSelectHospital(hosp)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.modalHospitalItemLeft}>
                      <View style={[styles.modalItemIconCircle, isSelected && styles.modalItemIconCircleSelected]}>
                        <Ionicons
                          name="business"
                          size={18}
                          color={isSelected ? '#0d6371' : '#64748b'}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.modalHospitalItemName, isSelected && styles.modalHospitalItemNameSelected]} numberOfLines={1}>
                          {hosp}
                        </Text>
                        <Text style={styles.modalHospitalItemSub}>
                          {isSelected ? 'Currently Stationed • Active' : 'Tap to switch location'}
                        </Text>
                      </View>
                    </View>
                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={22} color="#0d6371" />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Walk-in Registration Modal */}
      <Modal
        visible={isWalkInModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsWalkInModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsWalkInModalOpen(false)}
        >
          <View style={styles.walkInModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <View style={styles.walkInHeaderIconCircle}>
                  <Ionicons name="person-add" size={18} color="#0d6371" />
                </View>
                <Text style={styles.modalTitle}>Add Walk-in Patient</Text>
              </View>
              <TouchableOpacity onPress={() => setIsWalkInModalOpen(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Register an unscheduled or emergency walk-in patient directly to today's queue.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* Patient Full Name */}
              <View style={styles.walkInFieldGroup}>
                <Text style={styles.walkInFieldLabel}>Patient Full Name *</Text>
                <TextInput
                  style={styles.walkInTextInput}
                  placeholder="e.g. Kasun Bandara"
                  placeholderTextColor="#94a3b8"
                  value={walkInName}
                  onChangeText={setWalkInName}
                  autoCapitalize="words"
                />
              </View>

              {/* Age & Gender Row */}
              <View style={styles.walkInRowGroup}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.walkInFieldLabel}>Age</Text>
                  <TextInput
                    style={styles.walkInTextInput}
                    placeholder="e.g. 38"
                    placeholderTextColor="#94a3b8"
                    value={walkInAge}
                    onChangeText={setWalkInAge}
                    keyboardType="numeric"
                    maxLength={3}
                  />
                </View>

                <View style={{ flex: 1.6 }}>
                  <Text style={styles.walkInFieldLabel}>Gender</Text>
                  <View style={styles.genderSelectRow}>
                    {(['Male', 'Female', 'Other'] as const).map((g) => (
                      <TouchableOpacity
                        key={g}
                        style={[
                          styles.genderSelectPill,
                          walkInGender === g && styles.genderSelectPillActive,
                        ]}
                        onPress={() => setWalkInGender(g)}
                      >
                        <Text
                          style={[
                            styles.genderSelectPillText,
                            walkInGender === g && styles.genderSelectPillTextActive,
                          ]}
                        >
                          {g}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Priority Selection */}
              <View style={styles.walkInFieldGroup}>
                <Text style={styles.walkInFieldLabel}>Priority / Category</Text>
                <View style={styles.prioritySelectRow}>
                  <TouchableOpacity
                    style={[
                      styles.prioritySelectPill,
                      walkInPriority === 'walkin' && styles.prioritySelectPillActive,
                    ]}
                    onPress={() => setWalkInPriority('walkin')}
                  >
                    <Ionicons
                      name="walk-outline"
                      size={15}
                      color={walkInPriority === 'walkin' ? '#0d6371' : '#64748b'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.prioritySelectPillText,
                        walkInPriority === 'walkin' && styles.prioritySelectPillTextActive,
                      ]}
                    >
                      Standard Walk-in
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.prioritySelectPill,
                      walkInPriority === 'urgent' && styles.prioritySelectPillActiveUrgent,
                    ]}
                    onPress={() => setWalkInPriority('urgent')}
                  >
                    <Ionicons
                      name="alert-circle-outline"
                      size={15}
                      color={walkInPriority === 'urgent' ? '#b91c1c' : '#64748b'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.prioritySelectPillText,
                        walkInPriority === 'urgent' && styles.prioritySelectPillTextActiveUrgent,
                      ]}
                    >
                      Urgent / Emergency
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Reason / Complaint */}
              <View style={styles.walkInFieldGroup}>
                <Text style={styles.walkInFieldLabel}>Reason for Visit / Complaint</Text>
                <TextInput
                  style={[styles.walkInTextInput, { height: 68, textAlignVertical: 'top', paddingTop: 8 }]}
                  placeholder="e.g. Acute abdominal pain, high fever..."
                  placeholderTextColor="#94a3b8"
                  value={walkInReason}
                  onChangeText={setWalkInReason}
                  multiline
                />
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.walkInModalActions}>
              <TouchableOpacity
                style={styles.walkInCancelBtn}
                onPress={() => setIsWalkInModalOpen(false)}
                disabled={isSubmittingWalkIn}
              >
                <Text style={styles.walkInCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.walkInSubmitBtn}
                onPress={handleRegisterWalkIn}
                disabled={isSubmittingWalkIn}
              >
                {isSubmittingWalkIn ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="add-circle-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.walkInSubmitBtnText}>Add to Queue</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fbfd',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },

  // 1. TOP PROFILE BAR
  topProfileBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: '#e2e8f0',
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
    borderColor: '#f1f5f9',
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

  // 2. GREETING & SHIFT ROW
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 14,
    marginBottom: 16,
  },
  greetingLeft: {
    flex: 1,
  },
  greetingTitle: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  departmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  departmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0d6371',
  },
  shiftBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7cebf5',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginTop: 4,
  },
  shiftBadgeBtnBreak: {
    backgroundColor: '#fef3c7',
  },
  shiftDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#047857',
    marginRight: 6,
  },
  shiftDotBreak: {
    backgroundColor: '#d97706',
  },
  shiftBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#064e59',
  },
  shiftBadgeTextBreak: {
    color: '#92400e',
  },

  // CURRENT HOSPITAL CARD
  hospitalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#cff3f6',
    elevation: 2,
    shadowColor: 'rgba(13, 99, 113, 0.08)',
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  hospitalIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#e6f8fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  hospitalInfoWrap: {
    flex: 1,
  },
  hospitalLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  hospitalLabelText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0d6371',
    letterSpacing: 0.8,
  },
  hospitalActivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    marginLeft: 6,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#16a34a',
    marginRight: 4,
  },
  hospitalActivePillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#15803d',
  },
  hospitalTitleText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 1,
  },
  hospitalDeptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  hospitalDeptText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  hospitalChangeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0fbfb',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  // ACTIVE BREAK DASHBOARD CARD
  dashboardBreakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#fde68a',
    shadowColor: 'rgba(217, 119, 6, 0.12)',
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  dashboardBreakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  dashboardBreakIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dashboardBreakTextWrap: {
    flex: 1,
  },
  dashboardBreakTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  dashboardBreakTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#78350f',
    marginRight: 6,
  },
  dashboardBreakLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  dashboardBreakLiveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#dc2626',
    marginRight: 4,
  },
  dashboardBreakLiveText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#b91c1c',
  },
  dashboardBreakSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
  dashboardEndBreakBtn: {
    backgroundColor: '#d97706',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    shadowColor: '#d97706',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  dashboardEndBreakBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },

  // HOSPITAL MODAL STYLES
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 18,
  },
  modalHospitalList: {
    gap: 10,
  },
  modalHospitalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  modalHospitalItemSelected: {
    backgroundColor: '#effbfa',
    borderColor: '#0d6371',
  },
  modalHospitalItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },
  modalItemIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalItemIconCircleSelected: {
    backgroundColor: '#cff3f6',
  },
  modalHospitalItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  modalHospitalItemNameSelected: {
    color: '#0d6371',
    fontWeight: '800',
  },
  modalHospitalItemSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
    fontWeight: '500',
  },

  // WALK-IN MODAL STYLES
  walkInModalContent: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  walkInHeaderIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0f7fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  walkInFieldGroup: {
    marginBottom: 14,
  },
  walkInRowGroup: {
    flexDirection: 'row',
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  walkInFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  walkInTextInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  genderSelectRow: {
    flexDirection: 'row',
    gap: 6,
  },
  genderSelectPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  genderSelectPillActive: {
    backgroundColor: '#e0f7fa',
    borderColor: '#0d6371',
  },
  genderSelectPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  genderSelectPillTextActive: {
    color: '#0d6371',
    fontWeight: '800',
  },
  prioritySelectRow: {
    flexDirection: 'row',
    gap: 8,
  },
  prioritySelectPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  prioritySelectPillActive: {
    backgroundColor: '#e0f7fa',
    borderColor: '#0d6371',
  },
  prioritySelectPillActiveUrgent: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
  },
  prioritySelectPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  prioritySelectPillTextActive: {
    color: '#0d6371',
    fontWeight: '800',
  },
  prioritySelectPillTextActiveUrgent: {
    color: '#b91c1c',
    fontWeight: '800',
  },
  walkInModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  walkInCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkInCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  walkInSubmitBtn: {
    flex: 1.5,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#0d6371',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  walkInSubmitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },

  // 3. METRICS ROW
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#edf2f7',
    elevation: 2,
    shadowColor: 'rgba(15, 23, 42, 0.05)',
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  metricCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  metricIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e0f7fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 8,
  },
  metricBigNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  metricDeltaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0d9488',
    marginLeft: 6,
  },
  metricTotalText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#94a3b8',
  },
  metricFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  metricFooterText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e2e8f0',
    marginTop: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0d6371',
    borderRadius: 3,
  },

  // 4. IN CONSULTATION / ALL PATIENTS SEEN HERO CARD
  allSeenCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
    elevation: 3,
    shadowColor: 'rgba(5, 150, 105, 0.1)',
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    marginBottom: 20,
  },
  allSeenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  allSeenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  allSeenPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.6,
  },
  allSeenCenterContent: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  allSeenIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  allSeenTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#065f46',
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  allSeenSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#047857',
    textAlign: 'center',
  },
  allSeenActionsRow: {
    marginTop: 14,
  },
  allSeenUndoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e6f7f9',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1.2,
    borderColor: '#b2ebf2',
  },
  allSeenUndoButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0d6371',
  },
  consultationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eef3f6',
    elevation: 3,
    shadowColor: 'rgba(15, 23, 42, 0.06)',
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    marginBottom: 20,
  },
  consultationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  inConsultationPill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tealPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2dd4bf',
    marginRight: 6,
  },
  inConsultationText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0d6371',
    letterSpacing: 0.6,
  },
  timerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0d6371',
  },
  headerRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerUndoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f7fa',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#b2ebf2',
  },
  headerUndoBadgeText: {
    fontSize: 11,
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
  patientNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  patientNameText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  genderPill: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  genderText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0369a1',
  },
  complaintText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 3,
    fontWeight: '500',
  },
  vitalsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  vitalTag: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  vitalTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  tokenShield: {
    backgroundColor: '#0f5b66',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 68,
  },
  tokenShieldLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#99f6e4',
    letterSpacing: 0.5,
  },
  tokenShieldNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    marginTop: 1,
  },
  consultationActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  undoButton: {
    flex: 0.88,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e6f7f9',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1.2,
    borderColor: '#b2ebf2',
  },
  undoButtonDisabled: {
    opacity: 0.45,
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  undoButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0d6371',
  },
  undoButtonTextDisabled: {
    color: '#94a3b8',
  },
  rxButton: {
    flex: 1.12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f7fa',
    borderRadius: 12,
    paddingVertical: 12,
  },
  rxButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0d6371',
  },
  completeNextButton: {
    flex: 1.45,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d6371',
    borderRadius: 12,
    paddingVertical: 12,
    elevation: 2,
  },
  completeNextText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },

  // 5. QUICK ACTIONS
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#edf2f7',
    elevation: 1,
  },
  quickActionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#cff3f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 8,
  },

  // 6. UP NEXT IN QUEUE
  queueHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fullQueueLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0d6371',
  },
  queueList: {
    gap: 8,
    marginBottom: 10,
  },
  emptyQueueCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    marginBottom: 10,
  },
  emptyQueueIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e6f7f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  emptyQueueTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
  },
  emptyQueueSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  queueItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#edf2f7',
  },
  tknBox: {
    backgroundColor: '#f0f9fa',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginRight: 12,
  },
  tknLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
  },
  tknNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0d6371',
  },
  queueItemInfo: {
    flex: 1,
  },
  queueItemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  queueItemSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  queueItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timePill: {
    backgroundColor: '#e0f7fa',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0d6371',
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
