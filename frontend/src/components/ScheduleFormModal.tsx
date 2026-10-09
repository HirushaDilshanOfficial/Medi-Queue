import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText as Text } from '../i18n/LocalizedText';
import { useLanguage } from '../i18n/LanguageContext';
import { Colors } from '../constants/Colors';
import { DoctorSchedule, Doctor } from '../types';
import {
  getDoctors,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getErrorMessage,
} from '../services/api';
import { Toast, ToastType } from './Toast';
import { ScheduleDatePickerModal } from './ScheduleDatePickerModal';

export interface ScheduleFormModalProps {
  visible: boolean;
  onClose: () => void;
  schedule?: DoctorSchedule | null;
  initialDate?: string;
  onSuccess?: (message: string) => void;
  onDeleteSuccess?: (message: string) => void;
}

const getTodayDateString = (): string => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
};

const toMinutes = (timeStr: string): number | null => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const parts = timeStr.trim().split(':');
  if (parts.length !== 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
};

export const ScheduleFormModal: React.FC<ScheduleFormModalProps> = ({
  visible,
  onClose,
  schedule,
  initialDate,
  onSuccess,
  onDeleteSuccess,
}) => {
  const { t } = useLanguage();
  const isEditMode = Boolean(schedule);

  // Doctors list for doctor picker
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState<boolean>(false);

  // Form Fields State
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('08:00');
  const [endTime, setEndTime] = useState<string>('16:30');
  const [slotMinutes, setSlotMinutes] = useState<number>(15);
  const [maxPatients, setMaxPatients] = useState<string>('30');
  const [status, setStatus] = useState<'available' | 'leave'>('available');
  const [notes, setNotes] = useState<string>('');

  // UI / Action State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formCalendarVisible, setFormCalendarVisible] = useState<boolean>(false);

  // Toast State
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

  // Fetch doctors list when modal becomes visible
  useEffect(() => {
    if (visible) {
      const fetchDoctors = async () => {
        try {
          setLoadingDoctors(true);
          const data = await getDoctors();
          if (isMounted.current) {
            setDoctors(Array.isArray(data) ? data : []);
          }
        } catch (err: any) {
          if (isMounted.current) {
            console.error('Failed to load doctors:', err);
          }
        } finally {
          if (isMounted.current) {
            setLoadingDoctors(false);
          }
        }
      };
      fetchDoctors();
    }
  }, [visible]);

  // Populate form fields based on Edit or Add mode
  useEffect(() => {
    if (!visible) return;

    setErrorMessage(null);

    if (schedule) {
      // Edit Mode: populate from existing schedule
      const docId =
        typeof schedule.doctor === 'object' && schedule.doctor
          ? schedule.doctor._id
          : String(schedule.doctor || '');

      setSelectedDoctorId(docId);
      setDate(schedule.date || getTodayDateString());
      setStartTime(schedule.startTime || '08:00');
      setEndTime(schedule.endTime || '16:30');
      setSlotMinutes(schedule.slotMinutes || 15);
      setMaxPatients(String(schedule.maxPatients || 30));
      setStatus(schedule.status || 'available');
      setNotes(schedule.notes || '');
    } else {
      // Add Mode: reset with defaults
      const today = getTodayDateString();
      setDate(initialDate || today);
      setStartTime('08:00');
      setEndTime('16:30');
      setSlotMinutes(15);
      setMaxPatients('30');
      setStatus('available');
      setNotes('');

      // Pick first doctor if available
      if (doctors.length > 0 && !selectedDoctorId) {
        setSelectedDoctorId(doctors[0]._id || doctors[0].id || '');
      }
    }
  }, [visible, schedule, initialDate, doctors]);

  // Validate form inputs
  const validateForm = (): boolean => {
    if (!selectedDoctorId) {
      setErrorMessage(t('Please select a doctor'));
      return false;
    }

    const trimmedDate = date.trim();
    if (!trimmedDate || !/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      setErrorMessage(t('Please enter a valid date in YYYY-MM-DD format'));
      return false;
    }

    // Validate that the date is not in the past
    const today = getTodayDateString();
    if (trimmedDate < today) {
      setErrorMessage(t('Date cannot be in the past (must be today or later)'));
      return false;
    }

    // Validate times
    const startMins = toMinutes(startTime);
    const endMins = toMinutes(endTime);

    if (startMins === null || endMins === null) {
      setErrorMessage(t('Start time and end time must be in HH:mm 24-hour format (e.g. 08:30)'));
      return false;
    }

    // Validate that end is after start
    if (endMins <= startMins) {
      setErrorMessage(t('End time must be after start time'));
      return false;
    }

    const maxPts = parseInt(maxPatients, 10);
    if (isNaN(maxPts) || maxPts <= 0) {
      setErrorMessage(t('Max patients must be a positive number'));
      return false;
    }

    setErrorMessage(null);
    return true;
  };

  // Submit Handler: Add (createSchedule) or Edit (updateSchedule)
  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const maxPts = parseInt(maxPatients, 10);

      if (isEditMode && schedule) {
        // Edit Mode: updateSchedule
        await updateSchedule(schedule._id, {
          startTime: startTime.trim(),
          endTime: endTime.trim(),
          slotMinutes,
          maxPatients: maxPts,
          status,
          notes: notes.trim(),
        });

        const successMsg = t('Doctor schedule updated successfully');
        showToast(successMsg, 'success');

        if (onSuccess) {
          onSuccess(successMsg);
        }
      } else {
        // Add Mode: createSchedule
        await createSchedule({
          doctor: selectedDoctorId,
          date: date.trim(),
          startTime: startTime.trim(),
          endTime: endTime.trim(),
          slotMinutes,
          maxPatients: maxPts,
          status,
          notes: notes.trim(),
        });

        const successMsg = t('Doctor schedule created successfully');
        showToast(successMsg, 'success');

        if (onSuccess) {
          onSuccess(successMsg);
        }
      }

      onClose();
    } catch (err: any) {
      if (isMounted.current) {
        const msg = getErrorMessage(err);
        setErrorMessage(msg);
        showToast(msg, 'error');
      }
    } finally {
      if (isMounted.current) {
        setSubmitting(false);
      }
    }
  };

  // Delete Handler with Confirmation Alert
  const handleDelete = () => {
    if (!schedule) return;

    const docName =
      typeof schedule.doctor === 'object' && schedule.doctor?.name
        ? schedule.doctor.name
        : 'this doctor';

    const performDelete = async () => {
      try {
        setDeleting(true);
        setErrorMessage(null);

        await deleteSchedule(schedule._id);

        const successMsg = t('Schedule deleted successfully');
        showToast(successMsg, 'success');

        if (onDeleteSuccess) {
          onDeleteSuccess(successMsg);
        } else if (onSuccess) {
          onSuccess(successMsg);
        }

        onClose();
      } catch (err: any) {
        if (isMounted.current) {
          const msg = getErrorMessage(err);
          // Highlight 409 conflict message clearly
          setErrorMessage(msg);
          showToast(msg, 'error');
        }
      } finally {
        if (isMounted.current) {
          setDeleting(false);
        }
      }
    };

    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined'
          ? window.confirm(
              `Are you sure you want to delete the schedule for ${docName} (${schedule.date} ${schedule.startTime}-${schedule.endTime})?\n\nThis will be blocked if active appointments exist.`
            )
          : true;
      if (confirmed) {
        performDelete();
      }
    } else {
      Alert.alert(
        t('Delete Schedule'),
        `Are you sure you want to delete the schedule for ${docName} on ${schedule.date} (${schedule.startTime} - ${schedule.endTime})?`,
        [
          { text: t('Cancel'), style: 'cancel' },
          {
            text: t('Delete'),
            style: 'destructive',
            onPress: performDelete,
          },
        ]
      );
    }
  };

  // Helper to find selected doctor's details
  const currentDoctorObj = doctors.find(
    (d) => (d._id || d.id) === selectedDoctorId
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderTitleWrap}>
              <View
                style={[
                  styles.modalIconBox,
                  { backgroundColor: isEditMode ? '#FEF3C7' : '#E0F2FE' },
                ]}
              >
                <Ionicons
                  name={isEditMode ? 'create' : 'add-circle'}
                  size={20}
                  color={isEditMode ? '#D97706' : '#0A5C67'}
                />
              </View>
              <View>
                <Text style={styles.modalTitle}>
                  {isEditMode
                    ? t('Edit Doctor Schedule')
                    : t('Add Doctor Schedule')}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {isEditMode
                    ? t('Update shift times, capacity, or status')
                    : t('Assign clinic hours and room slot settings')}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityLabel="Close schedule modal"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={22} color={Colors.textMedium} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Error Banner (Shows 409 conflict or validation errors prominently) */}
            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Ionicons
                  name="alert-circle"
                  size={18}
                  color="#DC2626"
                  style={{ marginRight: 8, marginTop: 1 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.errorBannerTitle}>{t('Action Blocked')}</Text>
                  <Text style={styles.errorBannerText}>{errorMessage}</Text>
                </View>
              </View>
            ) : null}

            {/* 1. Doctor Picker */}
            <Text style={styles.fieldLabel}>
              {t('Doctor')} <Text style={{ color: '#DC2626' }}>*</Text>
            </Text>

            {loadingDoctors ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.loadingText}>{t('Loading doctors...')}</Text>
              </View>
            ) : isEditMode ? (
              /* In edit mode, display active doctor card */
              <View style={styles.lockedDoctorCard}>
                <View style={styles.lockedDoctorAvatar}>
                  <Ionicons name="medkit" size={16} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lockedDoctorName}>
                    {currentDoctorObj?.name ||
                      (typeof schedule?.doctor === 'object' && schedule?.doctor?.name) ||
                      'Doctor'}
                  </Text>
                  <Text style={styles.lockedDoctorDept}>
                    {currentDoctorObj?.department ||
                      (typeof schedule?.doctor === 'object' &&
                        schedule?.doctor?.department) ||
                      'OPD'}{' '}
                    • Room{' '}
                    {currentDoctorObj?.room ||
                      (typeof schedule?.doctor === 'object' &&
                        schedule?.doctor?.room) ||
                      '1A'}
                  </Text>
                </View>
                <View style={styles.lockedBadge}>
                  <Text style={styles.lockedBadgeText}>{t('Assigned')}</Text>
                </View>
              </View>
            ) : (
              /* In add mode, scrollable doctor chips */
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.doctorChipsScroll}
              >
                {doctors.map((doc) => {
                  const docId = doc._id || doc.id || '';
                  const isSelected = selectedDoctorId === docId;
                  return (
                    <TouchableOpacity
                      key={docId}
                      style={[
                        styles.doctorChip,
                        isSelected && styles.doctorChipSelected,
                      ]}
                      onPress={() => setSelectedDoctorId(docId)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.doctorChipName,
                          isSelected && styles.doctorChipNameSelected,
                        ]}
                      >
                        {doc.name}
                      </Text>
                      <Text
                        style={[
                          styles.doctorChipDept,
                          isSelected && styles.doctorChipDeptSelected,
                        ]}
                      >
                        {doc.department || 'OPD'} • Rm {doc.room || '1A'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* 2. Date */}
            <Text style={styles.fieldLabel}>
              {t('Date')} <Text style={{ color: '#DC2626' }}>*</Text>
            </Text>
            <View style={styles.inputWithIcon}>
              <TouchableOpacity
                onPress={() => !isEditMode && setFormCalendarVisible(true)}
                disabled={isEditMode}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={isEditMode ? '#94A3B8' : '#0A5C67'}
                  style={styles.inputLeadingIcon}
                />
              </TouchableOpacity>
              <TextInput
                style={[
                  styles.textInputWithIcon,
                  isEditMode && styles.textInputDisabled,
                ]}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
                editable={!isEditMode}
              />
              {!isEditMode && (
                <TouchableOpacity
                  style={styles.pickDatePill}
                  onPress={() => setFormCalendarVisible(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="calendar" size={13} color="#0A5C67" style={{ marginRight: 3 }} />
                  <Text style={styles.pickDatePillText}>{t('Pick Date')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 3. Start Time & End Time */}
            <View style={styles.formRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.fieldLabel}>
                  {t('Start Time')} <Text style={{ color: '#DC2626' }}>*</Text>
                </Text>
                <View style={styles.inputWithIcon}>
                  <Ionicons
                    name="time-outline"
                    size={18}
                    color="#64748B"
                    style={styles.inputLeadingIcon}
                  />
                  <TextInput
                    style={styles.textInputWithIcon}
                    value={startTime}
                    onChangeText={setStartTime}
                    placeholder="08:00"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.fieldLabel}>
                  {t('End Time')} <Text style={{ color: '#DC2626' }}>*</Text>
                </Text>
                <View style={styles.inputWithIcon}>
                  <Ionicons
                    name="time-outline"
                    size={18}
                    color="#64748B"
                    style={styles.inputLeadingIcon}
                  />
                  <TextInput
                    style={styles.textInputWithIcon}
                    value={endTime}
                    onChangeText={setEndTime}
                    placeholder="16:30"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>
            </View>

            {/* Quick Shift Presets */}
            <View style={styles.presetsRow}>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => {
                  setStartTime('08:00');
                  setEndTime('16:30');
                }}
              >
                <Text style={styles.presetChipText}>Full Day (08:00 - 16:30)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => {
                  setStartTime('08:30');
                  setEndTime('13:00');
                }}
              >
                <Text style={styles.presetChipText}>Morning (08:30 - 13:00)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => {
                  setStartTime('13:30');
                  setEndTime('17:00');
                }}
              >
                <Text style={styles.presetChipText}>Afternoon (13:30 - 17:00)</Text>
              </TouchableOpacity>
            </View>

            {/* 4. Slot Length (10 / 15 / 20) */}
            <Text style={styles.fieldLabel}>
              {t('Slot Length (minutes)')} <Text style={{ color: '#DC2626' }}>*</Text>
            </Text>
            <View style={styles.slotChipsRow}>
              {[10, 15, 20].map((mins) => {
                const isSelected = slotMinutes === mins;
                return (
                  <TouchableOpacity
                    key={mins}
                    style={[
                      styles.slotChip,
                      isSelected && styles.slotChipSelected,
                    ]}
                    onPress={() => setSlotMinutes(mins)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="timer-outline"
                      size={15}
                      color={isSelected ? Colors.white : '#0A5C67'}
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[
                        styles.slotChipText,
                        isSelected && styles.slotChipTextSelected,
                      ]}
                    >
                      {mins} min
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 5. Max Patients */}
            <Text style={styles.fieldLabel}>
              {t('Max Patients Capacity')} <Text style={{ color: '#DC2626' }}>*</Text>
            </Text>
            <View style={styles.inputWithIcon}>
              <Ionicons
                name="people-outline"
                size={18}
                color="#64748B"
                style={styles.inputLeadingIcon}
              />
              <TextInput
                style={styles.textInputWithIcon}
                value={maxPatients}
                onChangeText={setMaxPatients}
                keyboardType="numeric"
                placeholder="30"
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* 6. Status Toggle (Available green, Leave amber) */}
            <Text style={styles.fieldLabel}>
              {t('Doctor Status')} <Text style={{ color: '#DC2626' }}>*</Text>
            </Text>
            <View style={styles.statusToggleRow}>
              <TouchableOpacity
                style={[
                  styles.statusToggleBtn,
                  status === 'available' && styles.statusToggleBtnAvailable,
                ]}
                onPress={() => setStatus('available')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={status === 'available' ? '#15803D' : '#64748B'}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.statusToggleText,
                    status === 'available' && styles.statusToggleTextAvailable,
                  ]}
                >
                  {t('Available (Green)')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusToggleBtn,
                  status === 'leave' && styles.statusToggleBtnLeave,
                ]}
                onPress={() => setStatus('leave')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="pause-circle"
                  size={16}
                  color={status === 'leave' ? '#B45309' : '#64748B'}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.statusToggleText,
                    status === 'leave' && styles.statusToggleTextLeave,
                  ]}
                >
                  {t('On Leave (Amber)')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 7. Notes */}
            <Text style={styles.fieldLabel}>{t('Notes (Optional)')}</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('e.g. Ward rounds first, emergency on-call coverage')}
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
            />

            {/* Delete Schedule Button (Only in Edit mode) */}
            {isEditMode ? (
              <TouchableOpacity
                style={styles.deleteScheduleBtn}
                onPress={handleDelete}
                disabled={deleting || submitting}
                activeOpacity={0.8}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : (
                  <>
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color="#DC2626"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.deleteScheduleBtnText}>
                      {t('Delete Schedule')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
          </ScrollView>

          {/* Modal Bottom Actions */}
          <View style={styles.modalActionsRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={submitting || deleting}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>{t('Cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              disabled={submitting || deleting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <>
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={Colors.white}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.submitBtnText}>
                    {isEditMode ? t('Save Changes') : t('Create Schedule')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Full Month Calendar Date Picker */}
      <ScheduleDatePickerModal
        visible={formCalendarVisible}
        selectedDate={date}
        onSelectDate={(picked) => setDate(picked)}
        onClose={() => setFormCalendarVisible(false)}
      />

      {/* Internal Toast for notifications */}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onDismiss={() => setToastVisible(false)}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '92%',
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
    flex: 1,
  },
  modalIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  formScroll: {
    marginTop: 8,
  },
  formScrollContent: {
    paddingBottom: 16,
  },

  /* Error Banner */
  errorBanner: {
    flexDirection: 'row',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 6,
  },
  errorBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#991B1B',
    marginBottom: 2,
  },
  errorBannerText: {
    fontSize: 12,
    color: '#B91C1C',
    lineHeight: 17,
  },

  /* Field labels */
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    marginTop: 12,
  },

  /* Input fields */
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  inputLeadingIcon: {
    marginRight: 8,
  },
  textInputWithIcon: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  textInputDisabled: {
    color: '#64748B',
  },
  pickDatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F4F6',
    borderWidth: 1,
    borderColor: '#94D2BD',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginLeft: 6,
  },
  pickDatePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0A5C67',
  },
  notesInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    minHeight: 70,
    textAlignVertical: 'top',
  },

  formRow: {
    flexDirection: 'row',
  },

  /* Presets */
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
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

  /* Doctors list */
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 8,
  },
  doctorChipsScroll: {
    flexDirection: 'row',
    marginBottom: 4,
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
  lockedDoctorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  lockedDoctorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  lockedDoctorName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  lockedDoctorDept: {
    fontSize: 11,
    color: '#64748B',
  },
  lockedBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  lockedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },

  /* Slot Duration (10 / 15 / 20) */
  slotChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  slotChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 10,
  },
  slotChipSelected: {
    backgroundColor: '#0A5C67',
    borderColor: '#0A5C67',
  },
  slotChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  slotChipTextSelected: {
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
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  statusToggleTextAvailable: {
    color: '#15803D',
  },
  statusToggleTextLeave: {
    color: '#B45309',
  },

  /* Delete Button */
  deleteScheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 20,
  },
  deleteScheduleBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },

  /* Bottom Actions */
  modalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
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

export default ScheduleFormModal;
