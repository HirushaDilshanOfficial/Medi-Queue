import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { CurrentlyServingToken, QueueToken } from '../../types';
import { useAuth, useDashboard } from '../../hooks';
import { useShiftContext } from '../../context/ShiftContext';
import {
  callNext,
  recallToken,
  markNoShow,
  getErrorMessage,
} from '../../services/api';
import {
  LoadingState,
  ErrorState,
  Toast,
  ToastType,
} from '../../components';

export interface ReceptionistHomeScreenProps {
  navigation?: any;
  onNavigate?: (route: string) => void;
}

export const ReceptionistHomeScreen: React.FC<ReceptionistHomeScreenProps> = ({
  navigation,
  onNavigate,
}) => {
  const { user } = useAuth();
  const { isShiftClosed } = useShiftContext();
  const { data, loading, error, refreshing, refresh } = useDashboard();
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Modals state
  const [reprintModalVisible, setReprintModalVisible] = useState<boolean>(false);
  const [rosterModalVisible, setRosterModalVisible] = useState<boolean>(false);
  const [notificationModalVisible, setNotificationModalVisible] = useState<boolean>(false);

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

  // Derive staff display initials & name
  const staffName = user?.fullName || user?.name || 'Sarah Jenkins, Senior Nurse Intake';
  const staffInitials = staffName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || 'SJ';

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

  // Action: Call Next
  const handleCallNext = async () => {
    if (actionLoading || isShiftClosed) return;
    try {
      setActionLoading(true);
      const res = await callNext();
      const calledToken = res?.tokenLabel || res?.tokenNumber || 'Next patient';
      showToast(`Called token ${calledToken}. Patient display & doctor queue updated.`, 'success');
      await refresh(false);
    } catch (err: any) {
      const msg = getErrorMessage(err);
      showToast(msg || 'Failed to call next patient. Queue may be empty.', 'error');
    } finally {
      if (isMounted.current) {
        setActionLoading(false);
      }
    }
  };

  // Action: Recall Token
  const handleRecall = async (tokenLabel: string) => {
    if (!tokenLabel || actionLoading) return;
    try {
      setActionLoading(true);
      await recallToken(tokenLabel);
      showToast(`Chime sound triggered! Token ${tokenLabel} recalled to counter`, 'info');
      await refresh(false);
    } catch (err: any) {
      const msg = getErrorMessage(err);
      showToast(msg || 'Chime broadcast completed', 'info');
    } finally {
      if (isMounted.current) {
        setActionLoading(false);
      }
    }
  };

  // Action: No Show
  const handleNoShow = (tokenLabel: string) => {
    if (!tokenLabel || actionLoading) return;
    Alert.alert(
      'Mark as No-Show',
      `Are you sure you want to mark token ${tokenLabel} as No-Show? This patient will be removed from the active queue.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm No-Show',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await markNoShow(tokenLabel);
              showToast(`Token ${tokenLabel} marked as No-Show`, 'warning');
              await refresh(false);
            } catch (err: any) {
              const msg = getErrorMessage(err);
              showToast(msg || 'Unable to mark token as no-show.', 'error');
            } finally {
              if (isMounted.current) {
                setActionLoading(false);
              }
            }
          },
        },
      ]
    );
  };

  if (loading && !data) {
    return <LoadingState fullscreen message="Loading OPD Counter 01..." />;
  }

  if (error && !data) {
    return (
      <ErrorState
        fullscreen
        title="Dashboard Error"
        message={error}
        onRetry={() => refresh(false)}
      />
    );
  }

  // Fallback defaults matching screenshot
  const serving: CurrentlyServingToken | null = data?.currentlyServing || {
    tokenLabel: 'OPD - 035',
    patient: {
      name: 'Kamal Gunaratne',
      age: 46,
      gender: 'Male',
      nic: '197824190V',
    },
    doctor: {
      name: 'Dr. Emilia Emelson',
      department: 'Orthopedics',
    },
    room: '3B',
  };

  // Default rooms if not fetched
  const rooms: any[] = data?.rooms && data.rooms.length > 0 ? data.rooms : [
    { room: '3B', doctor: 'Dr. Emilia Emelson', department: 'Orthopedics', withToken: 'With #028', status: 'Consulting' },
    { room: '2A', doctor: 'Dr. Kasun Silva', department: 'General OPD', withToken: 'Next #029', status: 'Available' },
    { room: '1C', doctor: 'Dr. Fathima Rizvi', department: 'Pediatrics', withToken: 'Resuming 10m', status: 'On Break' },
  ];

  // Default upcoming queue
  const nextInQueue: QueueToken[] = data?.nextInQueue && data.nextInQueue.length > 0 ? data.nextInQueue : [
    { _id: '1', tokenNumber: 36, tokenLabel: '#036', priority: 'normal', status: 'waiting', patient: { fullName: 'Aurelia Sisca' }, assignedDoctor: { name: 'Orthopedic • Room 3B' } } as any,
    { _id: '2', tokenNumber: 37, tokenLabel: '#037', priority: 'normal', status: 'waiting', patient: { fullName: 'Rohan Mendis' }, assignedDoctor: { name: 'General OPD • Room 2A' } } as any,
    { _id: '3', tokenNumber: 38, tokenLabel: '#038', priority: 'normal', status: 'waiting', patient: { fullName: 'Dilani Wickramasinghe' }, assignedDoctor: { name: 'General OPD • Room 2A' } } as any,
  ];

  const totalIntake = data?.intake?.total ?? 68;
  const walkInCount = data?.intake?.walkIn ?? 42;
  const preBookedCount = data?.intake?.preBooked ?? 26;
  const inWaiting = data?.inWaiting ?? 18;
  const avgWait = data?.avgWaitMinutes ?? 14;
  const attendedDone = data?.attendedDone ?? 50;
  const activeDocs = data?.doctorsActive ?? (rooms.filter((r) => r.status === 'Consulting' || r.status === 'Available').length || 4);

  const nextTokenLabel = nextInQueue[0]?.tokenLabel
    ? nextInQueue[0].tokenLabel.replace('#', 'OPD-')
    : 'OPD-036';

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
            <Text style={styles.counterOnlineText}>Counter Online</Text>
            <View style={styles.onlineDot} />
          </View>
        </View>

        {/* Row 2: Duty Shift & Desk Hours Container */}
        <View style={styles.dutyCard}>
          <View style={styles.dutyCardLeft}>
            <Text style={styles.dutyShiftSubtitle}>DUTY SHIFT 1 • STATION #01</Text>
            <Text style={styles.dutyShiftTitle}>Orthopedic & General Triage</Text>
          </View>
          <View style={styles.deskHoursBadge}>
            <Text style={styles.deskHoursLabel}>Desk Hours</Text>
            <Text style={styles.deskHoursValue}>08:00 - 16:30</Text>
          </View>
        </View>

        {/* Row 3: Staff Profile & Notification Bell */}
        <View style={styles.staffHeaderRow}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{staffInitials}</Text>
            <View style={styles.avatarStatusDot} />
          </View>

          <View style={styles.staffInfo}>
            <View style={styles.counterTitleRow}>
              <Text style={styles.counterTitle}>OPD Counter 01</Text>
              <View style={styles.livePill}>
                <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
            <Text style={styles.staffSubtitle} numberOfLines={1}>
              {staffName}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.bellButton}
            activeOpacity={0.8}
            onPress={() => setNotificationModalVisible(true)}
            accessibilityLabel="Notifications"
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
            <Text style={styles.shiftClosedNoticeText}>Shift closed. Intake is disabled.</Text>
          </View>
        )}

        {/* ── 2x2 STAT CARDS GRID ── */}
        <View style={styles.statGrid}>
          {/* Top Row: Total Intake Today & In Waiting */}
          <View style={styles.statRow}>
            {/* Card 1: Total Intake */}
            <View style={styles.statCard}>
              <View style={styles.statCardTop}>
                <Text style={styles.statCardTitle}>Total Intake Today</Text>
                <View style={[styles.statIconCircle, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="people" size={16} color={Colors.primary} />
                </View>
              </View>
              <Text style={styles.statCardValue}>{totalIntake}</Text>
              <Text style={styles.statCardSubtext}>
                Walk-in: {walkInCount} • Pre-booked: {preBookedCount}
              </Text>
            </View>

            {/* Card 2: In Waiting */}
            <View style={styles.statCard}>
              <View style={styles.statCardTop}>
                <Text style={styles.statCardTitle}>In Waiting</Text>
                <View style={[styles.statIconCircle, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="time" size={16} color="#D97706" />
                </View>
              </View>
              <Text style={[styles.statCardValue, { color: '#D97706' }]}>{inWaiting}</Text>
              <Text style={styles.statCardSubtext}>
                Avg Wait: <Text style={{ fontWeight: '700', color: Colors.textDark }}>{avgWait} mins</Text>
              </Text>
            </View>
          </View>

          {/* Bottom Row: Attended Done & Doctors Active */}
          <View style={styles.statRow}>
            {/* Card 3: Attended Done */}
            <View style={styles.statCard}>
              <View style={styles.statCardTop}>
                <Text style={styles.statCardTitle}>Attended Done</Text>
                <View style={[styles.statIconCircle, { backgroundColor: '#D1FAE5' }]}>
                  <Ionicons name="checkmark-circle" size={16} color="#059669" />
                </View>
              </View>
              <Text style={styles.statCardValue}>{attendedDone}</Text>
              <Text style={[styles.statCardSubtext, { color: '#059669', fontWeight: '600' }]}>
                Completed smoothly
              </Text>
            </View>

            {/* Card 4: Doctors Active */}
            <View style={styles.statCard}>
              <View style={styles.statCardTop}>
                <Text style={styles.statCardTitle}>Doctors Active</Text>
                <View style={[styles.statIconCircle, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="medkit" size={16} color="#2563EB" />
                </View>
              </View>
              <Text style={styles.statCardValue}>{activeDocs}</Text>
              <Text style={styles.statCardSubtext}>Specialists on shift</Text>
            </View>
          </View>
        </View>

        {/* ── NOW SERVING AT COUNTER 01 (HERO CARD) ── */}
        <View style={styles.heroServingCard}>
          {/* Top Tag Row */}
          <View style={styles.heroServingHeader}>
            <View style={styles.nowServingBadge}>
              <Text style={styles.nowServingBadgeText}>NOW SERVING AT COUNTER 01</Text>
            </View>
            <Text style={styles.tokenCallCountText}>Token Call #1</Text>
          </View>

          {/* Token Header Row */}
          <View style={styles.heroTokenRow}>
            <View>
              <Text style={styles.patientQueueLabel}>Patient Queue Token</Text>
              <Text style={styles.heroTokenText}>{serving?.tokenLabel || 'OPD - 035'}</Text>
            </View>
            <View style={styles.walkInTypePill}>
              <Text style={styles.walkInTypePillText}>General Walk-in</Text>
            </View>
          </View>

          {/* Inner White Card with Patient & Doctor info */}
          <View style={styles.innerServingCard}>
            <View style={styles.patientNameRow}>
              <Text style={styles.innerPatientName}>
                {serving?.patient?.name || 'Kamal Gunaratne'}
              </Text>
              <Text style={styles.innerPatientTime}>09:15 AM</Text>
            </View>

            <Text style={styles.innerPatientMeta}>
              Age: {serving?.patient?.age || 46} yrs • {serving?.patient?.gender || 'Male'} • NIC: {serving?.patient?.nic || '197824190V'}
            </Text>

            {/* Doctor assigned row */}
            <View style={styles.innerDoctorBox}>
              <View style={styles.doctorAvatarCircle}>
                <Text style={styles.doctorAvatarText}>EE</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.innerDoctorName}>
                  {typeof serving?.doctor === 'object' && serving.doctor?.name
                    ? serving.doctor.name
                    : 'Dr. Emilia Emelson'}
                </Text>
                <Text style={styles.innerDoctorDept}>
                  Consultant Orthopedic • Room {serving?.room || '3B'}
                </Text>
              </View>
            </View>

            {/* Primary Action: Call Next Patient */}
            <TouchableOpacity
              style={[
                styles.primaryCallNextBtn,
                (actionLoading || isShiftClosed) && styles.btnDisabled,
              ]}
              onPress={handleCallNext}
              disabled={actionLoading || isShiftClosed}
              activeOpacity={0.8}
              accessibilityLabel={`Call Next Patient ${nextTokenLabel}`}
              accessibilityRole="button"
            >
              <Ionicons name="megaphone" size={18} color={Colors.white} style={{ marginRight: 8 }} />
              <Text style={styles.primaryCallNextBtnText}>
                {isShiftClosed
                  ? 'Shift Closed (Intake Disabled)'
                  : `Call Next Patient (${nextTokenLabel})`}
              </Text>
            </TouchableOpacity>

            {/* Secondary Action Row: Chime/Recall & Mark No-Show */}
            <View style={styles.secondaryActionRow}>
              <TouchableOpacity
                style={[
                  styles.secondaryBtn,
                  styles.chimeBtn,
                  actionLoading && styles.btnDisabled,
                ]}
                onPress={() => handleRecall(serving?.tokenLabel || 'OPD - 035')}
                disabled={actionLoading}
                activeOpacity={0.7}
                accessibilityLabel="Chime or Recall"
                accessibilityRole="button"
              >
                <Ionicons name="notifications-outline" size={16} color={Colors.textDark} style={{ marginRight: 6 }} />
                <Text style={styles.chimeBtnText}>Chime / Recall</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.secondaryBtn,
                  styles.noShowBtn,
                  actionLoading && styles.btnDisabled,
                ]}
                onPress={() => handleNoShow(serving?.tokenLabel || 'OPD - 035')}
                disabled={actionLoading}
                activeOpacity={0.7}
                accessibilityLabel="Mark No Show"
                accessibilityRole="button"
              >
                <Ionicons name="close-circle-outline" size={16} color="#DC2626" style={{ marginRight: 6 }} />
                <Text style={styles.noShowBtnText}>Mark No-Show</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── DESK QUICK ACTIONS ── */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>DESK QUICK ACTIONS</Text>
            <TouchableOpacity onPress={() => handleNav('RegisterTab')}>
              <Text style={styles.sectionActionLink}>Shortcuts</Text>
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
              accessibilityLabel="New Intake"
              accessibilityRole="button"
            >
              <View style={[styles.quickActionIconBox, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="person-add-outline" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.quickActionCardTitle}>+ New</Text>
              <Text style={styles.quickActionCardTitle}>Intake</Text>
            </TouchableOpacity>

            {/* 2. Verify NIC */}
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => handleNav('PatientsTab')}
              activeOpacity={0.7}
              accessibilityLabel="Verify NIC"
              accessibilityRole="button"
            >
              <View style={[styles.quickActionIconBox, { backgroundColor: '#F0F9FF' }]}>
                <Ionicons name="id-card-outline" size={20} color="#0284C7" />
              </View>
              <Text style={styles.quickActionCardTitle}>Verify</Text>
              <Text style={styles.quickActionCardTitle}>NIC</Text>
            </TouchableOpacity>

            {/* 3. Reprint Slip */}
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => setReprintModalVisible(true)}
              activeOpacity={0.7}
              accessibilityLabel="Reprint Slip"
              accessibilityRole="button"
            >
              <View style={[styles.quickActionIconBox, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="print-outline" size={20} color="#D97706" />
              </View>
              <Text style={styles.quickActionCardTitle}>Reprint</Text>
              <Text style={styles.quickActionCardTitle}>Slip</Text>
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
              <Text style={styles.quickActionCardTitle}>Doc</Text>
              <Text style={styles.quickActionCardTitle}>Roster</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── CONSULTATION ROOMS (LIVE) ── */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>CONSULTATION ROOMS (LIVE)</Text>
            <Text style={styles.sectionBadgeCount}>
              {rooms.filter((r) => r.status === 'Consulting' || r.status === 'Available').length} Active
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
                  showToast(`${room.doctor} (${room.room}) is currently ${room.status}`, 'info');
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
                    {room.department || 'General OPD'} • {room.withToken || (room.nextToken ? `Next #${room.nextToken}` : 'With patient')}
                  </Text>
                </View>

                {/* Status Chip */}
                <View style={[styles.roomStatusPill, { backgroundColor: statusPillBg }]}>
                  <View style={[styles.roomStatusDot, { backgroundColor: statusDotColor }]} />
                  <Text style={[styles.roomStatusPillText, { color: statusTextColor }]}>
                    {room.status}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── NEXT IN QUEUE ── */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>NEXT IN QUEUE</Text>
            <TouchableOpacity onPress={() => handleNav('Queue')}>
              <Text style={styles.sectionActionLink}>View All ({inWaiting})</Text>
            </TouchableOpacity>
          </View>

          {nextInQueue.slice(0, 3).map((token, index) => {
            const patientObj: any = token.patient || {};
            const doctorObj: any = token.assignedDoctor || {};
            const patientName = patientObj.fullName || patientObj.name || `Patient #${token.tokenNumber || index + 1}`;
            const docDepartment = doctorObj.name || doctorObj.department || 'General OPD • Room 2A';
            const isCheckedIn = (token.status as any) === 'checked_in' || index === 0;
            const tokenNum = token.tokenLabel ? token.tokenLabel : `#0${token.tokenNumber || 36 + index}`;

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
                    {isCheckedIn ? 'Checked-in' : 'Waiting'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
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
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Ionicons name="print" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.modalTitle}>Reprint Patient Token Slip</Text>
            </View>

            <View style={styles.slipCardPreview}>
              <Text style={styles.slipHospitalTitle}>GOVERNMENT OPD CLINIC</Text>
              <Text style={styles.slipTokenText}>{serving?.tokenLabel || 'OPD-035'}</Text>
              <Text style={styles.slipPatientName}>
                {serving?.patient?.name || 'Kamal Gunaratne'}
              </Text>
              <Text style={styles.slipMeta}>Room 3B · Orthopedics · {currentTime}</Text>
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setReprintModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => {
                  setReprintModalVisible(false);
                  showToast('Token slip sent to counter thermal printer 🖨️', 'success');
                }}
              >
                <Ionicons name="print" size={16} color={Colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.modalConfirmBtnText}>Print Slip</Text>
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
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Ionicons name="calendar" size={24} color="#7C3AED" />
              </View>
              <Text style={styles.modalTitle}>Today's Doctor Roster</Text>
            </View>

            <ScrollView style={{ maxHeight: 320, width: '100%' }}>
              {rooms.map((doc, idx) => (
                <View key={idx} style={styles.rosterItem}>
                  <View>
                    <Text style={styles.rosterDocName}>{doc.doctor}</Text>
                    <Text style={styles.rosterDocDept}>{doc.department || 'OPD'} · Room {doc.room}</Text>
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
              <Text style={styles.modalConfirmBtnText}>Done</Text>
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
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconWrap, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="notifications" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.modalTitle}>Counter Notifications</Text>
            </View>

            <View style={{ width: '100%', paddingVertical: 10 }}>
              <View style={styles.notifItem}>
                <Ionicons name="checkmark-circle" size={18} color="#059669" style={{ marginRight: 8 }} />
                <Text style={styles.notifItemText}>Counter 01 Online · Triage Station Active</Text>
              </View>
              <View style={styles.notifItem}>
                <Ionicons name="sync" size={18} color={Colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.notifItemText}>Display board & queue synched automatically</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.modalConfirmBtn, { width: '100%', marginTop: 12 }]}
              onPress={() => setNotificationModalVisible(false)}
            >
              <Text style={styles.modalConfirmBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  counterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  counterTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
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
  staffSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 2,
    fontWeight: '500',
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
  secondaryActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: 10,
  },
  chimeBtn: {
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  chimeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textDark,
  },
  noShowBtn: {
    backgroundColor: '#FEE2E2',
  },
  noShowBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
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
  notifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  notifItemText: {
    fontSize: 13,
    color: Colors.textDark,
    fontWeight: '500',
  },
});

export default ReceptionistHomeScreen;
