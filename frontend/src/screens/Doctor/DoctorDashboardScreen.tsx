import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Rect, Line, Polyline, Polygon } from 'react-native-svg';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { notificationApi } from '../../services/notificationApi';
import { getAuthToken } from '../../services/http';
import { BASE_URL } from '../../config';
import EmergencyBanner from '../../components/EmergencyBanner';
import {
  fetchDoctorDashboard,
  updateDoctorStatusApi,
  updateDoctorHospitalApi,
  callNextPatientApi,
  callSpecificTokenApi,
  undoPatientApi,
  addWalkInSlotApi,
  getCatalogPatient,
  DoctorDashboardData,
  PatientQueueItem,
} from '../../services/doctorService';

// ==========================================
// 2px STROKE LINE ICONS (NO EMOJIS, ROUND CAPS)
// ==========================================
const LineGlobe = ({ color = '#FFFFFF', size = 18 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Line x1="2" y1="12" x2="22" y2="12" />
    <Path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </Svg>
);

const LineBell = ({ color = '#FFFFFF', size = 18 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </Svg>
);

const LineBuilding = ({ color = '#FFFFFF', size = 17 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <Path d="M9 22v-4h6v4" />
    <Line x1="8" y1="6" x2="8.01" y2="6" />
    <Line x1="16" y1="6" x2="16.01" y2="6" />
    <Line x1="12" y1="6" x2="12.01" y2="6" />
    <Line x1="8" y1="10" x2="8.01" y2="10" />
    <Line x1="12" y1="10" x2="12.01" y2="10" />
    <Line x1="16" y1="10" x2="16.01" y2="10" />
  </Svg>
);

const LineSwap = ({ color = '#FFFFFF', size = 13 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M16 3l4 4-4 4" />
    <Path d="M20 7H4" />
    <Path d="M8 21l-4-4 4-4" />
    <Path d="M4 17h16" />
  </Svg>
);

const LineClock = ({ color = '#0B4F59', size = 14 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Polyline points="12 6 12 12 16 14" />
  </Svg>
);

const LineAlertTriangle = ({ color = '#C62828', size = 18 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <Line x1="12" y1="9" x2="12" y2="13" />
    <Line x1="12" y1="17" x2="12.01" y2="17" />
  </Svg>
);

const LineUndo = ({ color = '#0B4F59', size = 18 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 7v6h6" />
    <Path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
  </Svg>
);

const LineDocument = ({ color = '#0B4F59', size = 16 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <Polyline points="14 2 14 8 20 8" />
    <Line x1="16" y1="13" x2="8" y2="13" />
    <Line x1="16" y1="17" x2="8" y2="17" />
    <Line x1="10" y1="9" x2="8" y2="9" />
  </Svg>
);

const LineCheckCircle = ({ color = '#FFFFFF', size = 16 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <Polyline points="22 4 12 14.01 9 11.01" />
  </Svg>
);

const LineSpeaker = ({ color = '#0B4F59', size = 22 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <Path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <Path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </Svg>
);

const LineUserPlus = ({ color = '#0B4F59', size = 22 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <Circle cx="8.5" cy="7" r="4" />
    <Line x1="20" y1="8" x2="20" y2="14" />
    <Line x1="23" y1="11" x2="17" y2="11" />
  </Svg>
);

const LineCoffee = ({ color = '#0B4F59', size = 22 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 8h1a4 4 0 0 1 0 8h-1" />
    <Path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
    <Line x1="6" y1="1" x2="6" y2="4" />
    <Line x1="10" y1="1" x2="10" y2="4" />
    <Line x1="14" y1="1" x2="14" y2="4" />
  </Svg>
);

const LineChevronRight = ({ color = '#0E8F9A', size = 15 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="9 18 15 12 9 6" />
  </Svg>
);

const LineThreeDot = ({ color = '#5B6B73', size = 18 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="1.5" />
    <Circle cx="12" cy="5" r="1.5" />
    <Circle cx="12" cy="19" r="1.5" />
  </Svg>
);

// Fallback sample queue dataset specified in design requirements
const SAMPLE_QUEUE: PatientQueueItem[] = [
  { tokenNumber: 29, patientName: 'Aurelia Sisca', age: 32, gender: 'Female', priority: 'normal', category: 'all', status: 'next', reason: 'Post-op Check', slotTime: '11:15 AM' },
  { tokenNumber: 30, patientName: 'Rohan Mendis', age: 54, gender: 'Male', priority: 'normal', category: 'all', status: 'Waiting', reason: 'Hypertension Follow-up', slotTime: '11:30 AM' },
  { tokenNumber: 31, patientName: 'Dilshan Madushanka', age: 28, gender: 'Male', priority: 'normal', category: 'all', status: 'Waiting', reason: 'Hypertension Follow-up', slotTime: '11:45 AM' },
  { tokenNumber: 32, patientName: 'Sanduni Perera', age: 41, gender: 'Female', priority: 'normal', category: 'all', status: 'Waiting', reason: 'Hypertension Follow-up', slotTime: '12:00 PM' },
  { tokenNumber: 33, patientName: 'Piyadasa Samarasinghe', age: 71, gender: 'Male', priority: 'normal', category: 'all', status: 'Waiting', reason: 'Hypertension Follow-up', slotTime: '12:15 PM' },
  { tokenNumber: 34, patientName: 'Kavindi Fernando', age: 24, gender: 'Female', priority: 'normal', category: 'all', status: 'Waiting', reason: 'Hypertension Follow-up', slotTime: '12:30 PM' },
];

interface DoctorDashboardScreenProps {
  navigation?: any;
}

export default function DoctorDashboardScreen({ navigation }: DoctorDashboardScreenProps) {
  const { t, language, setLanguage } = useLanguage();
  const [data, setData] = useState<DoctorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'queue' | 'records' | 'schedule' | 'rx'>('home');
  const [currentHospital, setCurrentHospital] = useState<string>('Colombo Teaching Hospital 1');
  const [isHospitalModalOpen, setIsHospitalModalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Live timer state: starts at 08:47 (527 seconds) and increments live every second
  const [timerSeconds, setTimerSeconds] = useState(8 * 60 + 47);

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

  const [unreadCount, setUnreadCount] = useState(3);

  // Timer increment effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (sec: number) => {
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  // Color tokens based on appearance mode
  const colors = useMemo(() => {
    if (isDarkMode) {
      return {
        bgPage: '#0C1A1E',
        cardBg: '#13262B',
        textPrimary: '#EAF4F6',
        textSecondary: '#9DB2B8',
        tealDeep: '#0B4F59',
        tealBright: '#0E8F9A',
        tealTint: '#1B3A40',
        chipGrey: '#172F35',
        alertText: '#FF8A80',
        alertBg: '#3A1B1B',
        headerOverlay: 'rgba(255, 255, 255, 0.12)',
        headerBorder: 'rgba(255, 255, 255, 0.18)',
        headerPillInner: 'rgba(0, 0, 0, 0.35)',
        cardShadow: {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.45,
          shadowRadius: 18,
          elevation: 8,
        },
        cardShadowSm: {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 3,
        },
        borderSubtle: 'rgba(255, 255, 255, 0.08)',
      };
    }
    return {
      bgPage: '#EEF6F8',
      cardBg: '#FFFFFF',
      textPrimary: '#0F1F24',
      textSecondary: '#5B6B73',
      tealDeep: '#0B4F59',
      tealBright: '#0E8F9A',
      tealTint: '#DDF1F3',
      chipGrey: '#EEF3F4',
      alertText: '#C62828',
      alertBg: '#FDECEC',
      headerOverlay: 'rgba(255, 255, 255, 0.16)',
      headerBorder: 'rgba(255, 255, 255, 0.25)',
      headerPillInner: 'rgba(11, 79, 89, 0.45)',
      cardShadow: {
        shadowColor: '#0B4F59',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 22,
        elevation: 7,
      },
      cardShadowSm: {
        shadowColor: '#0B4F59',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
      },
      borderSubtle: 'rgba(11, 79, 89, 0.08)',
    };
  }, [isDarkMode]);

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
      checkUnreadNotifications();
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
      Alert.alert(t('Shift Resumed'), t('You have resumed your active shift.'));
    } catch (e) {
      console.log('Error ending break:', e);
    }
  };

  const handleTake15mBreak = async () => {
    if (activeBreak) {
      await handleEndActiveBreakFromDashboard();
      return;
    }
    const newBreak = {
      type: 'tea' as const,
      label: 'Tea Break',
      duration: '15 mins',
      minutes: 15,
      hospitalId: 'hosp-1',
      hospitalName: currentHospital,
      shiftName: 'Morning Shift',
      startTime: Date.now(),
    };
    try {
      await AsyncStorage.setItem('@medi_queue_doctor_break', JSON.stringify(newBreak));
      setActiveBreak(newBreak);
      if (data?.doctor) {
        setData({
          ...data,
          doctor: { ...data.doctor, status: 'on_break' },
        });
        await updateDoctorStatusApi('on_break', data.doctor._id);
      }
      Alert.alert(t('Break Started'), t('15m Break is now active on your dashboard.'));
    } catch (e) {}
  };

  const loadData = useCallback(async () => {
    try {
      loadActiveBreak();
      let savedHospital = '';
      try {
        const storedHosp = await AsyncStorage.getItem('doctor_current_hospital');
        if (storedHosp) savedHospital = storedHosp;
      } catch (e) {}

      const res = await fetchDoctorDashboard();
      const hosp = savedHospital || res?.doctor?.hospitalName || 'Colombo Teaching Hospital 1';
      setCurrentHospital(hosp);
      setData(res);
    } catch (err) {
      console.log('Failed to load doctor dashboard', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadActiveBreak]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    const newStatus = data.doctor?.status === 'active' ? 'on_break' : 'active';
    setData({
      ...data,
      doctor: { ...data.doctor, status: newStatus },
    });
    await updateDoctorStatusApi(newStatus, data.doctor?._id);
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
            bloodPressure: '124/82',
            heartRate: '76 bpm',
            fileRecord: `REC-${800 + nextPat.tokenNumber}`,
            checkedInTime: nextPat.slotTime || '11:15 AM',
            calledAtTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
          upcomingQueue: queue,
        };
      }

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
    try {
      const res = await callNextPatientApi();
      if (res && res.data) {
        setData(res.data);
      } else {
        advanceQueueLocally();
      }
      setTimerSeconds(0);
      Alert.alert(t('Consultation Completed'), t('Advanced to next patient.'));
    } catch (err: any) {
      advanceQueueLocally();
      setTimerSeconds(0);
      Alert.alert(t('Consultation Completed'), t('Advanced to next patient.'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUndoPatient = async () => {
    if (data?.currentPatient && data.currentPatient.tokenNumber <= 1) {
      Alert.alert(t('Notice'), t('First Patient Reached'));
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
    } catch (err) {}

    let restoredToken = 27;
    setData((prev) => {
      if (!prev) return prev;
      const curr = prev.currentPatient;
      const targetToken = curr ? curr.tokenNumber - 1 : 27;
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
          slotTime: curr.checkedInTime || '11:15 AM',
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
          bloodPressure: '124/82',
          heartRate: '76 bpm',
          calledAtTime: '08:47',
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
    const tokenStr = String(data?.currentPatient?.tokenNumber || 28).padStart(3, '0');
    Alert.alert(t('Recall'), `${t('Recalling Token')} #${tokenStr}`);
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
        age: walkInAge ? Number(walkInAge) : 35,
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
          const nextToken = Math.max(34, ...currentTokens) + 1;
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

  const handleRemoveQueuePatient = (tokenNumber: number, patientName: string) => {
    Alert.alert(
      t('Remove Patient'),
      `${patientName} (Token #${String(tokenNumber).padStart(3, '0')})`,
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Remove'),
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
          },
        },
      ]
    );
  };

  const handleSelectHospital = async (hosp: string) => {
    setCurrentHospital(hosp);
    setIsHospitalModalOpen(false);
    try {
      await AsyncStorage.setItem('doctor_current_hospital', hosp);
      await updateDoctorHospitalApi(hosp);
      Alert.alert(t('Notice'), `${hosp}`);
    } catch (e) {}
  };

  const handleTabPress = (tab: 'home' | 'queue' | 'records' | 'schedule' | 'rx') => {
    setActiveTab(tab);
    if (tab === 'queue') {
      try { router.push('/(doctor)/queue' as any); } catch (e) { router.push('/queue' as any); }
    } else if (tab === 'records') {
      if (currentPatient) {
        try {
          router.push({
            pathname: '/(doctor)/records' as any,
            params: {
              patientId: (currentPatient as any).patientId || '',
              patientName: currentPatient.patientName,
              tokenNumber: String(currentPatient.tokenNumber),
            },
          });
        } catch (e) {
          router.push('/(doctor)/records' as any);
        }
      } else {
        try { router.push('/(doctor)/records' as any); } catch (e) { router.push('/records' as any); }
      }
    } else if (tab === 'schedule') {
      try { router.push('/(doctor)/schedule' as any); } catch (e) { router.push('/schedule' as any); }
    } else if (tab === 'rx') {
      try { router.push('/(doctor)/prescription' as any); } catch (e) { router.push('/prescription' as any); }
    }
  };

  const toggleLanguage = async () => {
    const nextLang = language === 'en' ? 'si' : language === 'si' ? 'ta' : 'en';
    await setLanguage(nextLang);
  };

  // Up next queue list: use real backend queue from database
  const displayQueue: PatientQueueItem[] = useMemo(() => {
    if (data?.upcomingQueue && Array.isArray(data.upcomingQueue)) {
      return data.upcomingQueue;
    }
    return [];
  }, [data?.upcomingQueue]);

  const currentPatient = data?.currentPatient ?? (displayQueue.length > 0 ? {
    tokenNumber: displayQueue[0].tokenNumber,
    patientName: displayQueue[0].patientName,
    age: displayQueue[0].age,
    gender: displayQueue[0].gender,
    priority: displayQueue[0].priority === 'urgent' ? 'urgent' : 'normal',
    status: 'next',
    reason: displayQueue[0].reason || 'OPD Consultation',
    bloodPressure: '120/80',
    heartRate: '76 bpm',
    fileRecord: `REC-${displayQueue[0].tokenNumber}`,
    checkedInTime: displayQueue[0].slotTime || '10:00 AM',
    calledAtTime: '09:00',
    allergy: null,
    patientId: (displayQueue[0] as any).patientId,
    appointmentId: (displayQueue[0] as any).appointmentId,
  } : null);

  const waitingCount = data?.metrics?.waitingCount ?? displayQueue.length;
  const completedCount = data?.metrics?.completedCount ?? 0;
  const totalCapacity = data?.doctor?.dailyCapacity ?? 30;
  const avgWaitMinutes = data?.metrics?.avgWaitMinutes ?? 10;

  const doctorDisplayName = data?.doctor?.name || 'Dr. Palitha Perera';
  const doctorInitials = useMemo(() => {
    const clean = doctorDisplayName.replace(/^Dr\.\s*/i, '').trim();
    const parts = clean.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return clean.slice(0, 2).toUpperCase() || 'DR';
  }, [doctorDisplayName]);

  return (
    <SafeAreaView style={[styles.safeContainer, { backgroundColor: colors.bgPage }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#0B4F59"
      />
      <EmergencyBanner />

      {/* CENTERED RESPONSIVE WRAPPER (MAX 420px) */}
      <View style={styles.centerAlignWrapper}>
        <View style={[styles.mobileContainer, { backgroundColor: colors.bgPage }]}>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0E8F9A']} />}
          >
            {/* ========================================================= */}
            {/* SECTION 1: HEADER (DIAGONAL GRADIENT AREA #0B4F59 -> #0E8F9A) */}
            {/* ========================================================= */}
            <LinearGradient
              colors={['#0B4F59', '#0E8F9A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientHeader}
            >
              {/* Top Row: Avatar, Doctor Name, Online Badge, Language & Bell Buttons */}
              <View style={styles.headerTopRow}>
                <View style={styles.doctorProfileWrap}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarInitials}>{doctorInitials}</Text>
                  </View>
                  <View style={styles.doctorInfoCol}>
                    <Text style={styles.doctorName}>{doctorDisplayName}</Text>
                    <View style={styles.onlineBadgeRow}>
                      <View style={styles.greenOnlineDot} />
                      <Text style={styles.onlineBadgeText}>{t(`${data?.doctor?.room || 'Room 101'} Online`)}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.headerActionsWrap}>
                  {/* Notification Bell with Badge '3' */}
                  <TouchableOpacity
                    style={styles.headerIconBtn}
                    onPress={() => router.push('/notifications')}
                    activeOpacity={0.75}
                    accessibilityLabel={t('Notifications')}
                  >
                    <LineBell color="#FFFFFF" size={18} />
                    <View style={styles.bellBadge}>
                      <Text style={styles.bellBadgeText}>{unreadCount}</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Greeting & Shift/Break Status Pill */}
              <View style={styles.greetingHeaderRow}>
                <View style={styles.greetingWrap}>
                  <Text style={styles.greetingSmall}>{t('Good morning,')}</Text>
                  <Text style={styles.greetingDoctor}>
                    {doctorDisplayName.startsWith('Dr.') ? doctorDisplayName : `Dr. ${doctorDisplayName}`}
                  </Text>
                </View>

                {/* Shift / Break status badge button */}
                <TouchableOpacity
                  style={[
                    styles.shiftStatusBadge,
                    (activeBreak || data?.doctor?.status === 'on_break') && styles.shiftStatusBadgeBreak,
                  ]}
                  onPress={handleTake15mBreak}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.shiftStatusDot,
                      (activeBreak || data?.doctor?.status === 'on_break') && styles.shiftStatusDotBreak,
                    ]}
                  />
                  <Text
                    style={[
                      styles.shiftStatusText,
                      (activeBreak || data?.doctor?.status === 'on_break') && styles.shiftStatusTextBreak,
                    ]}
                    numberOfLines={1}
                  >
                    {activeBreak
                      ? `${t(activeBreak.label || 'Tea Break')} (${activeBreak.duration})`
                      : data?.doctor?.status === 'on_break'
                      ? t('On Break')
                      : t('Active Shift')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Location Pill */}
              <View style={styles.locationPill}>
                <View style={styles.locationLeft}>
                  <LineBuilding color="#FFFFFF" size={17} />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {currentHospital} · OPD
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.locationSwitchBtn}
                  onPress={() => setIsHospitalModalOpen(true)}
                  activeOpacity={0.8}
                >
                  <LineSwap color="#FFFFFF" size={13} />
                  <Text style={styles.locationSwitchText}>{t('Switch')}</Text>
                </TouchableOpacity>
              </View>

              {/* Three Equal Stat Tiles */}
              <View style={styles.statTilesRow}>
                {/* 1. Waiting: 14 with "+3" */}
                <View style={styles.statTile}>
                  <Text style={styles.statLabel}>{t('Waiting')}</Text>
                  <View style={styles.statValueRow}>
                    <Text style={styles.statNumber}>{waitingCount}</Text>
                    <Text style={styles.statSuffix}>+3</Text>
                  </View>
                </View>

                {/* 2. Done: 18 with "/ 32" */}
                <View style={styles.statTile}>
                  <Text style={styles.statLabel}>{t('Done')}</Text>
                  <View style={styles.statValueRow}>
                    <Text style={styles.statNumber}>{completedCount}</Text>
                    <Text style={styles.statSuffix}>/ {totalCapacity}</Text>
                  </View>
                </View>

                {/* 3. Avg wait: 9 with "min" */}
                <View style={styles.statTile}>
                  <Text style={styles.statLabel}>{t('Avg wait')}</Text>
                  <View style={styles.statValueRow}>
                    <Text style={styles.statNumber}>{avgWaitMinutes}</Text>
                    <Text style={styles.statSuffix}>{t('min')}</Text>
                  </View>
                </View>
              </View>
            </LinearGradient>

            {/* ========================================================= */}
            {/* PROMINENT ACTIVE BREAK ALERT CARD (IF ON BREAK) */}
            {/* ========================================================= */}
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
                      size={22}
                      color="#b45309"
                    />
                  </View>
                  <View style={styles.dashboardBreakTextWrap}>
                    <View style={styles.dashboardBreakTitleRow}>
                      <Text style={styles.dashboardBreakTitle}>{t(activeBreak.label || 'Tea Break')}</Text>
                      <View style={styles.dashboardBreakLivePill}>
                        <View style={styles.dashboardBreakLiveDot} />
                        <Text style={styles.dashboardBreakLiveText}>{t('On Break')}</Text>
                      </View>
                    </View>
                    <Text style={styles.dashboardBreakSub} numberOfLines={1}>
                      {activeBreak.duration} • {activeBreak.shiftName || 'Morning Shift'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.dashboardEndBreakBtn}
                  onPress={handleEndActiveBreakFromDashboard}
                  activeOpacity={0.8}
                >
                  <Text style={styles.dashboardEndBreakBtnText}>{t('End Break')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ========================================================= */}
            {/* SECTION 2: NOW SERVING CARD (OVERLAPS HEADER BY 50PX) */}
            {/* ========================================================= */}
            <View style={[styles.nowServingContainer, activeBreak && { marginTop: 0 }]}>
              {currentPatient ? (
                <View style={[styles.nowServingCard, { backgroundColor: colors.cardBg, borderColor: colors.borderSubtle }, colors.cardShadow]}>

                  {/* Top Row: Pulsing Dot + "NOW SERVING" and Tinted Live Timer */}
                  <View style={styles.nowServingTopRow}>
                    <View style={styles.pulsingTitleWrap}>
                      <View style={styles.pulseDotOuter}>
                        <View style={styles.pulseDotRing} />
                        <View style={styles.pulseDotCore} />
                      </View>
                      <Text style={styles.nowServingLabel}>{t('NOW SERVING')}</Text>
                    </View>

                    {/* Tinted Pill with Clock Icon and Live Running Timer */}
                    <View style={[styles.timerPill, { backgroundColor: colors.tealTint }]}>
                      <LineClock color={colors.tealDeep} size={14} />
                      <Text style={[styles.timerText, { color: colors.tealDeep }]}>
                        {formatTimer(timerSeconds)}
                      </Text>
                    </View>
                  </View>

                  {/* Patient Row: Dark Teal Token Badge (70px) + Patient Info */}
                  <View style={styles.patientRow}>
                    <View style={styles.tokenBadgeDark}>
                      <Text style={styles.tokenBadgeLabel}>{t('TOKEN')}</Text>
                      <Text style={styles.tokenBadgeNumber}>
                        {String(currentPatient.tokenNumber).padStart(3, '0')}
                      </Text>
                    </View>

                    <View style={styles.patientDetailsCol}>
                      <Text style={[styles.patientNameText, { color: colors.textPrimary }]} numberOfLines={1}>
                        {currentPatient.patientName}
                      </Text>
                      <Text style={[styles.patientSubtitleText, { color: colors.textSecondary }]} numberOfLines={1}>
                        {t(currentPatient.reason || 'OPD Consultation')} • {currentPatient.age || 35} {t('yrs')}
                      </Text>
                    </View>
                  </View>

                  {/* Vitals Chips Row */}
                  <View style={styles.vitalsChipsRow}>
                    <View style={[styles.vitalChip, { backgroundColor: colors.chipGrey }]}>
                      <Text style={[styles.vitalChipLabel, { color: colors.textSecondary }]}>BP: </Text>
                      <Text style={[styles.vitalChipVal, { color: colors.textPrimary }]}>{currentPatient.bloodPressure || '120/80'}</Text>
                    </View>
                    <View style={[styles.vitalChip, { backgroundColor: colors.chipGrey }]}>
                      <Text style={[styles.vitalChipLabel, { color: colors.textSecondary }]}>HR: </Text>
                      <Text style={[styles.vitalChipVal, { color: colors.textPrimary }]}>{currentPatient.heartRate || '76 bpm'}</Text>
                    </View>
                  </View>

                  {/* Dynamic Allergy Alert Banner */}
                  {currentPatient.allergy ? (
                    <View style={[styles.allergyBanner, { backgroundColor: colors.alertBg }]}>
                      <LineAlertTriangle color={colors.alertText} size={18} />
                      <Text style={[styles.allergyText, { color: colors.alertText }]} numberOfLines={1}>
                        {t('Allergy:')} {currentPatient.allergy}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.allergyBanner, { backgroundColor: isDarkMode ? '#132e27' : '#ecfdf5', borderColor: isDarkMode ? '#065f46' : '#a7f3d0', borderWidth: 1 }]}>
                      <Ionicons name="shield-checkmark" size={17} color="#10b981" style={{ marginRight: 6 }} />
                      <Text style={[styles.allergyText, { color: isDarkMode ? '#6ee7b7' : '#047857' }]}>
                        {t('No Known Drug Allergies (NKDA)')}
                      </Text>
                    </View>
                  )}

                  {/* Action Row: Three Buttons with PERFECT single-line fit */}
                  <View style={styles.actionRow}>
                    {/* 1. Square Icon-only Undo Button (tinted) */}
                    <TouchableOpacity
                      style={[styles.actionBtnUndo, { backgroundColor: colors.tealTint }]}
                      onPress={handleUndoPatient}
                      disabled={isProcessing}
                      activeOpacity={0.75}
                      accessibilityLabel={t('Undo')}
                    >
                      <LineUndo color={colors.tealDeep} size={18} />
                    </TouchableOpacity>

                    {/* 2. Tinted "Rx Prescribe" Button with document icon */}
                    <TouchableOpacity
                      style={[styles.actionBtnRx, { backgroundColor: colors.tealTint }]}
                      onPress={() => {
                        if (currentPatient) {
                          try {
                            router.push({
                              pathname: '/(doctor)/prescription' as any,
                              params: {
                                tokenNumber: String(currentPatient.tokenNumber),
                                patientName: currentPatient.patientName,
                                patientId: (currentPatient as any).patientId || '',
                              },
                            });
                          } catch (e) {
                            handleTabPress('rx');
                          }
                        } else {
                          handleTabPress('rx');
                        }
                      }}
                      activeOpacity={0.75}
                    >
                      <LineDocument color={colors.tealDeep} size={16} />
                      <Text style={[styles.actionBtnRxText, { color: colors.tealDeep }]} numberOfLines={1}>
                        {t('Rx Prescribe')}
                      </Text>
                    </TouchableOpacity>

                    {/* 3. Wide Primary Dark-teal Button "Complete & Next" - perfectly single line */}
                    <TouchableOpacity
                      style={styles.actionBtnComplete}
                      onPress={handleCompleteAndNext}
                      disabled={isProcessing}
                      activeOpacity={0.82}
                    >
                      {isProcessing ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <LineCheckCircle color="#FFFFFF" size={16} />
                          <Text style={styles.actionBtnCompleteText} numberOfLines={1} ellipsizeMode="tail">
                            {t('Complete & Next')}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>

                </View>
              ) : (
                <View style={[styles.nowServingCard, { backgroundColor: colors.cardBg, borderColor: colors.borderSubtle, alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 }, colors.cardShadow]}>
                  <View style={[styles.quickActionCircle, { backgroundColor: colors.tealTint, width: 52, height: 52, borderRadius: 26, marginBottom: 10, alignItems: 'center', justifyContent: 'center' }]}>
                    <LineSpeaker color={colors.tealDeep} size={24} />
                  </View>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 4, textAlign: 'center' }}>
                    {t('No Patient in Consultation')}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 14 }}>
                    {displayQueue.length > 0
                      ? t('{value0} patient(s) waiting in queue', { value0: String(displayQueue.length) })
                      : t('Queue is clear. New walk-in patients will appear here.')}
                  </Text>
                  {displayQueue.length > 0 && (
                    <TouchableOpacity
                      style={[styles.actionBtnComplete, { alignSelf: 'stretch', justifyContent: 'center' }]}
                      onPress={handleCallNext}
                      disabled={isProcessing}
                      activeOpacity={0.82}
                    >
                      <Ionicons name="notifications" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.actionBtnCompleteText}>
                        {t('Call Next Patient (#{value0})', { value0: String(displayQueue[0].tokenNumber).padStart(3, '0') })}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* ========================================================= */}
            {/* SECTION 3: QUICK ACTIONS (FOUR 56px CIRCULAR BUTTONS) */}
            {/* ========================================================= */}
            <View style={styles.quickActionsSection}>
              <View style={styles.quickActionsRow}>
                {/* 1. Call Next (speaker icon) */}
                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={handleCallNext}
                  disabled={isProcessing}
                  activeOpacity={0.7}
                >
                  <View style={[styles.quickActionCircle, { backgroundColor: colors.cardBg, borderColor: colors.borderSubtle }, colors.cardShadowSm]}>
                    <LineSpeaker color={colors.tealDeep} size={22} />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: colors.textPrimary }]} numberOfLines={1}>
                    {t('Call Next')}
                  </Text>
                </TouchableOpacity>

                {/* 2. Add Walk-in (user-plus icon) */}
                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={handleOpenWalkInModal}
                  activeOpacity={0.7}
                >
                  <View style={[styles.quickActionCircle, { backgroundColor: colors.cardBg, borderColor: colors.borderSubtle }, colors.cardShadowSm]}>
                    <LineUserPlus color={colors.tealDeep} size={22} />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: colors.textPrimary }]} numberOfLines={1}>
                    {t('Add Walk-in')}
                  </Text>
                </TouchableOpacity>

                {/* 3. 15m Break (coffee cup icon) */}
                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={handleTake15mBreak}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.quickActionCircle,
                      { backgroundColor: colors.cardBg, borderColor: colors.borderSubtle },
                      activeBreak && { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' },
                      colors.cardShadowSm,
                    ]}
                  >
                    <LineCoffee color={activeBreak ? '#B45309' : colors.tealDeep} size={22} />
                  </View>
                  <Text
                    style={[
                      styles.quickActionLabel,
                      { color: colors.textPrimary },
                      activeBreak && { color: '#B45309', fontWeight: '800' },
                    ]}
                    numberOfLines={1}
                  >
                    {activeBreak ? t('End Break') : t('15m Break')}
                  </Text>
                </TouchableOpacity>

                {/* 4. Recall (bell icon) */}
                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={handleRecallPatient}
                  activeOpacity={0.7}
                >
                  <View style={[styles.quickActionCircle, { backgroundColor: colors.cardBg, borderColor: colors.borderSubtle }, colors.cardShadowSm]}>
                    <LineBell color={colors.tealDeep} size={22} />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: colors.textPrimary }]} numberOfLines={1}>
                    {t('Recall')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ========================================================= */}
            {/* SECTION 4: UP NEXT IN QUEUE */}
            {/* ========================================================= */}
            <View style={styles.queueSection}>
              {/* Header row */}
              <View style={styles.queueHeaderRow}>
                <Text style={[styles.queueTitleText, { color: colors.textSecondary }]}>
                  {t('UP NEXT IN QUEUE')}
                </Text>
                <TouchableOpacity
                  style={styles.fullQueueBtn}
                  onPress={() => router.push('/(doctor)/queue')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.fullQueueText}>{t('Full Queue')}</Text>
                  <LineChevronRight color="#0E8F9A" size={15} />
                </TouchableOpacity>
              </View>

              {/* Vertical list of queue cards */}
              <View style={styles.queueCardsList}>
                {displayQueue.length === 0 ? (
                  <View style={[styles.queueCard, { backgroundColor: colors.cardBg, borderColor: colors.borderSubtle, alignItems: 'center', justifyContent: 'center', paddingVertical: 24, paddingHorizontal: 16 }]}>
                    <Ionicons name="people-outline" size={32} color={colors.textSecondary} style={{ marginBottom: 8 }} />
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>
                      {t('No Patients in Queue')}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4, textAlign: 'center' }}>
                      {t('New checked-in or walk-in patients will appear here automatically.')}
                    </Text>
                  </View>
                ) : (
                  displayQueue.map((item, index) => (
                    <TouchableOpacity
                      key={`${item.tokenNumber}-${index}`}
                      style={[styles.queueCard, { backgroundColor: colors.cardBg, borderColor: colors.borderSubtle }, colors.cardShadowSm]}
                      activeOpacity={0.85}
                      onPress={() =>
                        Alert.alert(
                          `Token #${String(item.tokenNumber).padStart(3, '0')} - ${item.patientName}`,
                          `${item.reason || 'OPD Consultation'}\nTime: ${item.slotTime || '--:--'}`,
                          [
                            {
                              text: t('Call into Room'),
                              onPress: async () => {
                                setIsProcessing(true);
                                try {
                                  const res = await callSpecificTokenApi(item.tokenNumber);
                                  if (res && res.data) setData(res.data);
                                } finally {
                                  setIsProcessing(false);
                                }
                              },
                            },
                            {
                              text: t('View Records'),
                              onPress: () => {
                                router.push({
                                  pathname: '/(doctor)/records' as any,
                                  params: {
                                    tokenNumber: String(item.tokenNumber),
                                    patientName: item.patientName,
                                    patientId: (item as any).patientId || '',
                                  },
                                });
                              },
                            },
                            {
                              text: t('Prescribe Rx'),
                              onPress: () => {
                                router.push({
                                  pathname: '/(doctor)/prescription' as any,
                                  params: {
                                    tokenNumber: String(item.tokenNumber),
                                    patientName: item.patientName,
                                    patientId: (item as any).patientId || '',
                                  },
                                });
                              },
                            },
                            { text: t('Cancel'), style: 'cancel' },
                          ]
                        )
                      }
                    >
                      {/* Light-tint token tile (58px) */}
                      <View style={[styles.queueTokenTile, { backgroundColor: colors.tealTint }]}>
                        <Text style={[styles.queueTokenLabel, { color: colors.tealDeep }]}>
                          {t('TKN')}
                        </Text>
                        <Text style={[styles.queueTokenNum, { color: colors.tealDeep }]}>
                          {String(item.tokenNumber).padStart(3, '0')}
                        </Text>
                      </View>

                      {/* Patient Name and Subtitle */}
                      <View style={styles.queueItemInfo}>
                        <Text style={[styles.queueItemName, { color: colors.textPrimary }]} numberOfLines={1}>
                          {item.patientName}
                        </Text>
                        <Text style={[styles.queueItemSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                          {t(item.reason || (index === 0 ? 'OPD Check' : 'Follow-up'))} • {item.age} {t('yrs')}
                        </Text>
                      </View>

                      {/* Teal-tinted Appointment Time Pill & Three-dot Menu */}
                      <View style={styles.queueCardRight}>
                        <View style={[styles.queueTimePill, { backgroundColor: colors.tealTint }]}>
                          <Text style={[styles.queueTimeText, { color: colors.tealDeep }]}>
                            {item.slotTime || '--:--'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.threeDotBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            Alert.alert(
                              `${item.patientName} (Token #${String(item.tokenNumber).padStart(3, '0')})`,
                              t('Choose an action'),
                              [
                                { text: t('Cancel'), style: 'cancel' },
                                {
                                  text: t('Remove'),
                                  style: 'destructive',
                                  onPress: () => handleRemoveQueuePatient(item.tokenNumber, item.patientName),
                                },
                              ]
                            );
                          }}
                          accessibilityLabel={`Options for ${item.patientName}`}
                        >
                          <LineThreeDot color={colors.textSecondary} size={18} />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </View>

          </ScrollView>

          {/* ========================================================= */}
          {/* BOTTOM NAVIGATION TABS (5 TABS) */}
          {/* ========================================================= */}
          <View style={[styles.bottomTabBar, { backgroundColor: colors.cardBg, borderTopColor: colors.borderSubtle }]}>
            <TouchableOpacity style={styles.tabItem} onPress={() => handleTabPress('home')}>
              <Ionicons name="home" size={22} color={activeTab === 'home' ? '#0B4F59' : '#9DB2B8'} />
              <Text style={[styles.tabLabel, activeTab === 'home' && styles.tabLabelActive]}>{t('Home')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.tabItem} onPress={() => handleTabPress('queue')}>
              <MaterialCommunityIcons name="ticket-confirmation-outline" size={22} color={activeTab === 'queue' ? '#0B4F59' : '#9DB2B8'} />
              <Text style={[styles.tabLabel, activeTab === 'queue' && styles.tabLabelActive]}>{t('Queue')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.tabItem} onPress={() => handleTabPress('records')}>
              <MaterialCommunityIcons name="folder-account-outline" size={22} color={activeTab === 'records' ? '#0B4F59' : '#9DB2B8'} />
              <Text style={[styles.tabLabel, activeTab === 'records' && styles.tabLabelActive]}>{t('Records')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.tabItem} onPress={() => handleTabPress('schedule')}>
              <MaterialCommunityIcons name="calendar-month-outline" size={22} color={activeTab === 'schedule' ? '#0B4F59' : '#9DB2B8'} />
              <Text style={[styles.tabLabel, activeTab === 'schedule' && styles.tabLabelActive]}>{t('Schedule')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.tabItem} onPress={() => handleTabPress('rx')}>
              <MaterialCommunityIcons name="clipboard-edit-outline" size={22} color={activeTab === 'rx' ? '#0B4F59' : '#9DB2B8'} />
              <Text style={[styles.tabLabel, activeTab === 'rx' && styles.tabLabelActive]}>{t('Prescription')}</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>

      {/* ========================================================= */}
      {/* HOSPITAL SELECTION MODAL */}
      {/* ========================================================= */}
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
          <View style={[styles.modalCard, { backgroundColor: colors.cardBg }]} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <MaterialCommunityIcons name="hospital-building" size={22} color="#0B4F59" style={{ marginRight: 8 }} />
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t("Select Hospital Duty")}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsHospitalModalOpen(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              {t("Select the hospital you are currently stationed at for OPD patient consultations.")}
            </Text>

            <View style={styles.modalHospitalList}>
              {availableHospitals.map((hosp, idx) => {
                const isSelected = currentHospital === hosp;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.modalHospitalItem,
                      isSelected && { borderColor: '#0B4F59', backgroundColor: colors.tealTint },
                    ]}
                    onPress={() => handleSelectHospital(hosp)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.modalHospitalItemLeft}>
                      <View style={[styles.modalItemIconCircle, isSelected && { backgroundColor: '#0B4F59' }]}>
                        <Ionicons
                          name="business"
                          size={18}
                          color={isSelected ? '#FFFFFF' : '#64748b'}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.modalHospitalItemName, { color: colors.textPrimary }]} numberOfLines={1}>
                          {hosp}
                        </Text>
                        <Text style={[styles.modalHospitalItemSub, { color: colors.textSecondary }]}>
                          {isSelected ? 'Currently Stationed • Active' : 'Tap to switch location'}
                        </Text>
                      </View>
                    </View>
                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={22} color="#0B4F59" />
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

      {/* ========================================================= */}
      {/* WALK-IN REGISTRATION MODAL */}
      {/* ========================================================= */}
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
          <View style={[styles.walkInModalContent, { backgroundColor: colors.cardBg }]} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <View style={styles.walkInHeaderIconCircle}>
                  <Ionicons name="person-add" size={18} color="#0B4F59" />
                </View>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t('Add Walk-in')}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsWalkInModalOpen(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              {t('Register an unscheduled or emergency walk-in patient directly to today\'s queue.')}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              <View style={styles.walkInFieldGroup}>
                <Text style={[styles.walkInFieldLabel, { color: colors.textPrimary }]}>{t('Patient Full Name *')}</Text>
                <TextInput
                  style={[styles.walkInTextInput, { backgroundColor: colors.chipGrey, color: colors.textPrimary }]}
                  placeholder="e.g. Kasun Bandara"
                  placeholderTextColor="#94a3b8"
                  value={walkInName}
                  onChangeText={setWalkInName}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.walkInRowGroup}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={[styles.walkInFieldLabel, { color: colors.textPrimary }]}>{t('Age')}</Text>
                  <TextInput
                    style={[styles.walkInTextInput, { backgroundColor: colors.chipGrey, color: colors.textPrimary }]}
                    placeholder="e.g. 38"
                    placeholderTextColor="#94a3b8"
                    value={walkInAge}
                    onChangeText={setWalkInAge}
                    keyboardType="numeric"
                    maxLength={3}
                  />
                </View>

                <View style={{ flex: 1.6 }}>
                  <Text style={[styles.walkInFieldLabel, { color: colors.textPrimary }]}>{t('Gender')}</Text>
                  <View style={styles.genderSelectRow}>
                    {(['Male', 'Female', 'Other'] as const).map((g) => (
                      <TouchableOpacity
                        key={g}
                        style={[
                          styles.genderSelectPill,
                          { backgroundColor: colors.chipGrey },
                          walkInGender === g && { backgroundColor: '#0B4F59' },
                        ]}
                        onPress={() => setWalkInGender(g)}
                      >
                        <Text
                          style={[
                            styles.genderSelectPillText,
                            { color: colors.textSecondary },
                            walkInGender === g && { color: '#FFFFFF', fontWeight: '800' },
                          ]}
                        >
                          {t(g)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.walkInFieldGroup}>
                <Text style={[styles.walkInFieldLabel, { color: colors.textPrimary }]}>{t('Chief Complaint / Reason')}</Text>
                <TextInput
                  style={[styles.walkInTextInput, { height: 68, textAlignVertical: 'top', paddingTop: 8, backgroundColor: colors.chipGrey, color: colors.textPrimary }]}
                  placeholder="e.g. Spine checkup, acute pain..."
                  placeholderTextColor="#94a3b8"
                  value={walkInReason}
                  onChangeText={setWalkInReason}
                  multiline
                />
              </View>
            </ScrollView>

            <View style={styles.walkInModalActions}>
              <TouchableOpacity
                style={[styles.walkInCancelBtn, { backgroundColor: colors.chipGrey }]}
                onPress={() => setIsWalkInModalOpen(false)}
                disabled={isSubmittingWalkIn}
              >
                <Text style={[styles.walkInCancelBtnText, { color: colors.textSecondary }]}>{t('Cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.walkInSubmitBtn}
                onPress={handleRegisterWalkIn}
                disabled={isSubmittingWalkIn}
              >
                {isSubmittingWalkIn ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.walkInSubmitBtnText}>{t('Add Walk-in')}</Text>
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

// ==========================================
// STYLES (ROUNDED EVERYWHERE, 420px MAX WIDTH)
// ==========================================
const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
  },
  centerAlignWrapper: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
  },
  mobileContainer: {
    width: '100%',
    maxWidth: 420,
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 28,
  },

  // ------------------------------------------
  // 1. GRADIENT HEADER (#0B4F59 -> #0E8F9A)
  // ------------------------------------------
  gradientHeader: {
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 24 : 14,
    paddingBottom: 70, // Room for overlapping card
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  doctorProfileWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  doctorInfoCol: {
    justifyContent: 'center',
  },
  doctorName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  onlineBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  greenOnlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  onlineBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.92)',
  },
  headerActionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#0E8F9A',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  greetingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  greetingWrap: {
    flex: 1,
  },
  greetingSmall: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.88)',
  },
  greetingDoctor: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 33,
    letterSpacing: -0.5,
  },
  shiftStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 4,
  },
  shiftStatusBadgeBreak: {
    backgroundColor: 'rgba(254, 243, 199, 0.35)',
    borderColor: '#FCD34D',
  },
  shiftStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  shiftStatusDotBreak: {
    backgroundColor: '#F59E0B',
  },
  shiftStatusText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  shiftStatusTextBreak: {
    color: '#FEF08A',
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 18,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    marginTop: 14,
  },
  locationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 6,
  },
  locationText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  locationSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(11, 79, 89, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  locationSwitchText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statTilesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  statTile: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 11,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 4,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 26,
  },
  statSuffix: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.85)',
  },

  // ------------------------------------------
  // ACTIVE BREAK PROMINENT CARD
  // ------------------------------------------
  dashboardBreakCard: {
    marginHorizontal: 16,
    marginTop: -40,
    marginBottom: 12,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    borderRadius: 22,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#B45309',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    zIndex: 15,
  },
  dashboardBreakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dashboardBreakIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashboardBreakTextWrap: {
    flex: 1,
  },
  dashboardBreakTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dashboardBreakTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400E',
  },
  dashboardBreakLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FDE68A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  dashboardBreakLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D97706',
  },
  dashboardBreakLiveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
  },
  dashboardBreakSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B45309',
    marginTop: 2,
  },
  dashboardEndBreakBtn: {
    backgroundColor: '#D97706',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  dashboardEndBreakBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  // ------------------------------------------
  // 2. NOW SERVING CARD (OVERLAPPING BY 50PX)
  // ------------------------------------------
  nowServingContainer: {
    paddingHorizontal: 16,
    marginTop: -50, // 50px overlap
    zIndex: 10,
  },
  nowServingCard: {
    borderRadius: 26,
    padding: 16,
    borderWidth: 1,
  },
  nowServingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pulsingTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  pulseDotOuter: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pulseDotRing: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#0E8F9A',
    opacity: 0.35,
  },
  pulseDotCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0E8F9A',
  },
  nowServingLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: '#0E8F9A',
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tokenBadgeDark: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: '#0B4F59',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B4F59',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  tokenBadgeLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  tokenBadgeNumber: {
    fontSize: 25,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 29,
    letterSpacing: -0.5,
  },
  patientDetailsCol: {
    flex: 1,
    justifyContent: 'center',
  },
  patientNameText: {
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 22,
  },
  patientSubtitleText: {
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 3,
  },
  vitalsChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  vitalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 12,
  },
  vitalChipLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  vitalChipVal: {
    fontSize: 12,
    fontWeight: '800',
  },
  allergyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 11,
  },
  allergyText: {
    fontSize: 12.5,
    fontWeight: '800',
  },

  // Action Row: Three 48px buttons fitted perfectly
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 13,
  },
  actionBtnUndo: {
    width: 44,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnRx: {
    height: 48,
    borderRadius: 16,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionBtnRxText: {
    fontSize: 12,
    fontWeight: '800',
  },
  actionBtnComplete: {
    flex: 1.35,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#0B4F59',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 5,
    shadowColor: '#0B4F59',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  actionBtnCompleteText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  // ------------------------------------------
  // 3. QUICK ACTIONS (FOUR 56px CIRCULAR BUTTONS)
  // ------------------------------------------
  quickActionsSection: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  quickActionsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  quickActionItem: {
    alignItems: 'center',
    flex: 1,
  },
  quickActionCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },

  // ------------------------------------------
  // 4. UP NEXT IN QUEUE
  // ------------------------------------------
  queueSection: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  queueHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 11,
  },
  queueTitleText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  fullQueueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  fullQueueText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0E8F9A',
  },
  queueCardsList: {
    gap: 11,
  },
  queueCard: {
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  queueTokenTile: {
    width: 58,
    height: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueTokenLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    opacity: 0.8,
  },
  queueTokenNum: {
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
  },
  queueItemInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  queueItemName: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
  queueItemSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  queueCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  queueTimePill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },
  queueTimeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  threeDotBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ------------------------------------------
  // 5. BOTTOM NAVIGATION BAR
  // ------------------------------------------
  bottomTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    flex: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9DB2B8',
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#0B4F59',
    fontWeight: '800',
  },

  // ------------------------------------------
  // MODALS
  // ------------------------------------------
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 20,
  },
  walkInModalContent: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walkInHeaderIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DDF1F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 16,
    lineHeight: 18,
  },
  modalHospitalList: {
    gap: 10,
  },
  modalHospitalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  modalHospitalItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  modalItemIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHospitalItemName: {
    fontSize: 14,
    fontWeight: '800',
  },
  modalHospitalItemSub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },

  // Walk-in modal fields
  walkInFieldGroup: {
    marginBottom: 14,
  },
  walkInRowGroup: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  walkInFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  walkInTextInput: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  genderSelectRow: {
    flexDirection: 'row',
    gap: 6,
  },
  genderSelectPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderSelectPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  walkInModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
  },
  walkInCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkInCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  walkInSubmitBtn: {
    flex: 1.4,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#0B4F59',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkInSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
