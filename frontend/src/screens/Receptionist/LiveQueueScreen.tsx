import { router } from 'expo-router';
import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React, { useState, useEffect, useRef } from 'react';
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
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { QueueToken, Doctor } from '../../types';
import { useLiveQueue, LiveQueueFilter } from '../../hooks';
import { useShiftContext } from '../../context/ShiftContext';
import {
  callNext,
  markNoShow,
  moveBack,
  getErrorMessage,
  getAutoAdvance,
  updateAutoAdvance,
} from '../../services/api';
import {
  TokenBadge,
  StatusChip,
  LoadingState,
  ErrorState,
  SectionHeader,
  Toast,
  ToastType,
  DoctorPickerModal,
} from '../../components';

export interface LiveQueueScreenProps {
  navigation?: any;
  onNavigate?: (route: string) => void;
}

export const LiveQueueScreen: React.FC<LiveQueueScreenProps> = ({
  navigation,
  onNavigate,
}) => {
  const { t, locale } = useLanguage();
  const { isShiftClosed } = useShiftContext();
  const [filter, setFilter] = useState<LiveQueueFilter>('all');
  const { data, loading, error, refreshing, refresh } = useLiveQueue(filter);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastType, setToastType] = useState<ToastType>('success');
  const [toastVisible, setToastVisible] = useState<boolean>(false);

  // Doctor Picker Modal state
  const [doctorModalVisible, setDoctorModalVisible] = useState<boolean>(false);
  const [selectedTokenForDoctor, setSelectedTokenForDoctor] = useState<QueueToken | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('all');

  // Auto-Advance Switch state
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState<boolean>(false);
  const [loadingAutoAdvance, setLoadingAutoAdvance] = useState<boolean>(false);
  const [savingAutoAdvance, setSavingAutoAdvance] = useState<boolean>(false);

  // Pulsing animation for ACTIVE badge dot
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isMounted = useRef<boolean>(true);

  useEffect(() => {
    isMounted.current = true;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.25,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
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

  // Load Auto-Advance Setting from backend on mount
  useEffect(() => {
    let isSubscribed = true;
    const fetchAutoAdvanceSetting = async () => {
      try {
        setLoadingAutoAdvance(true);
        const res = await getAutoAdvance();
        if (isSubscribed && res && typeof res.enabled === 'boolean') {
          setAutoAdvanceEnabled(res.enabled);
        }
      } catch (err) {
        // Fallback default
      } finally {
        if (isSubscribed) {
          setLoadingAutoAdvance(false);
        }
      }
    };

    fetchAutoAdvanceSetting();

    return () => {
      isSubscribed = false;
    };
  }, []);

  // Toast Helper
  const showToast = (message: string, type: ToastType = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  // Derive metrics
  const totalInQueue = data?.totals?.inQueue ?? data?.queue?.length ?? 0;
  const walkInsCount = data?.totals?.walkIns ?? 0;
  const preBookedCount = data?.totals?.preBooked ?? 0;
  const avgWaitMinutes = data?.totals?.avgWaitMinutes ?? (totalInQueue > 0 ? totalInQueue * 10 : 0);

  const filterCounts: Record<LiveQueueFilter, number> = {
    all: totalInQueue,
    walk_in: walkInsCount,
    pre_booked: preBookedCount,
  };

  const cleanRoomName = (room?: string | null): string => {
    if (!room) return 'Room 01';
    const trimmed = room.trim();
    if (trimmed.toLowerCase().startsWith('room')) {
      return trimmed;
    }
    return `Room ${trimmed}`;
  };

  const cleanRoomNumber = (room?: string | null): string => {
    if (!room) return '01';
    return room.trim().replace(/^room\s*/i, '') || '01';
  };

  // Identify waiting queue tokens with valid patient records
  const waitingTokens = (data?.queue || []).filter(
    (t) => t.status === 'waiting' && Boolean(t.patient)
  );

  // Group waiting tokens by assigned doctor, separating Walk-in and Pre-booked
  const doctorGroupsMap = new Map<string, {
    id: string;
    name: string;
    room?: string;
    department?: string;
    walkInTokens: QueueToken[];
    preBookedTokens: QueueToken[];
    totalCount: number;
  }>();

  if (data?.doctors && Array.isArray(data.doctors)) {
    for (const doc of data.doctors) {
      const docId = String((doc as any)._id || (doc as any).id);
      if (!doctorGroupsMap.has(docId)) {
        doctorGroupsMap.set(docId, {
          id: docId,
          name: doc.name.startsWith('Dr.') ? doc.name : `Dr. ${doc.name}`,
          room: doc.room,
          department: doc.department,
          walkInTokens: [],
          preBookedTokens: [],
          totalCount: 0,
        });
      }
    }
  }

  const unassignedGroup = {
    id: 'unassigned',
    name: t('Unassigned / Triage'),
    room: 'Triage Desk',
    department: 'General OPD',
    walkInTokens: [] as QueueToken[],
    preBookedTokens: [] as QueueToken[],
    totalCount: 0,
  };

  for (const token of waitingTokens) {
    const docObj =
      typeof token.assignedDoctor === 'object' && token.assignedDoctor !== null
        ? token.assignedDoctor
        : null;
    const docId = docObj ? String((docObj as any)._id || (docObj as any).id) : null;

    const appointmentObj =
      typeof token.appointment === 'object' && token.appointment !== null
        ? token.appointment
        : null;
    const isWalkIn =
      appointmentObj?.type === 'walk_in' || (token as any).type === 'walk_in';

    if (docId && docObj) {
      if (!doctorGroupsMap.has(docId)) {
        doctorGroupsMap.set(docId, {
          id: docId,
          name: docObj.name
            ? docObj.name.startsWith('Dr.')
              ? docObj.name
              : `Dr. ${docObj.name}`
            : t('Specialist Doctor'),
          room: docObj.room,
          department: docObj.department,
          walkInTokens: [],
          preBookedTokens: [],
          totalCount: 0,
        });
      }
      const group = doctorGroupsMap.get(docId)!;
      if (isWalkIn) {
        group.walkInTokens.push(token);
      } else {
        group.preBookedTokens.push(token);
      }
      group.totalCount += 1;
    } else {
      if (isWalkIn) {
        unassignedGroup.walkInTokens.push(token);
      } else {
        unassignedGroup.preBookedTokens.push(token);
      }
      unassignedGroup.totalCount += 1;
    }
  }

  const allDoctorGroups = Array.from(doctorGroupsMap.values());
  allDoctorGroups.sort((a, b) => {
    if (a.totalCount > 0 && b.totalCount === 0) return -1;
    if (a.totalCount === 0 && b.totalCount > 0) return 1;
    return a.name.localeCompare(b.name);
  });

  if (unassignedGroup.totalCount > 0) {
    allDoctorGroups.push(unassignedGroup);
  }

  // Doctor-filtered or overall next in line
  const selectedGroup = allDoctorGroups.find((g) => g.id === selectedDoctorId);
  const selectedDoctorTokens = selectedGroup
    ? [...selectedGroup.walkInTokens, ...selectedGroup.preBookedTokens].sort(
        (a, b) => (a.tokenNumber || 0) - (b.tokenNumber || 0)
      )
    : [];

  const nextInLine: QueueToken | null =
    selectedDoctorId !== 'all'
      ? (selectedDoctorTokens.length > 0 ? selectedDoctorTokens[0] : null)
      : (waitingTokens.length > 0 ? waitingTokens[0] : null);

  const handleFilterChange = (selected: LiveQueueFilter) => {
    if (filter !== selected) {
      setFilter(selected);
    }
  };

  const handleBack = () => {
    if (onNavigate) {
      onNavigate('Home');
    } else if (navigation?.canGoBack?.()) {
      navigation.goBack();
    } else if (navigation?.navigate) {
      navigation.navigate('Home');
    } else {
      router.push('/(reception)/home' as any);
    }
  };

  // Format timestamp for display
  const formatTime = (isoString?: string) => {
    if (!isoString) return t('Just now');
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return t('Just now');
    }
  };

  const formatWaitTime = (minutes: number) => {
    if (minutes <= 0) return t('{minutes} min', { minutes: 0 });
    if (minutes < 60) return t('~{minutes} min', { minutes });
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? t('~{hours}h {minutes}m', { hours: hrs, minutes: mins }) : t('~{hours}h', { hours: hrs });
  };

  // Calculate wait so far for a token
  const calculateWaitSoFar = (token: QueueToken): string => {
    const timeSource =
      token.createdAt ||
      (typeof token.appointment === 'object' && token.appointment?.createdAt) ||
      null;
    if (!timeSource) return t('{minutes} min', { minutes: 5 });
    try {
      const start = new Date(timeSource).getTime();
      const now = Date.now();
      const diffMins = Math.max(1, Math.round((now - start) / 60000));
      return t('{minutes} min', { minutes: diffMins });
    } catch {
      return t('{minutes} min', { minutes: 5 });
    }
  };

  // ─────────────────────────────────────────────────────────
  // Auto-Advance Toggle Handler
  // ─────────────────────────────────────────────────────────
  const handleAutoAdvanceToggle = async (newValue: boolean) => {
    if (savingAutoAdvance) return;
    // Optimistically update switch state
    setAutoAdvanceEnabled(newValue);
    setSavingAutoAdvance(true);

    try {
      await updateAutoAdvance(newValue);
      showToast(
        newValue ? t('Auto-Advance queue enabled') : t('Auto-Advance queue disabled'),
        'success'
      );
    } catch (err: any) {
      // Revert switch on error
      setAutoAdvanceEnabled(!newValue);
      const msg = getErrorMessage(err);
      showToast(msg || t('Failed to update auto-advance setting'), 'error');
    } finally {
      if (isMounted.current) {
        setSavingAutoAdvance(false);
      }
    }
  };

  // ─────────────────────────────────────────────────────────
  // Next in Line Action Handlers
  // ─────────────────────────────────────────────────────────

  // 1. Call Next to Room
  const handleCallNext = async (roomNumber: string, docId?: string, department?: string) => {
    if (!nextInLine || actionLoading || isShiftClosed) return;
    try {
      setActionLoading(true);
      const res = await callNext({
        doctorId: docId,
        department: department || nextInLine.department,
      });
      const tokenName = nextInLine.tokenLabel || res?.tokenLabel || `OPD-${nextInLine.tokenNumber}`;
      showToast(t("Token {value0} called to Room {value1}", { value0: String(tokenName), value1: String(roomNumber) }), 'success');
      await refresh(false);
    } catch (err: any) {
      const msg = getErrorMessage(err);
      showToast(msg || t('Failed to call next patient. Queue may be empty.'), 'error');
    } finally {
      if (isMounted.current) {
        setActionLoading(false);
      }
    }
  };

  // 2. Mark No-Show (Confirm first)
  const handleMarkNoShow = (token: QueueToken, patientName: string) => {
    if (!token || actionLoading) return;
    const tokenLabel = token.tokenLabel || `OPD-${token.tokenNumber}`;

    Alert.alert(
      t('Confirm No-Show'),
      t("Are you sure you want to mark {value0} ({value1}) as No-Show?", { value0: String(tokenLabel), value1: String(patientName) }),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Mark No-Show'),
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await markNoShow(token._id || tokenLabel);
              showToast(t("Token {value0} marked as No-Show", { value0: String(tokenLabel) }), 'info');
              await refresh(false);
            } catch (err: any) {
              const msg = getErrorMessage(err);
              showToast(msg || t('Failed to mark token as no-show'), 'error');
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

  // 3. Move Back (n) (Confirm first, hide for urgent)
  const handleMoveBack = (token: QueueToken) => {
    if (!token || actionLoading || token.priority === 'urgent') return;
    const tokenLabel = token.tokenLabel || `OPD-${token.tokenNumber}`;

    Alert.alert(
      t('Move Token Back'),
      t("Move {value0} 3 positions back in the waiting queue?", { value0: String(tokenLabel) }),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: 'Move Back',
          onPress: async () => {
            try {
              setActionLoading(true);
              await moveBack(token._id || tokenLabel);
              showToast(t("Token {value0} moved back in queue", { value0: String(tokenLabel) }), 'success');
              await refresh(false);
            } catch (err: any) {
              const msg = getErrorMessage(err);
              showToast(msg || t('Failed to move token back'), 'error');
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

  // 4. Open Doctor Modal
  const openDoctorModal = (token: QueueToken) => {
    setSelectedTokenForDoctor(token);
    setDoctorModalVisible(true);
  };

  // ─────────────────────────────────────────────────────────
  // Render "Next in Line" Card
  // ─────────────────────────────────────────────────────────
  const renderNextInLineCard = () => {
    if (!nextInLine) {
      return (
        <View style={styles.nextInLineSection}>
          <SectionHeader
            title={t("Next in Line")}
            subtitle={t("Immediate priority queue")}
          />
          <View style={styles.nextInLineEmptyCard}>
            <View style={styles.emptyLineIconBox}>
              <Ionicons name="people-outline" size={26} color={Colors.textLight} />
            </View>
            <Text style={styles.nextInLineEmptyTitle}>{t("No patients waiting")}</Text>
            <Text style={styles.nextInLineEmptySubtitle}>
              {t("All active patients have been called or attended.")}</Text>
          </View>
        </View>
      );
    }

    const patientObj =
      typeof nextInLine.patient === 'object' && nextInLine.patient !== null
        ? nextInLine.patient
        : null;
    const patientName = patientObj?.fullName || `Patient #${nextInLine.tokenNumber}`;
    const appointmentObj =
      typeof nextInLine.appointment === 'object' && nextInLine.appointment !== null
        ? nextInLine.appointment
        : null;
    const isWalkIn = appointmentObj?.type === 'walk_in';
    const doctorObj =
      typeof nextInLine.assignedDoctor === 'object' && nextInLine.assignedDoctor !== null
        ? nextInLine.assignedDoctor
        : null;
    const doctorName = doctorObj?.name
      ? doctorObj.name.startsWith('Dr.')
        ? doctorObj.name
        : `Dr. ${doctorObj.name}`
      : 'General OPD Doctor';
    const roomNumber = cleanRoomNumber(doctorObj?.room);
    const roomLabel = cleanRoomName(doctorObj?.room);
    const waitSoFar = calculateWaitSoFar(nextInLine);
    const moveBackCount = nextInLine.moveBackCount || 0;
    const isUrgent = nextInLine.priority === 'urgent';
    const tokenLabel = nextInLine.tokenLabel || `OPD-${nextInLine.tokenNumber}`;

    return (
      <View style={styles.nextInLineSection}>
        <SectionHeader
          title={t("Next in Line")}
          subtitle={t("Top waiting token ready to be dispatched")}
          rightElement={
            <View style={styles.readyBadge}>
              <View style={styles.readyDot} />
              <Text style={styles.readyBadgeText}>{t("READY")}</Text>
            </View>
          }
        />

        <View style={styles.nextInLineCard}>
          {/* Top Token & Patient Header */}
          <View style={styles.nextCardHeader}>
            <View style={styles.nextCardTokenWrap}>
              <TokenBadge
                tokenLabel={tokenLabel}
                priority={nextInLine.priority}
                size="large"
              />
              <View style={styles.nextPatientMeta}>
                <Text style={styles.nextPatientName} numberOfLines={1}>
                  {patientName}
                </Text>
                <View style={styles.nextPatientSubRow}>
                  {patientObj?.age ? (
                    <Text style={styles.nextSubText}>{patientObj.age} {t("yrs")}</Text>
                  ) : null}
                  {patientObj?.gender ? (
                    <Text style={styles.nextSubText}>
                      • {t(patientObj.gender.charAt(0).toUpperCase() + patientObj.gender.slice(1))}
                    </Text>
                  ) : null}
                  {patientObj?.nic ? (
                    <Text style={styles.nextSubText}>{t("• NIC:")}{' '}{patientObj.nic}</Text>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Type Chip */}
            <View
              style={[
                styles.nextTypeChip,
                isWalkIn ? styles.walkInChip : styles.preBookedChip,
              ]}
            >
              <Ionicons
                name={isWalkIn ? 'walk' : 'calendar'}
                size={12}
                color={isWalkIn ? '#0284C7' : '#0D9488'}
              />
              <Text
                style={[
                  styles.nextTypeChipText,
                  { color: isWalkIn ? '#0284C7' : '#0D9488' },
                ]}
              >
                {isWalkIn ? t('Walk-in') : t('Pre-booked')}
              </Text>
            </View>
          </View>

          {/* Details Row: Wait so far & Assigned Doctor */}
          <View style={styles.nextDetailsGrid}>
            <View style={styles.nextDetailItem}>
              <Ionicons name="time" size={15} color="#D97706" style={{ marginRight: 6 }} />
              <Text style={styles.nextDetailLabel}>{t("Wait so far:")}</Text>
              <Text style={styles.nextDetailValue}>{waitSoFar}</Text>
            </View>

            <View style={styles.nextDetailItem}>
              <Ionicons name="medkit" size={15} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.nextDetailLabel}>{t("Doctor:")}</Text>
              <Text style={styles.nextDetailValue} numberOfLines={1}>
                {doctorName} ({roomLabel})
              </Text>
            </View>
          </View>

          {/* Actions / Status Stack */}
          <View style={styles.nextActionsStack}>
            {/* OPD Queue Status: View Only for Receptionist */}
            <View style={styles.opdMonitorInfoBox}>
              <View style={styles.opdMonitorPill}>
                <Ionicons name="eye-outline" size={13} color={Colors.primary} style={{ marginRight: 4 }} />
                <Text style={styles.opdMonitorPillText}>{t('OPD QUEUE MONITOR')}</Text>
              </View>
              <Text style={styles.opdMonitorRoomText}>{roomLabel}</Text>
            </View>

            {/* Move Back in Line (n) */}
            {!isUrgent ? (
              <TouchableOpacity
                style={[
                  styles.secondaryActionBtn,
                  styles.moveBackBtn,
                  { width: '100%', marginTop: 8 },
                  actionLoading && styles.btnDisabled,
                ]}
                onPress={() => handleMoveBack(nextInLine)}
                disabled={actionLoading}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t("Move back token {value0}", { value0: String(tokenLabel) })}
              >
                <Ionicons
                  name="swap-vertical"
                  size={16}
                  color={Colors.secondary}
                  style={styles.btnIcon}
                />
                <Text style={styles.moveBackBtnText}>
                  {t("Move Back in Line (")}{moveBackCount})
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────
  // Render Individual Patient Queue Card
  // ─────────────────────────────────────────────────────────
  const renderQueueItemCard = (
    token: QueueToken,
    posLabel: string,
    isWalkIn: boolean,
    groupRoom: string,
    groupDocId?: string,
    groupDept?: string
  ) => {
    const patientObj =
      typeof token.patient === 'object' && token.patient !== null
        ? token.patient
        : null;
    const patientName =
      patientObj?.fullName || (patientObj as any)?.name || `Patient #${token.tokenNumber}`;
    const isSenior = token.priority === 'senior';
    const isUrgent = token.priority === 'urgent';
    const tokenLabel = token.tokenLabel || `OPD-${token.tokenNumber}`;
    const waitSoFar = calculateWaitSoFar(token);
    const roomNumber = cleanRoomNumber(groupRoom);
    const roomLabel = cleanRoomName(groupRoom);

    return (
      <View key={token._id || tokenLabel} style={styles.doctorQueueItemCard}>
        {/* Top Row: Position + Token Badge + Priority Chip */}
        <View style={styles.upcomingTopRow}>
          <View style={styles.upcomingTokenWrap}>
            <View style={[styles.upcomingPosBadge, isWalkIn ? styles.walkInPosBadge : styles.preBookedPosBadge]}>
              <Text style={[styles.upcomingPosText, isWalkIn ? styles.walkInPosText : styles.preBookedPosText]}>
                {posLabel}
              </Text>
            </View>
            <TokenBadge tokenLabel={tokenLabel} priority={token.priority} size="medium" />
          </View>

          {/* Priority & Type Chips */}
          <View style={styles.upcomingChipsGroup}>
            {isUrgent ? (
              <View style={[styles.priorityBadge, styles.urgentPriorityBadge]}>
                <Ionicons name="alert-circle" size={11} color="#DC2626" style={{ marginRight: 3 }} />
                <Text style={styles.urgentPriorityText}>{t('Urgent')}</Text>
              </View>
            ) : isSenior ? (
              <View style={[styles.priorityBadge, styles.seniorPriorityBadge]}>
                <Ionicons name="ribbon" size={11} color="#D97706" style={{ marginRight: 3 }} />
                <Text style={styles.seniorPriorityText}>{t('Senior')}</Text>
              </View>
            ) : null}

            <View style={[styles.upcomingTypeChip, isWalkIn ? styles.walkInChip : styles.preBookedChip]}>
              <Ionicons name={isWalkIn ? 'walk' : 'calendar'} size={11} color={isWalkIn ? '#0284C7' : '#0D9488'} />
              <Text style={[styles.upcomingTypeChipText, { color: isWalkIn ? '#0284C7' : '#0D9488' }]}>
                {isWalkIn ? t('Walk-in') : t('Pre-booked')}
              </Text>
            </View>
          </View>
        </View>

        {/* Patient Details */}
        <View style={styles.upcomingPatientRow}>
          <Text style={styles.upcomingPatientName} numberOfLines={1}>
            {patientName}
          </Text>
          <View style={styles.upcomingPatientMeta}>
            {patientObj?.age ? (
              <Text style={styles.upcomingMetaText}>{patientObj.age} {t('yrs')}</Text>
            ) : null}
            {patientObj?.gender ? (
              <Text style={styles.upcomingMetaText}>
                • {t(patientObj.gender.charAt(0).toUpperCase() + patientObj.gender.slice(1))}
              </Text>
            ) : null}
            {patientObj?.nic ? (
              <Text style={styles.upcomingMetaText}>• {patientObj.nic}</Text>
            ) : null}
            <Text style={[styles.upcomingMetaText, { color: '#D97706', fontWeight: '600', marginLeft: 4 }]}>
              • {t('Wait: {value0}', { value0: waitSoFar })}
            </Text>
          </View>
        </View>

        {/* Action: Change Doctor (Receptionist Re-assignment) */}
        <View style={styles.cardActionsRow}>
          <TouchableOpacity
            style={[styles.cardChangeDocBtn, { flex: 1 }]}
            onPress={() => openDoctorModal(token)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('Change doctor for {value0}', { value0: tokenLabel })}
          >
            <Ionicons name="repeat-outline" size={13} color={Colors.primary} style={{ marginRight: 4 }} />
            <Text style={styles.cardChangeDocBtnText}>{t('Reassign Doctor')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────
  // Render Doctor-Separated Queue Section (Walk-in vs Pre-booked)
  // ─────────────────────────────────────────────────────────
  const renderDoctorSeparatedQueues = () => {
    const displayedGroups =
      selectedDoctorId === 'all'
        ? allDoctorGroups.filter((g) => g.totalCount > 0 || allDoctorGroups.length <= 2)
        : allDoctorGroups.filter((g) => g.id === selectedDoctorId);

    const totalWaitingPatients = waitingTokens.length;

    return (
      <View style={styles.doctorQueueSection}>
        <SectionHeader
          title={t("Doctor Queue Breakdown")}
          rightElement={
            <View style={styles.doctorQueueTotalPill}>
              <Text style={styles.doctorQueueTotalPillText}>
                {totalWaitingPatients} {t("Total Waiting")}
              </Text>
            </View>
          }
        />

        {/* ── DOCTOR SELECTOR CHIPS BAR ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.doctorFilterRow}
        >
          {/* All Doctors Chip */}
          <TouchableOpacity
            style={[
              styles.doctorFilterChip,
              selectedDoctorId === 'all' && styles.doctorFilterChipActive,
            ]}
            onPress={() => setSelectedDoctorId('all')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.doctorFilterText,
                selectedDoctorId === 'all' && styles.doctorFilterTextActive,
              ]}
            >
              {t("All Doctors")}
            </Text>
            <View
              style={[
                styles.doctorFilterBadge,
                selectedDoctorId === 'all' && styles.doctorFilterBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.doctorFilterBadgeText,
                  selectedDoctorId === 'all' && styles.doctorFilterBadgeTextActive,
                ]}
              >
                {totalWaitingPatients}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Individual Doctor Chips */}
          {allDoctorGroups.map((group) => {
            const isSelected = selectedDoctorId === group.id;
            const shortName = group.name.replace('Dr. ', '');

            return (
              <TouchableOpacity
                key={group.id}
                style={[
                  styles.doctorFilterChip,
                  isSelected && styles.doctorFilterChipActive,
                ]}
                onPress={() => setSelectedDoctorId(group.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.doctorFilterText,
                    isSelected && styles.doctorFilterTextActive,
                  ]}
                  numberOfLines={1}
                >
                  Dr. {shortName}
                </Text>
                <View
                  style={[
                    styles.doctorFilterBadge,
                    isSelected && styles.doctorFilterBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.doctorFilterBadgeText,
                      isSelected && styles.doctorFilterBadgeTextActive,
                    ]}
                  >
                    {group.totalCount}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── DOCTOR QUEUE CARDS LIST ── */}
        {displayedGroups.length > 0 ? (
          displayedGroups.map((group) => {
            const roomLabel = cleanRoomName(group.room);
            const roomNumber = cleanRoomNumber(group.room);
            const doctorInitials =
              group.name
                .replace('Dr.', '')
                .trim()
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2) || 'DR';

            const showWalkIn = filter === 'all' || filter === 'walk_in';
            const showPreBooked = filter === 'all' || filter === 'pre_booked';

            return (
              <View key={group.id} style={styles.doctorSectionCard}>
                {/* 1. Doctor Header Bar */}
                <View style={styles.doctorHeaderBar}>
                  <View style={styles.doctorHeaderLeft}>
                    <View style={styles.doctorAvatarBox}>
                      <Text style={styles.doctorAvatarText}>{doctorInitials}</Text>
                    </View>
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={styles.doctorHeaderName} numberOfLines={1}>
                        {group.name}
                      </Text>
                      <View style={styles.doctorHeaderSubRow}>
                        <Text style={styles.doctorRoomBadgeText}>{roomLabel}</Text>
                        <Text style={styles.doctorDeptText} numberOfLines={1}>
                          {' '}• {t(group.department || 'General OPD')}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.doctorHeaderRight}>
                    <View style={styles.doctorTotalBadge}>
                      <Text style={styles.doctorTotalBadgeText}>
                        {group.totalCount} {t('Waiting')}
                      </Text>
                    </View>

                  </View>
                </View>

                {/* 2. Doctor Breakdown Count Sub-bar */}
                <View style={styles.doctorBreakdownBar}>
                  <View style={[styles.breakdownPill, styles.walkInBreakdownPill]}>
                    <Ionicons name="walk" size={13} color="#0284C7" style={{ marginRight: 4 }} />
                    <Text style={styles.walkInBreakdownText}>
                      {t('Walk-in:')} <Text style={{ fontWeight: '800' }}>{group.walkInTokens.length}</Text>
                    </Text>
                  </View>

                  <View style={[styles.breakdownPill, styles.preBookedBreakdownPill]}>
                    <Ionicons name="calendar" size={13} color="#0D9488" style={{ marginRight: 4 }} />
                    <Text style={styles.preBookedBreakdownText}>
                      {t('Pre-booked:')} <Text style={{ fontWeight: '800' }}>{group.preBookedTokens.length}</Text>
                    </Text>
                  </View>
                </View>

                {/* 3. SEPARATED QUEUE TRACKS */}
                <View style={styles.doctorQueuesContainer}>
                  {/* ── TRACK 1: WALK-IN QUEUE ── */}
                  {showWalkIn && (
                    <View style={styles.queueTrackWrap}>
                      <View style={[styles.queueTrackHeader, styles.walkInTrackHeader]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="walk" size={15} color="#0284C7" style={{ marginRight: 6 }} />
                          <Text style={styles.walkInTrackTitle}>{t('Walk-in Patients Queue')}</Text>
                        </View>
                        <View style={styles.trackCountBadgeWalkIn}>
                          <Text style={styles.trackCountBadgeWalkInText}>{group.walkInTokens.length}</Text>
                        </View>
                      </View>

                      {group.walkInTokens.length > 0 ? (
                        group.walkInTokens.map((token, idx) =>
                          renderQueueItemCard(
                            token,
                            `#${idx + 1} Walk-in`,
                            true,
                            group.room || '',
                            group.id !== 'unassigned' ? group.id : undefined,
                            group.department
                          )
                        )
                      ) : (
                        <View style={styles.emptyTrackBox}>
                          <Ionicons name="person-outline" size={16} color="#94A3B8" style={{ marginRight: 6 }} />
                          <Text style={styles.emptyTrackText}>
                            {t('No walk-in patients waiting for this doctor')}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* ── TRACK 2: PRE-BOOKED QUEUE ── */}
                  {showPreBooked && (
                    <View style={styles.queueTrackWrap}>
                      <View style={[styles.queueTrackHeader, styles.preBookedTrackHeader]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="calendar" size={15} color="#0D9488" style={{ marginRight: 6 }} />
                          <Text style={styles.preBookedTrackTitle}>
                            {t('Pre-booked Appointments Queue')}
                          </Text>
                        </View>
                        <View style={styles.trackCountBadgePreBooked}>
                          <Text style={styles.trackCountBadgePreBookedText}>
                            {group.preBookedTokens.length}
                          </Text>
                        </View>
                      </View>

                      {group.preBookedTokens.length > 0 ? (
                        group.preBookedTokens.map((token, idx) =>
                          renderQueueItemCard(
                            token,
                            `#${idx + 1} Pre-booked`,
                            false,
                            group.room || '',
                            group.id !== 'unassigned' ? group.id : undefined,
                            group.department
                          )
                        )
                      ) : (
                        <View style={styles.emptyTrackBox}>
                          <Ionicons name="calendar-outline" size={16} color="#94A3B8" style={{ marginRight: 6 }} />
                          <Text style={styles.emptyTrackText}>
                            {t('No pre-booked appointments waiting for this doctor')}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.upcomingEmptyCard}>
            <View style={styles.upcomingEmptyIconBox}>
              <Ionicons name="checkmark-done-circle-outline" size={28} color="#0D9488" />
            </View>
            <Text style={styles.upcomingEmptyTitle}>{t('All doctor queues are clear')}</Text>
            <Text style={styles.upcomingEmptySubtitle}>
              {t('No patients are currently waiting for the selected doctor or filter.')}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Toast Notification */}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        duration={2500}
        onDismiss={() => setToastVisible(false)}
      />

      {/* Doctor Picker Modal Component */}
      <DoctorPickerModal
        visible={doctorModalVisible}
        token={selectedTokenForDoctor}
        department={selectedTokenForDoctor?.department}
        onClose={() => {
          setDoctorModalVisible(false);
          setSelectedTokenForDoctor(null);
        }}
        onSuccess={async (doctor: Doctor, tokenLabel: string) => {
          const docName = doctor.name.startsWith('Dr.') ? doctor.name : `Dr. ${doctor.name}`;
          showToast(t("Assigned {value0} to {value1}", { value0: String(docName), value1: String(tokenLabel) }), 'success');
          await refresh(false);
        }}
        onError={(err: string) => {
          showToast(err || t('Failed to assign doctor'), 'error');
        }}
      />

      {/* Screen Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={t("Back to Home")}
            accessibilityRole="button"
          >
            <Ionicons name="home" size={20} color={Colors.white} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>{t("OPD Live Queue")}</Text>
            <Text style={styles.headerSubtitle}>{t("Real-time Patient Dispatch")}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.refreshIconButton}
          onPress={() => refresh(true)}
          activeOpacity={0.7}
          disabled={refreshing || actionLoading}
        >
          <Ionicons
            name="refresh"
            size={18}
            color={Colors.white}
            style={refreshing ? styles.rotatingIcon : undefined}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
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
            <Text style={styles.shiftClosedNoticeText}>{t("Shift closed. Intake is disabled.")}</Text>
          </View>
        )}

        {/* ======================================================== */}
        {/* 1. DISPATCH BANNER                                        */}
        {/* ======================================================== */}
        <View style={styles.dispatchBannerCard}>
          {/* Banner Top Row */}
          <View style={styles.bannerTopRow}>
            <View style={styles.bannerTagWrap}>
              <Text style={styles.bannerTagText}>{t("LIVE DISPATCH QUEUE")}</Text>
            </View>

            {/* Green ACTIVE Badge */}
            <View style={styles.activeBadge}>
              <Animated.View
                style={[
                  styles.activeDot,
                  {
                    opacity: pulseAnim,
                    transform: [
                      {
                        scale: pulseAnim.interpolate({
                          inputRange: [0.25, 1],
                          outputRange: [0.8, 1.2],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Text style={styles.activeBadgeText}>{t("ACTIVE")}</Text>
            </View>
          </View>

          {/* Banner Metrics Grid */}
          <View style={styles.metricsGrid}>
            {/* Total In Queue Card */}
            <View style={styles.metricCard}>
              <View style={styles.metricIconBox}>
                <Ionicons name="people" size={20} color={Colors.primary} />
              </View>
              <View style={styles.metricInfo}>
                <Text style={styles.metricValue}>{totalInQueue}</Text>
                <Text style={styles.metricLabel}>{t("Total in Queue")}</Text>
              </View>
            </View>

            <View style={styles.metricDivider} />

            {/* Average Wait Card */}
            <View style={styles.metricCard}>
              <View style={[styles.metricIconBox, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="time" size={20} color="#D97706" />
              </View>
              <View style={styles.metricInfo}>
                <Text style={styles.metricValue}>{formatWaitTime(avgWaitMinutes)}</Text>
                <Text style={styles.metricLabel}>{t("Average Wait")}</Text>
              </View>
            </View>
          </View>

          {/* Banner Footer Info */}
          <View style={styles.bannerFooter}>
            <View style={styles.bannerFooterItem}>
              <Ionicons name="walk-outline" size={13} color={Colors.textLight} />
              <Text style={styles.bannerFooterText}>
                {t("Walk-ins:")}{' '}<Text style={styles.boldText}>{walkInsCount}</Text>
              </Text>
            </View>
            <Text style={styles.bannerFooterDot}>•</Text>
            <View style={styles.bannerFooterItem}>
              <Ionicons name="calendar-outline" size={13} color={Colors.textLight} />
              <Text style={styles.bannerFooterText}>
                {t("Pre-booked:")}{' '}<Text style={styles.boldText}>{preBookedCount}</Text>
              </Text>
            </View>
            <Text style={styles.bannerFooterDot}>•</Text>
            <View style={styles.bannerFooterItem}>
              <Ionicons name="sync-outline" size={13} color={Colors.textLight} />
              <Text style={styles.bannerFooterText}>
                {formatTime(data?.lastUpdated)}
              </Text>
            </View>
          </View>
        </View>

        {/* ======================================================== */}
        {/* 2. FILTER CHIPS ROW                                       */}
        {/* ======================================================== */}
        <View style={styles.filterSection}>
          <Text style={styles.filterSectionTitle}>{t("Filter By Intake Type")}</Text>
          <View style={styles.filterChipsRow}>
            {/* Filter: All */}
            <TouchableOpacity
              style={[
                styles.filterChip,
                filter === 'all' && styles.filterChipActive,
              ]}
              onPress={() => handleFilterChange('all')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t("Filter all queue tokens")}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filter === 'all' && styles.filterChipTextActive,
                ]}
              >
                {t("All")}</Text>
              <View
                style={[
                  styles.countBadge,
                  filter === 'all' ? styles.countBadgeActive : styles.countBadgeInactive,
                ]}
              >
                <Text
                  style={[
                    styles.countBadgeText,
                    filter === 'all' && styles.countBadgeTextActive,
                  ]}
                >
                  {filterCounts.all}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Filter: Walk-ins */}
            <TouchableOpacity
              style={[
                styles.filterChip,
                filter === 'walk_in' && styles.filterChipActive,
              ]}
              onPress={() => handleFilterChange('walk_in')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t("Filter walk in queue tokens")}
            >
              <Ionicons
                name="walk"
                size={14}
                color={filter === 'walk_in' ? Colors.white : Colors.secondary}
                style={styles.chipIcon}
              />
              <Text
                style={[
                  styles.filterChipText,
                  filter === 'walk_in' && styles.filterChipTextActive,
                ]}
              >
                {t("Walk-ins")}</Text>
              <View
                style={[
                  styles.countBadge,
                  filter === 'walk_in' ? styles.countBadgeActive : styles.countBadgeInactive,
                ]}
              >
                <Text
                  style={[
                    styles.countBadgeText,
                    filter === 'walk_in' && styles.countBadgeTextActive,
                  ]}
                >
                  {filterCounts.walk_in}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Filter: Pre-booked */}
            <TouchableOpacity
              style={[
                styles.filterChip,
                filter === 'pre_booked' && styles.filterChipActive,
              ]}
              onPress={() => handleFilterChange('pre_booked')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t("Filter pre booked appointments")}
            >
              <Ionicons
                name="calendar"
                size={14}
                color={filter === 'pre_booked' ? Colors.white : Colors.secondary}
                style={styles.chipIcon}
              />
              <Text
                style={[
                  styles.filterChipText,
                  filter === 'pre_booked' && styles.filterChipTextActive,
                ]}
              >
                {t("Pre-booked")}</Text>
              <View
                style={[
                  styles.countBadge,
                  filter === 'pre_booked' ? styles.countBadgeActive : styles.countBadgeInactive,
                ]}
              >
                <Text
                  style={[
                    styles.countBadgeText,
                    filter === 'pre_booked' && styles.countBadgeTextActive,
                  ]}
                >
                  {filterCounts.pre_booked}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ======================================================== */}
        {/* 3. AUTO-ADVANCE SWITCH CONTROL                            */}
        {/* ======================================================== */}
        <View style={styles.autoAdvanceCard}>
          <View style={styles.autoAdvanceInfo}>
            <View style={styles.autoAdvanceTitleRow}>
              <Ionicons name="flash-outline" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.autoAdvanceTitle}>{t("Auto-Advance Queue")}</Text>
            </View>
            <Text style={styles.autoAdvanceSubtitle}>
              {t("Automatically dispatch next waiting patient when doctor finishes")}</Text>
          </View>

          <Switch
            value={autoAdvanceEnabled}
            onValueChange={handleAutoAdvanceToggle}
            disabled={savingAutoAdvance || loadingAutoAdvance}
            trackColor={{ false: '#E2E8F0', true: '#99F6E4' }}
            thumbColor={autoAdvanceEnabled ? Colors.primary : '#94A3B8'}
            ios_backgroundColor="#E2E8F0"
            style={styles.switchStyle}
          />
        </View>

        {/* ======================================================== */}
        {/* 4. NEXT IN LINE HERO CARD                                */}
        {/* ======================================================== */}
        {!loading || data ? renderNextInLineCard() : null}

        {/* ======================================================== */}
        {/* 5. DOCTOR-SEPARATED QUEUES (WALK-IN & PRE-BOOKED)         */}
        {/* ======================================================== */}
        {!loading || data ? renderDoctorSeparatedQueues() : null}

        {/* ======================================================== */}
        {/* 6. LOADING / ERROR STATES                                 */}
        {/* ======================================================== */}
        {loading && !data ? (
          <View style={styles.stateContainer}>
            <LoadingState
              message={t("Fetching live queue dispatch...")}
              size="large"
              fullscreen={false}
            />
          </View>
        ) : error && !data ? (
          <View style={styles.stateContainer}>
            <ErrorState
              title={t("Unable to load queue")}
              message={error}
              onRetry={() => refresh(false)}
              retryLabel="Retry Queue Fetch"
              fullscreen={false}
            />
          </View>
        ) : null}


        {/* Bottom padding for tab bar / safe layout */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#D0E8ED',
    marginTop: 1,
    fontWeight: '500',
  },
  refreshIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  rotatingIcon: {
    transform: [{ rotate: '45deg' }],
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // ─────────────────────────────────────────────────────────
  // Dispatch Banner Styles
  // ─────────────────────────────────────────────────────────
  dispatchBannerCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 16,
  },
  bannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  bannerTagWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  bannerTagIcon: {
    marginRight: 5,
  },
  bannerTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.5,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    minHeight: 28,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
    marginRight: 6,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.6,
  },
  metricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.tint,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  metricCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  metricInfo: {
    flex: 1,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textDark,
    lineHeight: 26,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMedium,
    marginTop: 1,
  },
  metricDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#BAE6FD',
    marginHorizontal: 10,
  },
  bannerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  bannerFooterItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerFooterText: {
    fontSize: 12,
    color: Colors.textMedium,
    marginLeft: 4,
  },
  boldText: {
    fontWeight: '700',
    color: Colors.textDark,
  },
  bannerFooterDot: {
    color: Colors.textLight,
    fontSize: 12,
  },

  // ─────────────────────────────────────────────────────────
  // Filter Chips Section
  // ─────────────────────────────────────────────────────────
  filterSection: {
    marginBottom: 12,
  },
  filterSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMedium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 2,
  },
  filterChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // 44px touch target requirement
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  chipIcon: {
    marginRight: 4,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textDark,
    marginRight: 6,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeInactive: {
    backgroundColor: Colors.tint,
  },
  countBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  countBadgeTextActive: {
    color: Colors.white,
  },

  // ─────────────────────────────────────────────────────────
  // Auto-Advance Switch Card
  // ─────────────────────────────────────────────────────────
  autoAdvanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  autoAdvanceInfo: {
    flex: 1,
    marginRight: 12,
  },
  autoAdvanceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  autoAdvanceTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textDark,
  },
  autoAdvanceSubtitle: {
    fontSize: 11.5,
    color: Colors.textMedium,
    lineHeight: 16,
  },
  switchStyle: {
    transform: Platform.OS === 'ios' ? [{ scaleX: 0.85 }, { scaleY: 0.85 }] : [],
  },

  // ─────────────────────────────────────────────────────────
  // Next in Line Hero Card Styles
  // ─────────────────────────────────────────────────────────
  nextInLineSection: {
    marginBottom: 20,
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  readyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
    marginRight: 5,
  },
  readyBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.5,
  },
  nextInLineCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  nextCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  nextCardTokenWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  nextPatientMeta: {
    marginLeft: 10,
    flex: 1,
  },
  nextPatientName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textDark,
  },
  nextPatientSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    flexWrap: 'wrap',
  },
  nextSubText: {
    fontSize: 12,
    color: Colors.textMedium,
    marginRight: 4,
  },
  nextTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  nextTypeChipText: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  nextDetailsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexWrap: 'wrap',
    gap: 8,
  },
  nextDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 130,
  },
  nextDetailLabel: {
    fontSize: 12,
    color: Colors.textMedium,
    marginRight: 4,
    fontWeight: '500',
  },
  nextDetailValue: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textDark,
    flexShrink: 1,
  },
  nextActionsStack: {
    gap: 10,
  },
  primaryCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    minHeight: 48, // 48px touch target
    borderRadius: 12,
    paddingHorizontal: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryCallBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.3,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // 44px touch target
    borderRadius: 10,
    paddingHorizontal: 10,
    borderWidth: 1.5,
  },
  moveBackBtn: {
    backgroundColor: Colors.tint,
    borderColor: '#BAE6FD',
  },
  moveBackBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.secondary,
  },
  noShowBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  noShowBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.danger,
  },
  btnIcon: {
    marginRight: 6,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  nextInLineEmptyCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyLineIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  nextInLineEmptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textDark,
    marginBottom: 2,
  },
  nextInLineEmptySubtitle: {
    fontSize: 12,
    color: Colors.textMedium,
    textAlign: 'center',
  },

  // ─────────────────────────────────────────────────────────
  // Doctor Separated Queues & Filter Styles
  // ─────────────────────────────────────────────────────────
  doctorQueueSection: {
    marginBottom: 20,
  },
  doctorQueueTotalPill: {
    backgroundColor: Colors.tint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  doctorQueueTotalPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  doctorFilterRow: {
    paddingVertical: 10,
    gap: 8,
  },
  doctorFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginRight: 8,
  },
  doctorFilterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  doctorFilterText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textDark,
  },
  doctorFilterTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  doctorFilterBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: Colors.background,
  },
  doctorFilterBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  doctorFilterBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMedium,
  },
  doctorFilterBadgeTextActive: {
    color: Colors.white,
  },
  doctorSectionCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  doctorHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  doctorHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  doctorAvatarBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doctorAvatarText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  doctorHeaderName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textDark,
  },
  doctorHeaderSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  doctorRoomBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.secondary,
  },
  doctorDeptText: {
    fontSize: 12,
    color: Colors.textMedium,
  },
  doctorHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  doctorTotalBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  doctorTotalBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  doctorQuickCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minHeight: 36,
  },
  doctorQuickCallBtnText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  doctorBreakdownBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: 10,
  },
  breakdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  walkInBreakdownPill: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  walkInBreakdownText: {
    fontSize: 12,
    color: '#0369A1',
  },
  preBookedBreakdownPill: {
    backgroundColor: '#F0FDFA',
    borderColor: '#99F6E4',
  },
  preBookedBreakdownText: {
    fontSize: 12,
    color: '#0F766E',
  },
  doctorQueuesContainer: {
    padding: 12,
    gap: 14,
  },
  queueTrackWrap: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  queueTrackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
  },
  walkInTrackHeader: {
    backgroundColor: '#F0F9FF',
    borderBottomColor: '#BAE6FD',
  },
  preBookedTrackHeader: {
    backgroundColor: '#F0FDFA',
    borderBottomColor: '#99F6E4',
  },
  walkInTrackTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0369A1',
  },
  trackCountBadgeWalkIn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  trackCountBadgeWalkInText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0369A1',
  },
  preBookedTrackTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F766E',
  },
  trackCountBadgePreBooked: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#CCFBF1',
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  trackCountBadgePreBookedText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F766E',
  },
  queueTrackTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textDark,
  },
  queueTrackCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  queueTrackCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textDark,
  },
  emptyTrackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  emptyTrackText: {
    fontSize: 12,
    color: Colors.textLight,
    fontStyle: 'italic',
  },
  doctorQueueItemCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 8,
    marginVertical: 6,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  walkInPosBadge: {
    backgroundColor: '#E0F2FE',
    borderColor: '#BAE6FD',
  },
  walkInPosText: {
    color: '#0369A1',
  },
  preBookedPosBadge: {
    backgroundColor: '#CCFBF1',
    borderColor: '#99F6E4',
  },
  preBookedPosText: {
    color: '#0F766E',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  cardCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minHeight: 36,
  },
  cardCallBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.white,
  },
  cardChangeDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.tint,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minHeight: 36,
  },
  cardChangeDocBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  cardNoShowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minHeight: 36,
  },
  cardNoShowBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.danger,
  },

  // ─────────────────────────────────────────────────────────
  // Upcoming Patients Section Styles
  // ─────────────────────────────────────────────────────────
  upcomingSection: {
    marginBottom: 16,
  },
  upcomingCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  upcomingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  upcomingTokenWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  upcomingPosBadge: {
    backgroundColor: Colors.background,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  upcomingPosText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMedium,
  },
  upcomingChipsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  urgentPriorityBadge: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  urgentPriorityText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
  },
  seniorPriorityBadge: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  seniorPriorityText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
  },
  upcomingTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  upcomingTypeChipText: {
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 3,
  },
  upcomingPatientRow: {
    paddingVertical: 4,
  },
  upcomingPatientName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textDark,
  },
  upcomingPatientMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    flexWrap: 'wrap',
  },
  upcomingMetaText: {
    fontSize: 12,
    color: Colors.textLight,
    marginRight: 4,
  },
  upcomingDoctorRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  doctorAssignedWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  doctorInfoCol: {
    flex: 1,
    marginRight: 8,
  },
  doctorIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  doctorNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textDark,
  },
  doctorRoomText: {
    fontSize: 11,
    color: Colors.textMedium,
    marginLeft: 4,
  },
  changeDoctorBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.tint,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    minHeight: 44, // 44px touch target
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeDoctorBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  doctorUnassignedWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unassignedLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unassignedLabelText: {
    fontSize: 12,
    color: '#D97706',
    fontWeight: '600',
  },
  assignDoctorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    minHeight: 44, // 44px touch target
    justifyContent: 'center',
  },
  assignDoctorBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  upcomingEmptyCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  upcomingEmptyIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  upcomingEmptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textDark,
    marginBottom: 2,
  },
  upcomingEmptySubtitle: {
    fontSize: 12,
    color: Colors.textMedium,
    textAlign: 'center',
    lineHeight: 16,
  },


  // ─────────────────────────────────────────────────────────
  // Shared Chip & State Handling
  // ─────────────────────────────────────────────────────────
  walkInChip: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  preBookedChip: {
    backgroundColor: '#F0FDFA',
    borderColor: '#99F6E4',
  },
  stateContainer: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
  },
  bottomSpacer: {
    height: 40,
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
  callNextHelperNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  callNextHelperNoticeText: {
    fontSize: 11,
    color: Colors.textMedium,
    fontWeight: '500',
    textAlign: 'center',
  },
  opdMonitorInfoBox: {
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#99F6E4',
    padding: 10,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  opdMonitorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  opdMonitorPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F766E',
    letterSpacing: 0.3,
  },
  opdMonitorRoomText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
    backgroundColor: Colors.white,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
});

export default LiveQueueScreen;
