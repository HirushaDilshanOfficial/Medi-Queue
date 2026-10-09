import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import { Colors } from '../../constants/Colors';
import { DoctorSchedule, Doctor } from '../../types';
import { useSchedules } from '../../hooks/useSchedules';
import {
  getDoctors,
  createSchedule,
  deleteSchedule,
  getErrorMessage,
} from '../../services/api';
import {
  LoadingState,
  ErrorState,
  Toast,
  ToastType,
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

  // Doctors for "+ Add Schedule" modal
  const [availableDoctors, setAvailableDoctors] = useState<Doctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState<boolean>(false);

  // Add Schedule Modal state
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(selectedDate);
  const [formStartTime, setFormStartTime] = useState<string>('08:00');
  const [formEndTime, setFormEndTime] = useState<string>('16:30');
  const [formSlotMinutes, setFormSlotMinutes] = useState<number>(15);
  const [formMaxPatients, setFormMaxPatients] = useState<string>('30');
  const [formStatus, setFormStatus] = useState<'available' | 'leave'>('available');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Deleting state
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

  // Sync form date when selectedDate changes
  useEffect(() => {
    setFormDate(selectedDate);
  }, [selectedDate]);

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

  // Open Add Schedule Modal and fetch doctors if needed
  const handleOpenAddModal = async () => {
    setFormDate(selectedDate);
    setFormStartTime('08:00');
    setFormEndTime('16:30');
    setFormSlotMinutes(15);
    setFormMaxPatients('30');
    setFormStatus('available');
    setFormNotes('');
    setFormError(null);
    setAddModalVisible(true);

    if (availableDoctors.length === 0) {
      try {
        setLoadingDoctors(true);
        const docs = await getDoctors();
        if (isMounted.current) {
          const list = Array.isArray(docs) ? docs : [];
          setAvailableDoctors(list);
          if (list.length > 0 && !selectedDoctorId) {
            setSelectedDoctorId(list[0]._id || list[0].id || '');
          }
        }
      } catch (err: any) {
        if (isMounted.current) {
          showToast(getErrorMessage(err) || 'Failed to load doctors list', 'warning');
        }
      } finally {
        if (isMounted.current) {
          setLoadingDoctors(false);
        }
      }
    } else if (!selectedDoctorId && availableDoctors.length > 0) {
      setSelectedDoctorId(availableDoctors[0]._id || availableDoctors[0].id || '');
    }
  };

  // Submit Create Schedule
  const handleCreateSchedule = async () => {
    if (!selectedDoctorId) {
      setFormError('Please select a doctor');
      return;
    }
    if (!formDate) {
      setFormError('Date is required (YYYY-MM-DD)');
      return;
    }
    if (!formStartTime || !formEndTime) {
      setFormError('Start time and end time are required');
      return;
    }
    if (formEndTime <= formStartTime) {
      setFormError('End time must be after start time');
      return;
    }

    const maxPts = parseInt(formMaxPatients, 10);
    if (isNaN(maxPts) || maxPts <= 0) {
      setFormError('Max patients must be a valid positive number');
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);

      await createSchedule({
        doctor: selectedDoctorId,
        date: formDate,
        startTime: formStartTime,
        endTime: formEndTime,
        slotMinutes: formSlotMinutes,
        maxPatients: maxPts,
        status: formStatus,
        notes: formNotes.trim(),
      });

      if (isMounted.current) {
        setAddModalVisible(false);
        showToast(t('Doctor schedule added successfully!'), 'success');
        await refresh();
      }
    } catch (err: any) {
      if (isMounted.current) {
        const msg = getErrorMessage(err);
        setFormError(msg || 'Failed to create schedule');
      }
    } finally {
      if (isMounted.current) {
        setSubmitting(false);
      }
    }
  };

  // Delete Schedule with Confirmation
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
          showToast(msg || 'Cannot delete schedule', 'error');
        }
      } finally {
        if (isMounted.current) {
          setDeletingId(null);
        }
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Delete schedule for ${docName} (${schedule.startTime} - ${schedule.endTime})?`)) {
        confirmAction();
      }
    } else {
      Alert.alert(
        t('Delete Schedule'),
        `Are you sure you want to delete the schedule for ${docName} (${schedule.startTime} - ${schedule.endTime})?`,
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
        room: schedule.doctor.room ? `Room ${schedule.doctor.room.replace(/^room\s+/i, '')}` : 'Room 1A',
        department: schedule.doctor.department || schedule.doctor.specialization || 'OPD',
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
                <Ionicons name="calendar-outline" size={13} color="#D0E8ED" style={{ marginRight: 4 }} />
                <Text style={styles.headerSubtitle}>{selectedDate}</Text>
              </View>
              <View style={styles.metaDot} />
              <View style={styles.headerMetaItem}>
                <Ionicons name="people-outline" size={13} color="#D0E8ED" style={{ marginRight: 4 }} />
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
          <Text style={[styles.statChipLabel, { color: '#15803D' }]}>{t('Available:')}</Text>
          <Text style={[styles.statChipValue, { color: '#15803D' }]}>{availableCount}</Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: '#FEF3C7' }]}>
          <View style={[styles.statusDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={[styles.statChipLabel, { color: '#B45309' }]}>{t('On Leave:')}</Text>
          <Text style={[styles.statChipValue, { color: '#B45309' }]}>{leaveCount}</Text>
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
              <Ionicons name="add" size={18} color={Colors.white} style={{ marginRight: 6 }} />
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
                <View key={schedule._id} style={styles.scheduleCard}>
                  {/* Top Doctor & Status Row */}
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.doctorInfoLeft}>
                      <View style={[styles.doctorAvatar, !isAvailable && styles.doctorAvatarLeave]}>
                        <Ionicons
                          name={isAvailable ? 'medkit' : 'bed-outline'}
                          size={18}
                          color={isAvailable ? Colors.primary : '#D97706'}
                        />
                      </View>
                      <View style={styles.doctorTextWrap}>
                        <Text style={styles.doctorName}>{details.name}</Text>
                        <Text style={styles.doctorMeta}>
                          {t(details.department)} • {details.specialization}
                        </Text>
                      </View>
                    </View>

                    {/* Status Chip (Available green, Leave amber) */}
                    <View
                      style={[
                        styles.statusChip,
                        isAvailable ? styles.statusChipAvailable : styles.statusChipLeave,
                      ]}
                    >
                      <View
                        style={[
                          styles.statusChipDot,
                          isAvailable ? styles.statusChipDotAvailable : styles.statusChipDotLeave,
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusChipText,
                          isAvailable ? styles.statusChipTextAvailable : styles.statusChipTextLeave,
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
                      <Ionicons name="business-outline" size={13} color="#0A5C67" style={{ marginRight: 4 }} />
                      <Text style={styles.metaBadgeText}>{details.room}</Text>
                    </View>

                    {/* Time Range */}
                    <View style={[styles.metaBadge, styles.timeBadge]}>
                      <Ionicons name="time-outline" size={13} color="#0369A1" style={{ marginRight: 4 }} />
                      <Text style={[styles.metaBadgeText, { color: '#0369A1', fontWeight: '700' }]}>
                        {schedule.startTime} - {schedule.endTime}
                      </Text>
                    </View>

                    {/* Slot Length */}
                    <View style={styles.metaBadge}>
                      <Ionicons name="timer-outline" size={13} color="#4A6572" style={{ marginRight: 4 }} />
                      <Text style={styles.metaBadgeText}>
                        {schedule.slotMinutes} {t('min slots')}
                      </Text>
                    </View>

                    {/* Max Patients */}
                    <View style={styles.metaBadge}>
                      <Ionicons name="people-outline" size={13} color="#4A6572" style={{ marginRight: 4 }} />
                      <Text style={styles.metaBadgeText}>
                        Max {schedule.maxPatients}
                      </Text>
                    </View>
                  </View>

                  {/* Notes / Footer */}
                  {schedule.notes ? (
                    <View style={styles.notesBox}>
                      <Ionicons name="information-circle-outline" size={14} color="#64748B" style={{ marginRight: 6 }} />
                      <Text style={styles.notesText} numberOfLines={2}>
                        {schedule.notes}
                      </Text>
                    </View>
                  ) : null}

                  {/* Card Actions Footer */}
                  <View style={styles.cardFooterRow}>
                    <Text style={styles.scheduleDateLabel}>
                      📅 {schedule.date}
                    </Text>

                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteSchedule(schedule)}
                      disabled={isDeleting}
                      activeOpacity={0.7}
                      accessibilityLabel="Delete schedule"
                    >
                      {isDeleting ? (
                        <ActivityIndicator size="small" color="#DC2626" />
                      ) : (
                        <>
                          <Ionicons name="trash-outline" size={14} color="#DC2626" style={{ marginRight: 4 }} />
                          <Text style={styles.deleteButtonText}>{t('Remove')}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
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
        <Ionicons name="add" size={22} color={Colors.white} style={{ marginRight: 6 }} />
        <Text style={styles.fabButtonText}>{t('+ Add Schedule')}</Text>
      </TouchableOpacity>

      {/* ── ADD SCHEDULE MODAL ── */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleWrap}>
                <View style={styles.modalHeaderIconBox}>
                  <Ionicons name="calendar" size={18} color="#0A5C67" />
                </View>
                <Text style={styles.modalHeaderTitle}>{t('Add Doctor Schedule')}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setAddModalVisible(false)}
                style={styles.modalCloseBtn}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={20} color={Colors.textMedium} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalFormScroll} showsVerticalScrollIndicator={false}>
              {/* Form Error Banner */}
              {formError ? (
                <View style={styles.formErrorBanner}>
                  <Ionicons name="alert-circle" size={16} color="#DC2626" style={{ marginRight: 6 }} />
                  <Text style={styles.formErrorText}>{formError}</Text>
                </View>
              ) : null}

              {/* 1. Doctor Picker */}
              <Text style={styles.fieldLabel}>{t('Select Doctor *')}</Text>
              {loadingDoctors ? (
                <View style={styles.doctorLoadingBox}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.doctorLoadingText}>{t('Loading doctors...')}</Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.doctorChipsScroll}>
                  {availableDoctors.map((doc) => {
                    const docId = doc._id || doc.id || '';
                    const isSelected = selectedDoctorId === docId;
                    return (
                      <TouchableOpacity
                        key={docId}
                        style={[styles.doctorChip, isSelected && styles.doctorChipSelected]}
                        onPress={() => setSelectedDoctorId(docId)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.doctorChipName, isSelected && styles.doctorChipNameSelected]}>
                          {doc.name}
                        </Text>
                        <Text style={[styles.doctorChipDept, isSelected && styles.doctorChipDeptSelected]}>
                          {t(doc.department || 'OPD')} • {doc.room ? `Rm ${doc.room}` : 'Rm 1A'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {/* 2. Date */}
              <Text style={styles.fieldLabel}>{t('Date (YYYY-MM-DD) *')}</Text>
              <TextInput
                style={styles.textInput}
                value={formDate}
                onChangeText={setFormDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
              />

              {/* 3. Time Range (Start & End) */}
              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.fieldLabel}>{t('Start Time *')}</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formStartTime}
                    onChangeText={setFormStartTime}
                    placeholder="08:00"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.fieldLabel}>{t('End Time *')}</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formEndTime}
                    onChangeText={setFormEndTime}
                    placeholder="16:30"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              {/* Quick Time Presets */}
              <View style={styles.presetRow}>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => {
                    setFormStartTime('08:00');
                    setFormEndTime('16:30');
                  }}
                >
                  <Text style={styles.presetChipText}>Full Shift (08:00 - 16:30)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => {
                    setFormStartTime('08:30');
                    setFormEndTime('13:00');
                  }}
                >
                  <Text style={styles.presetChipText}>Morning (08:30 - 13:00)</Text>
                </TouchableOpacity>
              </View>

              {/* 4. Slot Minutes Selection */}
              <Text style={styles.fieldLabel}>{t('Slot Duration (minutes) *')}</Text>
              <View style={styles.slotMinutesRow}>
                {[10, 15, 20, 30].map((mins) => {
                  const isSelected = formSlotMinutes === mins;
                  return (
                    <TouchableOpacity
                      key={mins}
                      style={[styles.slotMinuteChip, isSelected && styles.slotMinuteChipSelected]}
                      onPress={() => setFormSlotMinutes(mins)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.slotMinuteChipText,
                          isSelected && styles.slotMinuteChipTextSelected,
                        ]}
                      >
                        {mins} min
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 5. Max Patients */}
              <Text style={styles.fieldLabel}>{t('Max Patients Capacity *')}</Text>
              <TextInput
                style={styles.textInput}
                value={formMaxPatients}
                onChangeText={setFormMaxPatients}
                keyboardType="numeric"
                placeholder="30"
                placeholderTextColor="#94A3B8"
              />

              {/* 6. Status Toggle */}
              <Text style={styles.fieldLabel}>{t('Doctor Status *')}</Text>
              <View style={styles.statusToggleRow}>
                <TouchableOpacity
                  style={[
                    styles.statusToggleBtn,
                    formStatus === 'available' && styles.statusToggleBtnAvailable,
                  ]}
                  onPress={() => setFormStatus('available')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={formStatus === 'available' ? '#15803D' : '#64748B'}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.statusToggleText,
                      formStatus === 'available' && styles.statusToggleTextAvailable,
                    ]}
                  >
                    {t('Available')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.statusToggleBtn,
                    formStatus === 'leave' && styles.statusToggleBtnLeave,
                  ]}
                  onPress={() => setFormStatus('leave')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="pause-circle"
                    size={16}
                    color={formStatus === 'leave' ? '#B45309' : '#64748B'}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.statusToggleText,
                      formStatus === 'leave' && styles.statusToggleTextLeave,
                    ]}
                  >
                    {t('Leave')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 7. Notes */}
              <Text style={styles.fieldLabel}>{t('Notes (Optional)')}</Text>
              <TextInput
                style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
                value={formNotes}
                onChangeText={setFormNotes}
                placeholder={t('e.g. On-call coverage, morning rounds')}
                placeholderTextColor="#94A3B8"
                multiline
              />
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setAddModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelBtnText}>{t('Cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleCreateSchedule}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color={Colors.white} style={{ marginRight: 6 }} />
                    <Text style={styles.submitBtnText}>{t('Save Schedule')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    color: '#94A3B8',
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

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalHeaderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalHeaderIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalFormScroll: {
    paddingTop: 12,
  },
  formErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  formErrorText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    marginTop: 10,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  formRow: {
    flexDirection: 'row',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  presetChip: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1D4ED8',
  },

  /* Doctor selection scroll */
  doctorChipsScroll: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  doctorChip: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  doctorChipSelected: {
    backgroundColor: '#0A5C67',
    borderColor: '#0A5C67',
  },
  doctorChipName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  doctorChipNameSelected: {
    color: '#FFFFFF',
  },
  doctorChipDept: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  doctorChipDeptSelected: {
    color: '#D0E8ED',
  },
  doctorLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  doctorLoadingText: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 8,
  },

  /* Slot minute selection */
  slotMinutesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  slotMinuteChip: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  slotMinuteChipSelected: {
    backgroundColor: '#0A5C67',
    borderColor: '#0A5C67',
  },
  slotMinuteChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  slotMinuteChipTextSelected: {
    color: '#FFFFFF',
  },

  /* Status Toggle */
  statusToggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statusToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusToggleBtnAvailable: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  statusToggleBtnLeave: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  statusToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  statusToggleTextAvailable: {
    color: '#15803D',
  },
  statusToggleTextLeave: {
    color: '#B45309',
  },

  /* Modal Actions */
  modalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  submitBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#0A5C67',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0A5C67',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
});

export default DoctorScheduleScreen;
