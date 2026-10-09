import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import { Colors } from '../../constants/Colors';
import { DoctorSchedule } from '../../types';
import { useSchedules } from '../../hooks/useSchedules';
import { deleteSchedule, getErrorMessage } from '../../services/api';
import {
  LoadingState,
  ErrorState,
  Toast,
  ToastType,
  ScheduleFormModal,
} from '../../components';

export interface DoctorScheduleScreenProps {
  navigation?: any;
  onNavigate?: (route: string, params?: any) => void;
  onBack?: () => void;
}

interface DateItem {
  dateString: string;
  dayName: string;
  dayNumber: string;
  monthName: string;
  isToday: boolean;
}

/**
 * Returns today's date formatted as YYYY-MM-DD in Asia/Colombo timezone
 */
const getTodayDateString = (): string => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
};

/**
 * Generate 7 days (today + next 6 days) in Asia/Colombo timezone
 */
const get7DaysList = (): DateItem[] => {
  const result: DateItem[] = [];
  const base = new Date();

  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);

    const dateString = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);

    const dayName =
      i === 0
        ? 'Today'
        : new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Colombo',
            weekday: 'short',
          }).format(d);

    const dayNumber = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Colombo',
      day: '2-digit',
    }).format(d);

    const monthName = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Colombo',
      month: 'short',
    }).format(d);

    result.push({
      dateString,
      dayName,
      dayNumber,
      monthName,
      isToday: i === 0,
    });
  }

  return result;
};

