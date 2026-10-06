import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useWalkInForm } from '../../hooks/useWalkInForm';
import {
  searchPatients,
  getErrorMessage,
  getDoctors,
  getSlots,
  createWalkIn,
  WalkInPayload,
  WalkInResponse,
} from '../../services/api';
import { Patient, Doctor, QueuePriority, AppointmentType } from '../../types';
import { Toast, ToastType } from '../../components/Toast';
import { TokenBadge } from '../../components/TokenBadge';
import { useShiftContext } from '../../context/ShiftContext';

export interface RegisterPatientScreenProps {
  navigation?: any;
  route?: any;
  onNavigate?: (route: string) => void;
}

export interface DepartmentItem {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
}

export const DEPARTMENTS: DepartmentItem[] = [
  {
    id: 'General OPD',
    name: 'General OPD',
    icon: 'medkit',
    color: '#0D9488',
    bgColor: '#CCFBF1',
  },
  {
    id: 'Orthopedic',
    name: 'Orthopedic',
    icon: 'body',
    color: '#0284C7',
    bgColor: '#E0F2FE',
  },
  {
    id: 'Cardiology',
    name: 'Cardiology',
    icon: 'heart',
    color: '#E11D48',
    bgColor: '#FFE4E6',
  },
  {
    id: 'Pediatric',
    name: 'Pediatric',
    icon: 'happy',
    color: '#D97706',
    bgColor: '#FEF3C7',
  },
];

