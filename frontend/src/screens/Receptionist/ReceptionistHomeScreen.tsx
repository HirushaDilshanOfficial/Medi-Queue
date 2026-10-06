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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { CurrentlyServingToken, QueueToken } from '../../types';
import { useAuth, useDashboard } from '../../hooks';
import {
  callNext,
  recallToken,
  markNoShow,
  getErrorMessage,
} from '../../services/api';
import {
  StatCard,
  TokenBadge,
  StatusChip,
  SectionHeader,
  LoadingState,
  ErrorState,
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
  const { data, loading, error, refreshing, refresh } = useDashboard();
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'info' | 'warning'>('success');
  const toastAnim = useRef(new Animated.Value(-100)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isMounted = useRef<boolean>(true);

  // Derive display nurse/staff name
  const nurseName = user?.fullName || user?.name || 'Nurse In-Charge';

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
    (message: string, type: 'success' | 'info' | 'warning' = 'success') => {
      setToastMessage(message);
      setToastType(type);

      Animated.sequence([
        Animated.timing(toastAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(3500),
        Animated.timing(toastAnim, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (isMounted.current) {
          setToastMessage(null);
        }
      });
    },
    [toastAnim]
  );

  // Action: Call Next
  const handleCallNext = async () => {
    if (actionLoading) return;
    try {
      setActionLoading(true);
      const res = await callNext();
      const patientName =
        res?.patient?.name || res?.patient?.fullName || 'Patient';
      const token = res?.tokenLabel || 'Next Token';
      const room = res?.room ? ` (Room ${res.room})` : '';

      showToast(`Now Calling ${token} — ${patientName}${room}`, 'success');
      await refresh(false);
    } catch (err: any) {
      const msg = getErrorMessage(err);
      Alert.alert('Call Next Failed', msg || 'No more waiting patients or error calling next.');
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
      showToast(`Recalled ${tokenLabel} to consulting room`, 'info');
      await refresh(false);
    } catch (err: any) {
      const msg = getErrorMessage(err);
      Alert.alert('Recall Failed', msg || 'Unable to recall this token.');
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
      `Are you sure you want to mark token ${tokenLabel} as No-Show? This patient will be removed from active queue.`,
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
              Alert.alert('Action Failed', msg || 'Unable to mark token as no-show.');
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

  // Format today's date
  const formattedToday = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  if (loading && !data) {
    return <LoadingState fullscreen message="Loading Counter Dashboard..." />;
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

  const serving: CurrentlyServingToken | null = data?.currentlyServing || null;
  const rooms = data?.rooms || [];
  const nextInQueue: QueueToken[] = data?.nextInQueue || [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* ── TOAST NOTIFICATION BANNER ── */}
      {toastMessage && (
        <Animated.View
          style={[
            styles.toastContainer,
            toastType === 'success' && styles.toastSuccess,
            toastType === 'info' && styles.toastInfo,
            toastType === 'warning' && styles.toastWarning,
            { transform: [{ translateY: toastAnim }] },
          ]}
        >
          <Ionicons
            name={
              toastType === 'success'
                ? 'checkmark-circle'
                : toastType === 'info'
                ? 'megaphone'
                : 'alert-circle'
            }
            size={20}
            color={Colors.white}
            style={styles.toastIcon}
          />
          <Text style={styles.toastText} numberOfLines={2}>
            {toastMessage}
          </Text>
          <TouchableOpacity
            onPress={() => setToastMessage(null)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={18} color={Colors.white} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── HEADER WITH COUNTER, LIVE BADGE, NURSE NAME & NOTIFICATION BELL ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerTopRow}>
            <Text style={styles.headerTitle}>OPD Counter 01</Text>
            {/* LIVE Badge */}
            <View style={styles.livePill}>
              <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>

          {/* Nurse info & Date sub-row */}
          <View style={styles.nurseInfoRow}>
            <Ionicons
              name="person-circle-outline"
              size={15}
              color="rgba(255, 255, 255, 0.9)"
              style={{ marginRight: 5 }}
            />
            <Text style={styles.nurseNameText} numberOfLines={1}>
              {nurseName}
            </Text>
            <Text style={styles.dateDot}>•</Text>
            <Text style={styles.headerDate}>{formattedToday}</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {/* Notification Bell */}
          <TouchableOpacity
            style={styles.bellButton}
            activeOpacity={0.8}
            onPress={() => {
              Alert.alert('Notifications', 'All counter channels operating normally.');
            }}
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
        {/* ── 2x2 STAT CARDS ── */}
        <View style={styles.statGrid}>
          <View style={styles.statRow}>
            <StatCard
              title="Total Intake Today"
              value={data?.intake?.total ?? 0}
              subtitle={`${data?.intake?.walkIn ?? 0} Walk-In · ${data?.intake?.preBooked ?? 0} Pre-Booked`}
              iconName="people"
              variant="primary"
              style={styles.gridCard}
            />
            <StatCard
              title="In Waiting"
              value={data?.inWaiting ?? 0}
              subtitle={`~${data?.avgWaitMinutes ?? 0} min avg wait`}
              iconName="time"
              variant="warning"
              style={styles.gridCard}
            />
          </View>

          <View style={styles.statRow}>
            <StatCard
              title="Attended Done"
              value={data?.attendedDone ?? 0}
              subtitle="Completed visits"
              iconName="checkmark-circle"
              variant="success"
              style={styles.gridCard}
            />
            <StatCard
              title="Doctors Active"
              value={data?.doctorsActive ?? 0}
              subtitle={`${rooms.filter((r) => r.status === 'Consulting').length} in consultation`}
              iconName="medkit"
              variant="default"
              style={styles.gridCard}
            />
          </View>
        </View>

        {/* ── NOW SERVING CARD ── */}
        <View style={styles.servingSection}>
          <View style={styles.servingCard}>
            <View style={styles.servingHeader}>
              <View style={styles.servingTag}>
                <Ionicons name="radio" size={14} color={Colors.white} style={{ marginRight: 4 }} />
                <Text style={styles.servingTagText}>NOW SERVING</Text>
              </View>

              {serving?.room && (
                <View style={styles.roomPill}>
                  <Text style={styles.roomPillText}>Room {serving.room}</Text>
                </View>
              )}
            </View>

            {serving ? (
              <View style={styles.servingBody}>
                <View style={styles.servingMainRow}>
                  <TokenBadge
                    tokenLabel={serving.tokenLabel}
                    size="large"
                    priority="urgent"
                  />
                  <View style={styles.patientDetails}>
                    <Text style={styles.servingPatientName} numberOfLines={1}>
                      {serving.patient?.name || 'Walk-In Patient'}
                    </Text>
                    <Text style={styles.servingPatientMeta}>
                      {serving.patient?.age ? `${serving.patient.age} yrs` : 'Age: —'} •{' '}
                      {serving.patient?.gender ? serving.patient.gender : 'Gender: —'}
                    </Text>
                    {serving.patient?.nic ? (
                      <Text style={styles.servingPatientNic}>
                        NIC: {serving.patient.nic}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Doctor & Dept row */}
                <View style={styles.servingDoctorRow}>
                  <Ionicons name="medical" size={16} color={Colors.secondary} />
                  <Text style={styles.servingDoctorText} numberOfLines={1}>
                    {typeof serving.doctor === 'object' && serving.doctor?.name
                      ? `${serving.doctor.name} (${serving.doctor.department || 'OPD'})`
                      : typeof serving.doctor === 'string'
                      ? serving.doctor
                      : 'General OPD Consultation'}
                  </Text>
                </View>

                {/* Serving Actions */}
                <View style={styles.servingActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.callNextBtn]}
                    onPress={handleCallNext}
                    disabled={actionLoading}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="play-forward" size={18} color={Colors.white} />
                    <Text style={styles.callNextBtnText}>Call Next</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.recallBtn]}
                    onPress={() => handleRecall(serving.tokenLabel)}
                    disabled={actionLoading}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="repeat" size={16} color={Colors.primary} />
                    <Text style={styles.recallBtnText}>Recall</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.noShowBtn]}
                    onPress={() => handleNoShow(serving.tokenLabel)}
                    disabled={actionLoading}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close-circle-outline" size={16} color={Colors.danger} />
                    <Text style={styles.noShowBtnText}>No-Show</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.emptyServingBody}>
                <Ionicons name="person-outline" size={40} color={Colors.textLight} />
                <Text style={styles.emptyServingTitle}>No Active Patient Being Served</Text>
                <Text style={styles.emptyServingSub}>
                  {data?.inWaiting && data.inWaiting > 0
                    ? `${data.inWaiting} patients waiting in queue.`
                    : 'The waiting queue is currently empty.'}
                </Text>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.callNextBtnEmpty]}
                  onPress={handleCallNext}
                  disabled={actionLoading || (data?.inWaiting === 0)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="play-forward" size={18} color={Colors.white} style={{ marginRight: 6 }} />
                  <Text style={styles.callNextBtnText}>Call Next Patient</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* ── DESK QUICK ACTIONS ── */}
        <View style={styles.quickActionsSection}>
          <SectionHeader title="Desk Quick Actions" subtitle="Fast registration and desk navigation" />
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => handleNav('RegisterTab')}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIconWrap, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="person-add" size={22} color={Colors.primary} />
              </View>
              <Text style={styles.quickActionLabel}>New Walk-In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => handleNav('PatientsTab')}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIconWrap, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="search" size={22} color={Colors.success} />
              </View>
              <Text style={styles.quickActionLabel}>Find Patient</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => handleNav('Queue')}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIconWrap, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="list" size={22} color="#D97706" />
              </View>
              <Text style={styles.quickActionLabel}>Full Queue</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => handleNav('ReportsTab')}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIconWrap, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="document-text" size={22} color="#7E22CE" />
              </View>
              <Text style={styles.quickActionLabel}>Daily Report</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── CONSULTATION ROOMS (LIVE) ── */}
        <View style={styles.roomsSection}>
          <SectionHeader
            title="Consultation Rooms"
            subtitle="Live status per active doctor"
          />

          {rooms.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.roomsScroll}
            >
              {rooms.map((room, idx) => (
                <View key={idx} style={styles.roomCard}>
                  <View style={styles.roomCardHeader}>
                    <View style={styles.roomBadge}>
                      <Text style={styles.roomBadgeText}>{room.room || `Room ${idx + 1}`}</Text>
                    </View>
                    <StatusChip status={room.status} size="small" />
                  </View>

                  <Text style={styles.roomDoctorName} numberOfLines={1}>
                    {room.doctor}
                  </Text>

                  <View style={styles.roomNextWrap}>
                    <Text style={styles.roomNextLabel}>Next in line:</Text>
                    {room.nextToken ? (
                      <TokenBadge tokenLabel={room.nextToken} size="small" />
                    ) : (
                      <Text style={styles.roomNoneText}>None</Text>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No active consultation rooms found.</Text>
            </View>
          )}
        </View>

        {/* ── NEXT IN QUEUE LIST ── */}
        <View style={styles.queueSection}>
          <SectionHeader
            title="Next in Queue"
            subtitle="Patients waiting in order"
            actionText="View Full Queue"
            actionIcon="chevron-forward"
            onActionPress={() => handleNav('Queue')}
          />

          {nextInQueue.length > 0 ? (
            nextInQueue.map((item, index) => {
              const patientObj: any = item.patient || {};
              const doctorObj: any = item.assignedDoctor || {};
              const patientName = patientObj.fullName || patientObj.name || `Patient #${index + 1}`;
              const phone = patientObj.phone || '';
              const docName = doctorObj.name ? `Dr. ${doctorObj.name.replace(/^Dr\.?\s*/i, '')}` : 'General OPD';

              return (
                <View key={item._id || index} style={styles.queueItemCard}>
                  <View style={styles.queueItemLeft}>
                    <View style={styles.queuePosWrap}>
                      <Text style={styles.queuePosText}>#{index + 1}</Text>
                    </View>
                    <TokenBadge
                      tokenLabel={item.tokenLabel}
                      priority={item.priority}
                      size="medium"
                    />
                    <View style={styles.queueItemInfo}>
                      <Text style={styles.queuePatientName} numberOfLines={1}>
                        {patientName}
                      </Text>
                      <Text style={styles.queueDoctorSub} numberOfLines={1}>
                        {docName} {phone ? `• ${phone}` : ''}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.queueItemRight}>
                    <StatusChip status={item.status} size="small" />
                    {item.priority && item.priority !== 'normal' && (
                      <Text
                        style={[
                          styles.priorityTag,
                          item.priority === 'urgent' ? styles.urgentTag : styles.seniorTag,
                        ]}
                      >
                        {item.priority.toUpperCase()}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="checkmark-circle-outline" size={32} color={Colors.success} />
              <Text style={styles.emptyTitle}>Queue is Clear</Text>
              <Text style={styles.emptyText}>All waiting patients have been attended.</Text>
            </View>
          )}
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 32 }} />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 16 : 8,
    paddingBottom: 16,
    backgroundColor: Colors.primary,
  },
  headerLeft: {
    flex: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.5,
    marginRight: 10,
  },
  nurseInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  nurseNameText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.95)',
    fontWeight: '700',
    maxWidth: 160,
  },
  dateDot: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginHorizontal: 6,
  },
  headerDate: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
    marginRight: 5,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#A7F3D0',
    letterSpacing: 0.5,
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.danger,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 16,
    right: 16,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  toastSuccess: {
    backgroundColor: '#065F46',
  },
  toastInfo: {
    backgroundColor: '#0369A1',
  },
  toastWarning: {
    backgroundColor: '#92400E',
  },
  toastIcon: {
    marginRight: 10,
  },
  toastText: {
    flex: 1,
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
  gridCard: {
    flex: 1,
    marginHorizontal: 4,
  },
  servingSection: {
    marginBottom: 20,
  },
  servingCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    padding: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  servingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  servingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  servingTagText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  roomPill: {
    backgroundColor: Colors.tint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  roomPillText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  servingBody: {},
  servingMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  patientDetails: {
    marginLeft: 14,
    flex: 1,
  },
  servingPatientName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textDark,
    letterSpacing: -0.3,
  },
  servingPatientMeta: {
    fontSize: 13,
    color: Colors.textMedium,
    marginTop: 2,
    fontWeight: '500',
  },
  servingPatientNic: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
    fontWeight: '500',
  },
  servingDoctorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.tint,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 14,
  },
  servingDoctorText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: 8,
    flex: 1,
  },
  servingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  callNextBtn: {
    flex: 2,
    backgroundColor: Colors.primary,
    marginRight: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  callNextBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  recallBtn: {
    flex: 1.2,
    backgroundColor: Colors.tint,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginRight: 8,
  },
  recallBtnText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 4,
  },
  noShowBtn: {
    flex: 1.2,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  noShowBtnText: {
    color: Colors.danger,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 4,
  },
  emptyServingBody: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  emptyServingTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textDark,
    marginTop: 8,
  },
  emptyServingSub: {
    fontSize: 13,
    color: Colors.textMedium,
    marginTop: 4,
    textAlign: 'center',
    marginBottom: 16,
  },
  callNextBtnEmpty: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    minWidth: 180,
  },
  quickActionsSection: {
    marginBottom: 20,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  quickActionItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 14,
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 88,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  quickActionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textDark,
    textAlign: 'center',
  },
  roomsSection: {
    marginBottom: 20,
  },
  roomsScroll: {
    paddingVertical: 4,
  },
  roomCard: {
    width: 170,
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  roomCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  roomBadge: {
    backgroundColor: Colors.tint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roomBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  roomDoctorName: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textDark,
    marginBottom: 8,
  },
  roomNextWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  roomNextLabel: {
    fontSize: 11,
    color: Colors.textLight,
    fontWeight: '600',
  },
  roomNoneText: {
    fontSize: 11,
    color: Colors.textLight,
    fontStyle: 'italic',
  },
  queueSection: {
    marginBottom: 10,
  },
  queueItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  queueItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  queuePosWrap: {
    width: 24,
    marginRight: 6,
    alignItems: 'center',
  },
  queuePosText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textLight,
  },
  queueItemInfo: {
    marginLeft: 10,
    flex: 1,
  },
  queuePatientName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textDark,
  },
  queueDoctorSub: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
    fontWeight: '500',
  },
  queueItemRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  priorityTag: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  urgentTag: {
    backgroundColor: '#FEE2E2',
    color: Colors.danger,
  },
  seniorTag: {
    backgroundColor: '#FEF3C7',
    color: Colors.warning,
  },
  emptyCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textDark,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 12,
    color: Colors.textMedium,
    marginTop: 4,
    textAlign: 'center',
  },
});

export default ReceptionistHomeScreen;
