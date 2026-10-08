import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StatusBar,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../constants/Colors';
import { notificationApi } from '../../services/notificationApi';
import { getAuthToken } from '../../services/http';
import { BASE_URL } from '../../config';
import EmergencyBanner from '../../components/EmergencyBanner';
import {
  fetchDoctorDashboard,
  callNextPatientApi,
  undoPatientApi,
  addWalkInSlotApi,
  getCatalogPatient,
  updateDoctorHospitalApi,
  getDoctorDashboardForHospital,
  DoctorDashboardData,
  PatientQueueItem,
} from '../../services/doctorService';
import {
  DOCTOR_TOKENS as C,
  DoctorTopBar,
  DoctorBottomNav,
  DoctorDarkHighlightBox,
  DarkStrongPill,
  DarkTranslucentChip,
  StatusPill,
  PrimaryButton,
  SecondaryButton,
} from '../../components/doctor';

export default function DoctorDashboardScreen() {
  const { t } = useLanguage();
  const [data, setData] = useState<DoctorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(244);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [unreadCount, setUnreadCount] = useState(4);
  const [currentHospital, setCurrentHospital] = useState('Colombo Teaching Hospital 1');
  const [isHospitalModalOpen, setIsHospitalModalOpen] = useState(false);
  const [isBreakModalOpen, setIsBreakModalOpen] = useState(false);

  // Walk-in modal state
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [walkInName, setWalkInName] = useState('');
  const [walkInAge, setWalkInAge] = useState('');
  const [walkInGender, setWalkInGender] = useState<'Male' | 'Female'>('Male');
  const [walkInPriority, setWalkInPriority] = useState<'walkin' | 'urgent'>('walkin');
  const [walkInReason, setWalkInReason] = useState('');
  const [isSubmittingWalkIn, setIsSubmittingWalkIn] = useState(false);

  // Break state (Tea break, Lunch break, Dinner break)
  const [activeBreak, setActiveBreak] = useState<{
    label: string;
    type?: 'tea' | 'lunch' | 'dinner';
    duration: string;
    startTime: number;
  } | null>(null);

  // Advance queue locally
  const advanceQueueLocally = useCallback(() => {
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
          currentCallingToken: 4,
          waitingCount: 2,
          completedCount: 0,
          totalToday: 30,
          avgWaitMinutes: 15,
        },
        currentPatient: {
          tokenNumber: 4,
          patientName: 'Imantha kaniska',
          age: 28,
          gender: 'Male',
          priority: 'normal' as const,
          status: 'in_consultation',
          reason: 'General OPD Consultation',
          bloodPressure: '120/80',
          heartRate: '76 bpm',
          fileRecord: 'REC-004',
          checkedInTime: '08:59',
          calledAtTime: '08:59',
        },
        upcomingQueue: [
          {
            tokenNumber: 5,
            patientName: 'Kasun Bandara',
            age: 34,
            gender: 'Male',
            priority: 'normal' as const,
            category: 'all' as const,
            status: 'next',
            reason: 'Hypertension Review',
            location: 'Waiting Area',
            slotTime: '09:15',
          },
          {
            tokenNumber: 6,
            patientName: 'Nadeesha Silva',
            age: 29,
            gender: 'Female',
            priority: 'normal' as const,
            category: 'all' as const,
            status: 'Waiting',
            reason: 'Routine Medical Checkup',
            location: 'Waiting Area',
            slotTime: '09:30',
          },
        ],
      };

      const queue = [...(base.upcomingQueue || [])];
      let nextPat: PatientQueueItem;

      if (queue.length > 0) {
        nextPat = queue.shift()!;
      } else {
        const lastNum = base.currentPatient?.tokenNumber || 4;
        nextPat = {
          tokenNumber: lastNum + 1,
          patientName: 'Nadeesha Silva',
          age: 29,
          gender: 'Female',
          priority: 'normal',
          status: 'next',
          reason: 'Routine Medical Checkup',
          slotTime: '09:30',
        };
      }

      if (queue.length < 2) {
        const highestToken = Math.max(nextPat.tokenNumber, ...queue.map((q) => q.tokenNumber), 4);
        const nextNames = ['Ruwan Jayasinghe', 'Chathuri Perera', 'Dinesh Chandimal', 'Kumari Ranasinghe'];
        const chosen = nextNames[(highestToken + 1) % nextNames.length];
        queue.push({
          tokenNumber: highestToken + 1,
          patientName: chosen,
          age: 25 + ((highestToken * 3) % 40),
          gender: highestToken % 2 === 0 ? 'Female' : 'Male',
          priority: 'normal',
          category: 'all',
          status: 'Waiting',
          reason: 'Routine OPD Consultation',
          slotTime: '10:00',
        });
      }

      return {
        ...base,
        metrics: {
          ...base.metrics,
          completedCount: (base.metrics?.completedCount || 0) + 1,
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
          heartRate: '76 bpm',
          fileRecord: `REC-${String(nextPat.tokenNumber).padStart(3, '0')}`,
          checkedInTime: nextPat.slotTime || '09:00',
          calledAtTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
        upcomingQueue: queue,
      };
    });
  }, []);

  const loadData = useCallback(async () => {
    try {
      let savedHosp = await AsyncStorage.getItem('doctor_current_hospital');
      if (!savedHosp && typeof window !== 'undefined' && (window as any).localStorage) {
        savedHosp = (window as any).localStorage.getItem('doctor_current_hospital');
      }
      const activeHosp = savedHosp || currentHospital || 'Colombo Teaching Hospital 1';
      if (activeHosp !== currentHospital) {
        setCurrentHospital(activeHosp);
      }
      const res = await fetchDoctorDashboard(undefined, activeHosp);
      if (res) {
        setData(res);
        if (res.doctor?.hospitalName) {
          setCurrentHospital(res.doctor.hospitalName);
        }
      } else {
        setData(getDoctorDashboardForHospital(activeHosp));
      }
    } catch (err) {
      console.log('Error loading doctor dashboard:', err);
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
      (async () => {
        try {
          const raw = await AsyncStorage.getItem('@medi_queue_doctor_break');
          if (raw) setActiveBreak(JSON.parse(raw));
          else setActiveBreak(null);

          let storedHosp = await AsyncStorage.getItem('doctor_current_hospital');
          if (!storedHosp && typeof window !== 'undefined' && (window as any).localStorage) {
            storedHosp = (window as any).localStorage.getItem('doctor_current_hospital');
          }
          if (storedHosp && storedHosp !== currentHospital) {
            setCurrentHospital(storedHosp);
            const res = await fetchDoctorDashboard(undefined, storedHosp);
            if (res) setData(res);
            else setData(getDoctorDashboardForHospital(storedHosp));
          }
        } catch (e) {}
      })();
    }, [currentHospital])
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const BREAK_OPTIONS = useMemo(
    () => [
      {
        type: 'tea' as const,
        label: 'Tea break',
        duration: '15 min',
        icon: 'cafe-outline' as const,
        description: '15 min morning / evening tea interval',
      },
      {
        type: 'lunch' as const,
        label: 'Lunch break',
        duration: '30 min',
        icon: 'restaurant-outline' as const,
        description: '30 min mid-day lunch interval',
      },
      {
        type: 'dinner' as const,
        label: 'Dinner break',
        duration: '30 min',
        icon: 'moon-outline' as const,
        description: '30 min evening dinner interval',
      },
    ],
    []
  );

  const getBreakPillLabel = useCallback(() => {
    if (!activeBreak) return t('Active shift');
    if (activeBreak.type === 'lunch') return t('Lunch break');
    if (activeBreak.type === 'tea') return t('Tea break');
    if (activeBreak.type === 'dinner') return t('Dinner break');

    const lbl = (activeBreak.label || '').toLowerCase();
    if (lbl.includes('lunch')) return t('Lunch break');
    if (lbl.includes('dinner')) return t('Dinner break');
    if (lbl.includes('tea')) return t('Tea break');

    const hour = new Date().getHours();
    if (hour >= 11 && hour < 15) return t('Lunch break');
    if (hour >= 18 || hour < 5) return t('Dinner break');
    return t('Tea break');
  }, [activeBreak, t]);

  const handleStartBreak = async (option: {
    type: 'tea' | 'lunch' | 'dinner';
    label: string;
    duration: string;
  }) => {
    const breakInfo = {
      label: option.label,
      type: option.type,
      duration: option.duration,
      startTime: Date.now(),
    };
    setActiveBreak(breakInfo);
    try {
      await AsyncStorage.setItem('@medi_queue_doctor_break', JSON.stringify(breakInfo));
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('@medi_queue_doctor_break', JSON.stringify(breakInfo));
      }
    } catch (e) {}
    setIsBreakModalOpen(false);
    if (Platform.OS !== 'web') {
      Alert.alert(t(option.label), t("{value0} scheduled.", { value0: t(option.label) }));
    }
  };

  const handleEndBreak = async () => {
    const currentName = getBreakPillLabel();
    setActiveBreak(null);
    try {
      await AsyncStorage.removeItem('@medi_queue_doctor_break');
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('@medi_queue_doctor_break');
      }
    } catch (e) {}
    setIsBreakModalOpen(false);
    if (Platform.OS !== 'web') {
      Alert.alert(t('Break Ended'), t("{value0} ended. Resumed active consultation.", { value0: currentName }));
    }
  };

  const handleBreakActionPress = () => {
    if (activeBreak) {
      handleEndBreak();
    } else {
      setIsBreakModalOpen(true);
    }
  };

  const handleCompleteAndNext = async () => {
    setIsProcessing(true);
    try {
      const res = await callNextPatientApi();
      if (res && res.data) {
        setData(res.data);
      } else {
        advanceQueueLocally();
      }
      setTimerSeconds(0);
      Alert.alert(t('Consultation Completed'), t('Next patient called into room.'));
    } catch (err: any) {
      advanceQueueLocally();
      setTimerSeconds(0);
      Alert.alert(t('Consultation Completed'), t('Next patient called into room.'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUndoPatient = async () => {
    if (!data?.currentPatient) return;
    const currentToken = data.currentPatient.tokenNumber;

    if (currentToken <= 1) {
      Alert.alert(t('First Patient Reached'), t('You are already at Token #001. Cannot undo further.'));
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

    let restoredToken = 1;
    setData((prev) => {
      if (!prev) return prev;
      const curr = prev.currentPatient;
      const targetToken = curr ? curr.tokenNumber - 1 : 3;
      restoredToken = Math.max(1, targetToken);
      const prevPatientData = getCatalogPatient(restoredToken);

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
          slotTime: curr.checkedInTime || '08:45 AM',
        };
        updatedQueue = [currAsQueueItem, ...updatedQueue.filter((q) => q.tokenNumber !== curr.tokenNumber)];
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
          bloodPressure: '120/80',
          heartRate: '76 bpm',
          calledAtTime: '08:45',
        },
        upcomingQueue: updatedQueue,
      };
    });

    Alert.alert(t('Action Undone'), `${t('Reverted to previous patient.')} (#${String(restoredToken).padStart(3, '0')})`);
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
      setTimerSeconds(0);
      Alert.alert(t('Queue Called'), t('Next token called!'));
    } catch (err: any) {
      advanceQueueLocally();
      setTimerSeconds(0);
      Alert.alert(t('Queue Called'), t('Next token called!'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRecallPatient = () => {
    const tokenStr = String(data?.currentPatient?.tokenNumber || 4).padStart(3, '0');
    Alert.alert(t('Recall'), `${t('Recalling token')} #${tokenStr}`);
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
      Alert.alert(t('Validation Error'), t('Please enter the patient name.'));
      return;
    }

    setIsSubmittingWalkIn(true);
    try {
      const res = await addWalkInSlotApi({
        patientName: trimmedName,
        age: walkInAge ? Number(walkInAge) : 28,
        gender: walkInGender,
        priority: walkInPriority,
        reason: walkInReason.trim() || 'Walk-in OPD Consultation',
      });

      if (res && res.data) {
        setData(res.data);
      } else {
        setData((prev) => {
          if (!prev) return prev;
          const currentTokens = [
            prev.currentPatient?.tokenNumber || 0,
            ...prev.upcomingQueue.map((q) => q.tokenNumber || 0),
          ];
          const nextToken = Math.max(4, ...currentTokens) + 1;
          const newPatient: PatientQueueItem = {
            tokenNumber: nextToken,
            patientName: trimmedName,
            age: walkInAge ? Number(walkInAge) : 28,
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

      Alert.alert(t('Walk-in Added'), `${trimmedName} ${t('has been registered and added to the queue.')}`);
      setIsWalkInModalOpen(false);
      setWalkInName('');
      setWalkInAge('');
      setWalkInReason('');
    } catch (err: any) {
      Alert.alert(t('Error'), 'Failed to register walk-in patient.');
    } finally {
      setIsSubmittingWalkIn(false);
    }
  };

  const handleSelectHospital = async (hosp: string) => {
    setCurrentHospital(hosp);
    setIsHospitalModalOpen(false);

    try {
      await AsyncStorage.setItem('doctor_current_hospital', hosp);
      if (typeof window !== 'undefined' && (window as any).localStorage) {
        (window as any).localStorage.setItem('doctor_current_hospital', hosp);
      }
      await updateDoctorHospitalApi(hosp);
    } catch (e) {}

    try {
      const res = await fetchDoctorDashboard(undefined, hosp);
      if (res) {
        setData(res);
      } else {
        setData(getDoctorDashboardForHospital(hosp));
      }
    } catch (e) {
      setData(getDoctorDashboardForHospital(hosp));
    }
  };

  const displayQueue: PatientQueueItem[] = useMemo(() => {
    if (data?.upcomingQueue && Array.isArray(data.upcomingQueue)) {
      return data.upcomingQueue;
    }
    return [];
  }, [data?.upcomingQueue]);

  const defaultPatientForHosp = useMemo(
    () => getDoctorDashboardForHospital(currentHospital).currentPatient,
    [currentHospital]
  );

  const currentPatient = data?.currentPatient ?? (displayQueue.length > 0 ? {
    tokenNumber: displayQueue[0].tokenNumber,
    patientName: displayQueue[0].patientName,
    age: displayQueue[0].age,
    gender: displayQueue[0].gender,
    priority: displayQueue[0].priority === 'urgent' ? 'urgent' : 'normal',
    status: 'next',
    reason: displayQueue[0].reason || 'General OPD Consultation',
    bloodPressure: '120/80',
    heartRate: '76 bpm',
    fileRecord: `REC-${displayQueue[0].tokenNumber}`,
    checkedInTime: displayQueue[0].slotTime || '08:59',
    calledAtTime: '08:59',
    allergy: null,
    patientId: (displayQueue[0] as any).patientId,
    appointmentId: (displayQueue[0] as any).appointmentId,
  } : defaultPatientForHosp);

  const waitingCount = data?.metrics?.waitingCount ?? (displayQueue.length > 0 ? displayQueue.length : 2);
  const completedCount = data?.metrics?.completedCount ?? 0;
  const totalCapacity = data?.doctor?.dailyCapacity ?? 30;
  const avgWaitMinutes = data?.metrics?.avgWaitMinutes ?? 15;

  const doctorDisplayName = data?.doctor?.name || 'Dr. Palitha Perera';
  const doctorShortName = useMemo(() => {
    const clean = doctorDisplayName.replace(/^Dr\.\s*/i, '').trim();
    const first = clean.split(' ')[0] || clean;
    return `Dr. ${first}`;
  }, [doctorDisplayName]);

  const currentRoom = data?.doctor?.room || 'Room 101';

  // Dynamic greeting based on current time
  const { greetingText, greetingIcon } = useMemo(() => {
    const hour = currentTime.getHours();
    if (hour >= 5 && hour < 12) {
      return {
        greetingText: t('Good morning,'),
        greetingIcon: 'sunny-outline' as const,
      };
    } else if (hour >= 12 && hour < 17) {
      return {
        greetingText: t('Good afternoon,'),
        greetingIcon: 'sunny' as const,
      };
    } else if (hour >= 17 && hour < 21) {
      return {
        greetingText: t('Good evening,'),
        greetingIcon: 'partly-sunny-outline' as const,
      };
    } else {
      return {
        greetingText: t('Good night,'),
        greetingIcon: 'moon-outline' as const,
      };
    }
  }, [currentTime, t]);

  // Real-time clock & date
  const { timeString, amPmString, dateString } = useMemo(() => {
    let hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
    const timeFormatted = `${hours}:${minutesStr}`;

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayName = days[currentTime.getDay()];
    const monthName = months[currentTime.getMonth()];
    const dayNum = currentTime.getDate();
    const year = currentTime.getFullYear();
    const dateFormatted = `${dayName}, ${monthName} ${dayNum}, ${year}`;

    return {
      timeString: timeFormatted,
      amPmString: ampm,
      dateString: dateFormatted,
    };
  }, [currentTime]);

  return (
    <View style={styles.rootContainer}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />

      {/* 1. SHARED TOP BAR */}
      <DoctorTopBar
        doctorName={doctorDisplayName}
        room={currentRoom}
        unreadCount={unreadCount}
      />
      <EmergencyBanner />


      {/* SCROLLABLE BODY */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[C.teal]}
            tintColor={C.teal}
          />
        }
      >
        {/* 2. ONE DARK HIGHLIGHT BOX COMBINING GREETING + LOCATION */}
        <DoctorDarkHighlightBox style={styles.darkHighlightBox}>
          {/* Top row: dynamic icon + Greeting on left, strong "Active shift" / break pill on right */}
          <View style={styles.darkTopRow}>
            <View style={styles.darkGreetingRow}>
              <Ionicons name={greetingIcon} size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.darkGreetingText}>{greetingText}</Text>
</View>
            <DarkStrongPill
              label={getBreakPillLabel()}
              pulse
              onPress={handleBreakActionPress}
            />
          </View>

          {/* Middle row: Doctor name on left, Real-time Clock & Date on right */}
          <View style={styles.darkDoctorAndClockRow}>
            <Text style={styles.darkDoctorName}>{doctorShortName}</Text>

            <View style={styles.darkClockCol}>
              <View style={styles.darkTimeRow}>
                <Text style={styles.darkTimeNumber}>{timeString}</Text>
                <Text style={styles.darkTimeAmPm}>{amPmString}</Text>
              </View>
              <View style={styles.darkDateRow}>
                <Ionicons name="calendar-outline" size={13} color={C.white80} style={{ marginRight: 5 }} />
                <Text style={styles.darkDateText}>{dateString}</Text>
              </View>
            </View>
          </View>

          {/* Thin divider (white at 20% opacity) */}
          <View style={styles.darkDivider} />

          {/* Location row: building icon in rounded square (white 16%), hospital name wrapped, Switch chip */}
          <View style={styles.darkLocationRow}>
            <View style={styles.darkLocationLeft}>
              <View style={styles.darkBuildingSquare}>
                <Ionicons name="business" size={17} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.darkHospitalName}>{currentHospital}</Text>
                <Text style={styles.darkRoomSubtitle}>OPD · {currentRoom}</Text>
              </View>
            </View>
            <DarkTranslucentChip
              label={t('Switch')}
              icon={<Ionicons name="swap-horizontal" size={14} color="#FFFFFF" />}
              onPress={() => setIsHospitalModalOpen(true)}
            />
          </View>
        </DoctorDarkHighlightBox>

        {/* 3. STATS ROW (3 EQUAL WHITE TILES: Waiting "2 +3", Done "0 / 30", Avg wait "15 min") */}
        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Text style={styles.statLabelText}>{t('Waiting')}</Text>
            <View style={styles.statNumberRow}>
              <Text style={styles.statNumberText}>{waitingCount}</Text>
              <Text style={styles.statSuffixText}>+3</Text>
            </View>
          </View>

          <View style={styles.statTile}>
            <Text style={styles.statLabelText}>{t('Done')}</Text>
            <View style={styles.statNumberRow}>
              <Text style={styles.statNumberText}>{completedCount}</Text>
              <Text style={styles.statSuffixText}>/ {totalCapacity}</Text>
            </View>
          </View>

          <View style={styles.statTile}>
            <Text style={styles.statLabelText}>{t('Avg wait')}</Text>
            <View style={styles.statNumberRow}>
              <Text style={styles.statNumberText}>{avgWaitMinutes}</Text>
              <Text style={styles.statSuffixText}>{t('min')}</Text>
            </View>
          </View>
        </View>

        {/* 4. "NOW SERVING" CARD (WHITE, 4PX TEAL LEFT BORDER) */}
        {currentPatient ? (
          <View style={styles.nowServingCard}>
            <View style={styles.nowServingHeader}>
              <StatusPill label={t('Now serving')} />
              <View style={styles.timePill}>
                <Ionicons name="time-outline" size={13} color={C.sub} style={{ marginRight: 4 }} />
                <Text style={styles.timePillText}>{formatTimer(timerSeconds)}</Text>
              </View>
            </View>

            <View style={styles.patientRow}>
              <View style={styles.tokenTile70}>
                <Text style={styles.tokenTileLabel}>{t('Token')}</Text>
                <Text style={styles.tokenTileNumber}>
                  {String(currentPatient.tokenNumber).padStart(3, '0')}
                </Text>
              </View>

              <View style={styles.patientInfoCol}>
                <Text style={styles.patientNameHeading} numberOfLines={1}>
                  {currentPatient.patientName}
                </Text>
                <Text style={styles.patientSubtitleInfo} numberOfLines={1}>
                  {t(currentPatient.reason || 'General OPD consultation')} · {currentPatient.age || 28} {t('yrs')}
                </Text>
              </View>
            </View>

            {/* Vitals tiles */}
            <View style={styles.vitalsRow}>
              <View style={styles.vitalTile}>
                <Text style={styles.vitalLabel}>{t('Blood pressure')}</Text>
                <Text style={styles.vitalValue}>{currentPatient.bloodPressure || '120/80'}</Text>
              </View>
              <View style={styles.vitalTile}>
                <Text style={styles.vitalLabel}>{t('Heart rate')}</Text>
                <Text style={styles.vitalValueTeal}>{currentPatient.heartRate || '76 bpm'}</Text>
              </View>
            </View>

            {/* Allergy banner */}
            <View style={styles.allergyBannerOk}>
              <Ionicons name="shield-checkmark" size={16} color={C.ok} style={{ marginRight: 6 }} />
              <Text style={styles.allergyBannerOkText}>
                {t('No known drug allergies (NKDA)')}
              </Text>
            </View>

            {/* Action row: undo icon button, short Rx secondary button, primary Complete & next */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.undoBtn}
                onPress={handleUndoPatient}
                disabled={isProcessing}
                activeOpacity={0.75}
                accessibilityLabel={t('Undo')}
              >
                <Ionicons name="arrow-undo-outline" size={18} color={C.tealDeep} />
              </TouchableOpacity>

              <SecondaryButton
                label={t('Prescription')}
                icon={<MaterialCommunityIcons name="pill" size={16} color={C.tealDeep} />}
                onPress={() => {
                  if (currentPatient) {
                    router.push({
                      pathname: '/(doctor)/prescription',
                      params: {
                        tokenNumber: String(currentPatient.tokenNumber),
                        patientName: currentPatient.patientName,
                        patientId: currentPatient.patientId || '',
                      },
                    } as any);
                  } else {
                    router.push('/(doctor)/prescription' as any);
                  }
                }}
                style={{ paddingHorizontal: 12 }}
                textStyle={{ fontSize: 13 }}
              />

              <PrimaryButton
                label={t('Complete & next')}
                icon={<Ionicons name="checkmark-circle-outline" size={17} color="#FFFFFF" />}
                onPress={handleCompleteAndNext}
                loading={isProcessing}
                style={{ flex: 1, paddingHorizontal: 10 }}
                textStyle={{ fontSize: 13 }}
              />
            </View>
          </View>
        ) : null}

        {/* 5. QUICK ACTIONS */}
        <View style={styles.quickActionsSection}>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity style={styles.quickActionItem} onPress={handleCallNext} activeOpacity={0.7}>
              <View style={styles.quickActionCircle}>
                <Ionicons name="megaphone-outline" size={20} color={C.tealDeep} />
              </View>
              <Text style={styles.quickActionLabel}>{t('Call next')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push('/(doctor)/schedule' as any)}
              activeOpacity={0.7}
            >
              <View style={styles.quickActionCircle}>
                <Ionicons name="calendar-outline" size={20} color={C.tealDeep} />
              </View>
              <Text style={styles.quickActionLabel}>{t('Schedule')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionItem} onPress={handleBreakActionPress} activeOpacity={0.7}>
              <View style={[styles.quickActionCircle, activeBreak && { backgroundColor: C.warnTint }]}>
                <Ionicons
                  name={activeBreak?.type === 'lunch' || activeBreak?.type === 'dinner' ? 'restaurant-outline' : 'cafe-outline'}
                  size={20}
                  color={activeBreak ? C.warn : C.tealDeep}
                />
              </View>
              <Text style={[styles.quickActionLabel, activeBreak && { color: C.warn, fontWeight: '800' }]}>
                {activeBreak ? t('End break') : t('Take break')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionItem} onPress={handleRecallPatient} activeOpacity={0.7}>
              <View style={styles.quickActionCircle}>
                <Ionicons name="notifications-outline" size={20} color={C.tealDeep} />
              </View>
              <Text style={styles.quickActionLabel}>{t('Recall')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 6. UP NEXT IN QUEUE */}
        <View style={styles.queueSection}>
          <View style={styles.queueHeaderRow}>
            <Text style={styles.queueTitleText}>{t('Up next in queue')}</Text>
            <TouchableOpacity
              style={styles.fullQueueBtn}
              onPress={() => router.push('/(doctor)/queue' as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.fullQueueText}>{t('Full queue')}</Text>
              <Ionicons name="chevron-forward" size={14} color={C.teal} />
            </TouchableOpacity>
          </View>

          <View style={styles.queueCardsList}>
            {displayQueue.map((item, index) => (
              <View key={`${item.tokenNumber}-${index}`} style={styles.queueCard}>
                <View style={styles.queueTokenTile}>
                  <Text style={styles.queueTokenLabel}>{t('Token')}</Text>
                  <Text style={styles.queueTokenNum}>{String(item.tokenNumber).padStart(3, '0')}</Text>
                </View>
                <View style={styles.queueItemInfo}>
                  <Text style={styles.queueItemName} numberOfLines={1}>{item.patientName}</Text>
                  <Text style={styles.queueItemSubtitle} numberOfLines={1}>
                    {t(item.reason || 'OPD check')} · {item.age} {t('yrs')}
                  </Text>
                </View>
                <View style={styles.queueTimePill}>
                  <Text style={styles.queueTimeText}>{item.slotTime || '--:--'}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* 7. SHARED BOTTOM NAVIGATION BAR */}
      <DoctorBottomNav activeTab="home" />

      {/* HOSPITAL SELECTION MODAL */}
      <Modal
        visible={isHospitalModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsHospitalModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsHospitalModalOpen(false)}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
<Text style={styles.modalTitleText}>{t('Switch OPD Hospital')}</Text>
              <TouchableOpacity onPress={() => setIsHospitalModalOpen(false)}>
                <Ionicons name="close" size={22} color={C.ink} />
              </TouchableOpacity>
            </View>

            {[
              'Colombo Teaching Hospital 1',
              'City General Hospital',
              'National Hospital Sri Lanka',
              'Colombo South Teaching Hospital',
            ].map((hosp) => (
              <TouchableOpacity
                key={hosp}
                style={[
                  styles.hospitalOptionItem,
                  currentHospital === hosp && styles.hospitalOptionSelected,
                ]}
                onPress={() => handleSelectHospital(hosp)}
              >
                <Ionicons
                  name="business"
                  size={18}
                  color={currentHospital === hosp ? C.tealDeep : C.sub}
                  style={{ marginRight: 10 }}
                />
                <Text
                  style={[
                    styles.hospitalOptionText,
                    currentHospital === hosp && styles.hospitalOptionTextSelected,
                  ]}
                >
                  {hosp}
                </Text>
                {currentHospital === hosp && (
                  <Ionicons name="checkmark" size={18} color={C.tealDeep} style={{ marginLeft: 'auto' }} />
                )}
              </TouchableOpacity>
            ))}

          </View>
        </TouchableOpacity>
      </Modal>

      {/* WALK-IN REGISTRATION MODAL */}
      <Modal
        visible={isWalkInModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsWalkInModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsWalkInModalOpen(false)}
        >
          <TouchableOpacity style={styles.walkInModalContent} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitleText}>{t('Add Walk-in Patient')}</Text>
              <TouchableOpacity onPress={() => setIsWalkInModalOpen(false)}>
                <Ionicons name="close" size={22} color={C.ink} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>{t('Patient Name *')}</Text>
              <TextInput
                style={styles.textInput}
                placeholder={t('Enter full name')}
                placeholderTextColor={C.sub}
                value={walkInName}
                onChangeText={setWalkInName}
              />

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>{t('Age')}</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="28"
                    placeholderTextColor={C.sub}
                    keyboardType="numeric"
                    value={walkInAge}
                    onChangeText={setWalkInAge}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>{t('Gender')}</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {(['Male', 'Female'] as const).map((g) => (
                      <TouchableOpacity
                        key={g}
                        style={[
                          styles.genderChip,
                          walkInGender === g && styles.genderChipActive,
                        ]}
                        onPress={() => setWalkInGender(g)}
                      >
                        <Text
                          style={[
                            styles.genderChipText,
                            walkInGender === g && styles.genderChipTextActive,
                          ]}
                        >
                          {t(g)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>{t('Consultation Reason')}</Text>
              <TextInput
                style={styles.textInput}
                placeholder={t('e.g. Headache, Follow-up, Fever')}
                placeholderTextColor={C.sub}
                value={walkInReason}
                onChangeText={setWalkInReason}
              />

              <View style={{ marginTop: 20 }}>
                <PrimaryButton
                  label={t('Register & Add to Queue')}
                  onPress={handleRegisterWalkIn}
                  loading={isSubmittingWalkIn}
                />
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* BREAK TYPE SELECTION MODAL */}
      <Modal
        visible={isBreakModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsBreakModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsBreakModalOpen(false)}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitleText}>{t('Select Break Type')}</Text>
              <TouchableOpacity onPress={() => setIsBreakModalOpen(false)}>
                <Ionicons name="close" size={22} color={C.ink} />
              </TouchableOpacity>
            </View>

            {BREAK_OPTIONS.map((item) => (
              <TouchableOpacity
                key={item.type}
                style={[
                  styles.breakOptionItem,
                  activeBreak?.type === item.type && styles.breakOptionItemSelected,
                ]}
                onPress={() => handleStartBreak(item)}
                activeOpacity={0.75}
              >
                <View style={styles.breakOptionIconBox}>
                  <Ionicons name={item.icon} size={20} color={C.tealDeep} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.breakOptionTitle}>{t(item.label)}</Text>
                    <View style={styles.breakDurationBadge}>
                      <Text style={styles.breakDurationBadgeText}>{item.duration}</Text>
                    </View>
                  </View>
                  <Text style={styles.breakOptionDesc}>{t(item.description)}</Text>
                </View>
              </TouchableOpacity>
            ))}

            {activeBreak && (
              <TouchableOpacity
                style={styles.endBreakBtnModal}
                onPress={handleEndBreak}
                activeOpacity={0.75}
              >
                <Ionicons name="stop-circle-outline" size={18} color="#DC2626" style={{ marginRight: 6 }} />
                <Text style={styles.endBreakBtnModalText}>{t('End current break')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 110,
  },

  // 2. Dark Highlight Box
  darkHighlightBox: {
    marginBottom: 12,
  },
  darkTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  darkGreetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  darkGreetingText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  darkDoctorAndClockRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
  },
  darkDoctorName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  darkClockCol: {
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  darkTimeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  darkTimeNumber: {
    fontSize: 27,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  darkTimeAmPm: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 3,
  },
  darkDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  darkDateText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: C.white80,
  },
  darkDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
    marginVertical: 4,
  },
  darkLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  darkLocationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  darkBuildingSquare: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.white16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  darkHospitalName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 18,
  },
  darkRoomSubtitle: {
    fontSize: 12,
    color: C.white80,
    marginTop: 1,
  },

  // 3. Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statTile: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: C.radiusTile,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: C.line,
    ...C.shadow,
  },
  statLabelText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.sub,
    marginBottom: 4,
  },
  statNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statNumberText: {
    fontSize: 26,
    fontWeight: '800',
    color: C.teal,
    letterSpacing: -0.5,
  },
  statSuffixText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.sub,
    marginLeft: 3,
  },

  // 4. "Now Serving" Card
  nowServingCard: {
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
  nowServingHeader: {
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
    marginBottom: 12,
  },
  tokenTile70: {
    width: 70,
    height: 70,
    borderRadius: 14,
    backgroundColor: C.tint,
    borderWidth: 1,
    borderColor: C.tintBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tokenTileLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.tealDeep,
  },
  tokenTileNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: C.tealDeep,
    letterSpacing: -0.5,
  },
  patientInfoCol: {
    flex: 1,
  },
  patientNameHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: C.ink,
    letterSpacing: -0.3,
  },
  patientSubtitleInfo: {
    fontSize: 13,
    color: C.sub,
    marginTop: 3,
  },
  vitalsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  vitalTile: {
    flex: 1,
    backgroundColor: C.bg,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: C.line,
  },
  vitalLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.sub,
    marginBottom: 2,
  },
  vitalValue: {
    fontSize: 13,
    fontWeight: '800',
    color: C.ink,
  },
  vitalValueTeal: {
    fontSize: 13,
    fontWeight: '800',
    color: C.teal,
  },
  allergyBannerOk: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.okTint,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#C6EEDB',
    marginBottom: 12,
  },
  allergyBannerOkText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.ok,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  undoBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: C.tint,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // 5. Quick Actions
  quickActionsSection: {
    marginBottom: 14,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: C.card,
    borderRadius: C.radiusTile,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: C.line,
    ...C.shadow,
  },
  quickActionItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickActionCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.tint,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.ink,
  },

  // 6. Up Next Queue
  queueSection: {
    marginBottom: 14,
  },
  queueHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  queueTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: C.ink,
  },
  fullQueueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fullQueueText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.teal,
    marginRight: 2,
  },
  queueCardsList: {
    gap: 8,
  },
  queueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: C.line,
    ...C.shadow,
  },
  queueTokenTile: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: C.tint,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  queueTokenLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: C.sub,
  },
  queueTokenNum: {
    fontSize: 14,
    fontWeight: '800',
    color: C.tealDeep,
  },
  queueItemInfo: {
    flex: 1,
  },
  queueItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: C.ink,
  },
  queueItemSubtitle: {
    fontSize: 11,
    color: C.sub,
    marginTop: 2,
  },
  queueTimePill: {
    backgroundColor: C.bg,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: C.line,
  },
  queueTimeText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.sub,
  },

  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 39, 43, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 18,
    width: '100%',
    maxWidth: 380,
    ...C.shadow,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitleText: {
    fontSize: 17,
    fontWeight: '800',
    color: C.ink,
  },
  hospitalOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 4,
  },
  hospitalOptionSelected: {
    backgroundColor: C.tint,
  },
  hospitalOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.ink,
    flex: 1,
  },
  hospitalOptionTextSelected: {
    fontWeight: '800',
    color: C.tealDeep,
  },

  // Walk-in modal
  walkInModalContent: {
    backgroundColor: C.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    width: '100%',
    maxHeight: '85%',
    marginTop: 'auto',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.line,
    alignSelf: 'center',
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.ink,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 12,
    fontSize: 13,
    color: C.ink,
  },
  genderChip: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.line,
    justifyContent: 'center',
    alignItems: 'center',
  },
  genderChipActive: {
    backgroundColor: C.tint,
    borderColor: C.tintBorder,
  },
  genderChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.sub,
  },
  genderChipTextActive: {
    color: C.tealDeep,
    fontWeight: '700',
  },

  // Break Modal Styles
  breakOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    marginBottom: 10,
    backgroundColor: C.card,
  },
  breakOptionItemSelected: {
    borderColor: C.teal,
    backgroundColor: C.tint,
  },
  breakOptionIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: C.tint,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  breakOptionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: C.ink,
  },
  breakOptionDesc: {
    fontSize: 12,
    color: C.sub,
    marginTop: 2,
  },
  breakDurationBadge: {
    backgroundColor: C.bg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.line,
  },
  breakDurationBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.sub,
  },
  endBreakBtnModal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  endBreakBtnModalText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#DC2626',
  },
});