export const RegisterPatientScreen: React.FC<RegisterPatientScreenProps> = ({
  navigation,
  route,
  onNavigate,
}) => {
  const { isShiftClosed } = useShiftContext();
  const form = useWalkInForm(route?.params);
  const [searchQuery, setSearchQuery] = useState<string>(
    route?.params?.nic ||
      route?.params?.phone ||
      route?.params?.name ||
      route?.params?.fullName ||
      ''
  );
  const [searching, setSearching] = useState<boolean>(false);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'found' | 'not_found'>(
    route?.params?.existingPatientId ||
      route?.params?.name ||
      route?.params?.fullName ||
      route?.params?.patient
      ? 'found'
      : 'idle'
  );
  const [matchedPatient, setMatchedPatient] = useState<Patient | null>(
    route?.params?.patient ||
      (route?.params?.existingPatientId
        ? {
            _id: route.params.existingPatientId,
            fullName:
              route.params.name ||
              route.params.fullName ||
              'Patient',
            nic: route.params.nic || '',
            phone: route.params.phone || '',
            age: route.params.age ? Number(route.params.age) : undefined,
            gender: route.params.gender || undefined,
            registeredVia: 'reception',
          }
        : null)
  );

  // Doctors and Slots state
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState<boolean>(false);
  const [slots, setSlots] = useState<Array<{ time: string; status: 'available' | 'booked' | 'past' }>>([]);
  const [slotsLoading, setSlotsLoading] = useState<boolean>(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  // Submit, double-tap prevention ref, and confirmed booking state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const submittingRef = useRef<boolean>(false);
  const [confirmedBooking, setConfirmedBooking] = useState<WalkInResponse | null>(null);
  const [confirmedPriority, setConfirmedPriority] = useState<QueuePriority>('normal');
  const [lastIssuedToken, setLastIssuedToken] = useState<WalkInResponse | null>(null);

  // Toast state
  const [toastVisible, setToastVisible] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastType, setToastType] = useState<ToastType>('info');

  const showToast = (message: string, type: ToastType = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  // ── PREFILL PATIENT FROM NAVIGATION PARAMS ──
  useEffect(() => {
    const params = route?.params;
    if (!params) return;

    const existingId =
      params.existingPatientId ||
      params.patient?._id ||
      params.patient?.id ||
      null;
    const pName =
      params.name ||
      params.fullName ||
      params.patient?.fullName ||
      '';
    const pNic = params.nic || params.patient?.nic || '';
    const pPhone = params.phone || params.patient?.phone || '';
    const pAge =
      params.age !== undefined && params.age !== null
        ? String(params.age)
        : params.patient?.age !== undefined && params.patient?.age !== null
        ? String(params.patient.age)
        : '';
    const pGender = params.gender || params.patient?.gender || '';

    // Only proceed if at least one identifying param is passed
    if (existingId || pName || pNic || pPhone) {
      const patientObj: Patient = params.patient || {
        _id: existingId || '',
        fullName: pName || 'Patient',
        nic: pNic,
        phone: pPhone,
        age: pAge ? Number(pAge) : undefined,
        gender: (pGender as any) || undefined,
        registeredVia: 'reception',
      };

      setMatchedPatient(patientObj);
      setSearchStatus('found');
      setSearchQuery(pNic || pPhone || pName);

      form.setExistingPatient(existingId, {
        fullName: pName,
        nic: pNic,
        phone: pPhone,
        age: pAge,
        gender: (pGender as any) || '',
      });

      if (params.intakeType) {
        form.setField('intakeType', params.intakeType);
      }

      // Auto-suggest Senior if age is 60+
      if (pAge) {
        const ageNum = Number(pAge);
        if (!isNaN(ageNum) && ageNum >= 60) {
          form.setField('priority', 'senior');
        }
      }

      showToast(`Prefilled with record for ${pName || 'patient'}`, 'success');
    }
  }, [route?.params]);

  // Currently selected doctor object
  const selectedDoctor = allDoctors.find((d) => d._id === form.doctorId);

  // Estimated wait calculation for selected doctor
  const getEstimatedWaitForDoctor = useCallback((): string => {
    if (!selectedDoctor) return '--';
    const waitingPatients = selectedDoctor.todayPatients || 0;
    const avgMins = selectedDoctor.avgConsultMinutes || 10;
    const totalMins = waitingPatients * avgMins;
    if (totalMins <= 0) return '< 5 mins';
    return `~${totalMins} mins`;
  }, [selectedDoctor]);

  // Fetch all active doctors for department cards & picker
  const loadDoctors = useCallback(async () => {
    setDoctorsLoading(true);
    try {
      const docs = await getDoctors();
      if (Array.isArray(docs)) {
        setAllDoctors(docs);
      }
    } catch (err: any) {
      console.warn('Failed to load doctors:', err);
    } finally {
      setDoctorsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  // Compute wait time & doctor count per department
  const getDepartmentWaitTime = useCallback(
    (deptId: string): { waitStr: string; doctorCount: number } => {
      const normDept = deptId.toLowerCase().replace(/\s+/g, '');
      const docs = allDoctors.filter((d) => {
        const docDept = (d.department || '').toLowerCase().replace(/\s+/g, '');
        return docDept.includes(normDept) || normDept.includes(docDept);
      });

      const count = docs.length;
      if (count === 0) {
        return { waitStr: 'No wait', doctorCount: 0 };
      }

      const activeDocs = docs.filter((d) => d.status === 'active');
      const totalPatients = docs.reduce((sum, d) => sum + (d.todayPatients || 0), 0);
      const avgMins =
        docs.reduce((sum, d) => sum + (d.avgConsultMinutes || 10), 0) / count;
      const divisor = activeDocs.length > 0 ? activeDocs.length : 1;
      const estimatedMins = Math.round((totalPatients / divisor) * avgMins);

      if (estimatedMins <= 5) {
        return { waitStr: '< 5 min', doctorCount: count };
      }
      return { waitStr: `~${estimatedMins} min`, doctorCount: count };
    },
    [allDoctors]
  );

  // Department Selection: Reset doctor and slot when department changes
  const handleSelectDepartment = (deptId: string) => {
    if (form.department === deptId) return;
    form.setField('department', deptId);
    form.setField('doctorId', '');
    form.setField('slotTime', '');
    setSlots([]);
    setSlotsError(null);
  };

  // Doctor Selection: Reset slot when doctor changes
  const handleSelectDoctor = (docId: string) => {
    if (form.doctorId === docId) return;
    form.setField('doctorId', docId);
    form.setField('slotTime', '');
    setSlots([]);
    setSlotsError(null);
  };

  // Fetch slots for doctor today & preselect earliest available slot
  useEffect(() => {
    if (!form.doctorId) {
      setSlots([]);
      setSlotsLoading(false);
      setSlotsError(null);
      return;
    }

    let isMounted = true;
    const fetchDoctorSlots = async () => {
      setSlotsLoading(true);
      setSlotsError(null);
      try {
        let todayDate = '';
        try {
          todayDate = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Colombo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(new Date());
        } catch {
          todayDate = new Date().toISOString().split('T')[0];
        }

        const res = await getSlots(form.doctorId, todayDate);
        if (!isMounted) return;

        if (res && Array.isArray(res.slots)) {
          setSlots(res.slots);
          // Preselect earliest available slot
          if (res.earliestAvailable) {
            form.setField('slotTime', res.earliestAvailable);
          } else {
            const firstAvail = res.slots.find((s) => s.status === 'available');
            if (firstAvail) {
              form.setField('slotTime', firstAvail.time);
            }
          }
        } else {
          setSlots([]);
        }
      } catch (err: any) {
        if (!isMounted) return;
        const msg = getErrorMessage(err);
        setSlotsError(msg || 'Failed to load doctor slots');
        setSlots([]);
      } finally {
        if (isMounted) {
          setSlotsLoading(false);
        }
      }
    };

    fetchDoctorSlots();

    return () => {
      isMounted = false;
    };
  }, [form.doctorId]);

  // Filter doctors for the chosen department
  const departmentDoctors = allDoctors.filter((d) => {
    if (!form.department) return false;
    const normDept = form.department.toLowerCase().replace(/\s+/g, '');
    const docDept = (d.department || '').toLowerCase().replace(/\s+/g, '');
    return docDept.includes(normDept) || normDept.includes(docDept);
  });

  // 400ms Debounced Patient Search by NIC or Phone
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const executeSearch = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (trimmed.length < 3) {
        setSearchStatus('idle');
        setMatchedPatient(null);
        setSearching(false);
        return;
      }

      setSearching(true);
      try {
        const res = await searchPatients(trimmed);
        if (res?.found && res?.patients?.length > 0) {
          const patient = res.patients[0];
          setMatchedPatient(patient);
          setSearchStatus('found');

          // Auto-fill form and record existing patient ID
          form.setExistingPatient(patient._id, {
            fullName: patient.fullName || '',
            nic: patient.nic || '',
            phone: patient.phone || '',
            age: patient.age !== undefined && patient.age !== null ? String(patient.age) : '',
            gender: (patient.gender as any) || '',
          });

          // Auto-suggest Senior if age is 60+
          if (patient.age !== undefined && patient.age !== null) {
            const ageNum = Number(patient.age);
            if (!isNaN(ageNum) && ageNum >= 60) {
              form.setField('priority', 'senior');
            }
          }

          showToast('Existing patient record found & auto-filled', 'success');
        } else {
          setMatchedPatient(null);
          setSearchStatus('not_found');
          form.setExistingPatient(null);

          // If query looks like an NIC, pre-fill NIC field; if phone, pre-fill phone
          if (/^\d{9}[VXvx]?$|^\d{12}$/.test(trimmed)) {
            form.setField('nic', trimmed);
          } else if (/^(?:\+?94|0)\d+$/.test(trimmed)) {
            form.setField('phone', trimmed);
          }
        }
      } catch (err: any) {
        setSearchStatus('idle');
        const msg = getErrorMessage(err);
        showToast(msg || 'Search failed', 'error');
      } finally {
        setSearching(false);
      }
    },
    [form]
  );

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    form.setField('query', text);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (text.trim().length >= 3) {
      searchTimeoutRef.current = setTimeout(() => {
        executeSearch(text);
      }, 400);
    } else {
      setSearchStatus('idle');
      setMatchedPatient(null);
      setSearching(false);
    }
  };

  const handleClearSearch = () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    setSearchQuery('');
    setSearchStatus('idle');
    setMatchedPatient(null);
    setSearching(false);
    form.reset();
  };

  // Full form reset for "Clear Form / New Entry" button
  const handleClearForm = () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    setSearchQuery('');
    setSearchStatus('idle');
    setMatchedPatient(null);
    setSearching(false);
    setSlots([]);
    setSlotsError(null);
    form.reset();
    showToast('Form cleared. Ready for new patient entry.', 'info');
  };

  // Submit and issue token
  const handlePrintAndIssueToken = async () => {
    // Prevent double tap / multiple submissions or if shift is closed
    if (submitting || submittingRef.current || isShiftClosed) {
      if (isShiftClosed) {
        showToast('Shift closed. Intake is disabled.', 'warning');
      }
      return;
    }

    const isValid = form.validate();
    if (!isValid) {
      showToast('Please fix the highlighted errors before issuing token.', 'error');
      return;
    }

    let todayDate = '';
    try {
      todayDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Colombo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
    } catch {
      todayDate = new Date().toISOString().split('T')[0];
    }

    const payload: WalkInPayload = {
      department: form.department.trim(),
      doctorId: form.doctorId,
      date: todayDate,
      slotTime: form.slotTime,
      priority: form.priority,
    };

    // Send existingPatientId ONLY when a record was matched
    if (form.existingPatientId) {
      payload.existingPatientId = form.existingPatientId;
    } else {
      payload.patient = {
        fullName: form.patient.fullName.trim(),
        phone: form.patient.phone.trim(),
        nic: form.patient.nic?.trim() || undefined,
        age:
          form.patient.age !== '' &&
          form.patient.age !== undefined &&
          form.patient.age !== null
            ? Number(form.patient.age)
            : undefined,
        gender: (form.patient.gender as any) || undefined,
      };
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const res = await createWalkIn(payload);
      setConfirmedPriority(form.priority);
      setConfirmedBooking(res);
      setLastIssuedToken(res);
      showToast(`Token #${res.token.tokenLabel} issued successfully!`, 'success');
      // Reset form after successful submission
      form.reset();
      setSearchQuery('');
      setSearchStatus('idle');
      setMatchedPatient(null);
      setSlots([]);
      setSlotsError(null);
    } catch (err: any) {
      const is409 =
        err?.status === 409 ||
        err?.response?.status === 409 ||
        (typeof err?.message === 'string' &&
          (err.message.includes('409') ||
            err.message.toLowerCase().includes('slot was just taken') ||
            err.message.toLowerCase().includes('conflict')));

      if (is409) {
        showToast('Slot was just taken', 'warning');
        // Refetch slots and preselect next one
        if (form.doctorId) {
          try {
            const slotsRes = await getSlots(form.doctorId, todayDate);
            if (slotsRes && Array.isArray(slotsRes.slots)) {
              setSlots(slotsRes.slots);
              const nextSlot =
                slotsRes.earliestAvailable ||
                slotsRes.slots.find((s) => s.status === 'available')?.time ||
                '';
              form.setField('slotTime', nextSlot);
            }
          } catch {}
        }
      } else {
        const msg = getErrorMessage(err);
        showToast(msg || 'Failed to issue walk-in token', 'error');
      }
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  const handleNewEntry = () => {
    setConfirmedBooking(null);
    setConfirmedPriority('normal');
    form.reset();
    setSearchQuery('');
    setSearchStatus('idle');
    setMatchedPatient(null);
    setSlots([]);
    setSlotsError(null);
  };

  const handleAgeChange = (val: string) => {
    form.setField('age', val);
    const ageNum = parseInt(val, 10);
    if (!isNaN(ageNum) && ageNum >= 60) {
      if (form.priority !== 'urgent') {
        form.setField('priority', 'senior');
      }
    } else if (!isNaN(ageNum) && ageNum < 60 && form.priority === 'senior') {
      form.setField('priority', 'normal');
    }
  };

  const handleQRScanPress = () => {
    showToast('QR Code scanning coming soon', 'info');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* ── TOAST BANNER ── */}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        duration={2500}
        onDismiss={() => setToastVisible(false)}
      />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.badgeWrap}>
            <Ionicons name="person-add" size={12} color={Colors.white} style={{ marginRight: 4 }} />
            <Text style={styles.badgeText}>INTAKE DESK</Text>
          </View>
          <Text style={styles.headerTitle}>Patient Registration</Text>
          <Text style={styles.headerSubtitle}>Step 1 of 2: Patient Identification & Details</Text>
        </View>

        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={handleClearSearch}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={18} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {confirmedBooking ? (
            /* ── CONFIRMATION CARD AFTER SUCCESS ── */
            <View style={styles.confirmationCard}>
              {/* Header */}
              <View style={styles.confirmHeaderBox}>
                <View style={styles.confirmIconCircle}>
                  <Ionicons name="checkmark-circle" size={32} color={Colors.white} />
                </View>
                <Text style={styles.confirmTitle}>Patient Registered Successfully!</Text>
                <Text style={styles.confirmSubtitle}>
                  Official appointment confirmed & OPD token generated.
                </Text>
              </View>

              {/* Real Token Badge */}
              <View style={styles.confirmTokenBadgeBox}>
                <Text style={styles.confirmTokenHeaderLabel}>OFFICIAL QUEUE TOKEN</Text>
                <TokenBadge
                  tokenLabel={
                    confirmedBooking.token?.tokenLabel ||
                    `OPD-${String(confirmedBooking.token?.tokenNumber || 1).padStart(3, '0')}`
                  }
                  priority={confirmedPriority || 'normal'}
                  size="large"
                />
                <View style={styles.smsStatusBadge}>
                  <Ionicons
                    name="chatbubble-ellipses"
                    size={13}
                    color="#0D9488"
                    style={{ marginRight: 5 }}
                  />
                  <Text style={styles.smsStatusBadgeText}>
                    SMS confirmation queued to {confirmedBooking.patient.phone}
                  </Text>
                </View>
              </View>

              {/* Summary Breakdown Card */}
              <View style={styles.confirmDetailsCard}>
                {/* Patient Info */}
                <View style={styles.confirmRow}>
                  <View style={styles.confirmRowIconWrap}>
                    <Ionicons name="person" size={16} color={Colors.primary} />
                  </View>
                  <View style={styles.confirmRowContent}>
                    <Text style={styles.confirmRowLabel}>PATIENT</Text>
                    <Text style={styles.confirmRowMainValue}>
                      {confirmedBooking.patient.fullName}
                    </Text>
                    <Text style={styles.confirmRowSubText}>
                      {confirmedBooking.patient.nic
                        ? `NIC: ${confirmedBooking.patient.nic} • `
                        : ''}
                      {confirmedBooking.patient.age
                        ? `Age: ${confirmedBooking.patient.age} • `
                        : ''}
                      {confirmedBooking.patient.gender
                        ? `${confirmedBooking.patient.gender} • `
                        : ''}
                      Phone: {confirmedBooking.patient.phone}
                    </Text>
                  </View>
                </View>

                <View style={styles.confirmItemDivider} />

                {/* Doctor & Room */}
                <View style={styles.confirmRow}>
                  <View style={styles.confirmRowIconWrap}>
                    <Ionicons name="medkit" size={16} color={Colors.primary} />
                  </View>
                  <View style={styles.confirmRowContent}>
                    <Text style={styles.confirmRowLabel}>DOCTOR & ROOM</Text>
                    <Text style={styles.confirmRowMainValue}>
                      {confirmedBooking.doctor.name}
                    </Text>
                    <Text style={styles.confirmRowSubText}>
                      {confirmedBooking.doctor.room || 'OPD Room'} • Department:{' '}
                      {confirmedBooking.appointment.department || 'General OPD'}
                    </Text>
                  </View>
                </View>

                <View style={styles.confirmItemDivider} />

                {/* Slot & Time */}
                <View style={styles.confirmRow}>
                  <View style={styles.confirmRowIconWrap}>
                    <Ionicons name="calendar" size={16} color={Colors.primary} />
                  </View>
                  <View style={styles.confirmRowContent}>
                    <Text style={styles.confirmRowLabel}>SCHEDULED SLOT</Text>
                    <Text style={styles.confirmRowMainValue}>
                      {confirmedBooking.appointment.slotTime} ({confirmedBooking.appointment.date})
                    </Text>
                  </View>
                </View>

                <View style={styles.confirmItemDivider} />

                {/* Queue Metrics: Estimated Wait & Patients Ahead */}
                <View style={styles.confirmMetricsContainer}>
                  <View style={styles.confirmMetricCol}>
                    <Text style={styles.confirmMetricTitle}>ESTIMATED WAIT</Text>
                    <Text style={styles.confirmMetricNum}>
                      ~{confirmedBooking.estimatedWaitMinutes ?? 0} mins
                    </Text>
                  </View>

                  <View style={styles.confirmMetricSeparator} />

                  <View style={styles.confirmMetricCol}>
                    <Text style={styles.confirmMetricTitle}>PATIENTS AHEAD</Text>
                    <Text style={styles.confirmMetricNum}>
                      {confirmedBooking.patientsAhead ?? 0} ahead
                    </Text>
                  </View>
                </View>
              </View>

              {/* New Entry Button */}
              <TouchableOpacity
                style={styles.confirmNewEntryBtn}
                onPress={handleNewEntry}
                activeOpacity={0.8}
                accessibilityLabel="Start New Patient Entry"
                accessibilityRole="button"
              >
                <Ionicons
                  name="add-circle"
                  size={20}
                  color={Colors.white}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.confirmNewEntryBtnText}>New Entry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* ── SHIFT CLOSED NOTICE BANNER ── */}
              {isShiftClosed && (
                <View style={styles.shiftClosedNoticeBanner}>
                  <Ionicons name="lock-closed" size={16} color="#92400E" style={{ marginRight: 8 }} />
                  <Text style={styles.shiftClosedNoticeText}>Shift closed. Intake is disabled.</Text>
                </View>
              )}

              {/* ── SEARCH BAR (NIC / PHONE / QR) ── */}
              <View style={styles.searchCard}>
                <Text style={styles.searchTitle}>Search Existing Record</Text>
                <Text style={styles.searchDesc}>
                  Enter Patient NIC or Phone Number to check past hospital visits.
                </Text>

                <View style={styles.searchBarRow}>
                  <View style={styles.searchInputWrapper}>
                    <Ionicons
                      name="search"
                      size={18}
                      color={Colors.textLight}
                      style={styles.searchIcon}
                    />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="NIC (e.g. 199418201234 / 647891234V) or Phone"
                      placeholderTextColor={Colors.textLight}
                      value={searchQuery}
                      onChangeText={handleSearchChange}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      clearButtonMode="never"
                    />

                    {searching ? (
                      <ActivityIndicator
                        size="small"
                        color={Colors.primary}
                        style={styles.searchSpinner}
                      />
                    ) : searchQuery.length > 0 ? (
                      <TouchableOpacity
                        onPress={handleClearSearch}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={styles.clearBtn}
                      >
                        <Ionicons name="close-circle" size={18} color={Colors.textLight} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* QR Scanner Icon Button */}
                  <TouchableOpacity
                    style={styles.qrButton}
                    onPress={handleQRScanPress}
                    activeOpacity={0.7}
                    accessibilityLabel="Scan Patient QR Code"
                  >
                    <Ionicons name="qr-code-outline" size={22} color={Colors.primary} />
                  </TouchableOpacity>
                </View>

                {/* ── SEARCH STATUS BANNERS ── */}
                {searchStatus === 'found' && matchedPatient && (
                  <View style={styles.foundBanner}>
                    <View style={styles.bannerIconCircleSuccess}>
                      <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                    </View>
                    <View style={styles.bannerTextWrap}>
                      <Text style={styles.foundBannerTitle}>Existing record found (auto-filled)</Text>
                      <Text style={styles.foundBannerSub}>
                        Patient: {matchedPatient.fullName} • Reg:{' '}
                        {matchedPatient.registeredVia || 'Hospital'}
                      </Text>
                    </View>
                  </View>
                )}

                {searchStatus === 'not_found' && (
                  <View style={styles.notFoundBanner}>
                    <View style={styles.bannerIconCircleInfo}>
                      <Ionicons name="person-add" size={16} color={Colors.primary} />
                    </View>
                    <View style={styles.bannerTextWrap}>
                      <Text style={styles.notFoundBannerTitle}>New patient</Text>
                      <Text style={styles.notFoundBannerSub}>
                        No previous record found. Please enter details below.
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* ── STEP 1: DEMOGRAPHICS & TRIAGE CARD ── */}
              <View style={styles.formCard}>
                <View style={styles.formCardHeader}>
                  <View style={styles.stepPill}>
                    <Text style={styles.stepPillText}>STEP 1</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formCardTitle}>Demographics & Triage</Text>
                    <Text style={styles.formCardSub}>
                      Patient identification and priority triage
                    </Text>
                  </View>
                </View>

                {/* Full Name */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Full Name <Text style={styles.requiredAsterisk}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      form.errors.fullName ? styles.inputError : null,
                    ]}
                    placeholder="e.g. Kasun Chamara Mendis"
                    placeholderTextColor={Colors.textLight}
                    value={form.patient.fullName}
                    onChangeText={(val) => form.setField('fullName', val)}
                    autoCapitalize="words"
                  />
                  {form.errors.fullName ? (
                    <Text style={styles.errorText}>{form.errors.fullName}</Text>
                  ) : null}
                </View>

                {/* NIC & Phone Row */}
                <View style={styles.fieldsRow}>
                  {/* NIC Field */}
                  <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.fieldLabel}>NIC (Optional)</Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        form.errors.nic ? styles.inputError : null,
                      ]}
                      placeholder="199418201234 / 647891234V"
                      placeholderTextColor={Colors.textLight}
                      value={form.patient.nic}
                      onChangeText={(val) => form.setField('nic', val)}
                      autoCapitalize="characters"
                    />
                    {form.errors.nic ? (
                      <Text style={styles.errorText}>{form.errors.nic}</Text>
                    ) : null}
                  </View>

                  {/* Phone Field */}
                  <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
                    <Text style={styles.fieldLabel}>
                      Phone Number <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        form.errors.phone ? styles.inputError : null,
                      ]}
                      placeholder="0771234567"
                      placeholderTextColor={Colors.textLight}
                      value={form.patient.phone}
                      onChangeText={(val) => form.setField('phone', val)}
                      keyboardType="phone-pad"
                    />
                    {form.errors.phone ? (
                      <Text style={styles.errorText}>{form.errors.phone}</Text>
                    ) : null}
                  </View>
                </View>

                {/* Age & Gender Row */}
                <View style={styles.fieldsRow}>
                  {/* Age Field */}
                  <View style={[styles.fieldGroup, { flex: 0.8, marginRight: 8 }]}>
                    <View style={styles.ageLabelRow}>
                      <Text style={styles.fieldLabel}>Age</Text>
                      {Number(form.patient.age) >= 60 && (
                        <Text style={styles.seniorBadgeText}>Senior (60+)</Text>
                      )}
                    </View>
                    <TextInput
                      style={[
                        styles.textInput,
                        form.errors.age ? styles.inputError : null,
                      ]}
                      placeholder="e.g. 62"
                      placeholderTextColor={Colors.textLight}
                      value={String(form.patient.age || '')}
                      onChangeText={handleAgeChange}
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                    {form.errors.age ? (
                      <Text style={styles.errorText}>{form.errors.age}</Text>
                    ) : null}
                  </View>

                  {/* Gender Selector */}
                  <View style={[styles.fieldGroup, { flex: 1.2, marginLeft: 8 }]}>
                    <Text style={styles.fieldLabel}>Gender</Text>
                    <View style={styles.genderRow}>
                      {(['male', 'female', 'other'] as const).map((g) => {
                        const isSelected = form.patient.gender === g;
                        return (
                          <TouchableOpacity
                            key={g}
                            style={[
                              styles.genderChip,
                              isSelected ? styles.genderChipSelected : null,
                            ]}
                            onPress={() => form.setField('gender', g)}
                            activeOpacity={0.7}
                            accessibilityLabel={`Gender ${g}`}
                            accessibilityRole="button"
                          >
                            <Text
                              style={[
                                styles.genderChipText,
                                isSelected ? styles.genderChipTextSelected : null,
                              ]}
                            >
                              {g.charAt(0).toUpperCase() + g.slice(1)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>

                {/* Intake Toggle (Walk-In / Pre-Booked) */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Intake Mode</Text>
                  <View style={styles.intakeTypeRow}>
                    {[
                      { key: 'walk_in', label: 'Walk-In Patient', icon: 'walk' },
                      { key: 'pre_booked', label: 'Pre-Booked', icon: 'calendar' },
                    ].map((item) => {
                      const isSelected = form.intakeType === item.key;
                      return (
                        <TouchableOpacity
                          key={item.key}
                          style={[
                            styles.intakeTypeChip,
                            isSelected ? styles.intakeTypeChipSelected : null,
                          ]}
                          onPress={() =>
                            form.setField('intakeType', item.key as AppointmentType)
                          }
                          activeOpacity={0.7}
                          accessibilityLabel={`Intake ${item.label}`}
                          accessibilityRole="button"
                        >
                          <Ionicons
                            name={item.icon as any}
                            size={16}
                            color={isSelected ? Colors.primary : Colors.textMedium}
                            style={{ marginRight: 6 }}
                          />
                          <Text
                            style={[
                              styles.intakeTypeChipText,
                              isSelected ? styles.intakeTypeChipTextSelected : null,
                            ]}
                          >
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Priority Chips (Normal / Senior / Urgent) */}
                <View style={styles.fieldGroup}>
                  <View style={styles.priorityHeaderRow}>
                    <Text style={styles.fieldLabel}>Priority Triage</Text>
                    {form.priority === 'senior' && (
                      <Text style={styles.priorityHintSenior}>Senior line prioritized</Text>
                    )}
                    {form.priority === 'urgent' && (
                      <Text style={styles.priorityHintUrgent}>Immediate doctor triage</Text>
                    )}
                  </View>
                  <View style={styles.priorityRow}>
                    {[
                      { key: 'normal', label: 'Normal', icon: 'person' },
                      { key: 'senior', label: 'Senior', icon: 'heart' },
                      { key: 'urgent', label: 'Urgent', icon: 'warning' },
                    ].map((item) => {
                      const isSelected = form.priority === item.key;
                      return (
                        <TouchableOpacity
                          key={item.key}
                          style={[
                            styles.priorityChip,
                            isSelected ? styles.priorityChipSelected : null,
                            item.key === 'urgent' && isSelected
                              ? styles.priorityUrgentSelected
                              : null,
                            item.key === 'senior' && isSelected
                              ? styles.prioritySeniorSelected
                              : null,
                          ]}
                          onPress={() => form.setField('priority', item.key as QueuePriority)}
                          activeOpacity={0.7}
                          accessibilityLabel={`Priority ${item.label}`}
                          accessibilityRole="button"
                        >
                          <Ionicons
                            name={item.icon as any}
                            size={15}
                            color={
                              isSelected
                                ? item.key === 'urgent'
                                  ? Colors.danger
                                  : item.key === 'senior'
                                  ? Colors.warning
                                  : Colors.primary
                                : Colors.textMedium
                            }
                            style={{ marginRight: 5 }}
                          />
                          <Text
                            style={[
                              styles.priorityChipText,
                              isSelected ? styles.priorityChipTextSelected : null,
                            ]}
                          >
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* ── STEP 2: CONSULTATION & SLOT SCHEDULING CARD ── */}
              <View style={[styles.formCard, { marginTop: 16 }]}>
                <View style={styles.formCardHeader}>
                  <View style={[styles.stepPill, { backgroundColor: '#0284C7' }]}>
                    <Text style={styles.stepPillText}>STEP 2</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formCardTitle}>Department, Doctor & Slot</Text>
                    <Text style={styles.formCardSub}>
                      Select specialty, physician, and appointment time
                    </Text>
                  </View>
                </View>

                {/* ── 1. DEPARTMENT CARDS ── */}
                <View style={styles.fieldGroup}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.fieldLabel}>
                      Department <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    {form.department ? (
                      <Text style={styles.selectedLabelText}>
                        Selected: {form.department}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.departmentGrid}>
                    {DEPARTMENTS.map((dept) => {
                      const isSelected = form.department === dept.id;
                      const waitInfo = getDepartmentWaitTime(dept.id);
                      return (
                        <TouchableOpacity
                          key={dept.id}
                          style={[
                            styles.departmentCard,
                            isSelected ? styles.departmentCardSelected : null,
                          ]}
                          onPress={() => handleSelectDepartment(dept.id)}
                          activeOpacity={0.7}
                          accessibilityLabel={`Department ${dept.name}`}
                          accessibilityRole="button"
                        >
                          <View style={styles.deptCardTop}>
                            <View
                              style={[
                                styles.deptIconWrap,
                                { backgroundColor: dept.bgColor },
                              ]}
                            >
                              <Ionicons name={dept.icon as any} size={20} color={dept.color} />
                            </View>
                            {isSelected && (
                              <View style={styles.deptCheckBadge}>
                                <Ionicons
                                  name="checkmark-circle"
                                  size={16}
                                  color={Colors.primary}
                                />
                              </View>
                            )}
                          </View>

                          <Text
                            style={[
                              styles.deptName,
                              isSelected ? styles.deptNameSelected : null,
                            ]}
                            numberOfLines={1}
                          >
                            {dept.name}
                          </Text>

                          <View style={styles.deptFooter}>
                            <View style={styles.deptWaitTag}>
                              <Ionicons
                                name="time-outline"
                                size={11}
                                color={Colors.textLight}
                                style={{ marginRight: 3 }}
                              />
                              <Text style={styles.deptWaitText}>{waitInfo.waitStr}</Text>
                            </View>
                            <Text style={styles.deptDocCountText}>
                              {waitInfo.doctorCount}{' '}
                              {waitInfo.doctorCount === 1 ? 'doc' : 'docs'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {form.errors.department ? (
                    <Text style={styles.errorText}>{form.errors.department}</Text>
                  ) : null}
                </View>

                {/* ── 2. DOCTOR PICKER ── */}
                <View style={styles.fieldGroup}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.fieldLabel}>
                      Consulting Doctor <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    {departmentDoctors.length > 0 ? (
                      <Text style={styles.subCountText}>
                        {departmentDoctors.length} available
                      </Text>
                    ) : null}
                  </View>

                  {!form.department ? (
                    <View style={styles.promptBox}>
                      <Ionicons
                        name="arrow-up-circle-outline"
                        size={20}
                        color={Colors.textLight}
                      />
                      <Text style={styles.promptBoxText}>
                        Please select a department above to view active doctors
                      </Text>
                    </View>
                  ) : doctorsLoading ? (
                    <View style={styles.loadingBox}>
                      <ActivityIndicator size="small" color={Colors.primary} />
                      <Text style={styles.loadingBoxText}>Loading doctors...</Text>
                    </View>
                  ) : departmentDoctors.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Ionicons
                        name="alert-circle-outline"
                        size={20}
                        color={Colors.warning}
                      />
                      <Text style={styles.emptyBoxText}>
                        No active doctors currently available in {form.department}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.doctorList}>
                      {departmentDoctors.map((doc) => {
                        const isSelected = form.doctorId === doc._id;
                        const isActive = doc.status === 'active';
                        return (
                          <TouchableOpacity
                            key={doc._id}
                            style={[
                              styles.doctorCard,
                              isSelected ? styles.doctorCardSelected : null,
                            ]}
                            onPress={() => handleSelectDoctor(doc._id)}
                            activeOpacity={0.7}
                            accessibilityLabel={`Doctor ${doc.name}`}
                            accessibilityRole="button"
                          >
                            <View
                              style={[
                                styles.doctorAvatar,
                                isSelected ? styles.doctorAvatarSelected : null,
                              ]}
                            >
                              <Ionicons
                                name="person"
                                size={18}
                                color={isSelected ? Colors.white : Colors.primary}
                              />
                            </View>

                            <View style={styles.doctorInfo}>
                              <View style={styles.doctorNameRow}>
                                <Text
                                  style={[
                                    styles.doctorName,
                                    isSelected ? styles.doctorNameSelected : null,
                                  ]}
                                >
                                  {doc.name}
                                </Text>
                                <View
                                  style={[
                                    styles.docStatusDot,
                                    {
                                      backgroundColor: isActive
                                        ? Colors.success
                                        : Colors.warning,
                                    },
                                  ]}
                                />
                              </View>
                              <Text style={styles.doctorSpecialty}>
                                {doc.specialization || doc.department} •{' '}
                                {doc.room || 'OPD Room'}
                              </Text>
                              <Text style={styles.doctorLoadText}>
                                {doc.todayPatients || 0} patients attended today • ~
                                {doc.avgConsultMinutes || 10}m/patient
                              </Text>
                            </View>

                            <View
                              style={[
                                styles.radioCircle,
                                isSelected ? styles.radioCircleSelected : null,
                              ]}
                            >
                              {isSelected && <View style={styles.radioInner} />}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                  {form.errors.doctorId ? (
                    <Text style={styles.errorText}>{form.errors.doctorId}</Text>
                  ) : null}
                </View>

                {/* ── 3. SLOT GRID ── */}
                <View style={styles.fieldGroup}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.fieldLabel}>
                      Appointment Slot <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    {form.slotTime ? (
                      <View style={styles.slotBadge}>
                        <Ionicons
                          name="time"
                          size={12}
                          color={Colors.primary}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.slotBadgeText}>{form.slotTime}</Text>
                      </View>
                    ) : null}
                  </View>

                  {!form.doctorId ? (
                    <View style={styles.promptBox}>
                      <Ionicons
                        name="calendar-outline"
                        size={20}
                        color={Colors.textLight}
                      />
                      <Text style={styles.promptBoxText}>
                        Please choose a doctor above to view today's available slots
                      </Text>
                    </View>
                  ) : slotsLoading ? (
                    <View style={styles.loadingBox}>
                      <ActivityIndicator size="small" color={Colors.primary} />
                      <Text style={styles.loadingBoxText}>
                        Fetching available slots for today...
                      </Text>
                    </View>
                  ) : slotsError ? (
                    <View style={styles.errorBox}>
                      <Ionicons name="alert-circle" size={18} color={Colors.danger} />
                      <Text style={styles.errorBoxText}>{slotsError}</Text>
                    </View>
                  ) : slots.length === 0 || !slots.some((s) => s.status === 'available') ? (
                    <View style={styles.emptyBox}>
                      <Ionicons name="time-outline" size={22} color={Colors.warning} />
                      <Text style={styles.emptyBoxTitle}>No Slots Remaining</Text>
                      <Text style={styles.emptyBoxText}>
                        All appointment slots for this doctor are booked or passed for today.
                      </Text>
                    </View>
                  ) : (
                    <View>
                      {/* Legend */}
                      <View style={styles.slotsLegend}>
                        <View style={styles.legendItem}>
                          <View
                            style={[
                              styles.legendIndicator,
                              { backgroundColor: Colors.primary },
                            ]}
                          />
                          <Text style={styles.legendText}>Selected</Text>
                        </View>
                        <View style={styles.legendItem}>
                          <View
                            style={[
                              styles.legendIndicator,
                              {
                                backgroundColor: Colors.cardBackground,
                                borderColor: Colors.border,
                                borderWidth: 1,
                              },
                            ]}
                          />
                          <Text style={styles.legendText}>Available</Text>
                        </View>
                        <View style={styles.legendItem}>
                          <View
                            style={[
                              styles.legendIndicator,
                              { backgroundColor: '#E5E7EB' },
                            ]}
                          />
                          <Text style={styles.legendText}>Booked / Past</Text>
                        </View>
                      </View>

                      {/* Grid of Slots */}
                      <View style={styles.slotsGrid}>
                        {slots.map((slot) => {
                          const isSelected = form.slotTime === slot.time;
                          const isAvailable = slot.status === 'available';
                          const isBooked = slot.status === 'booked';
                          const isPast = slot.status === 'past';

                          return (
                            <TouchableOpacity
                              key={slot.time}
                              disabled={!isAvailable}
                              style={[
                                styles.slotChip,
                                isAvailable && styles.slotChipAvailable,
                                isSelected && styles.slotChipSelected,
                                isBooked && styles.slotChipBooked,
                                isPast && styles.slotChipPast,
                              ]}
                              onPress={() => form.setField('slotTime', slot.time)}
                              activeOpacity={0.7}
                              accessibilityLabel={`Slot ${slot.time}, status: ${slot.status}`}
                              accessibilityRole="button"
                            >
                              <Text
                                style={[
                                  styles.slotChipText,
                                  isAvailable && styles.slotChipTextAvailable,
                                  isSelected && styles.slotChipTextSelected,
                                  (isBooked || isPast) && styles.slotChipTextDisabled,
                                ]}
                              >
                                {slot.time}
                              </Text>
                              {isSelected && (
                                <Ionicons
                                  name="checkmark"
                                  size={12}
                                  color={Colors.white}
                                  style={{ marginLeft: 3 }}
                                />
                              )}
                              {isBooked && (
                                <Text style={styles.slotSubText}>Booked</Text>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}
                  {form.errors.slotTime ? (
                    <Text style={styles.errorText}>{form.errors.slotTime}</Text>
                  ) : null}
                </View>
              </View>

              {/* ── LIVE TOKEN PREVIEW CARD ── */}
              <View style={styles.previewCard}>
                <View style={styles.previewHeader}>
                  <View style={styles.previewBadge}>
                    <Ionicons
                      name="sparkles"
                      size={12}
                      color="#5EEAD4"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.previewBadgeText}>LIVE TOKEN PREVIEW</Text>
                  </View>
                  <View style={styles.previewStatusTag}>
                    <Text style={styles.previewStatusTagText}>
                      {form.existingPatientId ? 'Existing Record' : 'New Patient'}
                    </Text>
                  </View>
                </View>

                {/* Token Callout Box */}
                <View style={styles.previewTokenBox}>
                  <Text style={styles.previewTokenPlaceholder}>OPD • LIVE</Text>
                  <View style={styles.tokenAssignTag}>
                    <Ionicons
                      name="shield-checkmark"
                      size={13}
                      color="#0D9488"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.tokenAssignTagText}>
                      Token assigned on submit
                    </Text>
                  </View>
                </View>

                {/* Summary Data Grid */}
                <View style={styles.previewGrid}>
                  <View style={styles.previewGridItem}>
                    <Text style={styles.previewItemLabel}>PATIENT</Text>
                    <Text style={styles.previewItemValue} numberOfLines={1}>
                      {form.patient.fullName.trim() || '---'}
                    </Text>
                  </View>

                  <View style={styles.previewGridItem}>
                    <Text style={styles.previewItemLabel}>DOCTOR</Text>
                    <Text style={styles.previewItemValue} numberOfLines={1}>
                      {selectedDoctor ? selectedDoctor.name : '---'}
                    </Text>
                  </View>

                  <View style={styles.previewGridItem}>
                    <Text style={styles.previewItemLabel}>ROOM</Text>
                    <Text style={styles.previewItemValue}>
                      {selectedDoctor?.room || '---'}
                    </Text>
                  </View>

                  <View style={styles.previewGridItem}>
                    <Text style={styles.previewItemLabel}>SLOT TIME</Text>
                    <Text style={styles.previewItemValue}>
                      {form.slotTime || '---'}
                    </Text>
                  </View>

                  <View style={styles.previewGridItem}>
                    <Text style={styles.previewItemLabel}>DEPARTMENT</Text>
                    <Text style={styles.previewItemValue} numberOfLines={1}>
                      {form.department || '---'}
                    </Text>
                  </View>

                  <View style={styles.previewGridItem}>
                    <Text style={styles.previewItemLabel}>EST. WAIT TIME</Text>
                    <Text style={[styles.previewItemValue, { color: '#5EEAD4' }]}>
                      {getEstimatedWaitForDoctor()}
                    </Text>
                  </View>
                </View>

                {/* Tags Row: Priority & Intake Mode */}
                <View style={styles.previewTagsRow}>
                  <View style={styles.previewTagPill}>
                    <Text style={styles.previewTagPillText}>
                      Priority: {form.priority.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.previewTagPill}>
                    <Text style={styles.previewTagPillText}>
                      Mode: {form.intakeType === 'walk_in' ? 'Walk-In' : 'Pre-Booked'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* ── ACTION BUTTONS ROW ── */}
              <View style={styles.actionButtonsContainer}>
                {/* Submit: Print Ticket & Issue Token */}
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    (submitting || isShiftClosed) ? styles.submitButtonDisabled : null,
                  ]}
                  onPress={handlePrintAndIssueToken}
                  disabled={submitting || isShiftClosed}
                  activeOpacity={0.8}
                  accessibilityLabel="Print Ticket and Issue Token"
                  accessibilityRole="button"
                >
                  {submitting ? (
                    <View style={styles.btnContentRow}>
                      <ActivityIndicator
                        size="small"
                        color={Colors.white}
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.submitButtonText}>
                        Generating Token & Ticket...
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.btnContentRow}>
                      <Ionicons
                        name={isShiftClosed ? 'lock-closed' : 'print'}
                        size={20}
                        color={Colors.white}
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.submitButtonText}>
                        {isShiftClosed ? 'Shift Closed (Intake Disabled)' : 'Print Ticket & Issue Token'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Reset: Clear Form / New Entry */}
                <TouchableOpacity
                  style={styles.clearFormButton}
                  onPress={handleClearForm}
                  disabled={submitting}
                  activeOpacity={0.7}
                  accessibilityLabel="Clear Form and New Entry"
                  accessibilityRole="button"
                >
                  <Ionicons
                    name="refresh-outline"
                    size={18}
                    color={Colors.textMedium}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.clearFormButtonText}>Clear Form / New Entry</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Bottom spacing */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingTop: Platform.OS === 'android' ? 16 : 10,
    paddingBottom: 16,
    backgroundColor: Colors.primary,
  },
  headerLeft: {
    flex: 1,
  },
  badgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
    fontWeight: '500',
  },
  headerActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
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
  searchCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  searchTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textDark,
  },
  searchDesc: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 3,
    marginBottom: 12,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textDark,
    paddingVertical: 10,
    fontWeight: '600',
  },
  searchSpinner: {
    marginLeft: 6,
  },
  clearBtn: {
    padding: 4,
  },
  qrButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.tint,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  foundBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  bannerIconCircleSuccess: {
    marginRight: 10,
  },
  bannerTextWrap: {
    flex: 1,
  },
  foundBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  foundBannerSub: {
    fontSize: 11,
    color: '#047857',
    marginTop: 2,
  },
  notFoundBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  bannerIconCircleInfo: {
    marginRight: 10,
  },
  notFoundBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E40AF',
  },
  notFoundBannerSub: {
    fontSize: 11,
    color: '#1D4ED8',
    marginTop: 2,
  },
  formCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  formCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepPill: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  stepPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  formCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textDark,
  },
  formCardSub: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 6,
  },
  ageLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  seniorBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.warning,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  priorityHintSenior: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.warning,
  },
  priorityHintUrgent: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.danger,
  },
  requiredAsterisk: {
    color: Colors.danger,
    fontWeight: '800',
  },
  textInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.textDark,
    minHeight: 46,
  },
  inputError: {
    borderColor: Colors.danger,
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    fontSize: 11,
    color: Colors.danger,
    marginTop: 4,
    fontWeight: '600',
  },
  genderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  genderChip: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginHorizontal: 2,
    minHeight: 46,
  },
  genderChipSelected: {
    backgroundColor: Colors.tint,
    borderColor: Colors.primary,
  },
  genderChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMedium,
  },
  genderChipTextSelected: {
    color: Colors.primary,
    fontWeight: '800',
  },
  priorityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priorityChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginHorizontal: 2,
    minHeight: 44,
  },
  priorityChipSelected: {
    backgroundColor: Colors.tint,
    borderColor: Colors.primary,
  },
  priorityUrgentSelected: {
    backgroundColor: '#FEE2E2',
    borderColor: Colors.danger,
  },
  prioritySeniorSelected: {
    backgroundColor: '#FEF3C7',
    borderColor: Colors.warning,
  },
  priorityChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMedium,
  },
  priorityChipTextSelected: {
    fontWeight: '800',
    color: Colors.textDark,
  },
  intakeTypeRow: {
    flexDirection: 'row',
  },
  intakeTypeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingVertical: 11,
    paddingHorizontal: 6,
    marginHorizontal: 3,
    minHeight: 44,
  },
  intakeTypeChipSelected: {
    backgroundColor: Colors.tint,
    borderColor: Colors.primary,
  },
  intakeTypeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMedium,
  },
  intakeTypeChipTextSelected: {
    color: Colors.primary,
    fontWeight: '800',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  selectedLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  subCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textLight,
  },
  departmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  departmentCard: {
    width: '48.5%',
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 10,
    minHeight: 96,
    justifyContent: 'space-between',
  },
  departmentCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.tint,
  },
  deptCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  deptIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deptCheckBadge: {
    marginLeft: 4,
  },
  deptName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 6,
  },
  deptNameSelected: {
    color: Colors.primary,
    fontWeight: '800',
  },
  deptFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deptWaitTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deptWaitText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textLight,
  },
  deptDocCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMedium,
  },
  promptBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
  },
  promptBoxText: {
    fontSize: 12,
    color: Colors.textMedium,
    marginLeft: 8,
    flex: 1,
    fontWeight: '500',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loadingBoxText: {
    fontSize: 12,
    color: Colors.textLight,
    marginLeft: 8,
    fontWeight: '600',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
  },
  emptyBoxTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
    marginTop: 4,
  },
  emptyBoxText: {
    fontSize: 11,
    color: '#92400E',
    textAlign: 'center',
    marginTop: 2,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
  },
  errorBoxText: {
    fontSize: 12,
    color: Colors.danger,
    marginLeft: 8,
    fontWeight: '600',
    flex: 1,
  },
  doctorList: {
    marginTop: 4,
  },
  doctorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 8,
    minHeight: 64,
  },
  doctorCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.tint,
  },
  doctorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  doctorAvatarSelected: {
    backgroundColor: Colors.primary,
  },
  doctorInfo: {
    flex: 1,
  },
  doctorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  doctorName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textDark,
    marginRight: 6,
  },
  doctorNameSelected: {
    color: Colors.primary,
    fontWeight: '800',
  },
  docStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  doctorSpecialty: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 1,
  },
  doctorLoadText: {
    fontSize: 10,
    color: Colors.textLight,
    marginTop: 3,
    fontWeight: '500',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  radioCircleSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  slotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.tint,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  slotBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  slotsLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 14,
  },
  legendIndicator: {
    width: 10,
    height: 10,
    borderRadius: 3,
    marginRight: 5,
  },
  legendText: {
    fontSize: 11,
    color: Colors.textLight,
    fontWeight: '500',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  slotChip: {
    width: '23%',
    marginHorizontal: '1%',
    marginBottom: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    flexDirection: 'row',
  },
  slotChipAvailable: {
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.border,
  },
  slotChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  slotChipBooked: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  slotChipPast: {
    backgroundColor: '#F9FAFB',
    borderColor: '#F3F4F6',
    opacity: 0.6,
  },
  slotChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  slotChipTextAvailable: {
    color: Colors.textDark,
  },
  slotChipTextSelected: {
    color: Colors.white,
  },
  slotChipTextDisabled: {
    color: '#9CA3AF',
  },
  slotSubText: {
    fontSize: 8,
    color: '#9CA3AF',
    marginLeft: 2,
    fontWeight: '600',
  },
  previewCard: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 18,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(94, 234, 212, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  previewBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#5EEAD4',
    letterSpacing: 0.5,
  },
  previewStatusTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  previewStatusTagText: {
    fontSize: 11,
    color: '#E2E8F0',
    fontWeight: '600',
  },
  previewTokenBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16,
  },
  previewTokenPlaceholder: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
    marginBottom: 6,
  },
  tokenAssignTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 148, 136, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tokenAssignTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5EEAD4',
  },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  previewGridItem: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  previewItemLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  previewItemValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  previewTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 12,
    marginTop: 4,
  },
  previewTagPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  previewTagPillText: {
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  successIssuedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
  },
  successIssuedIcon: {
    marginRight: 10,
  },
  successIssuedTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#065F46',
  },
  successIssuedSub: {
    fontSize: 11,
    color: '#047857',
    marginTop: 2,
    fontWeight: '500',
  },
  actionButtonsContainer: {
    marginTop: 16,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 10,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  btnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.2,
  },
  clearFormButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingVertical: 13,
    minHeight: 48,
  },
  clearFormButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textMedium,
  },
  confirmationCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  confirmHeaderBox: {
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textDark,
    textAlign: 'center',
  },
  confirmSubtitle: {
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'center',
    marginTop: 3,
  },
  confirmTokenBadgeBox: {
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  confirmTokenHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#166534',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  smsStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 148, 136, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 12,
  },
  smsStatusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
  },
  confirmDetailsCard: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 18,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  confirmRowIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  confirmRowContent: {
    flex: 1,
  },
  confirmRowLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textLight,
    letterSpacing: 0.5,
  },
  confirmRowMainValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textDark,
    marginTop: 1,
  },
  confirmRowSubText: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
  },
  confirmItemDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 6,
  },
  confirmMetricsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 8,
  },
  confirmMetricCol: {
    alignItems: 'center',
    flex: 1,
  },
  confirmMetricTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textLight,
    letterSpacing: 0.5,
  },
  confirmMetricNum: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primary,
    marginTop: 2,
  },
  confirmMetricSeparator: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
  },
  confirmNewEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    minHeight: 50,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  confirmNewEntryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.white,
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

export default RegisterPatientScreen;
