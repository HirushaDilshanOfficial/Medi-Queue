import { router } from 'expo-router';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Modal,
} from 'react-native';
import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useWalkInForm } from '../../hooks/useWalkInForm';
import {
  searchPatients,
  getErrorMessage,
  getDoctors,
  getSlots,
  createWalkIn,
  getPreBookedAppointments,
  WalkInPayload,
  WalkInResponse,
  PreBookedAppointment,
} from '../../services/api';
import { Patient, Doctor, QueuePriority, AppointmentType } from '../../types';
import { Toast, ToastType } from '../../components/Toast';
import { TokenBadge } from '../../components/TokenBadge';
import { BirthdayCalendarModal } from '../../components/BirthdayCalendarModal';
import { BarcodeScannerModal } from '../../components/BarcodeScannerModal';
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
  defaultWait: string;
}

export const DEPARTMENTS: DepartmentItem[] = [
  {
    id: 'General OPD',
    name: 'General OPD',
    icon: 'medkit-outline',
    defaultWait: '8m',
  },
  {
    id: 'Orthopedic',
    name: 'Orthopedic',
    icon: 'body-outline',
    defaultWait: '18m',
  },
  {
    id: 'Cardiology',
    name: 'Cardiology',
    icon: 'pulse-outline',
    defaultWait: '35m',
  },
  {
    id: 'Pediatric',
    name: 'Pediatric',
    icon: 'happy-outline',
    defaultWait: '12m',
  },
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export const RegisterPatientScreen: React.FC<RegisterPatientScreenProps> = ({
  navigation,
  route,
  onNavigate,
}) => {
  const { t } = useLanguage();
  const { isShiftClosed } = useShiftContext();
  const handleGoHome = () => {
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

  // Pre-booked appointments state
  const [preBookedList, setPreBookedList] = useState<PreBookedAppointment[]>([]);
  const [preBookedLoading, setPreBookedLoading] = useState<boolean>(false);
  const [preBookedQuery, setPreBookedQuery] = useState<string>('');
  const [selectedPreBooking, setSelectedPreBooking] = useState<PreBookedAppointment | null>(null);
  const [showCalendarModal, setShowCalendarModal] = useState<boolean>(false);
  const [scannerModalVisible, setScannerModalVisible] = useState<boolean>(false);

  const [showStaffSuccessModal, setShowStaffSuccessModal] = useState<boolean>(false);

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

  // Load pre-booked appointments for today or search query
  const loadPreBooked = useCallback(async (query?: string) => {
    setPreBookedLoading(true);
    try {
      const res = await getPreBookedAppointments(undefined, query);
      if (res && Array.isArray(res.appointments)) {
        setPreBookedList(res.appointments);
      }
    } catch (err: any) {
      console.warn('Failed to load pre-booked appointments:', err);
    } finally {
      setPreBookedLoading(false);
    }
  }, []);

  // When switching to pre_booked intake mode, fetch today's appointments
  useEffect(() => {
    if (form.intakeType === 'pre_booked') {
      loadPreBooked(preBookedQuery);
    }
  }, [form.intakeType, loadPreBooked, preBookedQuery]);

  const handleSelectPreBooking = useCallback(
    (appt: PreBookedAppointment) => {
      setSelectedPreBooking(appt);
      if (appt.patient) {
        form.setExistingPatient(appt.patient._id, {
          fullName: appt.patient.fullName,
          nic: appt.patient.nic || '',
          phone: appt.patient.phone || '',
          age:
            appt.patient.age !== undefined && appt.patient.age !== null
              ? String(appt.patient.age)
              : '',
          gender: (appt.patient.gender as any) || '',
        });
        setMatchedPatient(appt.patient as any);
        setSearchStatus('found');
      }
      if (appt.department) {
        form.setField('department', appt.department);
      }
      if (appt.doctor?._id) {
        form.setField('doctorId', appt.doctor._id);
      }
      if (appt.slotTime) {
        form.setField('slotTime', appt.slotTime);
      }
      if (appt.priority) {
        form.setField('priority', appt.priority);
      }
      showToast(`Pre-booking #${appt.bookingRef} verified!`, 'success');
    },
    [form]
  );

  const handleClearPreBooking = useCallback(() => {
    setSelectedPreBooking(null);
    form.reset();
    form.setField('intakeType', 'pre_booked');
    setMatchedPatient(null);
    setSearchStatus('idle');
  }, [form]);

  // Compute wait time per department matching design (e.g. 8m, 18m, 35m, 12m)
  const getDepartmentWaitTime = useCallback(
    (deptId: string, defaultWait: string): string => {
      const normDept = deptId.toLowerCase().replace(/\s+/g, '');
      const docs = allDoctors.filter((d) => {
        const docDept = (d.department || '').toLowerCase().replace(/\s+/g, '');
        return docDept.includes(normDept) || normDept.includes(docDept);
      });

      if (docs.length === 0) {
        return defaultWait;
      }

      const activeDocs = docs.filter((d) => d.status === 'active');
      const totalPatients = docs.reduce((sum, d) => sum + (d.todayPatients || 0), 0);
      const avgMins =
        docs.reduce((sum, d) => sum + (d.avgConsultMinutes || 10), 0) / docs.length;
      const divisor = activeDocs.length > 0 ? activeDocs.length : 1;
      const estimatedMins = Math.round((totalPatients / divisor) * avgMins);

      if (estimatedMins <= 0) {
        return defaultWait;
      }
      return `${estimatedMins}m`;
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
            dob: (patient as any).dob ? new Date((patient as any).dob).toISOString().split('T')[0] : '',
            age: patient.age !== undefined && patient.age !== null ? String(patient.age) : '',
            gender: (patient.gender as any) || '',
            bloodGroup: (patient as any).bloodGroup || '',
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

  const handleNicBlur = async () => {
    const nicVal = form.patient.nic?.trim();
    if (nicVal && nicVal.length >= 9 && !form.existingPatientId) {
      try {
        const res = await searchPatients(nicVal);
        if (res?.found && res?.patients?.length > 0) {
          const p = res.patients[0];
          setMatchedPatient(p);
          setSearchStatus('found');
          form.setExistingPatient(p._id, {
            fullName: p.fullName,
            nic: p.nic || nicVal,
            phone: p.phone || form.patient.phone,
            dob: (p as any).dob ? new Date((p as any).dob).toISOString().split('T')[0] : '',
            age: p.age ? String(p.age) : form.patient.age,
            gender: p.gender || form.patient.gender,
            bloodGroup: (p as any).bloodGroup || '',
          });
          showToast(`Existing record found for ${p.fullName}`, 'info');
        }
      } catch {
        // Ignore lookup errors
      }
    }
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
    setSelectedPreBooking(null);
    form.reset();
    showToast(
      form.intakeType === 'pre_booked'
        ? 'Selection cleared. Select or search a pre-booked appointment.'
        : 'Form cleared. Ready for new patient entry.',
      'info'
    );
  };

  // Perform backend walk-in submission after OTP verification or bypass
  const executeFinalRegistration = async (payloadToSubmit: WalkInPayload) => {
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const res = await createWalkIn(payloadToSubmit);
      setConfirmedPriority(form.priority);
      setConfirmedBooking(res);
      setLastIssuedToken(res);
      setShowStaffSuccessModal(true);
      showToast(`Token #${res.token.tokenLabel} issued! SMS confirmation sent to ${res.patient.phone}`, 'success');

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
        if (form.doctorId) {
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
            const slotsRes = await getSlots(form.doctorId, todayDate);
            if (slotsRes && Array.isArray(slotsRes.slots)) {
              setSlots(slotsRes.slots);
              const nextSlot =
                slotsRes.earliestAvailable ||
                slotsRes.slots.find((s) => s.status === 'available')?.time ||
                '';
              form.setField('slotTime', nextSlot);
            }
          } catch { }
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

  // Submit and issue token
  const handlePrintAndIssueToken = async () => {
    // Prevent double tap / multiple submissions or if shift is closed
    if (submitting || submittingRef.current || isShiftClosed) {
      if (isShiftClosed) {
        showToast('Shift closed. Intake is disabled.', 'warning');
      }
      return;
    }

    if (form.intakeType === 'pre_booked') {
      if (!selectedPreBooking) {
        showToast('Please search or select a pre-booked appointment first.', 'warning');
        return;
      }
    } else {
      // 1. Verify Full Name
      const cleanName = (form.patient.fullName || '').trim();
      if (!cleanName) {
        form.setField('fullName', '');
        showToast('Please enter the patient full name.', 'error');
        return;
      }

      // 2. Verify Telephone Number
      const cleanPhone = (form.patient.phone || '').trim();
      if (!cleanPhone) {
        form.setField('phone', '');
        showToast('Please enter the patient telephone number.', 'error');
        return;
      }
      if (cleanPhone.length < 8) {
        showToast('Please enter a valid telephone number (e.g. 0712345678).', 'error');
        return;
      }

      // 3. Auto-resolve Department, Doctor & Slot if not yet selected by receptionist
      const resolvedDepartment = (form.department?.trim() || 'General OPD');
      if (!form.department) {
        form.setField('department', resolvedDepartment);
      }

      if (!form.doctorId && allDoctors.length > 0) {
        const targetDept = resolvedDepartment.toLowerCase();
        const matched = allDoctors.find(
          (d) => (d.department || '').toLowerCase().includes(targetDept)
        );
        const resolvedDoc = matched?._id || allDoctors[0]?._id;
        if (resolvedDoc) {
          form.setField('doctorId', resolvedDoc);
        }
      }

      if (!form.slotTime) {
        const avail = slots.find((s) => s.status === 'available')?.time;
        if (avail) {
          form.setField('slotTime', avail);
        } else {
          const now = new Date();
          const hh = String(now.getHours()).padStart(2, '0');
          const mm = String(Math.floor(now.getMinutes() / 15) * 15).padStart(2, '0');
          form.setField('slotTime', `${hh}:${mm}`);
        }
      }
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

    const deptToUse = (selectedPreBooking?.department || form.department || 'General OPD').trim();
    let docIdToUse = selectedPreBooking?.doctor?._id || form.doctorId;
    if (!docIdToUse && allDoctors.length > 0) {
      const matched = allDoctors.find(
        (d) => (d.department || '').toLowerCase().includes(deptToUse.toLowerCase())
      );
      docIdToUse = matched?._id || allDoctors[0]?._id;
    }

    let slotTimeToUse = selectedPreBooking?.slotTime || form.slotTime;
    if (!slotTimeToUse) {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(Math.floor(now.getMinutes() / 15) * 15).padStart(2, '0');
      slotTimeToUse = `${hh}:${mm}`;
    }

    const payload: WalkInPayload = {
      department: deptToUse,
      doctorId: docIdToUse,
      date: todayDate,
      slotTime: slotTimeToUse,
      priority: form.priority,
      type: form.intakeType,
      intakeType: form.intakeType,
      appointmentId: selectedPreBooking?._id,
    };

    if (selectedPreBooking?.patient?._id) {
      payload.existingPatientId = selectedPreBooking.patient._id;
    } else if (form.existingPatientId) {
      payload.existingPatientId = form.existingPatientId;
    } else {
      payload.patient = {
        fullName: (selectedPreBooking?.patient?.fullName || form.patient.fullName).trim(),
        phone: (selectedPreBooking?.patient?.phone || form.patient.phone).trim(),
        nic: selectedPreBooking?.patient?.nic?.trim() || form.patient.nic?.trim() || undefined,
        dob: form.patient.dob?.trim() || undefined,
        age:
          selectedPreBooking?.patient?.age !== undefined && selectedPreBooking?.patient?.age !== null
            ? Number(selectedPreBooking.patient.age)
            : form.patient.age !== '' &&
              form.patient.age !== undefined &&
              form.patient.age !== null
              ? Number(form.patient.age)
              : undefined,
        gender: ((selectedPreBooking?.patient?.gender || form.patient.gender) as any) || undefined,
        bloodGroup: form.patient.bloodGroup || undefined,
      };
    }

    await executeFinalRegistration(payload);
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

  const handleBirthdayChange = (val: string) => {
    form.setField('dob', val);
    const cleaned = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
      const birthDate = new Date(cleaned);
      if (!isNaN(birthDate.getTime())) {
        const today = new Date();
        let calcAge = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          calcAge--;
        }
        if (calcAge >= 0 && calcAge <= 125) {
          form.setField('age', String(calcAge));
          if (calcAge >= 60 && form.priority !== 'urgent') {
            form.setField('priority', 'senior');
          } else if (calcAge < 60 && form.priority === 'senior') {
            form.setField('priority', 'normal');
          }
        }
      }
    }
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
    setScannerModalVisible(true);
  };

  const handleScanSuccess = (scannedValue: string) => {
    let codeToSearch = scannedValue.trim();
    try {
      const parsed = JSON.parse(scannedValue);
      if (parsed.nic) codeToSearch = parsed.nic;
      else if (parsed.bookingRef) codeToSearch = parsed.bookingRef;
      else if (parsed.phone) codeToSearch = parsed.phone;
      else if (parsed.patientId) codeToSearch = parsed.patientId;
      else if (parsed.id) codeToSearch = parsed.id;
    } catch {
      // Direct raw barcode string
    }
    setSearchQuery(codeToSearch);
    form.setField('query', codeToSearch);
    executeSearch(codeToSearch);
    showToast(`Scanned: ${codeToSearch}`, 'success');
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
          <TouchableOpacity
            style={styles.homeBackButton}
            onPress={handleGoHome}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={t("Back to Home")}
            accessibilityRole="button"
          >
            <Ionicons name="home" size={20} color={Colors.white} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <View style={styles.badgeWrap}>
            <Ionicons name="person-add" size={12} color={Colors.white} style={{ marginRight: 4 }} />
            <Text style={styles.badgeText}>{t('INTAKE DESK')}</Text>
          </View>
          <Text style={styles.headerTitle}>
            {form.intakeType === 'pre_booked' ? t('Pre-Booked Check-In') : t('Patient Registration')}
          </Text>
          <Text style={styles.headerSubtitle}>
            {form.intakeType === 'pre_booked'
              ? t('Verify pre-booked appointment & issue token')
              : t('Step 1 of 2: Patient Identification & Details')}
          </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={handleClearSearch}
          activeOpacity={0.7}
          accessibilityLabel="Refresh form"
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
                <Text style={styles.confirmTitle}>{t('Patient Registered Successfully!')}</Text>
                <Text style={styles.confirmSubtitle}>
                  {t('Official appointment confirmed & OPD token generated.')}
                </Text>
              </View>

              {/* Real Token Badge */}
              <View style={styles.confirmTokenBadgeBox}>
                <Text style={styles.confirmTokenHeaderLabel}>{t('OFFICIAL QUEUE TOKEN')}</Text>
                <TokenBadge
                  tokenLabel={
                    confirmedBooking.token?.tokenLabel ||
                    `OPD-${String(confirmedBooking.token?.tokenNumber || 1).padStart(3, '0')}`
                  }
                  priority={confirmedPriority || 'normal'}
                  size="large"
                />
                {/* ── SMS CONFIRMATION DELIVERED TO PATIENT CARD ── */}
                <View style={styles.smsDeliveredCard}>
                  <View style={styles.smsDeliveredHeader}>
                    <View style={styles.smsDeliveredTitleRow}>
                      <Ionicons name="chatbubbles" size={15} color="#0D9488" style={{ marginRight: 6 }} />
                      <Text style={styles.smsDeliveredTitle}>{t('CONFIRMATION SMS SENT TO PATIENT')}</Text>
                    </View>
                    <View style={styles.smsSentBadge}>
                      <View style={styles.smsSentDot} />
                      <Text style={styles.smsSentBadgeText}>{t('Sent to')} {confirmedBooking.patient.phone}</Text>
                    </View>
                  </View>
                  <View style={styles.smsMessageBox}>
                    <Text style={styles.smsMessageText}>
                      {confirmedBooking.smsNotification?.message ||
                        `[Medi-Queue Hospital] Dear ${confirmedBooking.patient.fullName}, your registration is SUCCESSFUL! Queue Token: ${confirmedBooking.token?.tokenLabel || `OPD-${String(confirmedBooking.token?.tokenNumber || 1).padStart(3, '0')}`}. Doctor: ${confirmedBooking.doctor?.name} (${confirmedBooking.doctor?.room || 'OPD Room'}). Est. Wait: ~${confirmedBooking.estimatedWaitMinutes || 15} mins. Please proceed to waiting area.`}
                    </Text>
                  </View>
                  <View style={styles.smsFooterRow}>
                    <Ionicons name="checkmark-circle" size={13} color="#059669" style={{ marginRight: 4 }} />
                    <Text style={styles.smsTimestampText}>
                      {t('Status: Delivered Successfully to Patient Mobile • Just Now')}
                    </Text>
                  </View>
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
                    <Text style={styles.confirmRowLabel}>{t('PATIENT')}</Text>
                    <Text style={styles.confirmRowMainValue}>
                      {confirmedBooking.patient.fullName}
                    </Text>
                    <Text style={styles.confirmRowSubText}>
                      {confirmedBooking.patient.nic
                        ? `${t('NIC')}: ${confirmedBooking.patient.nic} • `
                        : ''}
                      {confirmedBooking.patient.age
                        ? `${t('Age')}: ${confirmedBooking.patient.age} • `
                        : ''}
                      {confirmedBooking.patient.gender
                        ? `${t(confirmedBooking.patient.gender)} • `
                        : ''}
                      {confirmedBooking.patient.bloodGroup
                        ? `${t('Blood:')} ${confirmedBooking.patient.bloodGroup} • `
                        : ''}
                      {t('Phone:')} {confirmedBooking.patient.phone}
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
                    <Text style={styles.confirmRowLabel}>{t('DOCTOR & ROOM')}</Text>
                    <Text style={styles.confirmRowMainValue}>
                      {confirmedBooking.doctor.name}
                    </Text>
                    <Text style={styles.confirmRowSubText}>
                      {confirmedBooking.doctor.room || t('OPD Room')} • {t('Department')}:{' '}
                      {t(confirmedBooking.appointment.department || 'General OPD')}
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
                    <Text style={styles.confirmRowLabel}>{t('SCHEDULED SLOT')}</Text>
                    <Text style={styles.confirmRowMainValue}>
                      {confirmedBooking.appointment.slotTime} ({confirmedBooking.appointment.date})
                    </Text>
                  </View>
                </View>

                <View style={styles.confirmItemDivider} />

                {/* Queue Metrics: Estimated Wait & Patients Ahead */}
                <View style={styles.confirmMetricsContainer}>
                  <View style={styles.confirmMetricCol}>
                    <Text style={styles.confirmMetricTitle}>{t('ESTIMATED WAIT')}</Text>
                    <Text style={styles.confirmMetricNum}>
                      ~{confirmedBooking.estimatedWaitMinutes ?? 0} {t('mins')}
                    </Text>
                  </View>

                  <View style={styles.confirmMetricSeparator} />

                  <View style={styles.confirmMetricCol}>
                    <Text style={styles.confirmMetricTitle}>{t('PATIENTS AHEAD')}</Text>
                    <Text style={styles.confirmMetricNum}>
                      {confirmedBooking.patientsAhead ?? 0} {t('ahead')}
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
                <Text style={styles.confirmNewEntryBtnText}>{t('New Entry')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* ── SHIFT CLOSED NOTICE BANNER ── */}
              {isShiftClosed && (
                <View style={styles.shiftClosedNoticeBanner}>
                  <Ionicons name="lock-closed" size={16} color="#92400E" style={{ marginRight: 8 }} />
                  <Text style={styles.shiftClosedNoticeText}>{t('Shift closed. Intake is disabled.')}</Text>
                </View>
              )}

              {/* ── SEARCH BAR (NIC / PHONE / QR) (WALK-IN ONLY) ── */}
              {form.intakeType === 'walk_in' && (
                <View style={styles.searchCard}>
                  <Text style={styles.searchTitle}>{t('Search Existing Record')}</Text>
                  <Text style={styles.searchDesc}>
                    {t('Enter Patient NIC or Phone Number to check past hospital visits.')}
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
                        placeholder={t('NIC (e.g. 199418201234 / 647891234V) or Phone')}
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
                  {(searchStatus === 'found' || !!form.existingPatientId) && (matchedPatient || form.patient.fullName) && (
                    <View style={styles.foundBanner}>
                      <View style={styles.bannerIconCircleSuccess}>
                        <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                      </View>
                      <View style={styles.bannerTextWrap}>
                        <Text style={styles.foundBannerTitle}>{t('Existing record found (auto-filled)')}</Text>
                        <Text style={styles.foundBannerSub}>
                          {t('Patient:')} {matchedPatient?.fullName || form.patient.fullName}
                          {matchedPatient?.nic || form.patient.nic ? ` • ${t('NIC')}: ${matchedPatient?.nic || form.patient.nic}` : ''}
                        </Text>
                      </View>
                    </View>
                  )}

                  {searchStatus === 'not_found' && !form.existingPatientId && (
                    <View style={styles.notFoundBanner}>
                      <View style={styles.bannerIconCircleInfo}>
                        <Ionicons name="person-add" size={16} color={Colors.primary} />
                      </View>
                      <View style={styles.bannerTextWrap}>
                        <Text style={styles.notFoundBannerTitle}>{t('New patient')}</Text>
                        <Text style={styles.notFoundBannerSub}>
                          {t('No previous record found. Please enter details below.')}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* ── STEP 1: DEMOGRAPHICS & TRIAGE CARD (OR PRE-BOOKED VERIFICATION) ── */}
              <View style={styles.formCard}>
                <View style={styles.formCardHeader}>
                  <View
                    style={[
                      styles.stepPill,
                      form.intakeType === 'pre_booked'
                        ? { backgroundColor: '#4F46E5' }
                        : null,
                    ]}
                  >
                    <Text style={styles.stepPillText}>
                      {form.intakeType === 'pre_booked' ? t('CHECK-IN') : t('STEP 1')}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formCardTitle}>
                      {form.intakeType === 'pre_booked'
                        ? t('Pre-Booked Patient Check-In')
                        : t('Demographics & Triage')}
                    </Text>
                    <Text style={styles.formCardSub}>
                      {form.intakeType === 'pre_booked'
                        ? t('Verify online appointment & issue OPD queue token')
                        : t('Patient identification, details and priority triage')}
                    </Text>
                  </View>
                </View>

                {/* ── INTAKE MODE SELECTOR (WALK-IN VS PRE-BOOKED) ── */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{t('Intake Mode')}</Text>
                  <View style={styles.intakeTypeRow}>
                    <TouchableOpacity
                      style={[
                        styles.intakeTypeChip,
                        form.intakeType === 'walk_in' ? styles.intakeTypeChipSelected : null,
                      ]}
                      onPress={() => {
                        form.setField('intakeType', 'walk_in');
                        setSelectedPreBooking(null);
                      }}
                      activeOpacity={0.7}
                      accessibilityLabel="Intake Walk-In Patient"
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name="walk"
                        size={18}
                        color={form.intakeType === 'walk_in' ? Colors.primary : Colors.textMedium}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.intakeTypeChipText,
                          form.intakeType === 'walk_in' ? styles.intakeTypeChipTextSelected : null,
                        ]}
                      >
                        {t('Walk-In Patient')}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.intakeTypeChip,
                        form.intakeType === 'pre_booked' ? styles.intakeTypeChipPreBookedSelected : null,
                      ]}
                      onPress={() => {
                        form.setField('intakeType', 'pre_booked');
                        loadPreBooked(preBookedQuery);
                      }}
                      activeOpacity={0.7}
                      accessibilityLabel="Intake Pre-Booked"
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name="calendar"
                        size={18}
                        color={form.intakeType === 'pre_booked' ? Colors.primary : Colors.textMedium}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.intakeTypeChipText,
                          form.intakeType === 'pre_booked' ? styles.intakeTypeChipTextPreBookedSelected : null,
                        ]}
                      >
                        {t('Pre-Booked')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* ── PRE-BOOKED APPOINTMENT LOOKUP CARD (PRE-BOOKED ONLY) ── */}
                {form.intakeType === 'pre_booked' && (
                  <View style={styles.preBookedLookupSection}>
                    {selectedPreBooking ? (
                      /* Verified Pre-Booked Card */
                      <View style={styles.verifiedBookingCard}>
                        <View style={styles.verifiedBookingHeader}>
                          <View style={styles.verifiedBadge}>
                            <Ionicons name="checkmark-circle" size={16} color={Colors.primary} style={{ marginRight: 5 }} />
                            <Text style={styles.verifiedBadgeText}>
                              Verified Pre-Booking • #{selectedPreBooking.bookingRef}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={handleClearPreBooking}
                            style={styles.changeBookingBtn}
                          >
                            <Text style={styles.changeBookingBtnText}>{t('Change')}</Text>
                          </TouchableOpacity>
                        </View>

                        {/* Auto-Issued Queue Token Header */}
                        <View style={styles.autoIssuedTokenHeaderCard}>
                          <View style={styles.autoIssuedTokenLeft}>
                            <View style={styles.autoIssuedCheckCircle}>
                              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                            </View>
                            <Text style={styles.autoIssuedTokenTag}>{t('Queue Token')}</Text>
                          </View>
                          <View style={styles.autoIssuedTokenNumberPill}>
                            <Text style={styles.autoIssuedTokenNumberText}>
                              {selectedPreBooking.tokenLabel ||
                                (selectedPreBooking.tokenNumber
                                  ? `OPD-${String(selectedPreBooking.tokenNumber).padStart(3, '0')}`
                                  : `#${selectedPreBooking.bookingRef}`)}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.verifiedBookingGrid}>
                          <View style={styles.verifiedBookingCol}>
                            <Text style={styles.verifiedBookingLabel}>{t('PATIENT')}</Text>
                            <Text style={styles.verifiedBookingValue}>
                              {selectedPreBooking.patient?.fullName || form.patient.fullName}
                            </Text>
                            <Text style={styles.verifiedBookingSub}>
                              {selectedPreBooking.patient?.phone || form.patient.phone}
                              {selectedPreBooking.patient?.nic ? ` • ${t('NIC')}: ${selectedPreBooking.patient.nic}` : ''}
                              {selectedPreBooking.patient?.age ? ` • ${t('Age')}: ${selectedPreBooking.patient.age}` : ''}
                              {selectedPreBooking.patient?.gender ? ` • ${t(selectedPreBooking.patient.gender)}` : ''}
                            </Text>
                          </View>
                          <View style={styles.verifiedBookingCol}>
                            <Text style={styles.verifiedBookingLabel}>{t('SCHEDULED CONSULTATION')}</Text>
                            <Text style={styles.verifiedBookingValue}>
                              {selectedPreBooking.doctor ? `Dr. ${selectedPreBooking.doctor.name}` : t(selectedPreBooking.department)}
                            </Text>
                            <Text style={styles.verifiedBookingSub}>
                              {t(selectedPreBooking.department)} • {t('Slot Time') || 'Slot'}: {selectedPreBooking.slotTime}
                              {selectedPreBooking.doctor?.room ? ` • ${selectedPreBooking.doctor.room}` : ''}
                            </Text>
                          </View>
                        </View>

                        {/* Arrival Priority Triage Option for Pre-Booked */}
                        <View style={styles.preBookedTriageWrap}>
                          <View style={styles.priorityHeaderRow}>
                            <Text style={[styles.fieldLabel, { marginBottom: 0 }]}>{t('Arrival Priority Triage')}</Text>
                            {form.priority === 'senior' && (
                              <Text style={styles.seniorBadgeText}>{t('Senior Queue (60+)')}</Text>
                            )}
                            {form.priority === 'urgent' && (
                              <Text style={styles.priorityHintUrgent}>{t('🚨 Urgent Queue')}</Text>
                            )}
                          </View>
                          <View style={[styles.priorityRow, { marginTop: 6 }]}>
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
                                    {t(item.label)}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      </View>
                    ) : (
                      /* Search & Today's Pre-Bookings List */
                      <View style={styles.preBookedSearchBox}>
                        <View style={styles.preBookedInputWrap}>
                          <Ionicons name="search" size={16} color={Colors.textLight} style={{ marginRight: 8 }} />
                          <TextInput
                            style={styles.preBookedSearchInput}
                            placeholder={t("Search Booking ID (e.g. BK-1234), NIC, or Mobile...")}
                            placeholderTextColor={Colors.textLight}
                            value={preBookedQuery}
                            onChangeText={(text) => {
                              setPreBookedQuery(text);
                              loadPreBooked(text);
                            }}
                          />
                          {preBookedQuery ? (
                            <TouchableOpacity onPress={() => { setPreBookedQuery(''); loadPreBooked(''); }}>
                              <Ionicons name="close-circle" size={18} color={Colors.textLight} />
                            </TouchableOpacity>
                          ) : null}
                        </View>

                        {/* List of today's pre-booked appointments */}
                        <View style={styles.preBookedListWrap}>
                          <View style={styles.preBookedListHeaderRow}>
                            <Text style={styles.preBookedListTitle}>
                              {t("Today's Pre-Booked Appointments")}
                            </Text>
                            <TouchableOpacity onPress={() => loadPreBooked(preBookedQuery)}>
                              <Text style={styles.preBookedRefreshText}>{t("Refresh")}</Text>
                            </TouchableOpacity>
                          </View>

                          {preBookedLoading ? (
                            <View style={styles.preBookedLoadingBox}>
                              <ActivityIndicator size="small" color={Colors.primary} />
                              <Text style={styles.preBookedLoadingText}>{t("Loading pre-bookings...")}</Text>
                            </View>
                          ) : preBookedList.length === 0 ? (
                            <View style={styles.preBookedEmptyBox}>
                              <Ionicons name="calendar-outline" size={20} color={Colors.textLight} />
                              <Text style={styles.preBookedEmptyText}>
                                {preBookedQuery
                                  ? t('No pre-booked appointments match your search')
                                  : t('No pre-booked appointments scheduled for today')}
                              </Text>
                            </View>
                          ) : (
                            <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator={false}
                              style={styles.preBookedScroll}
                              contentContainerStyle={{ paddingVertical: 4 }}
                            >
                              {preBookedList.map((appt) => (
                                <TouchableOpacity
                                  key={appt._id}
                                  style={styles.preBookedChipItem}
                                  onPress={() => handleSelectPreBooking(appt)}
                                  activeOpacity={0.7}
                                >
                                  <View style={styles.preBookedChipTop}>
                                    <View style={styles.preBookedTokenPill}>
                                      <Text style={styles.preBookedTokenPillText}>
                                        {appt.tokenLabel ||
                                          (appt.tokenNumber
                                            ? `OPD-${String(appt.tokenNumber).padStart(3, '0')}`
                                            : `#${appt.bookingRef}`)}
                                      </Text>
                                    </View>
                                    <View style={styles.preBookedChipTimeBadge}>
                                      <Text style={styles.preBookedChipTimeText}>{appt.slotTime}</Text>
                                    </View>
                                  </View>
                                  <Text style={styles.preBookedChipPatient} numberOfLines={1}>
                                    {appt.patient?.fullName || 'Patient'}
                                  </Text>
                                  <Text style={styles.preBookedChipDoctor} numberOfLines={1}>
                                    {appt.doctor ? `Dr. ${appt.doctor.name}` : appt.department}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          )}
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* ── WALK-IN PATIENT REGISTRATION FIELDS (WALK-IN ONLY) ── */}
                {form.intakeType === 'walk_in' && (
                  <>
                    {/* Full Name */}
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>
                        {t('Full Name')} <Text style={styles.requiredAsterisk}>*</Text>
                      </Text>
                      <TextInput
                        style={[
                          styles.textInput,
                          form.errors.fullName ? styles.inputError : null,
                        ]}
                        placeholder={t("Enter your full name")}
                        placeholderTextColor={Colors.textLight}
                        value={form.patient.fullName}
                        onChangeText={(val) => form.setField('fullName', val)}
                        autoCapitalize="words"
                      />
                      {form.errors.fullName ? (
                        <Text style={styles.errorText}>{form.errors.fullName}</Text>
                      ) : null}
                    </View>

                    {/* NIC Number */}
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>{t('NIC Number (Optional)')}</Text>
                      <TextInput
                        style={[
                          styles.textInput,
                          form.errors.nic ? styles.inputError : null,
                        ]}
                        placeholder="e.g. 199912345678 or 647891234V"
                        placeholderTextColor={Colors.textLight}
                        value={form.patient.nic}
                        onChangeText={(val) => form.setField('nic', val)}
                        onBlur={handleNicBlur}
                        autoCapitalize="characters"
                      />
                      {form.errors.nic ? (
                        <Text style={styles.errorText}>{form.errors.nic}</Text>
                      ) : null}
                    </View>

                    {/* Birthday & Age Row */}
                    <View style={styles.fieldsRow}>
                      {/* Birthday Field */}
                      <View style={[styles.fieldGroup, { flex: 1.2, marginRight: 8 }]}>
                        <Text style={styles.fieldLabel}>{t('Birthday')}</Text>
                        <View style={styles.inputWithIconWrap}>
                          <TextInput
                            style={[
                              styles.textInputWithIcon,
                              form.errors.dob ? styles.inputError : null,
                            ]}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor={Colors.textLight}
                            value={form.patient.dob || ''}
                            onChangeText={handleBirthdayChange}
                            maxLength={10}
                            keyboardType="numbers-and-punctuation"
                          />
                          <TouchableOpacity
                            style={styles.calendarIconBtn}
                            onPress={() => setShowCalendarModal(true)}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityLabel="Open Birthday Calendar Picker"
                            accessibilityRole="button"
                          >
                            <Ionicons
                              name="calendar"
                              size={19}
                              color={Colors.primary}
                            />
                          </TouchableOpacity>
                        </View>
                        {form.errors.dob ? (
                          <Text style={styles.errorText}>{form.errors.dob}</Text>
                        ) : null}
                      </View>

                      {/* Age Field */}
                      <View style={[styles.fieldGroup, { flex: 0.8, marginLeft: 8 }]}>
                        <View style={styles.ageLabelRow}>
                          <Text style={styles.fieldLabel}>{t('Age')}</Text>
                          {Number(form.patient.age) >= 60 && (
                            <Text style={styles.seniorBadgeText}>{t('Senior (60+)')}</Text>
                          )}
                        </View>
                        <TextInput
                          style={[
                            styles.textInput,
                            form.errors.age ? styles.inputError : null,
                          ]}
                          placeholder="e.g. 32"
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
                    </View>

                    {/* Gender Selector */}
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>{t('Gender')}</Text>
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
                                {t(g.charAt(0).toUpperCase() + g.slice(1))}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* Telephone Number */}
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>
                        {t('Telephone Number')} <Text style={styles.requiredAsterisk}>*</Text>
                      </Text>
                      <TextInput
                        style={[
                          styles.textInput,
                          form.errors.phone ? styles.inputError : null,
                        ]}
                        placeholder="e.g. 0712345678"
                        placeholderTextColor={Colors.textLight}
                        value={form.patient.phone}
                        onChangeText={(val) => form.setField('phone', val)}
                        keyboardType="phone-pad"
                        accessibilityLabel="Telephone Number"
                      />
                      {form.errors.phone ? (
                        <Text style={styles.errorText}>{form.errors.phone}</Text>
                      ) : null}
                    </View>

                    {/* Blood Group (Optional) */}
                    <View style={styles.fieldGroup}>
                      <View style={styles.bloodGroupHeaderRow}>
                        <Text style={styles.fieldLabel}>{t('Blood Group (Optional)')}</Text>
                        {form.patient.bloodGroup ? (
                          <TouchableOpacity
                            onPress={() => form.setField('bloodGroup', '')}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={styles.clearBloodGroupText}>
                              {t('Clear')} ({form.patient.bloodGroup})
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                      <View style={styles.bloodGroupRow}>
                        {BLOOD_GROUPS.map((bg) => {
                          const isSelected = form.patient.bloodGroup === bg;
                          return (
                            <TouchableOpacity
                              key={bg}
                              style={[
                                styles.bloodGroupChip,
                                isSelected ? styles.bloodGroupChipSelected : null,
                              ]}
                              onPress={() => form.setField('bloodGroup', isSelected ? '' : bg)}
                              activeOpacity={0.7}
                            >
                              <Text
                                style={[
                                  styles.bloodGroupChipText,
                                  isSelected ? styles.bloodGroupChipTextSelected : null,
                                ]}
                              >
                                {bg}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>


                    {/* Priority Chips (Normal / Senior / Urgent) */}
                    <View style={styles.fieldGroup}>
                      <View style={styles.priorityHeaderRow}>
                        <Text style={styles.fieldLabel}>{t('Priority Triage')}</Text>
                        {form.priority === 'senior' && (
                          <Text style={styles.priorityHintSenior}>{t('Senior line prioritized')}</Text>
                        )}
                        {form.priority === 'urgent' && (
                          <Text style={styles.priorityHintUrgent}>{t('Immediate doctor triage')}</Text>
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
                                {t(item.label)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  </>
                )}
              </View>

              {/* ── STEP 2: CONSULTATION & SLOT SCHEDULING CARD (WALK-IN ONLY) ── */}
              {form.intakeType === 'walk_in' && (
                <>
                  <View style={[styles.formCard, { marginTop: 16 }]}>
                    <View style={styles.formCardHeader}>
                      <View style={[styles.stepPill, { backgroundColor: '#0284C7' }]}>
                        <Text style={styles.stepPillText}>{t('STEP 2')}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.formCardTitle}>{t('Department, Doctor & Slot')}</Text>
                        <Text style={styles.formCardSub}>
                          {t('Select specialty, physician, and appointment time')}
                        </Text>
                      </View>
                    </View>

                    {selectedPreBooking && (
                      <View style={styles.preBookedReservationNotice}>
                        <Ionicons name="calendar-outline" size={16} color="#4F46E5" style={{ marginRight: 6 }} />
                        <Text style={styles.preBookedReservationNoticeText}>
                          {t('Pre-Booked Slot:')} {selectedPreBooking.slotTime} • Dr. {selectedPreBooking.doctor?.name || 'Assigned'} ({selectedPreBooking.department})
                        </Text>
                      </View>
                    )}

                    {/* ── 1. DEPARTMENT CARDS ── */}
                    <View style={styles.fieldGroup}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.fieldLabel}>
                          {t('Department')} <Text style={styles.requiredAsterisk}>*</Text>
                        </Text>
                        {form.department ? (
                          <Text style={styles.selectedLabelText}>
                            {t('Selected:')} {t(form.department)}
                          </Text>
                        ) : null}
                      </View>

                      <View style={styles.departmentGrid}>
                        {DEPARTMENTS.map((dept) => {
                          const isSelected = form.department === dept.id;
                          const waitStr = getDepartmentWaitTime(dept.id, dept.defaultWait);
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
                              {/* Top Row: Icon on left, Wait time on right */}
                              <View style={styles.deptCardTopRow}>
                                <Ionicons
                                  name={dept.icon as any}
                                  size={22}
                                  color={isSelected ? '#0284C7' : '#334155'}
                                />
                                <Text
                                  style={[
                                    styles.deptWaitTimeText,
                                    isSelected ? styles.deptWaitTimeSelected : null,
                                  ]}
                                >
                                  {waitStr}
                                </Text>
                              </View>

                              {/* Bottom Row: Department Name */}
                              <Text
                                style={[
                                  styles.deptCardNameText,
                                  isSelected ? styles.deptCardNameSelected : null,
                                ]}
                                numberOfLines={1}
                              >
                                {t(dept.name)}
                              </Text>
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
                          {t('Consulting Doctor')} <Text style={styles.requiredAsterisk}>*</Text>
                        </Text>
                        {departmentDoctors.length > 0 ? (
                          <Text style={styles.subCountText}>
                            {departmentDoctors.length} {t('available')}
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
                            {t('Please select a department above to view active doctors')}
                          </Text>
                        </View>
                      ) : doctorsLoading ? (
                        <View style={styles.loadingBox}>
                          <ActivityIndicator size="small" color={Colors.primary} />
                          <Text style={styles.loadingBoxText}>{t('Loading doctors...')}</Text>
                        </View>
                      ) : departmentDoctors.length === 0 ? (
                        <View style={styles.emptyBox}>
                          <Ionicons
                            name="alert-circle-outline"
                            size={20}
                            color={Colors.warning}
                          />
                          <Text style={styles.emptyBoxText}>
                            {t('No active doctors currently available in')} {t(form.department)}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.doctorList}>
                          {departmentDoctors.map((doc) => {
                            const isSelected = form.doctorId === doc._id || form.doctorId === (doc as any).id;
                            const isActive = doc.status === 'active';
                            return (
                              <TouchableOpacity
                                key={doc._id || (doc as any).id}
                                style={[
                                  styles.doctorCard,
                                  isSelected ? styles.doctorCardSelected : null,
                                ]}
                                onPress={() => handleSelectDoctor(doc._id || (doc as any).id)}
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
                                    {doc.todayPatients || 0} {t('patients attended today • ~')}
                                    {doc.avgConsultMinutes || 10}{t('m/patient')}
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
                          {t('Appointment Slot')} <Text style={styles.requiredAsterisk}>*</Text>
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
                            {t("Please choose a doctor above to view today's available slots")}
                          </Text>
                        </View>
                      ) : slotsLoading ? (
                        <View style={styles.loadingBox}>
                          <ActivityIndicator size="small" color={Colors.primary} />
                          <Text style={styles.loadingBoxText}>
                            {t("Fetching available slots for today...")}
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
                          <Text style={styles.emptyBoxTitle}>{t('No Slots Remaining')}</Text>
                          <Text style={styles.emptyBoxText}>
                            {t('All appointment slots for this doctor are booked or passed for today.')}
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
                              <Text style={styles.legendText}>{t('Selected')}</Text>
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
                              <Text style={styles.legendText}>{t('Available')}</Text>
                            </View>
                            <View style={styles.legendItem}>
                              <View
                                style={[
                                  styles.legendIndicator,
                                  {
                                    backgroundColor: '#FEE2E2',
                                    borderColor: '#FCA5A5',
                                    borderWidth: 1,
                                  },
                                ]}
                              />
                              <Text style={[styles.legendText, { color: '#DC2626', fontWeight: '600' }]}>
                                {t('Booked')}
                              </Text>
                            </View>
                            <View style={styles.legendItem}>
                              <View
                                style={[
                                  styles.legendIndicator,
                                  { backgroundColor: '#E5E7EB' },
                                ]}
                              />
                              <Text style={styles.legendText}>{t('Past')}</Text>
                            </View>
                          </View>

                          {/* Grid of Slots */}
                          <View style={styles.slotsGrid}>
                            {slots.map((slot) => {
                              const isSelected = form.slotTime === slot.time;
                              const isAvailable = slot.status === 'available';
                              const isBooked = slot.status === 'booked';
                              const isPast = slot.status === 'past';

                              const handleSlotPress = () => {
                                if (isAvailable) {
                                  form.setField('slotTime', slot.time);
                                } else if (isBooked) {
                                  showToast(`Slot ${slot.time} is already booked by a patient.`, 'warning');
                                } else if (isPast) {
                                  showToast(`Slot ${slot.time} has already passed for today.`, 'info');
                                }
                              };

                              return (
                                <TouchableOpacity
                                  key={slot.time}
                                  style={[
                                    styles.slotChip,
                                    isAvailable && styles.slotChipAvailable,
                                    isSelected && styles.slotChipSelected,
                                    isBooked && styles.slotChipBooked,
                                    isPast && styles.slotChipPast,
                                  ]}
                                  onPress={handleSlotPress}
                                  activeOpacity={isAvailable ? 0.7 : 0.85}
                                  accessibilityLabel={`Slot ${slot.time}, status: ${slot.status}`}
                                  accessibilityRole="button"
                                >
                                  <View style={styles.slotChipTimeRow}>
                                    <Text
                                      style={[
                                        styles.slotChipText,
                                        isAvailable && styles.slotChipTextAvailable,
                                        isSelected && styles.slotChipTextSelected,
                                        isBooked && styles.slotChipTextBooked,
                                        isPast && styles.slotChipTextDisabled,
                                      ]}
                                    >
                                      {slot.time}
                                    </Text>
                                    {isSelected && (
                                      <Ionicons
                                        name="checkmark"
                                        size={12}
                                        color={Colors.white}
                                        style={{ marginLeft: 2 }}
                                      />
                                    )}
                                  </View>
                                  {isBooked ? (
                                    <View style={styles.slotBookedTag}>
                                      <Text style={styles.slotBookedTagText}>{t('Booked')}</Text>
                                    </View>
                                  ) : isPast ? (
                                    <Text style={styles.slotPastTagText}>{t('Past')}</Text>
                                  ) : null}
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
                        <Text style={styles.previewBadgeText}>{t('LIVE TOKEN PREVIEW')}</Text>
                      </View>
                      <View style={styles.previewStatusTag}>
                        <Text style={styles.previewStatusTagText}>
                          {form.existingPatientId ? t('Existing Record') : t('New Patient')}
                        </Text>
                      </View>
                    </View>

                    {/* Token Callout Box */}
                    <View style={styles.previewTokenBox}>
                      <Text style={styles.previewTokenPlaceholder}>{t('OPD • LIVE')}</Text>
                      <View style={styles.tokenAssignTag}>
                        <Ionicons
                          name="shield-checkmark"
                          size={13}
                          color="#0D9488"
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.tokenAssignTagText}>
                          {t('Token assigned on submit')}
                        </Text>
                      </View>
                    </View>

                    {/* Summary Data Grid */}
                    <View style={styles.previewGrid}>
                      <View style={styles.previewGridItem}>
                        <Text style={styles.previewItemLabel}>{t('PATIENT')}</Text>
                        <Text style={styles.previewItemValue} numberOfLines={1}>
                          {form.patient.fullName.trim() || '---'}
                        </Text>
                      </View>

                      <View style={styles.previewGridItem}>
                        <Text style={styles.previewItemLabel}>{t('DOCTOR')}</Text>
                        <Text style={styles.previewItemValue} numberOfLines={1}>
                          {selectedDoctor ? selectedDoctor.name : '---'}
                        </Text>
                      </View>

                      <View style={styles.previewGridItem}>
                        <Text style={styles.previewItemLabel}>{t('ROOM')}</Text>
                        <Text style={styles.previewItemValue}>
                          {selectedDoctor?.room || '---'}
                        </Text>
                      </View>

                      <View style={styles.previewGridItem}>
                        <Text style={styles.previewItemLabel}>{t('SLOT TIME')}</Text>
                        <Text style={styles.previewItemValue}>
                          {form.slotTime || '---'}
                        </Text>
                      </View>

                      <View style={styles.previewGridItem}>
                        <Text style={styles.previewItemLabel}>{t('DEPARTMENT')}</Text>
                        <Text style={styles.previewItemValue} numberOfLines={1}>
                          {form.department ? t(form.department) : '---'}
                        </Text>
                      </View>

                      <View style={styles.previewGridItem}>
                        <Text style={styles.previewItemLabel}>{t('EST. WAIT TIME')}</Text>
                        <Text style={[styles.previewItemValue, { color: '#5EEAD4' }]}>
                          {getEstimatedWaitForDoctor()}
                        </Text>
                      </View>
                    </View>

                    {/* Tags Row: Priority & Intake Mode */}
                    <View style={styles.previewTagsRow}>
                      <View style={styles.previewTagPill}>
                        <Text style={styles.previewTagPillText}>
                          {t('Priority:')} {t(form.priority.toUpperCase())}
                        </Text>
                      </View>
                      <View style={styles.previewTagPill}>
                        <Ionicons
                          name="walk"
                          size={12}
                          color="#CBD5E1"
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.previewTagPillText}>
                          {t('Mode: Walk-In')}
                        </Text>
                      </View>
                      {form.patient.bloodGroup ? (
                        <View style={[styles.previewTagPill, { backgroundColor: 'rgba(239, 68, 68, 0.25)' }]}>
                          <Ionicons name="water" size={11} color="#F87171" style={{ marginRight: 3 }} />
                          <Text style={[styles.previewTagPillText, { color: '#FCA5A5' }]}>
                            {t('Blood:')} {form.patient.bloodGroup}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </>
              )}

              {/* ── ACTION BUTTONS ROW ── */}
              <View style={styles.actionButtonsContainer}>
                {/* Submit: Print Ticket & Issue Token */}
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    form.intakeType === 'pre_booked' ? styles.submitButtonPreBooked : null,
                    (submitting || isShiftClosed || (form.intakeType === 'pre_booked' && !selectedPreBooking))
                      ? styles.submitButtonDisabled
                      : null,
                  ]}
                  onPress={handlePrintAndIssueToken}
                  disabled={submitting || isShiftClosed || (form.intakeType === 'pre_booked' && !selectedPreBooking)}
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
                        {form.intakeType === 'pre_booked' ? t('Printing Ticket...') : t('Registering Patient & Issuing Token...')}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.btnContentRow}>
                      <Ionicons
                        name={
                          isShiftClosed
                            ? 'lock-closed'
                            : form.intakeType === 'pre_booked'
                              ? 'print'
                              : 'person-add'
                        }
                        size={20}
                        color={Colors.white}
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.submitButtonText}>
                        {isShiftClosed
                          ? 'Shift Closed (Intake Disabled)'
                          : form.intakeType === 'pre_booked'
                            ? selectedPreBooking
                              ? `${t('Print Ticket')} (${selectedPreBooking.tokenLabel || (selectedPreBooking.tokenNumber ? `OPD-${String(selectedPreBooking.tokenNumber).padStart(3, '0')}` : `#${selectedPreBooking.bookingRef}`)})`
                              : t('Select Pre-Booked Appointment to Print Ticket')
                            : t('Register Walk-In Patient & Issue Token')}
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
                  <Text style={styles.clearFormButtonText}>
                    {form.intakeType === 'pre_booked'
                      ? selectedPreBooking
                        ? t('Clear Selection / Choose Another')
                        : t('Refresh Appointments')
                      : t('Clear Form / New Entry')}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Bottom spacing */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Birthday Calendar Modal */}
      <BirthdayCalendarModal
        visible={showCalendarModal}
        initialDate={form.patient.dob}
        onSelectDate={(dateStr) => {
          handleBirthdayChange(dateStr);
        }}
        onClose={() => setShowCalendarModal(false)}
      />

      {/* Barcode & QR Scanner Modal (Dual Mode: Camera + Barcode Machine Gun) */}
      <BarcodeScannerModal
        visible={scannerModalVisible}
        onClose={() => setScannerModalVisible(false)}
        onScan={handleScanSuccess}
      />

      {/* ── STAFF SUCCESS FEEDBACK / CONFIRMATION MODAL ── */}
      <Modal
        visible={showStaffSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStaffSuccessModal(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={styles.successModalCard}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-done" size={32} color={Colors.white} />
            </View>

            <Text style={styles.successModalTitle}>{t('Registration Successful!')}</Text>
            <Text style={styles.successModalSubtitle}>
              {t('Official walk-in appointment confirmed & OPD Token generated.')}
            </Text>

            <View style={styles.successSummaryBox}>
              <View style={styles.successSummaryRow}>
                <Text style={styles.successSummaryKey}>{t('Patient:')}</Text>
                <Text style={styles.successSummaryVal}>{confirmedBooking?.patient.fullName}</Text>
              </View>
              <View style={styles.successSummaryRow}>
                <Text style={styles.successSummaryKey}>{t('Mobile:')}</Text>
                <Text style={styles.successSummaryVal}>{confirmedBooking?.patient.phone}</Text>
              </View>
              <View style={styles.successSummaryRow}>
                <Text style={styles.successSummaryKey}>{t('Queue Token:')}</Text>
                <Text style={[styles.successSummaryVal, { color: Colors.primary, fontWeight: '800' }]}>
                  {confirmedBooking?.token?.tokenLabel ||
                    `OPD-${String(confirmedBooking?.token?.tokenNumber || 1).padStart(3, '0')}`}
                </Text>
              </View>
              <View style={styles.successSummaryRow}>
                <Text style={styles.successSummaryKey}>{t('Doctor:')}</Text>
                <Text style={styles.successSummaryVal}>{confirmedBooking?.doctor.name}</Text>
              </View>
            </View>

            {/* SMS Dispatch Confirmation in modal */}
            <View style={styles.smsAlertCard}>
              <View style={styles.smsAlertHeader}>
                <Ionicons name="paper-plane" size={13} color="#0D9488" style={{ marginRight: 6 }} />
                <Text style={styles.smsAlertTitle}>{t('SMS SENT TO PATIENT')}</Text>
              </View>
              <Text style={styles.smsAlertText}>
                {confirmedBooking?.smsNotification?.message ||
                  `[Medi-Queue Hospital] Dear ${confirmedBooking?.patient.fullName}, your registration is SUCCESSFUL! Queue Token: ${confirmedBooking?.token?.tokenLabel}. Doctor: ${confirmedBooking?.doctor?.name}.`}
              </Text>
              <Text style={styles.smsAlertSub}>
                ✓ Sent to {confirmedBooking?.patient.phone} • Delivered
              </Text>
            </View>

            <TouchableOpacity
              style={styles.successModalCloseBtn}
              onPress={() => setShowStaffSuccessModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.successModalCloseBtnText}>{t('View Ticket & Continue')}</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  homeBackButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitleWrap: {
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
  inputWithIconWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  textInputWithIcon: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingLeft: 14,
    paddingRight: 38,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.textDark,
    minHeight: 46,
  },
  inputEndIcon: {
    position: 'absolute',
    right: 12,
  },
  calendarIconBtn: {
    position: 'absolute',
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloodGroupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  clearBloodGroupText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '700',
  },
  bloodGroupRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -3,
  },
  bloodGroupChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBackground,
    marginHorizontal: 3,
    marginBottom: 6,
    minWidth: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloodGroupChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  bloodGroupChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textDark,
  },
  bloodGroupChipTextSelected: {
    color: Colors.white,
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
  intakeTypeChipPreBookedSelected: {
    backgroundColor: Colors.tint,
    borderColor: Colors.primary,
  },
  intakeTypeChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMedium,
  },
  intakeTypeChipTextSelected: {
    color: Colors.primary,
    fontWeight: '800',
  },
  intakeTypeChipTextPreBookedSelected: {
    color: Colors.primary,
    fontWeight: '800',
  },
  modeGuideWalkIn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.tint,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 10,
  },
  modeGuideTextWalkIn: {
    fontSize: 11,
    color: Colors.secondary,
    fontWeight: '500',
    flex: 1,
    lineHeight: 16,
  },
  modeGuidePreBooked: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.tint,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 10,
  },
  modeGuideTextPreBooked: {
    fontSize: 11,
    color: Colors.secondary,
    fontWeight: '500',
    flex: 1,
    lineHeight: 16,
  },
  preBookedLookupSection: {
    marginBottom: 14,
  },
  verifiedBookingCard: {
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.border,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    marginBottom: 4,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  verifiedBookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifiedBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
  changeBookingBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: Colors.tint,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  changeBookingBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  autoIssuedTokenHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.tint,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  autoIssuedTokenLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  autoIssuedCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  autoIssuedTokenTag: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textDark,
  },
  autoIssuedTokenNumberPill: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  autoIssuedTokenNumberText: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  verifiedBookingGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  verifiedBookingCol: {
    flex: 1,
    marginRight: 6,
  },
  verifiedBookingLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textLight,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  verifiedBookingValue: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textDark,
  },
  verifiedBookingSub: {
    fontSize: 11,
    color: Colors.textMedium,
    marginTop: 2,
  },
  preBookedSearchBox: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  preBookedInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    minHeight: 44,
    marginBottom: 10,
  },
  preBookedSearchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.textDark,
    paddingVertical: 8,
  },
  preBookedListWrap: {
    marginTop: 2,
  },
  preBookedListHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  preBookedListTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMedium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  preBookedRefreshText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  preBookedLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  preBookedLoadingText: {
    fontSize: 12,
    color: Colors.textLight,
    marginLeft: 8,
  },
  preBookedEmptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  preBookedEmptyText: {
    fontSize: 11,
    color: Colors.textLight,
    textAlign: 'center',
    marginTop: 4,
  },
  preBookedScroll: {
    flexDirection: 'row',
  },
  preBookedChipItem: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 10,
    marginRight: 8,
    width: 175,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  preBookedChipTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  preBookedChipRef: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  preBookedTokenPill: {
    backgroundColor: Colors.tint,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  preBookedTokenPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  preBookedChipTimeBadge: {
    backgroundColor: Colors.tint,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  preBookedChipTimeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.secondary,
  },
  preBookedTriageWrap: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  preBookedGuidanceCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.tint,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginTop: 12,
  },
  preBookedGuidanceTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 2,
  },
  preBookedGuidanceText: {
    fontSize: 11,
    color: Colors.secondary,
    lineHeight: 16,
  },
  preBookedChipPatient: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 2,
  },
  preBookedChipDoctor: {
    fontSize: 10,
    color: Colors.textMedium,
  },
  preBookedReservationNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.tint,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  preBookedReservationNoticeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    flex: 1,
  },
  submitButtonPreBooked: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
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
    backgroundColor: '#F0F9FF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E0F2FE',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    minHeight: 80,
    justifyContent: 'space-between',
  },
  departmentCardSelected: {
    borderColor: '#0284C7',
    backgroundColor: '#E0F2FE',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  deptCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  deptWaitTimeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  deptWaitTimeSelected: {
    color: '#0284C7',
    fontWeight: '700',
  },
  deptCardNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  deptCardNameSelected: {
    color: '#0369A1',
    fontWeight: '800',
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
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    flexDirection: 'column',
  },
  slotChipTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
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
  slotChipTextBooked: {
    color: '#DC2626',
    textDecorationLine: 'line-through',
  },
  slotChipTextDisabled: {
    color: '#9CA3AF',
  },
  slotBookedTag: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
  },
  slotBookedTagText: {
    fontSize: 7.5,
    fontWeight: '700',
    color: '#DC2626',
    textTransform: 'uppercase',
  },
  slotPastTagText: {
    fontSize: 7.5,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 2,
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
  /* ── Phone Verification & OTP Styles ── */
  phoneLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  phoneVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  phoneVerifiedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phoneInputVerified: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  verifyPhoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1.5,
    borderColor: '#99F6E4',
    paddingHorizontal: 12,
    height: 48,
    borderRadius: 12,
  },
  verifyPhoneBtnDone: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  verifyPhoneBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  verifyPhoneBtnTextDone: {
    color: '#059669',
  },
  /* ── SMS Delivered to Patient Card (Confirmation View) ── */
  smsDeliveredCard: {
    backgroundColor: '#F0FDFA',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#99F6E4',
    padding: 14,
    marginTop: 12,
    width: '100%',
  },
  smsDeliveredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  smsDeliveredTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smsDeliveredTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0D9488',
    letterSpacing: 0.5,
  },
  smsSentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  smsSentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0D9488',
    marginRight: 5,
  },
  smsSentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F766E',
  },
  smsMessageBox: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    marginBottom: 8,
  },
  smsMessageText: {
    fontSize: 12,
    color: '#1E293B',
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  smsFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smsTimestampText: {
    fontSize: 11,
    color: '#0F766E',
    fontWeight: '600',
  },
  /* ── Staff Success Feedback Modal ── */
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successModalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  successModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textDark,
    textAlign: 'center',
    marginBottom: 4,
  },
  successModalSubtitle: {
    fontSize: 12,
    color: Colors.textMedium,
    textAlign: 'center',
    marginBottom: 16,
  },
  successSummaryBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  successSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  successSummaryKey: {
    fontSize: 12,
    color: Colors.textLight,
    fontWeight: '600',
  },
  successSummaryVal: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textDark,
  },
  smsAlertCard: {
    width: '100%',
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#99F6E4',
    marginBottom: 18,
  },
  smsAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  smsAlertTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0D9488',
    letterSpacing: 0.5,
  },
  smsAlertText: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 16,
    marginBottom: 4,
  },
  smsAlertSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F766E',
  },
  successModalCloseBtn: {
    width: '100%',
    height: 46,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successModalCloseBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
  /* ── Step 1 Direct Register Action Styles ── */
  step1ActionBox: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  step1RegisterBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  step1RegisterBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.2,
  },
  step1RegisterHint: {
    fontSize: 11,
    color: Colors.textMedium,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
});

export default RegisterPatientScreen;
