import React, { useState, useEffect, useRef } from 'react';
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

  // Identify waiting queue tokens
  const waitingTokens = (data?.queue || []).filter((t) => t.status === 'waiting');
  const nextInLine: QueueToken | null = waitingTokens.length > 0 ? waitingTokens[0] : null;
  const upcomingTokens: QueueToken[] = waitingTokens.length > 1 ? waitingTokens.slice(1) : [];

  const handleFilterChange = (selected: LiveQueueFilter) => {
    if (filter !== selected) {
      setFilter(selected);
    }
  };

  const handleBack = () => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
    } else if (onNavigate) {
      onNavigate('Home');
    }
  };

  // Format timestamp for display
  const formatTime = (isoString?: string) => {
    if (!isoString) return 'Just now';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Just now';
    }
  };

  const formatWaitTime = (minutes: number) => {
    if (minutes <= 0) return '0 min';
    if (minutes < 60) return `~${minutes} min`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `~${hrs}h ${mins}m` : `~${hrs}h`;
  };

  // Calculate wait so far for a token
  const calculateWaitSoFar = (token: QueueToken): string => {
    const timeSource =
      token.createdAt ||
      (typeof token.appointment === 'object' && token.appointment?.createdAt) ||
      null;
    if (!timeSource) return '5 mins';
    try {
      const start = new Date(timeSource).getTime();
      const now = Date.now();
      const diffMins = Math.max(1, Math.round((now - start) / 60000));
      return `${diffMins} min${diffMins === 1 ? '' : 's'}`;
    } catch {
      return '5 mins';
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
        newValue ? 'Auto-Advance queue enabled' : 'Auto-Advance queue disabled',
        'success'
      );
    } catch (err: any) {
      // Revert switch on error
      setAutoAdvanceEnabled(!newValue);
      const msg = getErrorMessage(err);
      showToast(msg || 'Failed to update auto-advance setting', 'error');
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
      showToast(`Token ${tokenName} called to Room ${roomNumber}`, 'success');
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

  // 2. Mark No-Show (Confirm first)
  const handleMarkNoShow = (token: QueueToken, patientName: string) => {
    if (!token || actionLoading) return;
    const tokenLabel = token.tokenLabel || `OPD-${token.tokenNumber}`;

    Alert.alert(
      'Confirm No-Show',
      `Are you sure you want to mark ${tokenLabel} (${patientName}) as No-Show?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark No-Show',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await markNoShow(token._id || tokenLabel);
              showToast(`Token ${tokenLabel} marked as No-Show`, 'info');
              await refresh(false);
            } catch (err: any) {
              const msg = getErrorMessage(err);
              showToast(msg || 'Failed to mark token as no-show', 'error');
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
      'Move Token Back',
      `Move ${tokenLabel} 3 positions back in the waiting queue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move Back',
          onPress: async () => {
            try {
              setActionLoading(true);
              await moveBack(token._id || tokenLabel);
              showToast(`Token ${tokenLabel} moved back in queue`, 'success');
              await refresh(false);
            } catch (err: any) {
              const msg = getErrorMessage(err);
              showToast(msg || 'Failed to move token back', 'error');
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
            title="Next in Line"
            subtitle="Immediate priority queue"
          />
          <View style={styles.nextInLineEmptyCard}>
            <View style={styles.emptyLineIconBox}>
              <Ionicons name="people-outline" size={26} color={Colors.textLight} />
            </View>
            <Text style={styles.nextInLineEmptyTitle}>No patients waiting</Text>
            <Text style={styles.nextInLineEmptySubtitle}>
              All active patients have been called or attended.
            </Text>
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
    const roomNumber = doctorObj?.room || '01';
    const waitSoFar = calculateWaitSoFar(nextInLine);
    const moveBackCount = nextInLine.moveBackCount || 0;
    const isUrgent = nextInLine.priority === 'urgent';
    const tokenLabel = nextInLine.tokenLabel || `OPD-${nextInLine.tokenNumber}`;

    return (
      <View style={styles.nextInLineSection}>
        <SectionHeader
          title="Next in Line"
          subtitle="Top waiting token ready to be dispatched"
          rightElement={
            <View style={styles.readyBadge}>
              <View style={styles.readyDot} />
              <Text style={styles.readyBadgeText}>READY</Text>
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
                    <Text style={styles.nextSubText}>{patientObj.age} yrs</Text>
                  ) : null}
                  {patientObj?.gender ? (
                    <Text style={styles.nextSubText}>
                      • {patientObj.gender.charAt(0).toUpperCase() + patientObj.gender.slice(1)}
                    </Text>
                  ) : null}
                  {patientObj?.nic ? (
                    <Text style={styles.nextSubText}>• NIC: {patientObj.nic}</Text>
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
                {isWalkIn ? 'Walk-in' : 'Pre-booked'}
              </Text>
            </View>
          </View>

          {/* Details Row: Wait so far & Assigned Doctor */}
          <View style={styles.nextDetailsGrid}>
            <View style={styles.nextDetailItem}>
              <Ionicons name="time" size={15} color="#D97706" style={{ marginRight: 6 }} />
              <Text style={styles.nextDetailLabel}>Wait so far:</Text>
              <Text style={styles.nextDetailValue}>{waitSoFar}</Text>
            </View>

            <View style={styles.nextDetailItem}>
              <Ionicons name="medkit" size={15} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.nextDetailLabel}>Doctor:</Text>
              <Text style={styles.nextDetailValue} numberOfLines={1}>
                {doctorName}
              </Text>
            </View>
          </View>

          {/* Buttons Stack */}
          <View style={styles.nextActionsStack}>
            {/* Primary Action: Call Next to Room <room> */}
            <TouchableOpacity
              style={[
                styles.primaryCallBtn,
                (actionLoading || isShiftClosed) && styles.btnDisabled,
              ]}
              onPress={() =>
                handleCallNext(
                  roomNumber,
                  doctorObj?._id || doctorObj?.id,
                  nextInLine.department
                )
              }
              disabled={actionLoading || isShiftClosed}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Call Next to Room ${roomNumber}`}
            >
              <Ionicons
                name={isShiftClosed ? 'lock-closed' : 'play-forward'}
                size={18}
                color={Colors.white}
                style={styles.btnIcon}
              />
              <Text style={styles.primaryCallBtnText}>
                {isShiftClosed ? 'Shift Closed (Intake Disabled)' : `Call Next to Room ${roomNumber}`}
              </Text>
            </TouchableOpacity>

            {/* Secondary Action Row: Mark No-Show & Move Back (n) */}
            <View style={styles.secondaryActionsRow}>
              {/* Move Back (n) - Hidden for urgent tokens */}
              {!isUrgent ? (
                <TouchableOpacity
                  style={[
                    styles.secondaryActionBtn,
                    styles.moveBackBtn,
                    actionLoading && styles.btnDisabled,
                  ]}
                  onPress={() => handleMoveBack(nextInLine)}
                  disabled={actionLoading}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Move back token ${tokenLabel}`}
                >
                  <Ionicons
                    name="swap-vertical"
                    size={16}
                    color={Colors.secondary}
                    style={styles.btnIcon}
                  />
                  <Text style={styles.moveBackBtnText}>
                    Move Back ({moveBackCount})
                  </Text>
                </TouchableOpacity>
              ) : null}

              {/* Mark No-Show */}
              <TouchableOpacity
                style={[
                  styles.secondaryActionBtn,
                  styles.noShowBtn,
                  actionLoading && styles.btnDisabled,
                  isUrgent && { flex: 1 }, // Take full width if Move Back is hidden
                ]}
                onPress={() => handleMarkNoShow(nextInLine, patientName)}
                disabled={actionLoading}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Mark token ${tokenLabel} as no show`}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={16}
                  color={Colors.danger}
                  style={styles.btnIcon}
                />
                <Text style={styles.noShowBtnText}>Mark No-Show</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────
  // Render "Upcoming Patients" List
  // ─────────────────────────────────────────────────────────
  const renderUpcomingPatientsList = () => {
    return (
      <View style={styles.upcomingSection}>
        <SectionHeader
          title={`Upcoming Patients (${upcomingTokens.length})`}
          subtitle="Queue order following the next-in-line patient"
        />

        {upcomingTokens.length > 0 ? (
          upcomingTokens.map((token: QueueToken, index: number) => {
            const patientObj =
              typeof token.patient === 'object' && token.patient !== null
                ? token.patient
                : null;
            const patientName =
              patientObj?.fullName || (patientObj as any)?.name || `Patient #${token.tokenNumber}`;
            const appointmentObj =
              typeof token.appointment === 'object' && token.appointment !== null
                ? token.appointment
                : null;
            const isWalkIn = appointmentObj?.type === 'walk_in';
            const doctorObj =
              typeof token.assignedDoctor === 'object' && token.assignedDoctor !== null
                ? token.assignedDoctor
                : null;
            const doctorName = doctorObj?.name
              ? doctorObj.name.startsWith('Dr.')
                ? doctorObj.name
                : `Dr. ${doctorObj.name}`
              : null;
            const roomName = doctorObj?.room ? `Room ${doctorObj.room}` : null;
            const isSenior = token.priority === 'senior';
            const isUrgent = token.priority === 'urgent';
            const tokenLabel = token.tokenLabel || `OPD-${token.tokenNumber}`;

            return (
              <View key={token._id || `upcoming-${index}`} style={styles.upcomingCard}>
                {/* Header Row: Token + Name + Chips */}
                <View style={styles.upcomingTopRow}>
                  <View style={styles.upcomingTokenWrap}>
                    <View style={styles.upcomingPosBadge}>
                      <Text style={styles.upcomingPosText}>#{index + 2}</Text>
                    </View>
                    <TokenBadge
                      tokenLabel={tokenLabel}
                      priority={token.priority}
                      size="medium"
                    />
                  </View>

                  {/* Priority & Type Chips */}
                  <View style={styles.upcomingChipsGroup}>
                    {/* Senior / Urgent Chip */}
                    {isUrgent ? (
                      <View style={[styles.priorityBadge, styles.urgentPriorityBadge]}>
                        <Ionicons name="alert-circle" size={11} color="#DC2626" style={{ marginRight: 3 }} />
                        <Text style={styles.urgentPriorityText}>Urgent</Text>
                      </View>
                    ) : isSenior ? (
                      <View style={[styles.priorityBadge, styles.seniorPriorityBadge]}>
                        <Ionicons name="ribbon" size={11} color="#D97706" style={{ marginRight: 3 }} />
                        <Text style={styles.seniorPriorityText}>Senior</Text>
                      </View>
                    ) : null}

                    {/* Walk-in / Pre-booked Chip */}
                    <View
                      style={[
                        styles.upcomingTypeChip,
                        isWalkIn ? styles.walkInChip : styles.preBookedChip,
                      ]}
                    >
                      <Ionicons
                        name={isWalkIn ? 'walk' : 'calendar'}
                        size={11}
                        color={isWalkIn ? '#0284C7' : '#0D9488'}
                      />
                      <Text
                        style={[
                          styles.upcomingTypeChipText,
                          { color: isWalkIn ? '#0284C7' : '#0D9488' },
                        ]}
                      >
                        {isWalkIn ? 'Walk-in' : 'Pre-booked'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Patient Name & Details */}
                <View style={styles.upcomingPatientRow}>
                  <Text style={styles.upcomingPatientName} numberOfLines={1}>
                    {patientName}
                  </Text>
                  <View style={styles.upcomingPatientMeta}>
                    {patientObj?.age ? (
                      <Text style={styles.upcomingMetaText}>{patientObj.age} yrs</Text>
                    ) : null}
                    {patientObj?.gender ? (
                      <Text style={styles.upcomingMetaText}>
                        • {patientObj.gender.charAt(0).toUpperCase() + patientObj.gender.slice(1)}
                      </Text>
                    ) : null}
                    {patientObj?.nic ? (
                      <Text style={styles.upcomingMetaText}>• {patientObj.nic}</Text>
                    ) : null}
                  </View>
                </View>

                {/* Doctor Assignment Row */}
                <View style={styles.upcomingDoctorRow}>
                  {doctorName ? (
                    // Doctor is assigned: show name, room, and "Change" action
                    <View style={styles.doctorAssignedWrap}>
                      <View style={styles.doctorInfoCol}>
                        <View style={styles.doctorIconRow}>
                          <Ionicons name="medkit" size={13} color={Colors.primary} style={{ marginRight: 4 }} />
                          <Text style={styles.doctorNameText} numberOfLines={1}>
                            {doctorName}
                          </Text>
                          {roomName ? (
                            <Text style={styles.doctorRoomText}>({roomName})</Text>
                          ) : null}
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.changeDoctorBtn}
                        onPress={() => openDoctorModal(token)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`Change assigned doctor for ${tokenLabel}`}
                      >
                        <Text style={styles.changeDoctorBtnText}>Change</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    // Doctor is unassigned: show "Assign Doctor" button
                    <View style={styles.doctorUnassignedWrap}>
                      <View style={styles.unassignedLabelWrap}>
                        <Ionicons name="alert-circle-outline" size={14} color="#D97706" style={{ marginRight: 4 }} />
                        <Text style={styles.unassignedLabelText}>Doctor unassigned</Text>
                      </View>

                      <TouchableOpacity
                        style={styles.assignDoctorBtn}
                        onPress={() => openDoctorModal(token)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`Assign doctor to ${tokenLabel}`}
                      >
                        <Ionicons name="person-add" size={12} color={Colors.white} style={{ marginRight: 4 }} />
                        <Text style={styles.assignDoctorBtnText}>Assign Doctor</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.upcomingEmptyCard}>
            <View style={styles.upcomingEmptyIconBox}>
              <Ionicons name="people-outline" size={24} color={Colors.textLight} />
            </View>
            <Text style={styles.upcomingEmptyTitle}>No upcoming patients</Text>
            <Text style={styles.upcomingEmptySubtitle}>
              {nextInLine
                ? 'There are no additional waiting patients queued after the next in line.'
                : 'No patients are currently waiting in this queue.'}
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
          showToast(`Assigned ${docName} to ${tokenLabel}`, 'success');
          await refresh(false);
        }}
        onError={(err: string) => {
          showToast(err || 'Failed to assign doctor', 'error');
        }}
      />

      {/* Screen Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {navigation?.canGoBack?.() ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={22} color={Colors.white} />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerIconWrap}>
              <Ionicons name="layers" size={20} color={Colors.white} />
            </View>
          )}
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>OPD Live Queue</Text>
            <Text style={styles.headerSubtitle}>Real-time Patient Dispatch</Text>
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
            <Text style={styles.shiftClosedNoticeText}>Shift closed. Intake is disabled.</Text>
          </View>
        )}

        {/* ======================================================== */}
        {/* 1. DISPATCH BANNER                                        */}
        {/* ======================================================== */}
        <View style={styles.dispatchBannerCard}>
          {/* Banner Top Row */}
          <View style={styles.bannerTopRow}>
            <View style={styles.bannerTagWrap}>
              <Ionicons name="flash" size={13} color="#F59E0B" style={styles.bannerTagIcon} />
              <Text style={styles.bannerTagText}>LIVE DISPATCH QUEUE</Text>
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
              <Text style={styles.activeBadgeText}>ACTIVE</Text>
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
                <Text style={styles.metricLabel}>Total in Queue</Text>
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
                <Text style={styles.metricLabel}>Average Wait</Text>
              </View>
            </View>
          </View>

          {/* Banner Footer Info */}
          <View style={styles.bannerFooter}>
            <View style={styles.bannerFooterItem}>
              <Ionicons name="walk-outline" size={13} color={Colors.textLight} />
              <Text style={styles.bannerFooterText}>
                Walk-ins: <Text style={styles.boldText}>{walkInsCount}</Text>
              </Text>
            </View>
            <Text style={styles.bannerFooterDot}>•</Text>
            <View style={styles.bannerFooterItem}>
              <Ionicons name="calendar-outline" size={13} color={Colors.textLight} />
              <Text style={styles.bannerFooterText}>
                Pre-booked: <Text style={styles.boldText}>{preBookedCount}</Text>
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
          <Text style={styles.filterSectionTitle}>Filter By Intake Type</Text>
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
              accessibilityLabel="Filter all queue tokens"
            >
              <Text
                style={[
                  styles.filterChipText,
                  filter === 'all' && styles.filterChipTextActive,
                ]}
              >
                All
              </Text>
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
              accessibilityLabel="Filter walk in queue tokens"
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
                Walk-ins
              </Text>
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
              accessibilityLabel="Filter pre booked appointments"
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
                Pre-booked
              </Text>
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
              <Text style={styles.autoAdvanceTitle}>Auto-Advance Queue</Text>
            </View>
            <Text style={styles.autoAdvanceSubtitle}>
              Automatically dispatch next waiting patient when doctor finishes
            </Text>
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
        {/* 5. UPCOMING PATIENTS LIST                                 */}
        {/* ======================================================== */}
        {!loading || data ? renderUpcomingPatientsList() : null}

        {/* ======================================================== */}
        {/* 6. LOADING / ERROR STATES                                 */}
        {/* ======================================================== */}
        {loading && !data ? (
          <View style={styles.stateContainer}>
            <LoadingState
              message="Fetching live queue dispatch..."
              size="large"
              fullscreen={false}
            />
          </View>
        ) : error && !data ? (
          <View style={styles.stateContainer}>
            <ErrorState
              title="Unable to load queue"
              message={error}
              onRetry={() => refresh(false)}
              retryLabel="Retry Queue Fetch"
              fullscreen={false}
            />
          </View>
        ) : null}

        {/* ======================================================== */}
        {/* 7. TIP BANNER                                             */}
        {/* ======================================================== */}
        <View style={styles.tipBanner}>
          <View style={styles.tipIconWrap}>
            <Ionicons name="information-circle" size={20} color={Colors.primary} />
          </View>
          <Text style={styles.tipText}>
            Pressing Call Next alerts the patient display and doctor queue automatically.
          </Text>
        </View>

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
  // Tip Banner Styles
  // ─────────────────────────────────────────────────────────
  tipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginTop: 8,
    marginBottom: 12,
  },
  tipIconWrap: {
    marginRight: 10,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textMedium,
    lineHeight: 17,
    fontWeight: '500',
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
});

export default LiveQueueScreen;
