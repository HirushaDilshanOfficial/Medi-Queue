import { router } from 'expo-router';
import { clearAuthToken } from '../../services/http';
import { setAuthToken as setApiAuthToken } from '../../services/api';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  Animated,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { CurrentlyServingToken, QueueToken } from '../../types';
import { useAuth, useDashboard } from '../../hooks';
import { useShiftContext } from '../../context/ShiftContext';
import {
  getErrorMessage,
  searchPatients,
  validateQueuePass,
} from '../../services/api';
import {
  LoadingState,
  ErrorState,
  Toast,
  ToastType,
  BarcodeScannerModal,
} from '../../components';

export interface ReceptionistHomeScreenProps {
  navigation?: any;
  onNavigate?: (route: string) => void;
}

export const ReceptionistHomeScreen: React.FC<ReceptionistHomeScreenProps> = ({
  navigation,
  onNavigate,
}) => {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const { isShiftClosed } = useShiftContext();
  const { data, loading, error, refreshing, refresh } = useDashboard();
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Modals state
  const [profileModalVisible, setProfileModalVisible] = useState<boolean>(false);
  const [activeCounter, setActiveCounter] = useState<string>('OPD Counter 01');
  const [reprintModalVisible, setReprintModalVisible] = useState<boolean>(false);
  const [rosterModalVisible, setRosterModalVisible] = useState<boolean>(false);
  const [notificationModalVisible, setNotificationModalVisible] = useState<boolean>(false);
  const [verifyNicModalVisible, setVerifyNicModalVisible] = useState<boolean>(false);
  const [verifyNicQuery, setVerifyNicQuery] = useState<string>('');
  const [verifyNicLoading, setVerifyNicLoading] = useState<boolean>(false);
  const [verifyNicResult, setVerifyNicResult] = useState<any>(null);
  const [scannerModalVisible, setScannerModalVisible] = useState<boolean>(false);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastType, setToastType] = useState<ToastType>('success');
  const [toastVisible, setToastVisible] = useState<boolean>(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isMounted = useRef<boolean>(true);

  // Current live time
  const [currentTime, setCurrentTime] = useState<string>('09:41 AM');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 10000);
    return () => clearInterval(timer);
  }, []);

  // Derive staff display initials, name, and role
  const staffName = user?.fullName || user?.name || 'Dinusha Shashini';
  const staffRole = user?.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1)) : 'Receptionist';
  const staffEmail = user?.email || 'dinusha.reception@mediqueue.lk';
  const staffInitials = staffName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || 'DS';

  // Action: Logout
  const performLogout = async () => {
    setProfileModalVisible(false);
    try {
      await clearAuthToken();
      setApiAuthToken(null);
      if (logout) {
        await logout();
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      if (onNavigate) {
        onNavigate('login');
      } else if (navigation?.replace) {
        navigation.replace('Login');
      } else {
        router.replace('/(auth)/login' as any);
      }
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined'
        ? window.confirm(t('Are you sure you want to log out of your receptionist account?'))
        : true;
      if (confirmed) {
        performLogout();
      }
    } else {
      Alert.alert(
        t('Log Out'),
        t('Are you sure you want to log out of your receptionist account?'),
        [
          { text: t('Cancel'), style: 'cancel' },
          {
            text: t('Log Out'),
            style: 'destructive',
            onPress: performLogout,
          },
        ]
      );
    }
  };

  // Helper to handle navigation whether in React Navigation stack or Expo Router
  const handleNav = (target: string) => {
    if (onNavigate) {
      onNavigate(target);
    } else if (navigation?.navigate) {
      navigation.navigate(target);
    }
  };

  // Pulsing animation for LIVE badge
  useEffect(() => {
    isMounted.current = true;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => {
      isMounted.current = false;
      pulse.stop();
    };
  }, [pulseAnim]);

  // Show Toast Helper
  const showToast = useCallback(
    (message: string, type: ToastType = 'success') => {
      setToastMessage(message);
      setToastType(type);
      setToastVisible(true);
    },
    []
  );

  // Action: Verify NIC Quick Lookup
  const handleVerifyNicSearch = async () => {
    executeSearchForVerify(verifyNicQuery);
  };

  const executeSearchForVerify = async (queryVal: string) => {
    const trimmed = queryVal.trim();
    if (!trimmed) {
      showToast(t("Please enter or scan an NIC / Barcode"), 'warning');
      return;
    }
    try {
      setVerifyNicLoading(true);
      setVerifyNicResult(null);
      const res = await searchPatients(trimmed);
      const patients = res?.patients || (Array.isArray(res) ? res : []);
      const matched = patients.find((p: any) =>
        (p.nic && p.nic.toLowerCase() === trimmed.toLowerCase()) ||
        (p.fullName && p.fullName.toLowerCase().includes(trimmed.toLowerCase()))
      );
      if (matched) {
        setVerifyNicResult({ found: true, patient: matched });
      } else {
        setVerifyNicResult({ found: false });
      }
    } catch {
      showToast(t("Error verifying NIC. Please try again."), 'error');
    } finally {
      if (isMounted.current) {
        setVerifyNicLoading(false);
      }
    }
  };

  const handleScanForVerify = (scannedValue: string) => {
    let code = scannedValue.trim();
    const passUrl = code.match(/(?:\/pass\/|\/queue-pass\/)([^/?#\s]+)/i);
    const passCode = passUrl?.[1]
      ? decodeURIComponent(passUrl[1]).toUpperCase()
      : /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{24}$/i.test(code)
        ? code.toUpperCase()
        : null;
    if (passCode) {
      setVerifyNicQuery(passCode);
      setVerifyNicLoading(true);
      setVerifyNicResult(null);
      validateQueuePass(passCode)
        .then((result) => {
          setVerifyNicResult({
            found: Boolean(result.patient),
            patient: result.patient,
            pass: result.pass,
            isQueuePass: true,
          });
          showToast(t("Queue pass verified: {value0}", { value0: String(result.pass.tokenLabel) }), 'success');
        })
        .catch((error) => {
          setVerifyNicResult({ found: false, isQueuePass: true });
          showToast(getErrorMessage(error), 'error');
        })
        .finally(() => setVerifyNicLoading(false));
      return;
    }
    try {
      const parsed = JSON.parse(scannedValue);
      if (parsed.nic) code = parsed.nic;
      else if (parsed.bookingRef) code = parsed.bookingRef;
      else if (parsed.phone) code = parsed.phone;
    } catch {}
    setVerifyNicQuery(code);
    executeSearchForVerify(code);
    showToast(t("Scanned: {value0}", { value0: String(code) }), 'success');
  };

  // Live data from database
  const serving: CurrentlyServingToken | null = data?.currentlyServing || null;

  // Consultation rooms from database
  const rooms: any[] = data?.rooms && data.rooms.length > 0 ? data.rooms : [];

  // Active upcoming queue from database (real patients only)
  const nextInQueue: QueueToken[] = (data?.nextInQueue || []).filter((t: any) => Boolean(t && t.patient));

  const totalIntake = data?.intake?.total ?? 0;
  const walkInCount = data?.intake?.walkIn ?? 0;
  const preBookedCount = data?.intake?.preBooked ?? 0;
  const inWaiting = data?.inWaiting ?? nextInQueue.length;
  const avgWait = data?.avgWaitMinutes ?? 0;
  const attendedDone = data?.attendedDone ?? 0;
  const activeDocs = data?.doctorsActive ?? (rooms.filter((r) => r.status === 'Consulting' || r.status === 'Available').length);

  const topWaiting = nextInQueue[0];
  const topWaitingPatient: any = topWaiting?.patient || {};
  const topWaitingDoctor: any = topWaiting?.assignedDoctor || {};

  const servingDocName = typeof serving?.doctor === 'object' && (serving?.doctor as any)?.name
    ? (serving.doctor as any).name
    : (typeof serving?.doctor === 'string' ? serving.doctor : '');
  const servingDocDept = typeof serving?.doctor === 'object' && (serving?.doctor as any)?.department
    ? (serving.doctor as any).department
    : '';

  const nextTokenLabel = topWaiting?.tokenLabel
    ? (topWaiting.tokenLabel.startsWith('#') ? `OPD-0${topWaiting.tokenLabel.replace('#', '')}` : topWaiting.tokenLabel)
    : (topWaiting?.tokenNumber ? `OPD-${String(topWaiting.tokenNumber).padStart(3, '0')}` : '');

  // Helper to cleanly format room label without duplicate "Room Room"
  const cleanRoomDisplay = (room?: string | null): string => {
    if (!room) return 'Room 1A';
    const trimmed = String(room).trim();
    if (/^room\s+/i.test(trimmed)) {
      return trimmed.replace(/^room\s+/i, 'Room ');
    }
    return `Room ${trimmed}`;
  };


  // Render loading or error states after all hooks have been invoked
  if (loading && !data) {
    return <LoadingState fullscreen message={`Loading ${activeCounter}...`} />;
  }

  if (error && !data) {
    return (
      <ErrorState
        fullscreen
        title={t("Dashboard Error")}
        message={error}
        onRetry={() => refresh(false)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#063C46" />

      {/* ── TOAST NOTIFICATION BANNER ── */}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        duration={2500}
        onDismiss={() => setToastVisible(false)}
      />

      {/* ── TOP DARK TEAL HEADER ── */}
      <View style={styles.header}>
        {/* Row 1: Time & Counter Online */}
        <View style={styles.statusTopRow}>
          <Text style={styles.statusTimeText}>{currentTime}</Text>
          <View style={styles.counterOnlineWrap}>
            <Text style={styles.counterOnlineText}>{t('Counter Online')}</Text>
            <View style={styles.onlineDot} />
          </View>
        </View>

        {/* Row 2: Duty Shift & Desk Hours Container */}
        <View style={styles.dutyCard}>
          <View style={styles.dutyCardLeft}>
            <Text style={styles.dutyShiftSubtitle}>{t('DUTY SHIFT 1 • STATION #01')}</Text>
            <Text style={styles.dutyShiftTitle}>{t('Orthopedic & General Triage')}</Text>
          </View>
          <View style={styles.deskHoursBadge}>
            <Text style={styles.deskHoursLabel}>{t('Desk Hours')}</Text>
            <Text style={styles.deskHoursValue}>08:00 - 16:30</Text>
          </View>
        </View>

        {/* Row 3: Staff Profile & Notification Bell */}
        <View style={styles.staffHeaderRow}>
          <TouchableOpacity
            style={styles.staffProfileTouchable}
            activeOpacity={0.7}
            onPress={() => setProfileModalVisible(true)}
            accessibilityLabel="Staff profile and desk details"
            accessibilityRole="button"
          >
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarText}>{staffInitials}</Text>
              <View style={styles.avatarStatusDot} />
            </View>

            <View style={styles.staffInfo}>
              <View style={styles.staffNameRow}>
                <Text style={styles.staffMainName} numberOfLines={1}>
                  {staffName}
                </Text>
                <Ionicons name="chevron-down" size={14} color="rgba(255, 255, 255, 0.75)" style={{ marginLeft: 4 }} />
              </View>
              <View style={styles.staffMetaRow}>
                <Text style={styles.staffMetaText}>
                  {t(staffRole)} • {activeCounter}
                </Text>
                <View style={styles.livePill}>
                  <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
                  <Text style={styles.liveText}>{t('LIVE')}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.bellButton}
            activeOpacity={0.8}
            onPress={() => setNotificationModalVisible(true)}
            accessibilityLabel={t("Notifications")}
            accessibilityRole="button"
          >
            <Ionicons name="notifications" size={20} color={Colors.white} />
            <View style={styles.bellBadge} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => refresh(true)}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        {/* ── SHIFT CLOSED NOTICE BANNER ── */}
        {isShiftClosed && (
          <View style={styles.shiftClosedNoticeBanner}>
            <Ionicons name="lock-closed" size={16} color="#92400E" style={{ marginRight: 8 }} />
            <Text style={styles.shiftClosedNoticeText}>{t('Shift closed. Intake is disabled.')}</Text>
          </View>
        )}

        {/* ── 2x2 STAT CARDS GRID ── */}
        <View style={styles.statGrid}>
          {/* Top Row: Total Intake Today & In Waiting */}
          <View style={styles.statRow}>
            {/* Card 1: Total Intake */}
            <View style={styles.statCard}>
              <View style={styles.statCardTop}>
                <Text style={styles.statCardTitle}>{t('Total Intake Today')}</Text>
                <View style={[styles.statIconCircle, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="people" size={16} color={Colors.primary} />
                </View>
              </View>
              <Text style={styles.statCardValue}>{totalIntake}</Text>
              <Text style={styles.statCardSubtext}>
                {t('Walk-in:')} {walkInCount} • {t('Pre-booked:')} {preBookedCount}
              </Text>
            </View>

            {/* Card 2: In Waiting */}
            <TouchableOpacity
              style={styles.statCard}
              onPress={() => handleNav('Queue')}
              activeOpacity={0.7}
              accessibilityLabel="View In Waiting Queue"
              accessibilityRole="button"
            >
              <View style={styles.statCardTop}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.statCardTitle}>{t('In Waiting')}</Text>
                  <Ionicons name="chevron-forward" size={13} color="#D97706" style={{ marginLeft: 2 }} />
                </View>
                <View style={[styles.statIconCircle, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="time" size={16} color="#D97706" />
                </View>
              </View>
              <Text style={[styles.statCardValue, { color: '#D97706' }]}>{inWaiting}</Text>
              <Text style={styles.statCardSubtext}>
                {t('Avg Wait:')} <Text style={{ fontWeight: '700', color: Colors.textDark }}>{avgWait} {t('mins')}</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Bottom Row: Attended Done & Doctors Active */}
          <View style={styles.statRow}>
            {/* Card 3: Attended Done */}
            <View style={styles.statCard}>
              <View style={styles.statCardTop}>
                <Text style={styles.statCardTitle}>{t('Attended Done')}</Text>
                <View style={[styles.statIconCircle, { backgroundColor: '#D1FAE5' }]}>
                  <Ionicons name="checkmark-circle" size={16} color="#059669" />
                </View>
              </View>
              <Text style={styles.statCardValue}>{attendedDone}</Text>
              <Text style={[styles.statCardSubtext, { color: '#059669', fontWeight: '600' }]}>
                {t('Completed smoothly')}
              </Text>
            </View>

            {/* Card 4: Doctors Active */}
            <View style={styles.statCard}>
              <View style={styles.statCardTop}>
                <Text style={styles.statCardTitle}>{t('Doctors Active')}</Text>
                <View style={[styles.statIconCircle, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="medkit" size={16} color="#2563EB" />
                </View>
              </View>
              <Text style={styles.statCardValue}>{activeDocs}</Text>
              <Text style={styles.statCardSubtext}>{t('Specialists on shift')}</Text>
            </View>
          </View>
        </View>

        {/* ── OPD PATIENT QUEUE MONITOR (HERO CARD) ── */}
        <View style={styles.heroServingCard}>
          {serving ? (
            <>
              {/* Top Tag Row */}
              <View style={styles.heroServingHeader}>
                <View style={styles.nowServingBadge}>
                  <Text style={styles.nowServingBadgeText}>{t('CURRENTLY IN OPD CONSULTATION')}</Text>
                </View>
                <View style={styles.liveConsultationBadge}>
                  <Animated.View style={[styles.liveConsultationDot, { opacity: pulseAnim }]} />
                  <Text style={styles.liveConsultationText}>{t('ACTIVE WITH DOCTOR')}</Text>
                </View>
              </View>

              {/* Token Header Row */}
              <View style={styles.heroTokenRow}>
                <View>
                  <Text style={styles.patientQueueLabel}>{t('Patient Queue Token')}</Text>
                  <Text style={styles.heroTokenText}>{serving.tokenLabel}</Text>
                </View>
                <View style={styles.walkInTypePill}>
                  <Text style={styles.walkInTypePillText}>{t('In Consultation')}</Text>
                </View>
              </View>

              {/* Inner White Card with Patient & Doctor info */}
              <View style={styles.innerServingCard}>
                <View style={styles.patientNameRow}>
                  <Text style={styles.innerPatientName}>
                    {serving.patient?.name || t('Patient')}
                  </Text>
                  <Text style={styles.innerPatientTime}>{currentTime}</Text>
                </View>

                <Text style={styles.innerPatientMeta}>
                  {t('Age')}: {serving.patient?.age ?? 'N/A'} • {t(serving.patient?.gender || 'N/A')} • {t('NIC')}: {serving.patient?.nic || 'N/A'}
                </Text>

                {/* Doctor assigned row */}
                <View style={styles.innerDoctorBox}>
                  <View style={styles.doctorAvatarCircle}>
                    <Text style={styles.doctorAvatarText}>
                      {(servingDocName || 'DR').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.innerDoctorName}>
                      {servingDocName || t('Assigned Specialist')}
                    </Text>
                    <Text style={styles.innerDoctorDept}>
                      {servingDocDept || t('Consultant')} • {cleanRoomDisplay(serving.room)}
                    </Text>
                  </View>
                </View>

                {/* Informative Status Strip (View Only) */}
                <View style={styles.opdConsultationStatusBox}>
                  <View style={styles.opdStatusPill}>
                    <Animated.View style={[styles.opdStatusDot, { opacity: pulseAnim }]} />
                    <Text style={styles.opdStatusPillText}>{t('IN OPD CONSULTATION')}</Text>
                  </View>
                  <View style={styles.opdRoomBadge}>
                    <Ionicons name="location-outline" size={12} color="#0F766E" style={{ marginRight: 3 }} />
                    <Text style={styles.opdRoomBadgeText}>{cleanRoomDisplay(serving.room)}</Text>
                  </View>
                </View>
              </View>
            </>
          ) : topWaiting ? (
            <>
              {/* Ready / Next in OPD Queue */}
              <View style={styles.heroServingHeader}>
                <View style={[styles.nowServingBadge, { backgroundColor: 'rgba(245, 158, 11, 0.25)', borderColor: '#F59E0B' }]}>
                  <Text style={[styles.nowServingBadgeText, { color: '#FDE68A' }]}>
                    {t('NEXT PATIENT IN OPD QUEUE')}
                  </Text>
                </View>
                <View style={[styles.liveConsultationBadge, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                  <Text style={[styles.liveConsultationText, { color: '#FDE68A' }]}>{t('WAITING IN LOBBY')}</Text>
                </View>
              </View>

              {/* Token Header Row */}
              <View style={styles.heroTokenRow}>
                <View>
                  <Text style={styles.patientQueueLabel}>{t('Next Token In Line')}</Text>
                  <Text style={styles.heroTokenText}>{nextTokenLabel}</Text>
                </View>
                <View style={[styles.walkInTypePill, topWaiting.priority === 'urgent' && { backgroundColor: '#FEE2E2' }]}>
                  <Text style={[styles.walkInTypePillText, topWaiting.priority === 'urgent' && { color: '#DC2626' }]}>
                    {topWaiting.priority === 'urgent'
                      ? t('Emergency Priority')
                      : topWaiting.priority === 'senior'
                      ? t('Senior Priority')
                      : t('General Walk-In')}
                  </Text>
                </View>
              </View>

              {/* Inner White Card with Patient & Doctor info */}
              <View style={styles.innerServingCard}>
                <View style={styles.patientNameRow}>
                  <Text style={styles.innerPatientName}>
                    {topWaitingPatient.fullName || topWaitingPatient.name || t('Waiting Patient')}
                  </Text>
                  <Text style={[styles.innerPatientTime, { color: '#D97706', fontWeight: '700' }]}>{t('Waiting')}</Text>
                </View>

                <Text style={styles.innerPatientMeta}>
                  {t('Age')}: {topWaitingPatient.age ?? 'N/A'} • {t(topWaitingPatient.gender || 'N/A')} • {t('NIC')}: {topWaitingPatient.nic || 'N/A'}
                </Text>

                {/* Doctor assigned row */}
                <View style={styles.innerDoctorBox}>
                  <View style={[styles.doctorAvatarCircle, { backgroundColor: '#E0F2FE' }]}>
                    <Text style={[styles.doctorAvatarText, { color: '#0284C7' }]}>
                      {(topWaitingDoctor.name || 'DR').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.innerDoctorName}>
                      {topWaitingDoctor.name || t('Assigned Specialist')}
                    </Text>
                    <Text style={styles.innerDoctorDept}>
                      {t(topWaitingDoctor.department || 'General OPD')} • {cleanRoomDisplay(topWaitingDoctor.room)}
                    </Text>
                  </View>
                </View>

                {/* Informative Status Badge for Receptionist View */}
                <View style={styles.opdWaitingStatusBox}>
                  <View style={styles.opdWaitingPill}>
                    <Ionicons name="time" size={13} color="#D97706" style={{ marginRight: 4 }} />
                    <Text style={styles.opdWaitingPillText}>{t('WAITING FOR CALL')}</Text>
                  </View>
                  <View style={styles.opdWaitingRoomBadge}>
                    <Ionicons name="medical-outline" size={12} color="#B45309" style={{ marginRight: 3 }} />
                    <Text style={styles.opdWaitingRoomBadgeText}>{cleanRoomDisplay(topWaitingDoctor.room)}</Text>
                  </View>
                </View>
              </View>
            </>
          ) : (
            <>
              {/* Queue is empty / No patients waiting */}
              <View style={styles.heroServingHeader}>
                <View style={[styles.nowServingBadge, { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: '#10B981' }]}>
                  <Text style={[styles.nowServingBadgeText, { color: '#A7F3D0' }]}>
                    {t('OPD QUEUE CLEAR • ALL ATTENDED')}
                  </Text>
                </View>
                <Text style={styles.tokenCallCountText}>{activeCounter}</Text>
              </View>

              <View style={styles.heroTokenRow}>
                <View>
                  <Text style={styles.patientQueueLabel}>{t('Queue Status')}</Text>
                  <Text style={[styles.heroTokenText, { fontSize: 22, marginTop: 4 }]}>{t('No Patients Waiting')}</Text>
                </View>
              </View>

              <View style={styles.innerServingCard}>
                <Text style={{ fontSize: 13, color: Colors.textMedium, lineHeight: 20, marginBottom: 14 }}>
                  {t('There are no waiting patients in today’s queue. You can register a walk-in patient or check pre-booked appointments.')}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.primaryCallNextBtn,
                    isShiftClosed && styles.btnDisabled,
                  ]}
                  onPress={() => !isShiftClosed && handleNav('RegisterTab')}
                  disabled={isShiftClosed}
                  activeOpacity={0.8}
                >
                  <Ionicons name="person-add" size={18} color={Colors.white} style={{ marginRight: 8 }} />
                  <Text style={styles.primaryCallNextBtnText}>
                    {t('+ Register Walk-In Patient')}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* ── DESK QUICK ACTIONS ── */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>{t('DESK QUICK ACTIONS')}</Text>
            <TouchableOpacity onPress={() => handleNav('RegisterTab')}>
              <Text style={styles.sectionActionLink}>{t('Shortcuts')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.quickActionsRow}>
            {/* 1. + New Intake */}
            <TouchableOpacity
              style={[
                styles.quickActionCard,
                isShiftClosed && styles.btnDisabled,
              ]}
              onPress={() => !isShiftClosed && handleNav('RegisterTab')}
              disabled={isShiftClosed}
              activeOpacity={0.7}
              accessibilityLabel={t("New Intake")}
              accessibilityRole="button"
            >
              <View style={[styles.quickActionIconBox, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="person-add-outline" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.quickActionCardTitle}>{t('+ New')}</Text>
              <Text style={styles.quickActionCardTitle}>{t('Intake')}</Text>
            </TouchableOpacity>

            {/* 2. Verify NIC */}
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => {
                setVerifyNicQuery('');
                setVerifyNicResult(null);
                setVerifyNicModalVisible(true);
              }}
              activeOpacity={0.7}
              accessibilityLabel={t("Verify NIC")}
              accessibilityRole="button"
            >
              <View style={[styles.quickActionIconBox, { backgroundColor: '#F0F9FF' }]}>
                <Ionicons name="id-card-outline" size={20} color="#0284C7" />
              </View>
              <Text style={styles.quickActionCardTitle}>{t('Verify')}</Text>
              <Text style={styles.quickActionCardTitle}>{t('NIC')}</Text>
            </TouchableOpacity>

            {/* 3. Reprint Slip */}
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => setReprintModalVisible(true)}
              activeOpacity={0.7}
              accessibilityLabel={t("Reprint Slip")}
              accessibilityRole="button"
            >
              <View style={[styles.quickActionIconBox, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="print-outline" size={20} color="#D97706" />
              </View>
              <Text style={styles.quickActionCardTitle}>{t('Reprint')}</Text>
              <Text style={styles.quickActionCardTitle}>{t('Slip')}</Text>
            </TouchableOpacity>

            {/* 4. Doc Roster */}
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => setRosterModalVisible(true)}
              activeOpacity={0.7}
              accessibilityLabel="Doctor Roster"
              accessibilityRole="button"
            >
              <View style={[styles.quickActionIconBox, { backgroundColor: '#F5F3FF' }]}>
                <Ionicons name="calendar-outline" size={20} color="#7C3AED" />
              </View>
              <Text style={styles.quickActionCardTitle}>{t('Doc')}</Text>
              <Text style={styles.quickActionCardTitle}>{t('Roster')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── CONSULTATION ROOMS (LIVE) ── */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>{t('Consultation Rooms (Live)')}</Text>
            <Text style={styles.sectionBadgeCount}>
              {rooms.filter((r) => r.status === 'Consulting' || r.status === 'Available').length} {t('Active')}
            </Text>
          </View>

          {/* List of room cards matching screenshot */}
          {rooms.map((room, idx) => {
            const isConsulting = room.status === 'Consulting';
            const isAvailable = room.status === 'Available';
            const isOnBreak = room.status === 'On Break' || room.status === 'Paused';

            const badgeBg = isConsulting
              ? '#D1FAE5'
              : isAvailable
              ? '#E0F2FE'
              : '#FEF3C7';
            const badgeTextColor = isConsulting
              ? '#047857'
              : isAvailable
              ? '#0369A1'
              : '#B45309';

            const statusPillBg = isConsulting
              ? '#ECFDF5'
              : isAvailable
              ? '#EFF6FF'
              : '#FFFBEB';
            const statusTextColor = isConsulting
              ? '#059669'
              : isAvailable
              ? '#2563EB'
              : '#D97706';
            const statusDotColor = isConsulting
              ? '#10B981'
              : isAvailable
              ? '#3B82F6'
              : '#F59E0B';

            return (
              <TouchableOpacity
                key={idx}
                style={styles.roomListCard}
                activeOpacity={0.8}
                onPress={() => {
                  showToast(t("{value0} ({value1}) is currently {value2}", { value0: String(room.doctor), value1: String(room.room), value2: String(room.status) }), 'info');
                }}
              >
                {/* Room Badge */}
                <View style={[styles.roomBadgeSquare, { backgroundColor: badgeBg }]}>
                  <Text style={[styles.roomBadgeSquareText, { color: badgeTextColor }]}>
                    {room.room || `R${idx + 1}`}
                  </Text>
                </View>

                {/* Doctor info */}
                <View style={styles.roomListInfo}>
                  <Text style={styles.roomListDoctorName}>{room.doctor}</Text>
                  <Text style={styles.roomListSub}>
                    {t(room.department || 'General OPD')} • {room.withToken ? room.withToken : room.nextToken ? `${t('Next')} #${room.nextToken}` : t('With patient')}
                  </Text>
                </View>

                {/* Status Chip */}
                <View style={[styles.roomStatusPill, { backgroundColor: statusPillBg }]}>
                  <View style={[styles.roomStatusDot, { backgroundColor: statusDotColor }]} />
                  <Text style={[styles.roomStatusPillText, { color: statusTextColor }]}>
                    {t(room.status)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── NEXT IN QUEUE ── */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>{t('Next in Queue')}</Text>
            <TouchableOpacity onPress={() => handleNav('Queue')}>
              <Text style={styles.sectionActionLink}>{t('View All')} ({inWaiting})</Text>
            </TouchableOpacity>
          </View>

          {nextInQueue.length === 0 ? (
            <View style={styles.emptyQueueCard}>
              <Ionicons name="checkmark-circle-outline" size={32} color="#059669" />
              <Text style={styles.emptyQueueTitle}>{t('Queue is currently clear')}</Text>
              <Text style={styles.emptyQueueSub}>{t('No patients waiting at this time')}</Text>
            </View>
          ) : (
            nextInQueue.slice(0, 6).map((token, index) => {
              const patientObj: any = token.patient || {};
              const doctorObj: any = token.assignedDoctor || {};
              const patientName = patientObj.fullName || patientObj.name || `Patient #${token.tokenNumber || index + 1}`;
              const docDepartment = doctorObj.name || doctorObj.department || 'General OPD';
              const isCheckedIn = (token.status as any) === 'checked_in' || index === 0;
              const tokenNum = token.tokenLabel
                ? token.tokenLabel
                : (token.tokenNumber ? `OPD-${String(token.tokenNumber).padStart(3, '0')}` : `#${index + 1}`);

              return (
                <TouchableOpacity
                  key={token._id || index}
                  style={styles.queueItemCard}
                  activeOpacity={0.8}
                  onPress={() => handleNav('Queue')}
                >
                  {/* Token Badge */}
                  <View style={styles.queueTokenBadge}>
                    <Text style={styles.queueTokenBadgeText}>{tokenNum}</Text>
                  </View>

                  {/* Patient details */}
                  <View style={styles.queueItemInfo}>
                    <Text style={styles.queuePatientName}>{patientName}</Text>
                    <Text style={styles.queueDoctorSub}>{docDepartment}</Text>
                  </View>

                  {/* Status chip */}
                  <View
                    style={[
                      styles.queueStatusChip,
                      {
                        backgroundColor: isCheckedIn ? '#ECFDF5' : '#FFFBEB',
                        borderColor: isCheckedIn ? '#A7F3D0' : '#FDE68A',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.queueStatusChipText,
                        { color: isCheckedIn ? '#059669' : '#D97706' },
                      ]}
                    >
                      {isCheckedIn ? t('Next in Line') : t('Waiting')}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Bottom spacer */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── REPRINT SLIP MODAL ── */}
      <Modal
        visible={reprintModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReprintModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header with Close (X) */}
            <View style={styles.modalHeaderWithClose}>
              <View style={styles.modalHeaderTitleWrap}>
                <View style={[styles.modalIconWrapSmall, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="print" size={18} color="#D97706" />
                </View>
                <Text style={styles.modalTitleText}>{t('Reprint Patient Token')}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setReprintModalVisible(false)}
                style={styles.modalCloseIconBtn}
                accessibilityLabel="Close Reprint Modal"
              >
                <Ionicons name="close" size={20} color={Colors.textMedium} />
              </TouchableOpacity>
            </View>

            <View style={styles.slipCardPreview}>
              <Text style={styles.slipHospitalTitle}>{t('GOVERNMENT OPD CLINIC')}</Text>
              <Text style={styles.slipTokenText}>{serving?.tokenLabel || nextTokenLabel || 'OPD-001'}</Text>
              <Text style={styles.slipPatientName}>
                {serving?.patient?.name || topWaitingPatient.fullName || topWaitingPatient.name || t('Registered Patient')}
              </Text>
              <Text style={styles.slipMeta}>
                {serving?.room ? `${cleanRoomDisplay(serving.room)} · ` : ''}{servingDocDept || topWaitingDoctor.department || 'General OPD'} · {currentTime}
              </Text>
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setReprintModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>{t('Close')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => {
                  setReprintModalVisible(false);
                  showToast(t("Token slip sent to counter thermal printer 🖨️"), 'success');
                }}
              >
                <Ionicons name="print" size={16} color={Colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.modalConfirmBtnText}>{t('Print Slip')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── DOCTOR ROSTER MODAL ── */}
      <Modal
        visible={rosterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRosterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header with Close (X) */}
            <View style={styles.modalHeaderWithClose}>
              <View style={styles.modalHeaderTitleWrap}>
                <View style={[styles.modalIconWrapSmall, { backgroundColor: '#F5F3FF' }]}>
                  <Ionicons name="calendar" size={18} color="#7C3AED" />
                </View>
                <Text style={styles.modalTitleText}>{t("Today's Doctor Roster")}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setRosterModalVisible(false)}
                style={styles.modalCloseIconBtn}
                accessibilityLabel="Close Doctor Roster"
              >
                <Ionicons name="close" size={20} color={Colors.textMedium} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320, width: '100%' }}>
              {rooms.map((doc, idx) => (
                <View key={idx} style={styles.rosterItem}>
                  <View>
                    <Text style={styles.rosterDocName}>{doc.doctor}</Text>
                    <Text style={styles.rosterDocDept}>{t(doc.department || 'OPD')}{' · '}{cleanRoomDisplay(doc.room)}</Text>
                  </View>
                  <View style={styles.rosterDocHours}>
                    <Text style={styles.rosterDocHoursText}>08:00 - 16:30</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalConfirmBtn, { width: '100%', marginTop: 16 }]}
              onPress={() => setRosterModalVisible(false)}
            >
              <Text style={styles.modalConfirmBtnText}>{t('Done')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── NOTIFICATIONS MODAL ── */}
      <Modal
        visible={notificationModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNotificationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.notifModalContent}>
            {/* Header with Icon, Title, Badge & Close Button */}
            <View style={styles.notifModalHeader}>
              <View style={styles.notifModalHeaderLeft}>
                <View style={styles.notifBellIconWrap}>
                  <Ionicons name="notifications" size={20} color={Colors.primary} />
                  <View style={styles.notifBadgeDot} />
                </View>
                <View style={styles.notifModalTitleWrap}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.notifModalTitle}>{t('Counter Notifications')}</Text>
                    <View style={styles.notifCountPill}>
                      <Text style={styles.notifCountPillText}>{t('2 Active')}</Text>
                    </View>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setNotificationModalVisible(false)}
                style={styles.modalCloseIconBtn}
                accessibilityLabel="Close Notifications"
              >
                <Ionicons name="close" size={20} color={Colors.textMedium} />
              </TouchableOpacity>
            </View>

            {/* Notification Cards List */}
            <View style={styles.notifCardsContainer}>
              {/* Card 1: Counter Station Online */}
              <View style={styles.notifCardSuccess}>
                <View style={styles.notifCardIconWrapSuccess}>
                  <Ionicons name="checkmark-circle" size={20} color="#059669" />
                </View>
                <View style={styles.notifCardContent}>
                  <View style={styles.notifCardHeaderRow}>
                    <Text style={styles.notifCardTitle}>{t('Counter 01 Online')}</Text>
                    <View style={styles.notifStatusBadgeSuccess}>
                      <View style={styles.pulseDotGreen} />
                      <Text style={styles.notifStatusTextSuccess}>{t('ACTIVE')}</Text>
                    </View>
                  </View>
                  <Text style={styles.notifCardDesc}>
                    {t('Triage Station is active and ready to call walk-in & pre-booked patients.')}
                  </Text>
                  <View style={styles.notifCardFooterRow}>
                    <View style={styles.notifMetaTag}>
                      <Ionicons name="medkit-outline" size={12} color="#059669" style={{ marginRight: 4 }} />
                      <Text style={styles.notifMetaTagText}>{t('Orthopedic & General Triage')}</Text>
                    </View>
                    <Text style={styles.notifTimeText}>{t('Live • Shift 1')}</Text>
                  </View>
                </View>
              </View>

              {/* Card 2: Display Board Sync */}
              <View style={styles.notifCardInfo}>
                <View style={styles.notifCardIconWrapInfo}>
                  <Ionicons name="sync-circle" size={22} color="#0284C7" />
                </View>
                <View style={styles.notifCardContent}>
                  <View style={styles.notifCardHeaderRow}>
                    <Text style={styles.notifCardTitle}>{t('Waiting Display Synced')}</Text>
                    <View style={styles.notifStatusBadgeInfo}>
                      <Ionicons name="cloud-done-outline" size={11} color="#0284C7" style={{ marginRight: 3 }} />
                      <Text style={styles.notifStatusTextInfo}>{t('SYNCED')}</Text>
                    </View>
                  </View>
                  <Text style={styles.notifCardDesc}>
                    {t('Waiting hall display screens & audio chimes are synchronized in real-time.')}
                  </Text>
                  <View style={styles.notifCardFooterRow}>
                    <View style={styles.notifMetaTag}>
                      <Ionicons name="tv-outline" size={12} color="#0284C7" style={{ marginRight: 4 }} />
                      <Text style={styles.notifMetaTagText}>{t('OPD Public Hall Screens')}</Text>
                    </View>
                    <Text style={styles.notifTimeText}>{t('Auto-updated')}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Close Button */}
            <TouchableOpacity
              style={styles.notifDoneBtn}
              onPress={() => setNotificationModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.notifDoneBtnText}>{t('Close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── VERIFY NIC QUICK MODAL ── */}
      <Modal
        visible={verifyNicModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setVerifyNicModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.verifyNicModalContent}>
            {/* Header with Close (X) */}
            <View style={styles.modalHeaderWithClose}>
              <View style={styles.modalHeaderTitleWrap}>
                <View style={[styles.modalIconWrapSmall, { backgroundColor: '#F0F9FF' }]}>
                  <Ionicons name="id-card" size={18} color="#0284C7" />
                </View>
                <Text style={styles.modalTitleText}>{t('Verify Patient NIC')}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setVerifyNicModalVisible(false)}
                style={styles.modalCloseIconBtn}
                accessibilityLabel="Close Verify NIC"
              >
                <Ionicons name="close" size={20} color={Colors.textMedium} />
              </TouchableOpacity>
            </View>

            {/* NIC Input Row with Barcode / QR Scanner Button */}
            <View style={styles.verifyNicInputRow}>
              <TextInput
                style={styles.verifyNicInput}
                placeholder={t('Enter or scan NIC / Barcode...')}
                placeholderTextColor={Colors.textLight}
                value={verifyNicQuery}
                onChangeText={setVerifyNicQuery}
                autoCapitalize="characters"
                returnKeyType="search"
                onSubmitEditing={handleVerifyNicSearch}
              />
              <TouchableOpacity
                style={styles.verifyNicScanBtn}
                onPress={() => setScannerModalVisible(true)}
                activeOpacity={0.7}
                accessibilityLabel="Scan with Barcode Machine or Camera"
              >
                <Ionicons name="barcode-outline" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.verifyNicSearchBtn}
                onPress={handleVerifyNicSearch}
                disabled={verifyNicLoading}
              >
                {verifyNicLoading ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.verifyNicSearchBtnText}>{t('Verify')}</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Results Display */}
            {verifyNicResult?.found && (
              <View style={styles.verifyNicFoundBox}>
                <View style={styles.verifyNicBadgeRow}>
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#059669" style={{ marginRight: 4 }} />
                    <Text style={styles.verifiedBadgeText}>{t('VERIFIED CITIZEN RECORD')}</Text>
                  </View>
                </View>
                <Text style={styles.verifyNicPatientName}>
                  {verifyNicResult.patient.fullName}
                </Text>
                <Text style={styles.verifyNicPatientMeta}>
                  {t('NIC')}: {verifyNicResult.patient.nic} • {t('Age')}: {verifyNicResult.patient.age || 'N/A'} • {t(verifyNicResult.patient.gender || '')}
                </Text>
                <Text style={styles.verifyNicPatientPhone}>
                  📞 {verifyNicResult.patient.phone || 'No phone recorded'}
                </Text>
                {verifyNicResult.isQueuePass && verifyNicResult.pass ? (
                  <Text style={styles.verifyNicPatientMeta}>
                    {t("Queue:")}{' '}{verifyNicResult.pass.tokenLabel} • {t(verifyNicResult.pass.department ?? '')} • {verifyNicResult.pass.status}
                  </Text>
                ) : null}

                <View style={styles.verifyNicActionsRow}>
                  <TouchableOpacity
                    style={styles.verifyNicDirectoryBtn}
                    onPress={() => {
                      setVerifyNicModalVisible(false);
                      handleNav('PatientsTab');
                    }}
                  >
                    <Text style={styles.verifyNicDirectoryBtnText}>{t('Full Profile')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.verifyNicIntakeBtn}
                    onPress={() => {
                      setVerifyNicModalVisible(false);
                      handleNav('RegisterTab');
                    }}
                  >
                    <Text style={styles.verifyNicIntakeBtnText}>{t('New Intake')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {verifyNicResult && !verifyNicResult.found && (
              <View style={styles.verifyNicNotFoundBox}>
                <Ionicons name="alert-circle-outline" size={30} color="#D97706" style={{ marginBottom: 6 }} />
                <Text style={styles.verifyNicNotFoundTitle}>{t('No Record Found')}</Text>
                <Text style={styles.verifyNicNotFoundSub}>
                  {t("No patient registered under NIC \"")}{verifyNicQuery}".
                </Text>
                <TouchableOpacity
                  style={styles.verifyNicCreateNewBtn}
                  onPress={() => {
                    setVerifyNicModalVisible(false);
                    handleNav('RegisterTab');
                  }}
                >
                  <Ionicons name="person-add" size={15} color={Colors.white} style={{ marginRight: 6 }} />
                  <Text style={styles.verifyNicCreateNewBtnText}>{t('Register New Patient')}</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.modalCancelFullBtn}
              onPress={() => setVerifyNicModalVisible(false)}
            >
              <Text style={styles.modalCancelFullBtnText}>{t('Close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── STAFF PROFILE & COUNTER MANAGEMENT MODAL ── */}
      <Modal
        visible={profileModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.profileModalContent}>
            {/* Modal Header */}
            <View style={styles.profileModalHeader}>
              <View style={styles.profileModalTitleWrap}>
                <Ionicons name="id-card" size={20} color={Colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.profileModalTitle}>{t('Staff & Desk Profile')}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setProfileModalVisible(false)}
                style={styles.profileModalCloseBtn}
                accessibilityLabel="Close profile modal"
              >
                <Ionicons name="close" size={20} color={Colors.textMedium} />
              </TouchableOpacity>
            </View>

            {/* Staff Card */}
            <View style={styles.staffCardBig}>
              <View style={styles.bigAvatarWrap}>
                <Text style={styles.bigAvatarText}>{staffInitials}</Text>
              </View>
              <View style={styles.bigStaffDetails}>
                <Text style={styles.bigStaffName} numberOfLines={1}>{staffName}</Text>
                <View style={styles.roleTag}>
                  <Text style={styles.roleTagText}>{t(staffRole)} • {t('OPD Front Desk')}</Text>
                </View>
                <Text style={styles.staffEmailText} numberOfLines={1}>{staffEmail}</Text>
              </View>
            </View>

            {/* Counter Station Selector */}
            <Text style={styles.sectionSubtitle}>{t('Assigned Service Desk')}</Text>
            <View style={styles.counterSelectorCol}>
              {['OPD Counter 01', 'OPD Counter 02', 'OPD Counter 03'].map((counterOption) => {
                const isSelected = activeCounter === counterOption;
                return (
                  <TouchableOpacity
                    key={counterOption}
                    style={[
                      styles.counterOptionBtn,
                      isSelected && styles.counterOptionBtnActive,
                    ]}
                    onPress={() => {
                      setActiveCounter(counterOption);
                      showToast(t("Switched active desk to {value0}", { value0: String(counterOption) }), 'info');
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={16}
                      color={isSelected ? Colors.primary : Colors.textLight}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={[
                        styles.counterOptionText,
                        isSelected && styles.counterOptionTextActive,
                      ]}
                    >
                      {counterOption}
                    </Text>
                    {isSelected && (
                      <View style={styles.activeDeskPill}>
                        <Text style={styles.activeDeskPillText}>{t('ACTIVE')}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Shift & Duty Info Box */}
            <View style={styles.dutyInfoBox}>
              <View style={styles.dutyInfoRow}>
                <Ionicons name="time-outline" size={15} color={Colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.dutyInfoLabel}>{t("Desk Hours:")}</Text>
                <Text style={styles.dutyInfoValue}>{t("08:00 AM - 04:30 PM (Shift 1)")}</Text>
              </View>
              <View style={[styles.dutyInfoRow, { marginTop: 6 }]}>
                <Ionicons name="medkit-outline" size={15} color={Colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.dutyInfoLabel}>{t("Station:")}</Text>
                <Text style={styles.dutyInfoValue}>{t("Orthopedic & General Triage")}</Text>
              </View>
              <View style={[styles.dutyInfoRow, { marginTop: 6 }]}>
                <Ionicons name="pulse" size={15} color="#059669" style={{ marginRight: 8 }} />
                <Text style={styles.dutyInfoLabel}>{t("Queue Status:")}</Text>
                <Text style={[styles.dutyInfoValue, { color: '#059669', fontWeight: '700' }]}>{t("Online & Dispatching")}</Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.profileActionRow}>
              <TouchableOpacity
                style={styles.logoutBtn}
                onPress={handleLogout}
                activeOpacity={0.8}
              >
                <Ionicons name="log-out-outline" size={18} color="#DC2626" style={{ marginRight: 6 }} />
                <Text style={styles.logoutBtnText}>{t('Log Out')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => setProfileModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.doneBtnText}>{t('Done')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Barcode & QR Scanner Modal (Dual Mode: Camera + Barcode Machine Gun) */}
      <BarcodeScannerModal
        visible={scannerModalVisible}
        onClose={() => setScannerModalVisible(false)}
        onScan={handleScanForVerify}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#063C46',
  },
  header: {
    backgroundColor: '#063C46',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 14 : 8,
    paddingBottom: 16,
  },
  statusTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusTimeText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.95)',
  },
  counterOnlineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  counterOnlineText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
    marginRight: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  dutyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#052F37',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dutyCardLeft: {
    flex: 1,
  },
  dutyShiftSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  dutyShiftTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  deskHoursBadge: {
    backgroundColor: '#063C46',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  deskHoursLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.65)',
  },
  deskHoursValue: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.white,
    marginTop: 1,
  },
  staffHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  staffProfileTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0A4B56',
    borderWidth: 2,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.white,
  },
  avatarStatusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#063C46',
  },
  staffInfo: {
    flex: 1,
    marginLeft: 12,
  },
  staffNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  staffMainName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.2,
  },
  staffMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  staffMetaText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    marginRight: 8,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 4,
  },
  liveText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#34D399',
    letterSpacing: 0.5,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#063C46',
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: '#F3F6F8',
  },
  scrollContent: {
    padding: 16,
  },
  statGrid: {
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  statCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMedium,
  },
  statIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardValue: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.textDark,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  statCardSubtext: {
    fontSize: 11,
    color: Colors.textLight,
    fontWeight: '500',
  },
  heroServingCard: {
    backgroundColor: '#064E5B',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  heroServingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  nowServingBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  nowServingBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#34D399',
    letterSpacing: 0.5,
  },
  tokenCallCountText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },
  heroTokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  patientQueueLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '500',
  },
  heroTokenText: {
    fontSize: 30,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  walkInTypePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  walkInTypePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  innerServingCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
  },
  patientNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  innerPatientName: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textDark,
  },
  innerPatientTime: {
    fontSize: 12,
    color: Colors.textLight,
    fontWeight: '500',
  },
  innerPatientMeta: {
    fontSize: 12,
    color: Colors.textMedium,
    marginTop: 3,
    fontWeight: '500',
  },
  innerDoctorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  doctorAvatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doctorAvatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.white,
  },
  innerDoctorName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textDark,
  },
  innerDoctorDept: {
    fontSize: 11,
    color: Colors.textMedium,
    marginTop: 1,
  },
  primaryCallNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#064E5B',
    borderRadius: 12,
    height: 46,
    marginTop: 14,
    shadowColor: '#064E5B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryCallNextBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
  sectionWrap: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMedium,
    letterSpacing: 0.5,
  },
  sectionActionLink: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  sectionBadgeCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  quickActionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickActionCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textDark,
    textAlign: 'center',
    lineHeight: 14,
  },
  roomListCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  roomBadgeSquare: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomBadgeSquareText: {
    fontSize: 13,
    fontWeight: '900',
  },
  roomListInfo: {
    flex: 1,
    marginLeft: 12,
  },
  roomListDoctorName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textDark,
  },
  roomListSub: {
    fontSize: 11,
    color: Colors.textMedium,
    marginTop: 2,
  },
  roomStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  roomStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  roomStatusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  queueItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  queueTokenBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  queueTokenBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textDark,
  },
  queueItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  queuePatientName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textDark,
  },
  queueDoctorSub: {
    fontSize: 11,
    color: Colors.textMedium,
    marginTop: 2,
  },
  queueStatusChip: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  queueStatusChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  shiftClosedNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  shiftClosedNoticeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    flex: 1,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textDark,
  },
  slipCardPreview: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    marginBottom: 16,
  },
  slipHospitalTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMedium,
    letterSpacing: 1,
  },
  slipTokenText: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.primary,
    marginVertical: 6,
  },
  slipPatientName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textDark,
  },
  slipMeta: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 4,
  },
  modalActionsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textMedium,
  },
  modalConfirmBtn: {
    flex: 1.5,
    height: 44,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
  rosterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    width: '100%',
  },
  rosterDocName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textDark,
  },
  rosterDocDept: {
    fontSize: 11,
    color: Colors.textMedium,
    marginTop: 2,
  },
  rosterDocHours: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rosterDocHoursText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textDark,
  },
  notifModalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.white,
    borderRadius: 22,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 10,
  },
  notifModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  notifModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  notifBellIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
  },
  notifBadgeDot: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#059669',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  notifModalTitleWrap: {
    flex: 1,
  },
  notifModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textDark,
  },
  notifCountPill: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  notifCountPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
  },
  notifModalSubtitle: {
    fontSize: 11,
    color: Colors.textMedium,
    fontWeight: '500',
    marginTop: 2,
  },
  notifCardsContainer: {
    gap: 12,
    marginBottom: 14,
  },
  notifCardSuccess: {
    flexDirection: 'row',
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  notifCardIconWrapSuccess: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  notifCardInfo: {
    flexDirection: 'row',
    backgroundColor: '#F0F9FF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  notifCardIconWrapInfo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  notifCardContent: {
    flex: 1,
  },
  notifCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notifCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textDark,
  },
  notifStatusBadgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pulseDotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
    marginRight: 4,
  },
  notifStatusTextSuccess: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  notifStatusBadgeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  notifStatusTextInfo: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284C7',
  },
  notifCardDesc: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
    marginBottom: 6,
  },
  notifCardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notifMetaTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notifMetaTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textLight,
  },
  notifTimeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textLight,
  },
  notifHealthStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  healthStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#059669',
    marginRight: 8,
  },
  notifHealthStatusText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
    flex: 1,
  },
  notifDoneBtn: {
    width: '100%',
    height: 42,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifDoneBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  profileModalContent: {
    width: '100%',
    maxWidth: 390,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  profileModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  profileModalTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textDark,
  },
  profileModalCloseBtn: {
    padding: 4,
  },
  staffCardBig: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  bigAvatarWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bigAvatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.white,
  },
  bigStaffDetails: {
    flex: 1,
  },
  bigStaffName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textDark,
  },
  roleTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#E6F6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  roleTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  staffEmailText: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 4,
  },
  sectionSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMedium,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  counterSelectorCol: {
    marginBottom: 14,
  },
  counterOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  counterOptionBtnActive: {
    backgroundColor: '#F0FDFA',
    borderColor: Colors.primary,
  },
  counterOptionText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMedium,
  },
  counterOptionTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  activeDeskPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeDeskPillText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#059669',
  },
  dutyInfoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dutyInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dutyInfoLabel: {
    fontSize: 12,
    color: Colors.textLight,
    fontWeight: '600',
    marginRight: 6,
  },
  dutyInfoValue: {
    fontSize: 12,
    color: Colors.textDark,
    fontWeight: '700',
  },
  profileActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoutBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    height: 44,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
  doneBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 44,
  },
  doneBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
  modalHeaderWithClose: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeaderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalIconWrapSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  modalTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textDark,
  },
  modalCloseIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyNicModalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  verifyNicInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  verifyNicInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    fontSize: 14,
    color: Colors.textDark,
    marginRight: 8,
    fontWeight: '600',
  },
  verifyNicScanBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#E6F6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  verifyNicSearchBtn: {
    height: 44,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyNicSearchBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.white,
  },
  verifyNicFoundBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    width: '100%',
    marginBottom: 14,
  },
  verifyNicBadgeRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  verifiedBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#059669',
  },
  verifyNicPatientName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textDark,
    marginBottom: 4,
  },
  verifyNicPatientMeta: {
    fontSize: 12,
    color: Colors.textMedium,
    fontWeight: '600',
    marginBottom: 4,
  },
  verifyNicPatientPhone: {
    fontSize: 12,
    color: Colors.textLight,
    marginBottom: 12,
  },
  verifyNicActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  verifyNicDirectoryBtn: {
    flex: 1,
    height: 38,
    backgroundColor: '#E6F6FF',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyNicDirectoryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  verifyNicIntakeBtn: {
    flex: 1,
    height: 38,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyNicIntakeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  verifyNicNotFoundBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    width: '100%',
    marginBottom: 14,
  },
  verifyNicNotFoundTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#B45309',
    marginBottom: 4,
  },
  verifyNicNotFoundSub: {
    fontSize: 12,
    color: Colors.textMedium,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 16,
  },
  verifyNicCreateNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D97706',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  verifyNicCreateNewBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.white,
  },
  modalCancelFullBtn: {
    width: '100%',
    height: 42,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  modalCancelFullBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMedium,
  },
  emptyQueueCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 6,
  },
  emptyQueueTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textDark,
    marginTop: 8,
    marginBottom: 4,
  },
  emptyQueueSub: {
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'center',
  },

  // ─────────────────────────────────────────────────────────
  // OPD Consultation & Queue Monitoring Styles (View Only)
  // ─────────────────────────────────────────────────────────

  liveConsultationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveConsultationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
    marginRight: 5,
  },
  liveConsultationText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#34D399',
    letterSpacing: 0.5,
  },
  opdConsultationStatusBox: {
    marginTop: 14,
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#99F6E4',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  opdStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  opdStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0D9488',
    marginRight: 5,
  },
  opdStatusPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F766E',
    letterSpacing: 0.3,
  },
  opdRoomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  opdRoomBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
  },
  opdWaitingStatusBox: {
    marginTop: 14,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  opdWaitingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  opdWaitingPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.3,
  },
  opdWaitingRoomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  opdWaitingRoomBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
});

export default ReceptionistHomeScreen;