export const DoctorScheduleScreen: React.FC<DoctorScheduleScreenProps> = ({
  navigation,
  onNavigate,
  onBack,
}) => {
  const { t } = useLanguage();

  // Date selector state (today + next 6 days)
  const dateList = useMemo(() => get7DaysList(), []);
  const todayStr = useMemo(() => getTodayDateString(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Hook fetching schedules for selectedDate
  const { schedules, loading, error, refresh } = useSchedules(selectedDate);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Schedule Form Modal State (Add & Edit)
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [selectedSchedule, setSelectedSchedule] = useState<DoctorSchedule | null>(null);

  // Quick card delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastType, setToastType] = useState<ToastType>('success');
  const [toastVisible, setToastVisible] = useState<boolean>(false);

  const isMounted = useRef<boolean>(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (navigation?.goBack) {
      navigation.goBack();
    } else if (onNavigate) {
      onNavigate('Home');
    } else if (router?.canGoBack?.()) {
      router.back();
    }
  };

  const handlePullRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      if (isMounted.current) {
        setRefreshing(false);
      }
    }
  };

  // Open Add Schedule Modal
  const handleOpenAddModal = () => {
    setSelectedSchedule(null);
    setModalVisible(true);
  };

  // Open Edit Schedule Modal when a card is tapped
  const handleCardPress = (schedule: DoctorSchedule) => {
    setSelectedSchedule(schedule);
    setModalVisible(true);
  };

  // Modal Action Callbacks
  const handleModalSuccess = (msg: string) => {
    showToast(msg, 'success');
    refresh();
  };

  const handleModalDeleteSuccess = (msg: string) => {
    showToast(msg, 'success');
    refresh();
  };

  // Direct card delete button with Confirmation Alert
  const handleDeleteSchedule = (schedule: DoctorSchedule) => {
    const docName =
      typeof schedule.doctor === 'object' && schedule.doctor?.name
        ? schedule.doctor.name
        : 'Doctor';

    const confirmAction = async () => {
      try {
        setDeletingId(schedule._id);
        await deleteSchedule(schedule._id);
        if (isMounted.current) {
          showToast(t('Schedule deleted successfully'), 'success');
          await refresh();
        }
      } catch (err: any) {
        if (isMounted.current) {
          const msg = getErrorMessage(err);
          // Highlight 409 conflict message clearly
          showToast(msg || 'Cannot delete schedule', 'error');
        }
      } finally {
        if (isMounted.current) {
          setDeletingId(null);
        }
      }
    };

    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined'
          ? window.confirm(
              `Are you sure you want to delete the schedule for ${docName} (${schedule.startTime} - ${schedule.endTime})?\n\nThis will be blocked if active appointments exist.`
            )
          : true;
      if (confirmed) {
        confirmAction();
      }
    } else {
      Alert.alert(
        t('Delete Schedule'),
        `Are you sure you want to delete the schedule for ${docName} on ${schedule.date} (${schedule.startTime} - ${schedule.endTime})?`,
        [
          { text: t('Cancel'), style: 'cancel' },
          { text: t('Delete'), style: 'destructive', onPress: confirmAction },
        ]
      );
    }
  };

  // Helper to extract doctor display details
  const getDoctorDetails = (schedule: DoctorSchedule) => {
    if (typeof schedule.doctor === 'object' && schedule.doctor) {
      return {
        name: schedule.doctor.name || 'Dr. Specialist',
        room: schedule.doctor.room
          ? `Room ${schedule.doctor.room.replace(/^room\s+/i, '')}`
          : 'Room 1A',
        department:
          schedule.doctor.department ||
          schedule.doctor.specialization ||
          'OPD',
        specialization: schedule.doctor.specialization || 'Consultant',
      };
    }
    return {
      name: 'Dr. Specialist',
      room: 'Room 1A',
      department: 'OPD',
      specialization: 'General',
    };
  };

  // Summary counts for current selected date
  const availableCount = schedules.filter((s) => s.status === 'available').length;
  const leaveCount = schedules.filter((s) => s.status === 'leave').length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#063C46" />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={t('Back to Home')}
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={20} color={Colors.white} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>{t('Doctor Roster')}</Text>
            <View style={styles.headerMetaRow}>
              <View style={styles.headerMetaItem}>
                <Ionicons
                  name="calendar-outline"
                  size={13}
                  color="#D0E8ED"
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.headerSubtitle}>{selectedDate}</Text>
              </View>
              <View style={styles.metaDot} />
              <View style={styles.headerMetaItem}>
                <Ionicons
                  name="people-outline"
                  size={13}
                  color="#D0E8ED"
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.headerSubtitle}>
                  {schedules.length} {t('Rostered')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => refresh()}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={t('Refresh schedules')}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Ionicons name="refresh" size={20} color={Colors.white} />
          )}
        </TouchableOpacity>
      </View>

      {/* ── DATE SELECTOR (TODAY + NEXT 6 DAYS) ── */}
      <View style={styles.dateSelectorSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateSelectorContent}
        >
          {dateList.map((item) => {
            const isSelected = item.dateString === selectedDate;
            return (
              <TouchableOpacity
                key={item.dateString}
                style={[
                  styles.datePill,
                  isSelected && styles.datePillSelected,
                  item.isToday && !isSelected && styles.datePillToday,
                ]}
                onPress={() => setSelectedDate(item.dateString)}
                activeOpacity={0.75}
                accessibilityLabel={`${item.dayName} ${item.dayNumber} ${item.monthName}`}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.datePillDayName,
                    isSelected && styles.datePillDayNameSelected,
                  ]}
                >
                  {t(item.dayName)}
                </Text>
                <Text
                  style={[
                    styles.datePillDayNumber,
                    isSelected && styles.datePillDayNumberSelected,
                  ]}
                >
                  {item.dayNumber}
                </Text>
                <Text
                  style={[
                    styles.datePillMonth,
                    isSelected && styles.datePillMonthSelected,
                  ]}
                >
                  {item.monthName}
                </Text>
                {item.isToday && (
                  <View
                    style={[
                      styles.todayIndicatorDot,
                      isSelected && styles.todayIndicatorDotSelected,
                    ]}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── STATS BAR ── */}
      <View style={styles.statsBar}>
        <View style={styles.statChip}>
          <Text style={styles.statChipLabel}>{t('Total:')}</Text>
          <Text style={styles.statChipValue}>{schedules.length}</Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: '#DCFCE7' }]}>
          <View style={[styles.statusDot, { backgroundColor: '#16A34A' }]} />
          <Text style={[styles.statChipLabel, { color: '#15803D' }]}>
            {t('Available:')}
          </Text>
          <Text style={[styles.statChipValue, { color: '#15803D' }]}>
            {availableCount}
          </Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: '#FEF3C7' }]}>
          <View style={[styles.statusDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={[styles.statChipLabel, { color: '#B45309' }]}>
            {t('On Leave:')}
          </Text>
          <Text style={[styles.statChipValue, { color: '#B45309' }]}>
            {leaveCount}
          </Text>
        </View>
      </View>

      {/* ── MAIN CONTENT: LOADING, ERROR, EMPTY, OR LIST ── */}
      <View style={styles.contentContainer}>
        {loading && schedules.length === 0 ? (
          <LoadingState message="Loading doctor schedules..." />
        ) : error && schedules.length === 0 ? (
          <ErrorState
            title="Failed to Load Schedules"
            message={error}
            onRetry={refresh}
            retryLabel="Reload Schedules"
          />
        ) : schedules.length === 0 ? (
          /* Empty Message State */
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="calendar-outline" size={44} color="#0A5C67" />
            </View>
            <Text style={styles.emptyTitle}>{t('No Doctor Schedules')}</Text>
            <Text style={styles.emptySubtitle}>
              {t('There are no doctor schedules configured for this date.')}
            </Text>
            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={handleOpenAddModal}
              activeOpacity={0.8}
            >
              <Ionicons
                name="add"
                size={18}
                color={Colors.white}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.emptyAddBtnText}>{t('+ Add Schedule')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* List of Schedules */
          <ScrollView
            style={styles.scheduleList}
            contentContainerStyle={styles.scheduleListContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handlePullRefresh}
                colors={[Colors.primary]}
                tintColor={Colors.primary}
              />
            }
          >
            {schedules.map((schedule) => {
              const details = getDoctorDetails(schedule);
              const isAvailable = schedule.status === 'available';
              const isDeleting = deletingId === schedule._id;

              return (
                <TouchableOpacity
                  key={schedule._id}
                  style={styles.scheduleCard}
                  onPress={() => handleCardPress(schedule)}
                  activeOpacity={0.85}
                  accessibilityLabel={`Edit schedule for ${details.name}`}
                  accessibilityRole="button"
                >
                  {/* Top Doctor & Status Row */}
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.doctorInfoLeft}>
                      <View
                        style={[
                          styles.doctorAvatar,
                          !isAvailable && styles.doctorAvatarLeave,
                        ]}
                      >
                        <Ionicons
                          name={isAvailable ? 'medkit' : 'bed-outline'}
                          size={18}
                          color={isAvailable ? Colors.primary : '#D97706'}
                        />
                      </View>
                      <View style={styles.doctorTextWrap}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={styles.doctorName}>{details.name}</Text>
                          <Ionicons
                            name="create-outline"
                            size={14}
                            color="#94A3B8"
                            style={{ marginLeft: 6 }}
                          />
                        </View>
                        <Text style={styles.doctorMeta}>
                          {t(details.department)} • {details.specialization}
                        </Text>
                      </View>
                    </View>

                    {/* Status Chip (Available green, Leave amber) */}
                    <View
                      style={[
                        styles.statusChip,
                        isAvailable
                          ? styles.statusChipAvailable
                          : styles.statusChipLeave,
                      ]}
                    >
                      <View
                        style={[
                          styles.statusChipDot,
                          isAvailable
                            ? styles.statusChipDotAvailable
                            : styles.statusChipDotLeave,
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusChipText,
                          isAvailable
                            ? styles.statusChipTextAvailable
                            : styles.statusChipTextLeave,
                        ]}
                      >
                        {isAvailable ? t('Available') : t('Leave')}
                      </Text>
                    </View>
                  </View>

                  {/* Badges Row: Room, Time Range, Slot Length, Max Patients */}
                  <View style={styles.badgesRow}>
                    {/* Room Badge */}
                    <View style={styles.metaBadge}>
                      <Ionicons
                        name="business-outline"
                        size={13}
                        color="#0A5C67"
                        style={{ marginRight: 4 }}
                      />
                      <Text style={styles.metaBadgeText}>{details.room}</Text>
                    </View>

                    {/* Time Range */}
                    <View style={[styles.metaBadge, styles.timeBadge]}>
                      <Ionicons
                        name="time-outline"
                        size={13}
                        color="#0369A1"
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={[
                          styles.metaBadgeText,
                          { color: '#0369A1', fontWeight: '700' },
                        ]}
                      >
                        {schedule.startTime} - {schedule.endTime}
                      </Text>
                    </View>

                    {/* Slot Length */}
                    <View style={styles.metaBadge}>
                      <Ionicons
                        name="timer-outline"
                        size={13}
                        color="#4A6572"
                        style={{ marginRight: 4 }}
                      />
                      <Text style={styles.metaBadgeText}>
                        {schedule.slotMinutes} {t('min slots')}
                      </Text>
                    </View>

                    {/* Max Patients */}
                    <View style={styles.metaBadge}>
                      <Ionicons
                        name="people-outline"
                        size={13}
                        color="#4A6572"
                        style={{ marginRight: 4 }}
                      />
                      <Text style={styles.metaBadgeText}>
                        Max {schedule.maxPatients}
                      </Text>
                    </View>
                  </View>

                  {/* Notes / Footer */}
                  {schedule.notes ? (
                    <View style={styles.notesBox}>
                      <Ionicons
                        name="information-circle-outline"
                        size={14}
                        color="#64748B"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.notesText} numberOfLines={2}>
                        {schedule.notes}
                      </Text>
                    </View>
                  ) : null}

                  {/* Card Actions Footer */}
                  <View style={styles.cardFooterRow}>
                    <Text style={styles.scheduleDateLabel}>
                      📅 {schedule.date} • {t('Tap to Edit')}
                    </Text>

                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeleteSchedule(schedule);
                      }}
                      disabled={isDeleting}
                      activeOpacity={0.7}
                      accessibilityLabel="Delete schedule"
                    >
                      {isDeleting ? (
                        <ActivityIndicator size="small" color="#DC2626" />
                      ) : (
                        <>
                          <Ionicons
                            name="trash-outline"
                            size={14}
                            color="#DC2626"
                            style={{ marginRight: 4 }}
                          />
                          <Text style={styles.deleteButtonText}>
                            {t('Remove')}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* ── FLOATING "+ ADD SCHEDULE" BUTTON ── */}
      <TouchableOpacity
        style={styles.fabButton}
        onPress={handleOpenAddModal}
        activeOpacity={0.85}
        accessibilityLabel={t('+ Add Schedule')}
        accessibilityRole="button"
      >
        <Ionicons
          name="add"
          size={22}
          color={Colors.white}
          style={{ marginRight: 6 }}
        />
        <Text style={styles.fabButtonText}>{t('+ Add Schedule')}</Text>
      </TouchableOpacity>

      {/* ── UNIFIED SCHEDULE FORM MODAL (ADD & EDIT) ── */}
      <ScheduleFormModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        schedule={selectedSchedule}
        initialDate={selectedDate}
        onSuccess={handleModalSuccess}
        onDeleteSuccess={handleModalDeleteSuccess}
      />

      {/* ── TOAST NOTIFICATION ── */}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onDismiss={() => setToastVisible(false)}
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
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.3,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  headerMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 8,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#D0E8ED',
    fontWeight: '500',
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Date Selector */
  dateSelectorSection: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 10,
  },
  dateSelectorContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  datePill: {
    width: 64,
    height: 72,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  datePillSelected: {
    backgroundColor: '#0A5C67',
    borderColor: '#0A5C67',
    shadowColor: '#0A5C67',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  datePillToday: {
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
  },
  datePillDayName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
  },
  datePillDayNameSelected: {
    color: '#D0E8ED',
  },
  datePillDayNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  datePillDayNumberSelected: {
    color: '#FFFFFF',
  },
  datePillMonth: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 1,
  },
  datePillMonthSelected: {
    color: '#E0F2FE',
  },
  todayIndicatorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2563EB',
    marginTop: 2,
  },
  todayIndicatorDotSelected: {
    backgroundColor: '#FFFFFF',
  },

  /* Stats Bar */
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statChipLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginRight: 4,
  },
  statChipValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },

  /* Content area */
  contentContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scheduleList: {
    flex: 1,
  },
  scheduleListContent: {
    padding: 16,
    paddingBottom: 90,
    gap: 12,
  },

  /* Schedule Card */
  scheduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  doctorInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  doctorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  doctorAvatarLeave: {
    backgroundColor: '#FEF3C7',
  },
  doctorTextWrap: {
    flex: 1,
  },
  doctorName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  doctorMeta: {
    fontSize: 12,
    color: '#64748B',
  },

  /* Status Chips (Available green, Leave amber) */
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusChipAvailable: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  statusChipLeave: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  statusChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusChipDotAvailable: {
    backgroundColor: '#16A34A',
  },
  statusChipDotLeave: {
    backgroundColor: '#F59E0B',
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusChipTextAvailable: {
    color: '#15803D',
  },
  statusChipTextLeave: {
    color: '#B45309',
  },

  /* Badges Row */
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeBadge: {
    backgroundColor: '#E0F2FE',
  },
  metaBadgeText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },

  /* Notes */
  notesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 10,
  },
  notesText: {
    fontSize: 12,
    color: '#475569',
    fontStyle: 'italic',
    flex: 1,
  },

  /* Card Footer */
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  scheduleDateLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deleteButtonText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },

  /* Empty State */
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 40,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
    maxWidth: 280,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A5C67',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#0A5C67',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  emptyAddBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },

  /* Floating Action Button (FAB) */
  fabButton: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A5C67',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: '#0A5C67',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fabButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.2,
  },
});

export default DoctorScheduleScreen;
