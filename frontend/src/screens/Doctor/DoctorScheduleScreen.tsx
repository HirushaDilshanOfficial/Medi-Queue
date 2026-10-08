import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  Platform,
  useColorScheme,
  Animated,
  StatusBar,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../config';
import {
  HOSPITALS,
  HospitalInfo,
  ScheduleAppointment,
  AppointmentStatus,
  DaySchedule,
  INITIAL_SCHEDULE_DATA,
  REFERENCE_TODAY,
  WeekDayItem,
  getWeekDays,
  formatWeekRangeLabel,
  formatHeaderDate,
  parseDateKey,
  formatDateKey,
} from '../../services/scheduleData';

interface DoctorScheduleScreenProps {
  navigation?: any;
}

export default function DoctorScheduleScreen({ navigation }: DoctorScheduleScreenProps) {
  const { t } = useLanguage();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Theme definition
  const theme = useMemo(() => {
    if (isDark) {
      return {
        isDark: true,
        background: '#0e191b',
        pageBg: '#091012',
        card: '#16272a',
        cardBorder: '#1f383c',
        primary: '#146370',
        primaryDeep: '#0b4f5a',
        accent: '#22aab8',
        tint: '#1a373d',
        textDark: '#eef8fa',
        textMedium: '#b2c8cb',
        textMuted: '#7a969a',
        divider: '#20393d',
        weekendBg: '#132124',
        weekendBorder: '#233d42',
        inputBg: '#142326',
        modalOverlay: 'rgba(0, 0, 0, 0.75)',
        sheetBg: '#142427',
      };
    }
    return {
      isDark: false,
      background: '#eef6f8',
      pageBg: '#e2e8f0',
      card: '#ffffff',
      cardBorder: '#e1eff1',
      primary: '#0b4f5a',
      primaryDeep: '#0b4f5a',
      accent: '#0e8a96',
      tint: '#d9f2f5',
      textDark: '#08252b',
      textMedium: '#31555c',
      textMuted: '#688990',
      divider: '#e2eff1',
      weekendBg: '#f6fbfb',
      weekendBorder: '#d4e7e9',
      inputBg: '#f8fafc',
      modalOverlay: 'rgba(8, 37, 43, 0.45)',
      sheetBg: '#ffffff',
    };
  }, [isDark]);

  // Inject Lexend Google font on web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      if (!document.getElementById('lexend-google-font')) {
        const link = document.createElement('link');
        link.id = 'lexend-google-font';
        link.rel = 'stylesheet';
        link.href =
          'https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;800&display=swap';
        document.head.appendChild(link);
      }
    }
  }, []);

  // ─────────────────────────────────────────────────────────
  // STATE MANAGEMENT
  // ─────────────────────────────────────────────────────────

  // Selected date key (Defaults to Oct 6, 2026 - Tue)
  const [selectedDateKey, setSelectedDateKey] = useState<string>(REFERENCE_TODAY);
  const isTodaySelected = selectedDateKey === REFERENCE_TODAY;

  // Relative day label for the selected date:
  // - Day before current day (yesterday): "Yesterday"
  // - Current day (today): "Today"
  // - Day after current day (tomorrow): "Tomorrow"
  // - Other dates: null (nothing shown)
  const relativeDateLabel = useMemo(() => {
    const selectedD = parseDateKey(selectedDateKey);
    const todayD = parseDateKey(REFERENCE_TODAY);
    const selectedUtc = Date.UTC(selectedD.getFullYear(), selectedD.getMonth(), selectedD.getDate());
    const todayUtc = Date.UTC(todayD.getFullYear(), todayD.getMonth(), todayD.getDate());
    const diffDays = Math.round((selectedUtc - todayUtc) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays === 1) return 'Tomorrow';
    return null;
  }, [selectedDateKey]);
  // Current week anchor date (used to calculate Mon-Sun strip)
  const [weekAnchorDate, setWeekAnchorDate] = useState<Date>(() => parseDateKey(REFERENCE_TODAY));

  // Schedule appointments stored in mutable state for walk-in additions
  const [scheduleData, setScheduleData] = useState<Record<string, DaySchedule>>(
    INITIAL_SCHEDULE_DATA
  );

  // Remaining walk-in allocations per hospital (today)
  const [walkInAllocations, setWalkInAllocations] = useState<Record<string, number>>({
    cgh: HOSPITALS.cgh.walkInCapacity,
    lakeview: HOSPITALS.lakeview.walkInCapacity,
    'st-lucia': HOSPITALS['st-lucia'].walkInCapacity,
  });

  // Filter state
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>('all');
  const [isHospitalDropdownOpen, setIsHospitalDropdownOpen] = useState(false);
  const [showAllShiftsOverview, setShowAllShiftsOverview] = useState(false);

  // Selected patient for bottom detail sheet
  const [selectedPatient, setSelectedPatient] = useState<ScheduleAppointment | null>(null);

  // Active bottom navigation tab
  const [activeTab, setActiveTab] = useState<'home' | 'queue' | 'records' | 'schedule' | 'rx'>(
    'schedule'
  );

  // Break state & dropdown options (Tea break, Lunch break, Dinner break)
  const [activeBreak, setActiveBreak] = useState<{
    type: 'tea' | 'lunch' | 'dinner';
    label: string;
    duration: string;
    minutes: number;
    hospitalId: string;
    hospitalName: string;
    shiftName: string;
    startTime: number;
  } | null>(null);
  const [openBreakDropdownHospId, setOpenBreakDropdownHospId] = useState<string | null>(null);

  // Helper: Get shift-specific break options according to hospital/shift time:
  // - Morning shift: Tea break (15 mins) & Lunch break (1 hour)
  // - Afternoon shift: Tea break (15 mins) only
  // - Evening/Night shift: Tea break (15 mins) & Dinner break (1 hour)
  const getBreakOptionsForHospital = useCallback((hosp: HospitalInfo) => {
    const sName = (hosp.shiftName || '').toLowerCase();
    const hId = (hosp.id || '').toLowerCase();

    const teaOption = {
      type: 'tea' as const,
      label: 'Tea break',
      duration: '15 mins',
      minutes: 15,
      sub: '15 min rest & tea',
      iconName: 'coffee',
    };

    const lunchOption = {
      type: 'lunch' as const,
      label: 'Lunch break',
      duration: '1 hour',
      minutes: 60,
      sub: '1 hour meal break',
      iconName: 'food-variant',
    };

    const dinnerOption = {
      type: 'dinner' as const,
      label: 'Dinner break',
      duration: '1 hour',
      minutes: 60,
      sub: '1 hour dinner break',
      iconName: 'food-fork-drink',
    };

    // Morning shift: Tea break and Lunch break
    if (hId === 'cgh' || sName.includes('morning')) {
      return [teaOption, lunchOption];
    }

    // Afternoon shift: Tea break only
    if (hId === 'lakeview' || sName.includes('afternoon')) {
      return [teaOption];
    }

    // Night / Evening shift: Tea break and Dinner break
    if (hId === 'st-lucia' || sName.includes('evening') || sName.includes('night')) {
      return [teaOption, dinnerOption];
    }

    return [teaOption];
  }, []);

  // Load saved break on screen focus
  const loadActiveBreak = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('@medi_queue_doctor_break');
      if (raw) {
        setActiveBreak(JSON.parse(raw));
      } else {
        setActiveBreak(null);
      }
    } catch (e) {
      setActiveBreak(null);
    }
  }, []);

  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);

  // Fetch real schedule from backend database for the selected dateKey
  const fetchScheduleForDate = useCallback(async (dateKey: string) => {
    try {
      setIsLoadingSchedule(true);
      const res = await fetch(`${API_URL}/doctor/schedule?dateKey=${dateKey}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const daySchedule: DaySchedule = {
            dateKey: json.data.dateKey || dateKey,
            hospitals: json.data.hospitals || [],
            appointments: json.data.appointments || [],
          };
          setScheduleData((prev) => ({
            ...prev,
            [dateKey]: daySchedule,
          }));
          return;
        }
      }
    } catch (e) {
      console.warn('Error fetching doctor schedule for date:', dateKey, e);
    } finally {
      setIsLoadingSchedule(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadActiveBreak();
      fetchScheduleForDate(selectedDateKey);
    }, [loadActiveBreak, fetchScheduleForDate, selectedDateKey])
  );

  const handleSelectBreak = async (type: 'tea' | 'lunch' | 'dinner', hosp: HospitalInfo) => {
    let label = 'Tea Break';
    let duration = '15 mins';
    let minutes = 15;
    if (type === 'lunch') {
      label = 'Lunch Break';
      duration = '1 hour';
      minutes = 60;
    } else if (type === 'dinner') {
      label = 'Dinner Break';
      duration = '1 hour';
      minutes = 60;
    }

    const breakData = {
      type,
      label,
      duration,
      minutes,
      hospitalId: hosp.id,
      hospitalName: hosp.name,
      shiftName: hosp.shiftName,
      startTime: Date.now(),
    };
    setActiveBreak(breakData);
    setOpenBreakDropdownHospId(null);
    await AsyncStorage.setItem('@medi_queue_doctor_break', JSON.stringify(breakData));
    showToast(
      `✓ ${breakData.label} (${breakData.duration}) scheduled for ${hosp.shiftName}`
    );
  };

  const handleEndBreak = async (hosp: HospitalInfo) => {
    setActiveBreak(null);
    setOpenBreakDropdownHospId(null);
    await AsyncStorage.removeItem('@medi_queue_doctor_break');
    showToast(`Break ended. Resumed ${hosp.shiftName}`);
  };

  // Consultation elapsed counter for active patient
  const [elapsedMinutes, setElapsedMinutes] = useState(6);

  // Toast feedback system
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastFade] = useState(new Animated.Value(0));

  // Walk-in Registration Modal state
  const [isWalkInModalVisible, setIsWalkInModalVisible] = useState(false);
  const [walkInName, setWalkInName] = useState('');
  const [walkInAge, setWalkInAge] = useState('');
  const [walkInGender, setWalkInGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [walkInHospitalId, setWalkInHospitalId] = useState<string>('cgh');
  const [walkInReason, setWalkInReason] = useState('');
  const [walkInErrors, setWalkInErrors] = useState<{
    name?: string;
    age?: string;
    hospital?: string;
    reason?: string;
  }>({});

  // 1. Delete Confirmation Modal state
  const [walkInToDelete, setWalkInToDelete] = useState<ScheduleAppointment | null>(null);
  const [isRemoveModalVisible, setIsRemoveModalVisible] = useState(false);

  // 2. Edit Available Slots Modal state
  const [isEditSlotsModalVisible, setIsEditSlotsModalVisible] = useState(false);
  const [editSlotsHospitalId, setEditSlotsHospitalId] = useState<string>('cgh');
  const [editSlotsCount, setEditSlotsCount] = useState<number>(5);
  const [isEditSlotsHospDropdownOpen, setIsEditSlotsHospDropdownOpen] = useState(false);

  // 3. Edit Walk-in Slot (Appointment) Modal state
  const [isEditWalkInModalVisible, setIsEditWalkInModalVisible] = useState(false);
  const [editingWalkInAppt, setEditingWalkInAppt] = useState<ScheduleAppointment | null>(null);
  const [editPatientName, setEditPatientName] = useState('');
  const [editPatientAge, setEditPatientAge] = useState('');
  const [editPatientGender, setEditPatientGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [editPatientTime, setEditPatientTime] = useState('');
  const [editPatientReason, setEditPatientReason] = useState('');
  const [editPatientStatus, setEditPatientStatus] = useState<AppointmentStatus>('Waiting');

  // Fetch schedule whenever selectedDateKey changes
  useEffect(() => {
    fetchScheduleForDate(selectedDateKey);
  }, [selectedDateKey, fetchScheduleForDate]);

  // Load persisted walk-in allocations on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const storedAllocations = await AsyncStorage.getItem('@medi_queue_walkin_allocations');
        if (storedAllocations && isMounted) {
          const parsed = JSON.parse(storedAllocations);
          if (parsed && typeof parsed === 'object') {
            setWalkInAllocations((prev) => ({ ...prev, ...parsed }));
          }
        }
      } catch (e) {
        console.warn('Error loading schedule storage:', e);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const showToast = useCallback(
    (msg: string) => {
      setToastMessage(msg);
      Animated.sequence([
        Animated.timing(toastFade, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.delay(2400),
        Animated.timing(toastFade, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setToastMessage(null);
      });
    },
    [toastFade]
  );

  // Handle escape key on web to close modals & dropdown
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setSelectedPatient(null);
          setIsHospitalDropdownOpen(false);
          setIsWalkInModalVisible(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, []);

  // Increment consultation elapsed timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedMinutes((prev) => prev + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // ─────────────────────────────────────────────────────────
  // WEEK STRIP LOGIC
  // ─────────────────────────────────────────────────────────

  // 7 days for the current anchor week
  const weekDays = useMemo(() => {
    return getWeekDays(weekAnchorDate);
  }, [weekAnchorDate]);

  // Week range label (e.g. "Oct 5 – 11, 2026")
  const weekRangeLabel = useMemo(() => {
    return formatWeekRangeLabel(weekDays);
  }, [weekDays]);

  // Navigate to previous week
  const handlePrevWeek = () => {
    const newAnchor = new Date(weekAnchorDate);
    newAnchor.setDate(newAnchor.getDate() - 7);
    setWeekAnchorDate(newAnchor);

    // Keep the same weekday selected
    const selectedD = parseDateKey(selectedDateKey);
    const dayOfWeek = selectedD.getDay(); // 0 = Sun, 1 = Mon...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const newMonday = new Date(newAnchor);
    const newAnchorDayOfWeek = newAnchor.getDay();
    const anchorMonOffset = newAnchorDayOfWeek === 0 ? -6 : 1 - newAnchorDayOfWeek;
    newMonday.setDate(newAnchor.getDate() + anchorMonOffset);

    const targetDayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const newSelected = new Date(newMonday);
    newSelected.setDate(newMonday.getDate() + targetDayIndex);
    const newKey = formatDateKey(newSelected);
    setSelectedDateKey(newKey);
    setSelectedHospitalId('all'); // Reset filter on day change
    setShowAllShiftsOverview(false);
    setIsHospitalDropdownOpen(false);
  };

  // Navigate to next week
  const handleNextWeek = () => {
    const newAnchor = new Date(weekAnchorDate);
    newAnchor.setDate(newAnchor.getDate() + 7);
    setWeekAnchorDate(newAnchor);

    // Keep the same weekday selected
    const selectedD = parseDateKey(selectedDateKey);
    const dayOfWeek = selectedD.getDay();
    const newMonday = new Date(newAnchor);
    const newAnchorDayOfWeek = newAnchor.getDay();
    const anchorMonOffset = newAnchorDayOfWeek === 0 ? -6 : 1 - newAnchorDayOfWeek;
    newMonday.setDate(newAnchor.getDate() + anchorMonOffset);

    const targetDayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const newSelected = new Date(newMonday);
    newSelected.setDate(newMonday.getDate() + targetDayIndex);
    const newKey = formatDateKey(newSelected);
    setSelectedDateKey(newKey);
    setSelectedHospitalId('all'); // Reset filter on day change
    setShowAllShiftsOverview(false);
    setIsHospitalDropdownOpen(false);
  };

  // Jump to Today (Tue Oct 6, 2026)
  const handleJumpToday = () => {
    const today = parseDateKey(REFERENCE_TODAY);
    setWeekAnchorDate(today);
    setSelectedDateKey(REFERENCE_TODAY);
    setSelectedHospitalId('all');
    setShowAllShiftsOverview(false);
    setIsHospitalDropdownOpen(false);
    showToast('Jumped to Today (Oct 6, 2026)');
  };

  // Select day on week strip
  const handleSelectDay = (key: string) => {
    setSelectedDateKey(key);
    setSelectedHospitalId('all'); // Resets to "All hospitals" when day changes
    setShowAllShiftsOverview(false);
    setIsHospitalDropdownOpen(false);
  };

  // ─────────────────────────────────────────────────────────
  // CURRENT DAY DATA & FILTERING
  // ─────────────────────────────────────────────────────────

  const currentDayData: DaySchedule = useMemo(() => {
    return (
      scheduleData[selectedDateKey] || {
        dateKey: selectedDateKey,
        hospitals: [],
        appointments: [],
      }
    );
  }, [scheduleData, selectedDateKey]);

  // Is current day a leave day?
  const isLeaveDay = Boolean(currentDayData.isLeave);

  // Hospitals active on current day
  const dayHospitals = useMemo(() => {
    return (currentDayData.hospitals || [])
      .map((hid) => HOSPITALS[hid])
      .filter(Boolean);
  }, [currentDayData]);

  // Appointments for the day
  const dayAppointments = useMemo(() => {
    return currentDayData.appointments || [];
  }, [currentDayData]);

  // Active hospital for the current view (matching the displayed shift)
  const currentActiveHospitalId = useMemo(() => {
    if (dayHospitals.length === 0) return 'cgh';
    const activeHosp =
      dayHospitals.find((h) => (isTodaySelected ? h.id === 'cgh' : false)) ||
      dayHospitals[0];
    return activeHosp?.id || 'cgh';
  }, [dayHospitals, isTodaySelected]);

  // Filtered appointments based on hospital dropdown:
  // User instruction: "time line eke show wenna one related hospital eke patints la"
  // Shows ONLY the related hospital's patients!
  const filteredAppointments = useMemo(() => {
    if (selectedHospitalId !== 'all') {
      return dayAppointments.filter((a) => a.hospitalId === selectedHospitalId);
    }
    if (showAllShiftsOverview) {
      return dayAppointments;
    }
    // Default view: Show ONLY the related hospital's patients (matches current active shift)
    return dayAppointments.filter((a) => a.hospitalId === currentActiveHospitalId);
  }, [dayAppointments, selectedHospitalId, showAllShiftsOverview, currentActiveHospitalId]);

  // Filtered shift cards based on hospital dropdown
  const filteredHospitals = useMemo(() => {
    if (selectedHospitalId === 'all') {
      return dayHospitals;
    }
    return dayHospitals.filter((h) => h.id === selectedHospitalId);
  }, [dayHospitals, selectedHospitalId]);

  // Displayed shift cards:
  // User requirement: "default current shift eka witharak show wenna thiyanna. anith ewa doctorta fileter option eken fileter kalama balanna puluwan wena vidihata"
  // By default (when 'all' is selected), only show the CURRENT active shift!
  // When filtered to a specific hospital, show that hospital's shift.
  const displayedShiftHospitals = useMemo(() => {
    if (selectedHospitalId !== 'all') {
      return dayHospitals.filter((h) => h.id === selectedHospitalId);
    }
    if (showAllShiftsOverview) {
      return dayHospitals;
    }
    if (dayHospitals.length === 0) return [];

    // Find the currently active shift (In progress on today, or first shift of the day)
    const activeHosp =
      dayHospitals.find((h) => (isTodaySelected ? h.id === 'cgh' : false)) ||
      dayHospitals[0];

    return activeHosp ? [activeHosp] : [];
  }, [dayHospitals, selectedHospitalId, showAllShiftsOverview, isTodaySelected]);

  // Patient now attending (if any in filtered list)
  const nowAttendingPatient = useMemo(() => {
    return filteredAppointments.find((a) => a.status === 'Now attending');
  }, [filteredAppointments]);

  // Other appointments (Done, Waiting, Scheduled)
  const regularAppointments = useMemo(() => {
    return filteredAppointments.filter((a) => a.status !== 'Now attending');
  }, [filteredAppointments]);

  // ─────────────────────────────────────────────────────────
  // WALK-IN SLOT HANDLER (POPUP FORM MODAL)
  // Form fields: Patient Name, Age, Gender, Hospital, Reason
  // ─────────────────────────────────────────────────────────

  const handleOpenWalkInModal = () => {
    if (selectedDateKey !== REFERENCE_TODAY) {
      showToast('Walk-ins can only be added for Today (Oct 6)');
      return;
    }
    if (isLeaveDay) {
      showToast('Doctor is on leave. Walk-in slots blocked');
      return;
    }
    if (dayHospitals.length === 0) {
      showToast('No clinics scheduled today');
      return;
    }

    // Determine target hospital
    const validHospWithSlots = dayHospitals.find(
      (h) => (walkInAllocations[h.id] ?? 0) > 0
    );
    const targetHospId =
      selectedHospitalId !== 'all' && (walkInAllocations[selectedHospitalId] ?? 0) > 0
        ? selectedHospitalId
        : validHospWithSlots?.id || dayHospitals[0]?.id || 'cgh';

    setWalkInHospitalId(targetHospId);
    setWalkInName('');
    setWalkInAge('');
    setWalkInGender('Male');
    setWalkInReason('');
    setWalkInErrors({});
    setIsWalkInModalVisible(true);
  };

  const handleCloseWalkInModal = () => {
    setIsWalkInModalVisible(false);
    setWalkInErrors({});
  };

  const handleSubmitWalkInSlot = () => {
    const errs: { name?: string; age?: string; hospital?: string; reason?: string } = {};

    const trimmedName = walkInName.trim();
    if (!trimmedName) {
      errs.name = 'Patient name is required';
    } else if (trimmedName.length < 2) {
      errs.name = 'Name must be at least 2 characters';
    }

    const trimmedAge = walkInAge.trim();
    const ageNum = parseInt(trimmedAge, 10);
    if (!trimmedAge) {
      errs.age = 'Patient age is required';
    } else if (isNaN(ageNum) || ageNum <= 0 || ageNum > 120) {
      errs.age = 'Please enter a valid age (1 - 120)';
    }

    if (!walkInHospitalId) {
      errs.hospital = 'Please select a hospital';
    } else {
      const remaining = walkInAllocations[walkInHospitalId] ?? 0;
      if (remaining <= 0) {
        const hName = HOSPITALS[walkInHospitalId]?.shortName || 'Selected hospital';
        errs.hospital = `No walk-in slots remaining for ${hName}`;
      }
    }

    const trimmedReason = walkInReason.trim();
    if (!trimmedReason) {
      errs.reason = 'Reason for consultation is required';
    }

    if (Object.keys(errs).length > 0) {
      setWalkInErrors(errs);
      return;
    }

    // Decrement allocation for selected hospital
    setWalkInAllocations((prev) => ({
      ...prev,
      [walkInHospitalId]: Math.max(0, (prev[walkInHospitalId] || 0) - 1),
    }));

    // Generate Token Number
    const daySchedule = scheduleData[selectedDateKey] || {
      dateKey: selectedDateKey,
      hospitals: dayHospitals.map((h) => h.id),
      appointments: [],
    };
    const walkInsCount = daySchedule.appointments.filter(
      (a) => a.isWalkIn || a.id.startsWith('walkin-')
    ).length;
    const walkInTokenNum = 70 + walkInsCount + Math.floor(Math.random() * 10);
    const tokenStr = `Token #${String(walkInTokenNum).padStart(3, '0')}`;

    // Current time formatted
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    const timeStr = `${String(formattedHours).padStart(2, '0')}:${formattedMinutes} ${ampm}`;

    const newAppointment: ScheduleAppointment = {
      id: `walkin-${Date.now()}`,
      time: timeStr,
      patientName: trimmedName,
      reason: trimmedReason,
      token: tokenStr,
      status: 'Waiting',
      hospitalId: walkInHospitalId,
      age: ageNum,
      sex: walkInGender,
      bloodGroup: 'B+',
      nic: `2000${Math.floor(10000000 + Math.random() * 90000000)}`,
      phone: `077 ${Math.floor(100 + Math.random() * 900)} ${Math.floor(1000 + Math.random() * 9000)}`,
      isWalkIn: true,
    };

    setScheduleData((prev) => {
      const existing = prev[selectedDateKey] || {
        dateKey: selectedDateKey,
        hospitals: dayHospitals.map((h) => h.id),
        appointments: [],
      };
      return {
        ...prev,
        [selectedDateKey]: {
          ...existing,
          appointments: [...existing.appointments, newAppointment],
        },
      };
    });

    setIsWalkInModalVisible(false);
    const hosp = HOSPITALS[walkInHospitalId];
    showToast(`✓ Added walk-in: ${trimmedName} (${tokenStr}) at ${hosp?.shortName || ''}`);
  };

  // ─────────────────────────────────────────────────────────
  // WALK-IN REMOVAL & AVAILABLE SLOTS EDITING HANDLERS
  // ─────────────────────────────────────────────────────────

  // Open Delete Confirmation Modal
  const handleOpenRemoveModal = (appt: ScheduleAppointment) => {
    setWalkInToDelete(appt);
    setIsRemoveModalVisible(true);
  };

  // Perform actual removal
  const executeRemoveWalkIn = (appt: ScheduleAppointment) => {
    // 1. Remove from schedule appointments
    setScheduleData((prev) => {
      const daySchedule = prev[selectedDateKey];
      if (!daySchedule) return prev;
      const updated = {
        ...prev,
        [selectedDateKey]: {
          ...daySchedule,
          appointments: daySchedule.appointments.filter((a) => a.id !== appt.id),
        },
      };
      try {
        AsyncStorage.setItem(`@medi_queue_schedule_data_${selectedDateKey}`, JSON.stringify(updated));
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(`@medi_queue_schedule_data_${selectedDateKey}`, JSON.stringify(updated));
        }
      } catch (e) {}
      return updated;
    });

    // 2. Restore walk-in allocation count
    if (appt.hospitalId) {
      setWalkInAllocations((prev) => {
        const currentCount = prev[appt.hospitalId] ?? 0;
        const updated = {
          ...prev,
          [appt.hospitalId]: currentCount + 1,
        };
        try {
          AsyncStorage.setItem('@medi_queue_walkin_allocations', JSON.stringify(updated));
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem('@medi_queue_walkin_allocations', JSON.stringify(updated));
          }
        } catch (e) {}
        return updated;
      });
    }

    if (selectedPatient?.id === appt.id) {
      setSelectedPatient(null);
    }

    setIsRemoveModalVisible(false);
    setWalkInToDelete(null);

    showToast(`✓ Removed walk-in slot (${appt.token}). Allocation restored.`);
  };

  // Backward compatibility alias
  const handleConfirmRemoveWalkIn = (appt: ScheduleAppointment) => {
    handleOpenRemoveModal(appt);
  };

  // Open Edit Available Slots Modal
  const handleOpenEditSlotsModal = (hospId: string = 'cgh') => {
    setEditSlotsHospitalId(hospId);
    setEditSlotsCount(walkInAllocations[hospId] ?? (HOSPITALS[hospId]?.walkInCapacity || 5));
    setIsEditSlotsHospDropdownOpen(false);
    setIsEditSlotsModalVisible(true);
  };

  // Quick inline increment / decrement of available slots
  const handleAdjustAllocation = (hospId: string, delta: number) => {
    setWalkInAllocations((prev) => {
      const current = prev[hospId] ?? (HOSPITALS[hospId]?.walkInCapacity || 5);
      const nextCount = Math.max(0, current + delta);
      const updated = {
        ...prev,
        [hospId]: nextCount,
      };
      try {
        AsyncStorage.setItem('@medi_queue_walkin_allocations', JSON.stringify(updated));
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('@medi_queue_walkin_allocations', JSON.stringify(updated));
        }
      } catch (e) {}
      return updated;
    });
    const hName = HOSPITALS[hospId]?.shortName || 'Clinic';
    showToast(`Updated ${hName} available slots`);
  };

  // Save Available Slots Modal
  const handleSaveAvailableSlots = () => {
    const validCount = Math.max(0, editSlotsCount);
    setWalkInAllocations((prev) => {
      const updated = {
        ...prev,
        [editSlotsHospitalId]: validCount,
      };
      try {
        AsyncStorage.setItem('@medi_queue_walkin_allocations', JSON.stringify(updated));
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('@medi_queue_walkin_allocations', JSON.stringify(updated));
        }
      } catch (e) {}
      return updated;
    });

    setIsEditSlotsModalVisible(false);
    const hName = HOSPITALS[editSlotsHospitalId]?.shortName || 'Clinic';
    showToast(`✓ Available slots updated: ${hName} set to ${validCount} slots`);
  };

  // Open Edit Walk-in Patient Modal
  const handleOpenEditWalkInModal = (appt: ScheduleAppointment) => {
    setEditingWalkInAppt(appt);
    setEditPatientName(appt.patientName);
    setEditPatientAge(String(appt.age || ''));
    setEditPatientGender(appt.sex || 'Male');
    setEditPatientTime(appt.time || '');
    setEditPatientReason(appt.reason || '');
    setEditPatientStatus(appt.status || 'Waiting');
    setIsEditWalkInModalVisible(true);
  };

  // Save Edited Walk-in Patient
  const handleSaveEditedWalkIn = () => {
    if (!editingWalkInAppt) return;
    const trimmedName = editPatientName.trim();
    if (!trimmedName) {
      showToast('Patient name cannot be empty');
      return;
    }
    const ageNum = parseInt(editPatientAge, 10) || editingWalkInAppt.age;

    setScheduleData((prev) => {
      const daySchedule = prev[selectedDateKey];
      if (!daySchedule) return prev;
      const updated = {
        ...prev,
        [selectedDateKey]: {
          ...daySchedule,
          appointments: daySchedule.appointments.map((a) => {
            if (a.id !== editingWalkInAppt.id) return a;
            return {
              ...a,
              patientName: trimmedName,
              age: ageNum,
              sex: editPatientGender,
              time: editPatientTime.trim() || a.time,
              reason: editPatientReason.trim() || a.reason,
              status: editPatientStatus,
            };
          }),
        },
      };
      try {
        AsyncStorage.setItem(`@medi_queue_schedule_data_${selectedDateKey}`, JSON.stringify(updated));
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(`@medi_queue_schedule_data_${selectedDateKey}`, JSON.stringify(updated));
        }
      } catch (e) {}
      return updated;
    });

    setIsEditWalkInModalVisible(false);
    setEditingWalkInAppt(null);
    showToast(`✓ Updated slot for ${trimmedName}`);
  };

  // ─────────────────────────────────────────────────────────
  // BOTTOM TAB NAVIGATION
  // User instruction: "mage araginal navigation bar eke icon change karanna epa"
  // Keep original icons:
  // Home: Ionicons 'home-outline'
  // Queue: MaterialCommunityIcons 'ticket-confirmation-outline'
  // Records: MaterialCommunityIcons 'folder-account-outline'
  // Schedule: MaterialCommunityIcons 'calendar-month-outline'
  // Prescription: MaterialCommunityIcons 'clipboard-edit-outline'
  // ─────────────────────────────────────────────────────────
  const handleTabPress = (tab: 'home' | 'queue' | 'records' | 'schedule' | 'rx') => {
    setActiveTab(tab);
    if (tab === 'schedule') {
      showToast('Viewing My Schedule');
      return;
    }
    if (tab === 'home') {
      try {
        router.push('/(doctor)/dashboard' as any);
      } catch (e) {
        showToast('Switched to Home Dashboard');
      }
    } else if (tab === 'queue') {
      try {
        router.push('/(doctor)/queue' as any);
      } catch (e) {
        showToast('Switched to Live Queue');
      }
    } else if (tab === 'records') {
      try {
        router.push('/(doctor)/records' as any);
      } catch (e) {
        showToast('Switched to Patient Records');
      }
    } else if (tab === 'rx') {
      try {
        router.push('/(doctor)/prescription' as any);
      } catch (e) {
        showToast('Switched to Prescription');
      }
    }
  };

  // Current formatted time for timeline header (today only)

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: isDark ? theme.pageBg : theme.pageBg },
      ]}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      {/* Centered responsive frame: 440px max width on desktop, full width on mobile */}
      <View
        style={[
          styles.outerFrame,
          { backgroundColor: isDark ? theme.pageBg : theme.pageBg },
        ]}
      >
        <View
          style={[
            styles.mobileContainer,
            { backgroundColor: theme.background },
          ]}
        >
          {/* Main Scroll Content */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* ─────────────────────────────────────────────────────────
                1. HEADER
                Doctor avatar (initials) with green online dot,
                "Dr. Emilia Emelson", "Room 3B online", notification bell
               ───────────────────────────────────────────────────────── */}
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <TouchableOpacity
                  onPress={() => router.push('/(doctor)/dashboard' as any)}
                  style={styles.homeBackBtn}
                  activeOpacity={0.7}
                  accessibilityLabel={t("Back to Home")}
                  accessibilityRole="button"
                >
                  <Ionicons name="home" size={18} color="#0D9488" />
                </TouchableOpacity>
                {/* Doctor Avatar with online badge */}
                <View style={styles.avatarWrapper}>
                  <View
                    style={[
                      styles.avatarBadge,
                      { backgroundColor: theme.primaryDeep },
                    ]}
                  >
                    <Text style={styles.avatarInitials}>EE</Text>
                  </View>
                  <View style={styles.onlineDot} />
                </View>

                {/* Doctor Name & Subtitle */}
                <View style={styles.doctorInfo}>
                  <Text
                    style={[styles.doctorName, { color: theme.textDark }]}
                    numberOfLines={1}
                  >
                    Dr. Emilia Emelson
                  </Text>
                  <View style={styles.doctorSubRow}>
                    <View style={styles.onlineMiniDot} />
                    <Text
                      style={[styles.doctorSubtitle, { color: theme.textMuted }]}
                    >
                      Room 3B online
                    </Text>
                  </View>
                </View>
              </View>

              {/* Notification Bell */}
              <TouchableOpacity
                style={[
                  styles.bellButton,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.cardBorder,
                  },
                ]}
                activeOpacity={0.7}
                onPress={() => showToast('Notifications: No new alerts')}
              >
                <Ionicons
                  name="notifications-outline"
                  size={20}
                  color={theme.textDark}
                />
                <View style={styles.redDot} />
              </TouchableOpacity>
            </View>

            {/* ─────────────────────────────────────────────────────────
                2. TODAY'S DATE & SCREEN TITLE
                Small teal text with calendar icon ("TUESDAY, OCT 6, 2026")
                Large title "My schedule" + round filter button
               ───────────────────────────────────────────────────────── */}
            <View style={styles.titleSection}>
              <View style={styles.dateBadgeRow}>
                <Ionicons
                  name="calendar-outline"
                  size={13}
                  color={theme.accent}
                  style={{ marginRight: 5 }}
                />
                <Text
                  style={[styles.headerDateLabel, { color: theme.accent }]}
                >
                  {formatHeaderDate(selectedDateKey)}
                </Text>
              </View>

              <View style={styles.titleRow}>
                <Text
                  style={[styles.screenTitle, { color: theme.textDark }]}
                >
                  My schedule
                </Text>

                {/* Filter icon button: shows or hides hospital dropdown */}
                <TouchableOpacity
                  style={[
                    styles.filterButton,
                    isHospitalDropdownOpen && styles.filterButtonActive,
                    {
                      backgroundColor: isHospitalDropdownOpen
                        ? theme.primaryDeep
                        : theme.card,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                  activeOpacity={0.8}
                  onPress={() =>
                    setIsHospitalDropdownOpen(!isHospitalDropdownOpen)
                  }
                >
                  <MaterialCommunityIcons
                    name="filter-variant"
                    size={20}
                    color={
                      isHospitalDropdownOpen ? '#ffffff' : theme.textDark
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* ─────────────────────────────────────────────────────────
                3. WEEK STRIP
                - Row: < | "Oct 5 – 11, 2026" | > | "Today"
                - 7 day boxes, Mon to Sun
                - Selected day: dark teal fill (#0b4f5a) with white text
                - Today: small underline
                - Sat & Sun: lighter dashed style when not selected
                - Leave day: small "off" label
               ───────────────────────────────────────────────────────── */}
            <View
              style={[
                styles.weekStripContainer,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              {/* Top controls: prev arrow, week range, next arrow, Today pill */}
              <View style={styles.weekControlRow}>
                <View style={styles.weekNavGroup}>
                  <TouchableOpacity
                    style={[
                      styles.weekNavArrow,
                      { backgroundColor: theme.tint },
                    ]}
                    onPress={handlePrevWeek}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={16}
                      color={theme.primaryDeep}
                    />
                  </TouchableOpacity>

                  <Text
                    style={[styles.weekRangeText, { color: theme.textDark }]}
                  >
                    {weekRangeLabel}
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.weekNavArrow,
                      { backgroundColor: theme.tint },
                    ]}
                    onPress={handleNextWeek}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={theme.primaryDeep}
                    />
                  </TouchableOpacity>
                </View>

                {/* Relative Date Indicator (Today / Yesterday / Tomorrow; hidden for other dates) */}
                {relativeDateLabel ? (
                  <TouchableOpacity
                    style={[
                      styles.todayPill,
                      {
                        backgroundColor:
                          relativeDateLabel === 'Today'
                            ? theme.primaryDeep
                            : theme.tint,
                      },
                    ]}
                    onPress={handleJumpToday}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={
                      relativeDateLabel === 'Today'
                        ? 'Current day selected'
                        : `Selected: ${relativeDateLabel}. Tap to jump to Today`
                    }
                  >
                    <Text
                      style={[
                        styles.todayPillText,
                        {
                          color:
                            relativeDateLabel === 'Today'
                              ? '#ffffff'
                              : theme.primaryDeep,
                        },
                      ]}
                    >
                      {relativeDateLabel}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ width: 1 }} />
                )}
              </View>

              {/* 7 Days Row */}
              <View style={styles.daysRow}>
                {weekDays.map((item: WeekDayItem) => {
                  const isSelected = item.dateKey === selectedDateKey;

                  return (
                    <TouchableOpacity
                      key={item.dateKey}
                      activeOpacity={0.8}
                      onPress={() => handleSelectDay(item.dateKey)}
                      style={[
                        styles.dayBox,
                        isSelected && [
                          styles.dayBoxSelected,
                          { backgroundColor: theme.primaryDeep },
                        ],
                        !isSelected &&
                          item.isWeekend && [
                            styles.dayBoxWeekend,
                            {
                              backgroundColor: theme.weekendBg,
                              borderColor: theme.weekendBorder,
                            },
                          ],
                        !isSelected &&
                          !item.isWeekend && {
                            borderColor: theme.cardBorder,
                          },
                      ]}
                    >
                      {/* Leave "off" label tag */}
                      {item.isLeave && (
                        <View style={styles.leaveOffBadge}>
                          <Text style={styles.leaveOffText}>off</Text>
                        </View>
                      )}

                      <Text
                        style={[
                          styles.dayWeekday,
                          isSelected
                            ? styles.dayTextSelected
                            : { color: theme.textMuted },
                        ]}
                      >
                        {item.dayLabel}
                      </Text>

                      <Text
                        style={[
                          styles.dayDateNum,
                          isSelected
                            ? styles.dayTextSelectedBold
                            : { color: theme.textDark },
                        ]}
                      >
                        {item.dateNum}
                      </Text>

                      {/* Small underline indicator for Today */}
                      {item.isToday && (
                        <View
                          style={[
                            styles.todayUnderline,
                            {
                              backgroundColor: isSelected
                                ? '#ffffff'
                                : theme.accent,
                            },
                          ]}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ─────────────────────────────────────────────────────────
                4. HOSPITAL DROPDOWN
                - Full-width button, pill-like, with colored dot, hospital name, chevron
                - Shows options: "All hospitals" + each hospital with shifts today
                - Shows hospital name, room, appointment count on right
                - Closes on outside tap or Escape
                - Resets to "All hospitals" when day changes
               ───────────────────────────────────────────────────────── */}
            <View style={styles.dropdownWrapper}>
              <TouchableOpacity
                style={[
                  styles.dropdownPillButton,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.cardBorder,
                  },
                ]}
                activeOpacity={0.85}
                onPress={() =>
                  setIsHospitalDropdownOpen(!isHospitalDropdownOpen)
                }
              >
                <View style={styles.dropdownLeft}>
                  {selectedHospitalId === 'all' ? (
                    <View
                      style={[
                        styles.colorDot,
                        { backgroundColor: theme.accent },
                      ]}
                    />
                  ) : (
                    <View
                      style={[
                        styles.colorDot,
                        {
                          backgroundColor:
                            HOSPITALS[selectedHospitalId]?.accentColor ||
                            theme.accent,
                        },
                      ]}
                    />
                  )}
                  <Text
                    style={[styles.dropdownButtonText, { color: theme.textDark }]}
                  >
                    {selectedHospitalId === 'all'
                      ? 'All hospitals'
                      : HOSPITALS[selectedHospitalId]?.name || 'Hospital'}
                  </Text>
                </View>

                <Ionicons
                  name={
                    isHospitalDropdownOpen
                      ? 'chevron-up-outline'
                      : 'chevron-down-outline'
                  }
                  size={18}
                  color={theme.textMuted}
                />
              </TouchableOpacity>

              {/* Dropdown Menu Overlay */}
              {isHospitalDropdownOpen && (
                <View
                  style={[
                    styles.dropdownMenu,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  {/* Option: All hospitals */}
                  <TouchableOpacity
                    style={[
                      styles.dropdownMenuItem,
                      selectedHospitalId === 'all' && [
                        styles.dropdownMenuItemActive,
                        { backgroundColor: theme.tint },
                      ],
                      { borderBottomColor: theme.divider },
                    ]}
                    onPress={() => {
                      setSelectedHospitalId('all');
                      setIsHospitalDropdownOpen(false);
                      showToast('Showing shifts for all hospitals');
                    }}
                  >
                    <View style={styles.dropdownMenuLeft}>
                      <View
                        style={[
                          styles.colorDot,
                          { backgroundColor: theme.accent },
                        ]}
                      />
                      <View>
                        <Text
                          style={[
                            styles.dropdownItemTitle,
                            { color: theme.textDark },
                          ]}
                        >
                          All hospitals
                        </Text>
                        <Text
                          style={[
                            styles.dropdownItemSub,
                            { color: theme.textMuted },
                          ]}
                        >
                          Combined overview
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.dropdownItemBadge,
                        { color: theme.primaryDeep },
                      ]}
                    >
                      {dayAppointments.length === 1
                        ? '1 patient'
                        : `${dayAppointments.length} patients`}
                    </Text>
                  </TouchableOpacity>

                  {/* Options: Hospitals with shifts today */}
                  {dayHospitals.map((hosp: HospitalInfo) => {
                    const count = dayAppointments.filter(
                      (a) => a.hospitalId === hosp.id
                    ).length;
                    const isSelected = selectedHospitalId === hosp.id;

                    return (
                      <TouchableOpacity
                        key={hosp.id}
                        style={[
                          styles.dropdownMenuItem,
                          isSelected && [
                            styles.dropdownMenuItemActive,
                            { backgroundColor: theme.tint },
                          ],
                          { borderBottomColor: theme.divider },
                        ]}
                        onPress={() => {
                          setSelectedHospitalId(hosp.id);
                          setIsHospitalDropdownOpen(false);
                          showToast(`Filtered: ${hosp.name}`);
                        }}
                      >
                        <View style={styles.dropdownMenuLeft}>
                          <View
                            style={[
                              styles.colorDot,
                              { backgroundColor: hosp.accentColor },
                            ]}
                          />
                          <View>
                            <Text
                              style={[
                                styles.dropdownItemTitle,
                                { color: theme.textDark },
                              ]}
                            >
                              {hosp.name}
                            </Text>
                            <Text
                              style={[
                                styles.dropdownItemSub,
                                { color: theme.textMuted },
                              ]}
                            >
                              {hosp.room}
                            </Text>
                          </View>
                        </View>
                        <Text
                          style={[
                            styles.dropdownItemBadge,
                            { color: hosp.accentColor },
                          ]}
                        >
                          {count === 1 ? '1 patient' : `${count} patients`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* ─────────────────────────────────────────────────────────
                5. SHIFT CARDS
                - Icon, shift name, time range, room, status pill
                - Hospital name with its colored dot
                - "N consulted" on left, "N waiting" on right, progress bar
                - Footer: "Avg. 9m / patient" and "Take 15m break" pill
                - If leave day or no clinics: "On leave" or "No clinics scheduled"
               ───────────────────────────────────────────────────────── */}
            <View
              style={[
                styles.shiftsSection,
                { position: 'relative', zIndex: openBreakDropdownHospId ? 9999 : 20 },
              ]}
            >
              {/* Scenario A: Doctor is On Leave */}
              {isLeaveDay ? (
                <View
                  style={[
                    styles.stateCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <View style={styles.stateIconCircle}>
                    <Ionicons
                      name="airplane-outline"
                      size={28}
                      color="#d97706"
                    />
                  </View>
                  <Text
                    style={[styles.stateCardTitle, { color: theme.textDark }]}
                  >
                    On leave
                  </Text>
                  <Text
                    style={[
                      styles.stateCardSubtitle,
                      { color: theme.textMuted },
                    ]}
                  >
                    {currentDayData.leaveReason ||
                      'Annual medical conference leave approved.'}
                  </Text>
                  <View style={styles.blockedPill}>
                    <Ionicons
                      name="lock-closed"
                      size={13}
                      color="#b45309"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.blockedPillText}>
                      Bookings and walk-ins are blocked
                    </Text>
                  </View>
                </View>
              ) : displayedShiftHospitals.length === 0 ? (
                /* Scenario B: No clinics scheduled */
                <View
                  style={[
                    styles.stateCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <View style={styles.stateIconCircle}>
                    <Ionicons
                      name="calendar-clear-outline"
                      size={28}
                      color={theme.accent}
                    />
                  </View>
                  <Text
                    style={[styles.stateCardTitle, { color: theme.textDark }]}
                  >
                    No clinics scheduled
                  </Text>
                  <Text
                    style={[
                      styles.stateCardSubtitle,
                      { color: theme.textMuted },
                    ]}
                  >
                    There are no hospital clinic sessions allocated for this date.
                  </Text>
                </View>
              ) : (
                /* Scenario C: Render shift card per hospital (default current shift only) */
                <>
                  {displayedShiftHospitals.map((hosp: HospitalInfo, hIndex: number) => {
                  const hospAppts = dayAppointments.filter(
                    (a) => a.hospitalId === hosp.id
                  );
                  const consulted = hospAppts.filter(
                    (a) => a.status === 'Done'
                  ).length;
                  const waiting = hospAppts.filter(
                    (a) => a.status === 'Waiting' || a.status === 'Now attending'
                  ).length;
                  const total = hospAppts.length;
                  const progressPct =
                    total > 0 ? Math.min(100, Math.round((consulted / total) * 100)) : 0;

                  // Determine status pill
                  let statusLabel = 'Upcoming';
                  let statusBg = isDark ? '#1a2e33' : '#e6f7f9';
                  let statusColor = '#0e8a96';

                  if (isTodaySelected) {
                    if (hosp.id === 'cgh') {
                      statusLabel = 'In progress';
                      statusBg = isDark ? '#1a3328' : '#ecfdf5';
                      statusColor = '#059669';
                    } else if (hosp.id === 'lakeview') {
                      statusLabel = 'Upcoming';
                      statusBg = isDark ? '#33271a' : '#fffbeb';
                      statusColor = '#d97706';
                    } else {
                      statusLabel = 'Upcoming';
                      statusBg = isDark ? '#281a38' : '#faf5ff';
                      statusColor = '#7c3aed';
                    }
                  } else {
                    const selD = parseDateKey(selectedDateKey);
                    const refD = parseDateKey(REFERENCE_TODAY);
                    if (selD < refD) {
                      statusLabel = 'Completed';
                      statusBg = isDark ? '#232931' : '#f1f5f9';
                      statusColor = '#64748b';
                    }
                  }

                  return (
                    <View
                      key={hosp.id}
                      style={[
                        styles.shiftCard,
                        {
                          backgroundColor: theme.card,
                          borderColor: theme.cardBorder,
                          position: 'relative',
                          zIndex: openBreakDropdownHospId === hosp.id ? 9999 : (20 - hIndex),
                          elevation: openBreakDropdownHospId === hosp.id ? 25 : 2,
                        },
                      ]}
                    >
                      {/* Top: Icon + Shift name + Time + Status pill */}
                      <View style={styles.shiftHeader}>
                        <View style={styles.shiftTitleGroup}>
                          <View
                            style={[
                              styles.shiftIconBox,
                              { backgroundColor: theme.tint },
                            ]}
                          >
                            <MaterialCommunityIcons
                              name={hosp.shiftIcon as any}
                              size={18}
                              color={theme.primaryDeep}
                            />
                          </View>
                          <View>
                            <Text
                              style={[
                                styles.shiftNameText,
                                { color: theme.textDark },
                              ]}
                            >
                              {hosp.shiftName}
                            </Text>
                            <Text
                              style={[
                                styles.shiftTimeText,
                                { color: theme.textMuted },
                              ]}
                            >
                              {hosp.shiftTime} · {hosp.room}
                            </Text>
                          </View>
                        </View>

                        <View
                          style={[
                            styles.statusPill,
                            { backgroundColor: statusBg },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusPillText,
                              { color: statusColor },
                            ]}
                          >
                            {statusLabel}
                          </Text>
                        </View>
                      </View>

                      {/* Hospital Tag with dot */}
                      <View style={styles.hospitalTagRow}>
                        <View
                          style={[
                            styles.hospitalTag,
                            {
                              backgroundColor: isDark
                                ? '#142023'
                                : hosp.accentLight,
                              borderColor: hosp.accentColor + '33',
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.colorDotSmall,
                              { backgroundColor: hosp.accentColor },
                            ]}
                          />
                          <Text
                            style={[
                              styles.hospitalTagText,
                              { color: hosp.accentColor },
                            ]}
                          >
                            {hosp.name}
                          </Text>
                        </View>
                      </View>

                      {/* Progress Stats */}
                      <View style={styles.progressSection}>
                        <View style={styles.progressLabels}>
                          <Text
                            style={[
                              styles.statLabel,
                              { color: theme.textDark },
                            ]}
                          >
                            <Text style={styles.statNumber}>{consulted}</Text>{' '}
                            consulted
                          </Text>
                          <Text
                            style={[
                              styles.statLabel,
                              { color: theme.textDark },
                            ]}
                          >
                            <Text style={styles.statNumber}>{waiting}</Text>{' '}
                            waiting
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.progressBarBg,
                            { backgroundColor: theme.divider },
                          ]}
                        >
                          <View
                            style={[
                              styles.progressBarFill,
                              {
                                width: `${progressPct}%`,
                                backgroundColor: hosp.accentColor,
                              },
                            ]}
                          />
                        </View>
                      </View>
                      <View
                        style={[
                          styles.shiftFooter,
                          {
                            borderTopColor: theme.divider,
                            position: 'relative',
                            zIndex: openBreakDropdownHospId === hosp.id ? 9999 : 1,
                          },
                        ]}
                      >
                        <View style={styles.avgConsultRow}>
                          <Ionicons
                            name="time-outline"
                            size={14}
                            color={theme.textMuted}
                          />
                          <Text
                            style={[
                              styles.avgConsultText,
                              { color: theme.textMuted },
                            ]}
                          >
                            Avg. 9m / patient
                          </Text>
                        </View>

                        {(() => {
                          const isThisShiftBreak =
                            activeBreak !== null &&
                            (activeBreak.hospitalId === hosp.id ||
                              activeBreak.shiftName === hosp.shiftName);
                          const breakOptions = getBreakOptionsForHospital(hosp);

                          let pillIconName: any = 'coffee-outline';
                          if (isThisShiftBreak && activeBreak) {
                            if (activeBreak.type === 'lunch') pillIconName = 'food-variant';
                            else if (activeBreak.type === 'dinner') pillIconName = 'food-fork-drink';
                            else pillIconName = 'coffee';
                          }

                          return (
                            <View
                              style={{
                                position: 'relative',
                                zIndex: openBreakDropdownHospId === hosp.id ? 99999 : 1,
                              }}
                            >
                              <TouchableOpacity
                                style={[
                                  styles.breakPillButton,
                                  isThisShiftBreak
                                    ? {
                                        backgroundColor: isDark ? '#33271a' : '#fef3c7',
                                        borderColor: '#f59e0b',
                                      }
                                    : {
                                        backgroundColor: theme.tint,
                                        borderColor: theme.cardBorder,
                                      },
                                ]}
                                activeOpacity={0.8}
                                onPress={() =>
                                  setOpenBreakDropdownHospId(
                                    openBreakDropdownHospId === hosp.id ? null : hosp.id
                                  )
                                }
                                accessibilityRole="button"
                                accessibilityLabel="Take break options"
                              >
                                <MaterialCommunityIcons
                                  name={pillIconName}
                                  size={14}
                                  color={isThisShiftBreak ? '#d97706' : theme.primaryDeep}
                                  style={{ marginRight: 4 }}
                                />
                                <Text
                                  style={[
                                    styles.breakPillText,
                                    { color: isThisShiftBreak ? '#b45309' : theme.primaryDeep },
                                  ]}
                                >
                                  {isThisShiftBreak && activeBreak
                                    ? `${activeBreak.label} (${activeBreak.type === 'tea' ? '15m' : '1h'})`
                                    : 'Take break'}
                                </Text>
                                <Ionicons
                                  name={
                                    openBreakDropdownHospId === hosp.id
                                      ? 'chevron-up'
                                      : 'chevron-down'
                                  }
                                  size={12}
                                  color={isThisShiftBreak ? '#b45309' : theme.primaryDeep}
                                  style={{ marginLeft: 3 }}
                                />
                              </TouchableOpacity>

                              {/* Break Dropdown Menu */}
                              {openBreakDropdownHospId === hosp.id && (
                                <View
                                  style={[
                                    styles.breakDropdownMenu,
                                    {
                                      backgroundColor: isDark ? '#192b2e' : '#ffffff',
                                      borderColor: theme.cardBorder,
                                    },
                                  ]}
                                >
                                  {breakOptions.map((opt, optIdx) => {
                                    const isSelected =
                                      isThisShiftBreak && activeBreak?.type === opt.type;
                                    return (
                                      <TouchableOpacity
                                        key={opt.type}
                                        style={[
                                          styles.breakDropdownItem,
                                          optIdx > 0 && {
                                            borderTopWidth: 1,
                                            borderTopColor: theme.divider,
                                          },
                                          isSelected && {
                                            backgroundColor: isDark ? '#23393c' : '#fef3c7',
                                          },
                                        ]}
                                        activeOpacity={0.7}
                                        onPress={() => handleSelectBreak(opt.type, hosp)}
                                      >
                                        <View style={styles.breakDropdownItemLeft}>
                                          <View
                                            style={[
                                              styles.breakOptionIconWrap,
                                              {
                                                backgroundColor: isDark
                                                  ? '#2b2619'
                                                  : '#fef3c7',
                                              },
                                            ]}
                                          >
                                            <MaterialCommunityIcons
                                              name={opt.iconName as any}
                                              size={15}
                                              color="#d97706"
                                            />
                                          </View>
                                          <View>
                                            <Text
                                              style={[
                                                styles.breakDropdownItemTitle,
                                                { color: theme.textDark },
                                              ]}
                                            >
                                              {opt.label} ({opt.duration})
                                            </Text>
                                            <Text
                                              style={[
                                                styles.breakDropdownItemSub,
                                                { color: theme.textMuted },
                                              ]}
                                            >
                                              {opt.sub}
                                            </Text>
                                          </View>
                                        </View>
                                        {isSelected && (
                                          <Ionicons
                                            name="checkmark-circle"
                                            size={16}
                                            color="#d97706"
                                          />
                                        )}
                                      </TouchableOpacity>
                                    );
                                  })}

                                  {/* End break option if this shift has active break */}
                                  {isThisShiftBreak && (
                                    <TouchableOpacity
                                      style={[
                                        styles.breakDropdownItem,
                                        styles.endBreakDropdownItem,
                                        {
                                          borderTopWidth: 1,
                                          borderTopColor: theme.divider,
                                          backgroundColor: isDark
                                            ? '#2b1b1b'
                                            : '#fef2f2',
                                        },
                                      ]}
                                      activeOpacity={0.7}
                                      onPress={() => handleEndBreak(hosp)}
                                    >
                                      <Ionicons
                                        name="stop-circle-outline"
                                        size={16}
                                        color="#ef4444"
                                        style={{ marginRight: 6 }}
                                      />
                                      <Text style={styles.endBreakDropdownText}>
                                        End Break & Resume Shift
                                      </Text>
                                    </TouchableOpacity>
                                  )}
                                </View>
                              )}
                            </View>
                          );
                        })()}
                      </View>
                    </View>
                  );
                })}

                {/* Optional toggle when 'all' is selected: View all shifts or only current shift */}
                {selectedHospitalId === 'all' && dayHospitals.length > 1 && (
                  <TouchableOpacity
                    style={[
                      styles.toggleAllShiftsBtn,
                      {
                        backgroundColor: isDark ? '#142528' : '#f0f9fa',
                        borderColor: isDark ? '#1f383c' : '#d4eff2',
                      },
                    ]}
                    onPress={() => setShowAllShiftsOverview((prev) => !prev)}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={
                      showAllShiftsOverview
                        ? 'Show current shift only'
                        : 'View all shifts for today'
                    }
                  >
                    <Ionicons
                      name={showAllShiftsOverview ? 'chevron-up-circle-outline' : 'layers-outline'}
                      size={15}
                      color={theme.accent}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.toggleAllShiftsBtnText,
                        { color: theme.accent },
                      ]}
                    >
                      {showAllShiftsOverview
                        ? 'Show current shift only'
                        : `View all ${dayHospitals.length} shifts today (${dayHospitals.length - 1} upcoming)`}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

            {/* ─────────────────────────────────────────────────────────
                6. TIMELINE
                - Heading "Timeline" + patient count badge + "Current: 10:12 AM"
                - Highlighted card for NOW ATTENDING with thick teal left border:
                  round token number, "NOW ATTENDING •", patient name,
                  reason • time, "In room" badge, hospital tag,
                  "Consultation elapsed: 6 min", "Open EHR" pill button
                - Rows for other appointments with AM/PM time, patient name,
                  reason • Token #030, hospital tag with dot, status pill
               ───────────────────────────────────────────────────────── */}
            <View style={[styles.timelineSection, { position: 'relative', zIndex: 1 }]}>
              {/* Timeline Header */}
              <View style={styles.timelineHeaderRow}>
                <View style={styles.timelineTitleGroup}>
                  <Text
                    style={[styles.timelineHeading, { color: theme.textDark }]}
                  >
                    Timeline
                  </Text>
                  <View
                    style={[
                      styles.patientCountBadge,
                      { backgroundColor: theme.tint },
                    ]}
                  >
                    <Text
                      style={[
                        styles.patientCountText,
                        { color: theme.primaryDeep },
                      ]}
                    >
                      {filteredAppointments.length} patients
                    </Text>
                  </View>
                </View>

                {isTodaySelected && (
                  <View style={styles.currentClockRow}>
                    <View style={styles.clockPulseDot} />
                    <Text
                      style={[styles.clockTimeText, { color: theme.accent }]}
                    >
                      Current: 10:12 AM
                    </Text>
                  </View>
                )}
              </View>

              {/* Patient List */}
              {isLoadingSchedule && filteredAppointments.length === 0 ? (
                <View
                  style={[
                    styles.emptyTimelineBox,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <ActivityIndicator size="small" color={theme.accent} style={{ marginBottom: 6 }} />
                  <Text
                    style={[
                      styles.emptyTimelineText,
                      { color: theme.textMuted },
                    ]}
                  >
                    {t("Loading schedule...")}
                  </Text>
                </View>
              ) : filteredAppointments.length === 0 ? (
                <View
                  style={[
                    styles.emptyTimelineBox,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.emptyTimelineText,
                      { color: theme.textMuted },
                    ]}
                  >
                    {t("No appointments on this timeline")}
                  </Text>
                </View>
              ) : (
                <View style={styles.appointmentsList}>
                  {/* Highlighted NOW ATTENDING Card */}
                  {nowAttendingPatient && (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => setSelectedPatient(nowAttendingPatient)}
                      style={[
                        styles.nowAttendingCard,
                        {
                          backgroundColor: theme.card,
                          borderColor: theme.cardBorder,
                          borderLeftColor: theme.accent,
                        },
                      ]}
                    >
                      <View style={styles.nowAttendingTop}>
                        <View style={styles.tokenCircle}>
                          <Text style={styles.tokenCircleText}>
                            {nowAttendingPatient.token.replace('Token #', '')}
                          </Text>
                        </View>

                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <View style={styles.nowAttendingBadgeRow}>
                            <Text
                              style={[
                                styles.nowAttendingLabel,
                                { color: theme.accent },
                              ]}
                            >
                              NOW ATTENDING •
                            </Text>
                            <View style={styles.inRoomBadge}>
                              <Text style={styles.inRoomText}>In room</Text>
                            </View>
                          </View>

                          <Text
                            style={[
                              styles.nowPatientName,
                              { color: theme.textDark },
                            ]}
                          >
                            {nowAttendingPatient.patientName}
                          </Text>

                          <Text
                            style={[
                              styles.nowPatientSub,
                              { color: theme.textMuted },
                            ]}
                          >
                            {nowAttendingPatient.reason} ·{' '}
                            {nowAttendingPatient.time}
                          </Text>
                        </View>
                      </View>

                      {/* Hospital tag + Elapsed time + Open EHR button */}
                      <View
                        style={[
                          styles.nowAttendingFooter,
                          { borderTopColor: theme.divider },
                        ]}
                      >
                        <View style={styles.nowFooterLeft}>
                          {/* Hospital Tag */}
                          <View
                            style={[
                              styles.hospitalTag,
                              {
                                backgroundColor: isDark
                                  ? '#142023'
                                  : HOSPITALS[nowAttendingPatient.hospitalId]
                                      ?.accentLight || theme.tint,
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.colorDotSmall,
                                {
                                  backgroundColor:
                                    HOSPITALS[nowAttendingPatient.hospitalId]
                                      ?.accentColor || theme.accent,
                                },
                              ]}
                            />
                            <Text
                              style={[
                                styles.hospitalTagText,
                                {
                                  color:
                                    HOSPITALS[nowAttendingPatient.hospitalId]
                                      ?.accentColor || theme.accent,
                                },
                              ]}
                            >
                              {HOSPITALS[nowAttendingPatient.hospitalId]
                                ?.shortName || 'Hospital'}
                            </Text>
                          </View>

                          <Text
                            style={[
                              styles.elapsedText,
                              { color: theme.textMuted },
                            ]}
                          >
                            Consultation elapsed: {elapsedMinutes} min
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={[
                            styles.openEhrPill,
                            { backgroundColor: theme.primaryDeep },
                          ]}
                          activeOpacity={0.8}
                          onPress={() =>
                            showToast(
                              `Opening EHR for ${nowAttendingPatient.patientName}`
                            )
                          }
                        >
                          <Text style={styles.openEhrText}>Open EHR</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Regular Appointment Rows */}
                  {regularAppointments.map((appt: ScheduleAppointment) => {
                    const hosp = HOSPITALS[appt.hospitalId] || HOSPITALS.cgh;
                    const isWalkIn =
                      Boolean(appt.isWalkIn) ||
                      appt.id.startsWith('walkin-') ||
                      appt.patientName.toLowerCase().includes('walk-in') ||
                      appt.reason.toLowerCase().includes('walk-in');

                    // Status pill styling
                    let statusBg = isDark ? '#142023' : '#f1f5f9';
                    let statusColor = '#64748b';
                    if (appt.status === 'Done') {
                      statusBg = isDark ? '#142b23' : '#ecfdf5';
                      statusColor = '#059669';
                    } else if (appt.status === 'Waiting') {
                      statusBg = isDark ? '#302613' : '#fffbeb';
                      statusColor = '#d97706';
                    } else if (appt.status === 'Scheduled') {
                      statusBg = isDark ? '#1a2e33' : '#e6f7f9';
                      statusColor = '#0e8a96';
                    }

                    return (
                      <TouchableOpacity
                        key={appt.id}
                        activeOpacity={0.7}
                        onPress={() => setSelectedPatient(appt)}
                        style={[
                          styles.timelineRowCard,
                          {
                            backgroundColor: theme.card,
                            borderColor: theme.cardBorder,
                          },
                        ]}
                      >
                        <View style={styles.timelineRowLeft}>
                          {/* Time */}
                          <View style={styles.timeBlock}>
                            <Text
                              style={[
                                styles.timeTextMain,
                                { color: theme.textDark },
                              ]}
                            >
                              {appt.time}
                            </Text>
                          </View>

                          {/* Patient details */}
                          <View style={styles.patientInfoBlock}>
                            <Text
                              style={[
                                styles.rowPatientName,
                                { color: theme.textDark },
                              ]}
                              numberOfLines={1}
                            >
                              {appt.patientName}
                            </Text>

                            <Text
                              style={[
                                styles.rowReasonText,
                                { color: theme.textMuted },
                              ]}
                              numberOfLines={1}
                            >
                              {appt.reason} · {appt.token}
                            </Text>

                            {/* Hospital Tag with dot */}
                            <View style={styles.rowTagRow}>
                              <View
                                style={[
                                  styles.hospitalTag,
                                  {
                                    backgroundColor: isDark
                                      ? '#142023'
                                      : hosp.accentLight,
                                  },
                                ]}
                              >
                                <View
                                  style={[
                                    styles.colorDotSmall,
                                    { backgroundColor: hosp.accentColor },
                                  ]}
                                />
                                <Text
                                  style={[
                                    styles.hospitalTagText,
                                    { color: hosp.accentColor },
                                  ]}
                                >
                                  {hosp.shortName}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>

                        {/* Status Pill & Remove Option for Walk-in */}
                        <View style={styles.rowRightPillGroup}>
                          <View
                            style={[
                              styles.statusPillSmall,
                              { backgroundColor: statusBg },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusPillSmallText,
                                { color: statusColor },
                              ]}
                            >
                              {appt.status}
                            </Text>
                          </View>

                          {isWalkIn && (
                            <View style={styles.walkInActionsRow}>
                              <TouchableOpacity
                                style={styles.editWalkInRowBadge}
                                activeOpacity={0.7}
                                onPress={(e) => {
                                  if (e && typeof e.stopPropagation === 'function') {
                                    e.stopPropagation();
                                  }
                                  handleOpenEditWalkInModal(appt);
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                accessibilityRole="button"
                                accessibilityLabel={`Edit walk-in ${appt.patientName}`}
                              >
                                <Ionicons name="pencil" size={11} color="#0d9488" style={{ marginRight: 3 }} />
                                <Text style={styles.editWalkInRowBadgeText}>Edit</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={styles.removeWalkInRowBadge}
                                activeOpacity={0.7}
                                onPress={(e) => {
                                  if (e && typeof e.stopPropagation === 'function') {
                                    e.stopPropagation();
                                  }
                                  handleOpenRemoveModal(appt);
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                accessibilityRole="button"
                                accessibilityLabel={`Remove walk-in ${appt.patientName}`}
                              >
                                <Ionicons name="trash-outline" size={11} color="#dc2626" style={{ marginRight: 3 }} />
                                <Text style={styles.removeWalkInRowBadgeText}>Remove</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* ─────────────────────────────────────────────────────────
                7. ADD WALK-IN SLOT
                - Full-width dark teal pill button: "+ Add walk-in slot"
                - Below it: small centered text per hospital:
                - Tapping adds walk-in (today only) & reduces count
               ───────────────────────────────────────────────────────── */}
            <View style={styles.walkInSection}>
              <TouchableOpacity
                style={[
                  styles.addWalkInButton,
                  { backgroundColor: theme.primaryDeep },
                ]}
                activeOpacity={0.85}
                onPress={handleOpenWalkInModal}
              >
                <Ionicons
                  name="add"
                  size={20}
                  color="#ffffff"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.addWalkInButtonText}>
                  Add walk-in slot
                </Text>
              </TouchableOpacity>

              {/* Clean Available Walk-in Slots Status Indicator (Edit button removed as edit is inside the modal) */}
              <View
                style={[
                  styles.allocationsCleanBar,
                  {
                    backgroundColor: isDark ? '#142528' : '#f0f9fa',
                    borderColor: isDark ? '#1f383c' : '#d4eff2',
                  },
                ]}
              >
                <View
                  style={[
                    styles.allocationsDot,
                    {
                      backgroundColor:
                        selectedHospitalId !== 'all'
                          ? HOSPITALS[selectedHospitalId]?.accentColor || theme.accent
                          : HOSPITALS[currentActiveHospitalId]?.accentColor || HOSPITALS.cgh.accentColor,
                    },
                  ]}
                />
                <Text style={[styles.allocationsCleanTitle, { color: theme.textDark }]}>
                  Available walk-in slots:{' '}
                  <Text style={{ fontWeight: '800', color: theme.accent }}>
                    {selectedHospitalId !== 'all'
                      ? `${walkInAllocations[selectedHospitalId] ?? 0} remaining`
                      : `${walkInAllocations[currentActiveHospitalId] ?? 5} remaining`}
                  </Text>
                </Text>
              </View>
            </View>

            {/* Bottom spacer so content is not hidden by navigation bar */}
            <View style={{ height: 100 }} />
          </ScrollView>

          {/* ─────────────────────────────────────────────────────────
              8. FIXED BOTTOM NAVIGATION
              User instruction: "mage araginal navigation bar eke icon change karanna epa"
              EXACT ORIGINAL 5 ICONS & LABELS PRESERVED:
              1. Home: Ionicons 'home-outline'
              2. Queue: MaterialCommunityIcons 'ticket-confirmation-outline'
              3. Records: MaterialCommunityIcons 'folder-account-outline'
              4. Schedule: MaterialCommunityIcons 'calendar-month-outline' (Active)
              5. Prescription: MaterialCommunityIcons 'clipboard-edit-outline'
             ───────────────────────────────────────────────────────── */}
          <View
            style={[
              styles.bottomTabBar,
              {
                backgroundColor: theme.card,
                borderTopColor: theme.cardBorder,
              },
            ]}
          >
            {/* 1. Home */}
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => handleTabPress('home')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="home-outline"
                size={22}
                color={activeTab === 'home' ? theme.accent : theme.textMuted}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: activeTab === 'home' ? theme.accent : theme.textMuted },
                  activeTab === 'home' && styles.tabLabelActive,
                ]}
              >
                Home
              </Text>
            </TouchableOpacity>

            {/* 2. Queue */}
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => handleTabPress('queue')}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="ticket-confirmation-outline"
                size={23}
                color={activeTab === 'queue' ? theme.accent : theme.textMuted}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: activeTab === 'queue' ? theme.accent : theme.textMuted },
                  activeTab === 'queue' && styles.tabLabelActive,
                ]}
              >
                Queue
              </Text>
            </TouchableOpacity>

            {/* 3. Records */}
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => handleTabPress('records')}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="folder-account-outline"
                size={22}
                color={activeTab === 'records' ? theme.accent : theme.textMuted}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: activeTab === 'records' ? theme.accent : theme.textMuted },
                  activeTab === 'records' && styles.tabLabelActive,
                ]}
              >
                Records
              </Text>
            </TouchableOpacity>

            {/* 4. Schedule (ACTIVE) */}
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => handleTabPress('schedule')}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="calendar-month-outline"
                size={22}
                color={theme.accent}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: theme.accent },
                  styles.tabLabelActive,
                ]}
              >
                Schedule
              </Text>
            </TouchableOpacity>

            {/* 5. Prescription */}
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => handleTabPress('rx')}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="clipboard-edit-outline"
                size={22}
                color={activeTab === 'rx' ? theme.accent : theme.textMuted}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.tabLabel,
                  { color: activeTab === 'rx' ? theme.accent : theme.textMuted },
                  activeTab === 'rx' && styles.tabLabelActive,
                ]}
              >
                Prescription
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ─────────────────────────────────────────────────────────
          PATIENT DETAIL BOTTOM SHEET MODAL
          - Initials avatar, name, "age • sex • Blood: B+", close button
          - Allergy alert (red) OR calm "No known allergies" card
          - Info grid (token, appointment time, NIC, phone, reason for visit)
          - Hospital box (hospital name with dot, room, address)
          - Two buttons: "Call patient" and "Open EHR"
          - Close with X, tap outside, or Escape
         ───────────────────────────────────────────────────────── */}
      <Modal
        visible={Boolean(selectedPatient)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedPatient(null)}
      >
        <TouchableOpacity
          style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}
          activeOpacity={1}
          onPress={() => setSelectedPatient(null)}
        >
          <TouchableOpacity
            style={[
              styles.sheetContainer,
              {
                backgroundColor: theme.sheetBg,
                borderColor: theme.cardBorder,
              },
            ]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Sheet Handle */}
            <View
              style={[
                styles.sheetHandle,
                { backgroundColor: theme.cardBorder },
              ]}
            />

            {selectedPatient && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.sheetScrollContent}
              >
                {/* Header: Avatar, Name, Demographics, Close X */}
                <View style={styles.sheetHeaderRow}>
                  <View style={styles.sheetAvatarGroup}>
                    <View
                      style={[
                        styles.sheetAvatar,
                        { backgroundColor: theme.tint },
                      ]}
                    >
                      <Text
                        style={[
                          styles.sheetAvatarText,
                          { color: theme.primaryDeep },
                        ]}
                      >
                        {selectedPatient.patientName
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.sheetNameCol}>
                      <Text
                        style={[
                          styles.sheetPatientName,
                          { color: theme.textDark },
                        ]}
                      >
                        {selectedPatient.patientName}
                      </Text>
                      <Text
                        style={[
                          styles.sheetDemographics,
                          { color: theme.textMuted },
                        ]}
                      >
                        {selectedPatient.age} yrs · {selectedPatient.sex} ·{' '}
                        Blood: {selectedPatient.bloodGroup}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.sheetCloseBtn,
                      { backgroundColor: theme.cardBorder },
                    ]}
                    onPress={() => setSelectedPatient(null)}
                  >
                    <Ionicons name="close" size={20} color={theme.textDark} />
                  </TouchableOpacity>
                </View>

                {/* Allergy Section: Red Alert or Calm Green Card */}
                {selectedPatient.allergy ? (
                  <View style={styles.allergyAlertBox}>
                    <View style={styles.allergyIconCol}>
                      <Ionicons name="warning" size={22} color="#dc2626" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.allergyAlertTitle}>
                        CRITICAL DRUG ALLERGY ALERT
                      </Text>
                      <Text style={styles.allergyAlertDesc}>
                        {selectedPatient.allergy}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.noAllergyBox,
                      {
                        backgroundColor: isDark ? '#12261e' : '#f0fdf4',
                        borderColor: isDark ? '#1c3e31' : '#bbf7d0',
                      },
                    ]}
                  >
                    <Ionicons
                      name="shield-checkmark"
                      size={20}
                      color="#16a34a"
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={[
                        styles.noAllergyText,
                        { color: isDark ? '#86efac' : '#15803d' },
                      ]}
                    >
                      No known drug allergies reported
                    </Text>
                  </View>
                )}

                {/* Info Grid (Token, Time, NIC, Phone, Reason) */}
                <View
                  style={[
                    styles.infoGrid,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <View style={styles.infoGridRow}>
                    <View style={styles.infoCol}>
                      <Text
                        style={[styles.infoLabel, { color: theme.textMuted }]}
                      >
                        QUEUE TOKEN
                      </Text>
                      <Text
                        style={[styles.infoValue, { color: theme.textDark }]}
                      >
                        {selectedPatient.token}
                      </Text>
                    </View>
                    <View style={styles.infoCol}>
                      <Text
                        style={[styles.infoLabel, { color: theme.textMuted }]}
                      >
                        APPOINTMENT TIME
                      </Text>
                      <Text
                        style={[styles.infoValue, { color: theme.textDark }]}
                      >
                        {selectedPatient.time}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.infoDivider,
                      { backgroundColor: theme.divider },
                    ]}
                  />

                  <View style={styles.infoGridRow}>
                    <View style={styles.infoCol}>
                      <Text
                        style={[styles.infoLabel, { color: theme.textMuted }]}
                      >
                        NIC NUMBER
                      </Text>
                      <Text
                        style={[styles.infoValue, { color: theme.textDark }]}
                      >
                        {selectedPatient.nic}
                      </Text>
                    </View>
                    <View style={styles.infoCol}>
                      <Text
                        style={[styles.infoLabel, { color: theme.textMuted }]}
                      >
                        PHONE NUMBER
                      </Text>
                      <Text
                        style={[styles.infoValue, { color: theme.textDark }]}
                      >
                        {selectedPatient.phone}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.infoDivider,
                      { backgroundColor: theme.divider },
                    ]}
                  />

                  <View style={{ paddingTop: 8 }}>
                    <Text
                      style={[styles.infoLabel, { color: theme.textMuted }]}
                    >
                      REASON FOR VISIT
                    </Text>
                    <Text
                      style={[
                        styles.infoValueReason,
                        { color: theme.textDark },
                      ]}
                    >
                      {selectedPatient.reason}
                    </Text>
                  </View>
                </View>

                {/* Hospital Box */}
                {(() => {
                  const hosp =
                    HOSPITALS[selectedPatient.hospitalId] || HOSPITALS.cgh;
                  return (
                    <View
                      style={[
                        styles.hospitalBox,
                        {
                          backgroundColor: isDark
                            ? '#142023'
                            : hosp.accentLight,
                          borderColor: hosp.accentColor + '44',
                        },
                      ]}
                    >
                      <View style={styles.hospBoxTop}>
                        <View
                          style={[
                            styles.colorDot,
                            { backgroundColor: hosp.accentColor },
                          ]}
                        />
                        <Text
                          style={[
                            styles.hospBoxName,
                            { color: hosp.accentColor },
                          ]}
                        >
                          {hosp.name}
                        </Text>
                      </View>
                      <Text
                        style={[styles.hospBoxSub, { color: theme.textDark }]}
                      >
                        {hosp.room} · {hosp.address}
                      </Text>
                    </View>
                  );
                })()}

                {/* Remove & Edit Walk-in buttons if this is a walk-in patient */}
                {Boolean(
                  selectedPatient.isWalkIn ||
                  selectedPatient.id.startsWith('walkin-') ||
                  selectedPatient.patientName.toLowerCase().includes('walk-in') ||
                  selectedPatient.reason.toLowerCase().includes('walk-in')
                ) && (
                  <View style={styles.sheetWalkInBtnsRow}>
                    <TouchableOpacity
                      style={styles.sheetBtnEditWalkIn}
                      activeOpacity={0.8}
                      onPress={() => {
                        const p = selectedPatient;
                        setSelectedPatient(null);
                        handleOpenEditWalkInModal(p);
                      }}
                    >
                      <Ionicons
                        name="pencil"
                        size={16}
                        color="#0f766e"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.sheetBtnEditWalkInText}>
                        Edit Walk-in Details
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.sheetBtnRemoveWalkIn}
                      activeOpacity={0.8}
                      onPress={() => handleOpenRemoveModal(selectedPatient)}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={16}
                        color="#dc2626"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.sheetBtnRemoveWalkInText}>
                        Remove Walk-in Slot
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Bottom Action Buttons: Call patient & Open EHR */}
                <View style={styles.sheetBtnRow}>
                  <TouchableOpacity
                    style={[
                      styles.sheetBtnSecondary,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                    activeOpacity={0.8}
                    onPress={() => {
                      showToast(`Calling ${selectedPatient.phone}...`);
                    }}
                  >
                    <Ionicons
                      name="call-outline"
                      size={18}
                      color={theme.primaryDeep}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.sheetBtnSecondaryText,
                        { color: theme.primaryDeep },
                      ]}
                    >
                      Call patient
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.sheetBtnPrimary,
                      { backgroundColor: theme.primaryDeep },
                    ]}
                    activeOpacity={0.85}
                    onPress={() => {
                      setSelectedPatient(null);
                      showToast(
                        `Opening EHR Record for ${selectedPatient.patientName}`
                      );
                    }}
                  >
                    <Ionicons
                      name="folder-open-outline"
                      size={18}
                      color="#ffffff"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.sheetBtnPrimaryText}>Open EHR</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ─────────────────────────────────────────────────────────
          WALK-IN SLOT REGISTRATION MODAL
          Form fields required:
          1. Patient Name
          2. Age
          3. Gender (Male / Female / Other)
          4. Hospital (Select from active hospitals with remaining slots)
          5. Reason for Consultation
         ───────────────────────────────────────────────────────── */}
      <Modal
        visible={isWalkInModalVisible}
        transparent
        animationType="slide"
        onRequestClose={handleCloseWalkInModal}
      >
        <TouchableOpacity
          style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}
          activeOpacity={1}
          onPress={handleCloseWalkInModal}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardAvoidingWrap}
          >
            <TouchableOpacity
              style={[
                styles.walkInModalSheet,
                {
                  backgroundColor: theme.sheetBg,
                  borderColor: theme.cardBorder,
                },
              ]}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              {/* Sheet Handle */}
              <View
                style={[
                  styles.sheetHandle,
                  { backgroundColor: theme.cardBorder },
                ]}
              />

              {/* Modal Header */}
              <View style={styles.walkInModalHeader}>
                <View style={styles.walkInModalHeaderLeft}>
                  <View
                    style={[
                      styles.walkInIconBadge,
                      { backgroundColor: theme.tint },
                    ]}
                  >
                    <Ionicons
                      name="person-add"
                      size={20}
                      color={theme.accent}
                    />
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.walkInModalTitle,
                        { color: theme.textDark },
                      ]}
                    >
                      Add Walk-in Slot
                    </Text>
                    <Text
                      style={[
                        styles.walkInModalSubtitle,
                        { color: theme.textMuted },
                      ]}
                    >
                      Register a walk-in patient for today's queue
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.sheetCloseBtn,
                    { backgroundColor: theme.cardBorder },
                  ]}
                  onPress={handleCloseWalkInModal}
                >
                  <Ionicons name="close" size={20} color={theme.textDark} />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.walkInModalScroll}
              >
                {/* 1. Patient Name */}
                <View style={styles.walkInFieldGroup}>
                  <Text
                    style={[styles.walkInFieldLabel, { color: theme.textMuted }]}
                  >
                    PATIENT NAME <Text style={styles.walkInRequiredStar}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.walkInTextInput,
                      {
                        backgroundColor: theme.inputBg,
                        borderColor: walkInErrors.name ? '#ef4444' : theme.cardBorder,
                        color: theme.textDark,
                      },
                    ]}
                    placeholder="e.g. Kasun Perera"
                    placeholderTextColor={theme.textMuted}
                    value={walkInName}
                    onChangeText={(val) => {
                      setWalkInName(val);
                      if (walkInErrors.name) {
                        setWalkInErrors((prev) => ({ ...prev, name: undefined }));
                      }
                    }}
                  />
                  {walkInErrors.name && (
                    <Text style={styles.walkInErrorText}>{walkInErrors.name}</Text>
                  )}
                </View>

                {/* 2 & 3. Age & Gender */}
                <View style={styles.walkInRowGroup}>
                  {/* Age */}
                  <View style={[styles.walkInFieldGroup, { flex: 0.85 }]}>
                    <Text
                      style={[
                        styles.walkInFieldLabel,
                        { color: theme.textMuted },
                      ]}
                    >
                      AGE <Text style={styles.walkInRequiredStar}>*</Text>
                    </Text>
                    <TextInput
                      style={[
                        styles.walkInTextInput,
                        {
                          backgroundColor: theme.inputBg,
                          borderColor: walkInErrors.age ? '#ef4444' : theme.cardBorder,
                          color: theme.textDark,
                        },
                      ]}
                      placeholder="e.g. 34"
                      placeholderTextColor={theme.textMuted}
                      keyboardType="number-pad"
                      maxLength={3}
                      value={walkInAge}
                      onChangeText={(val) => {
                        setWalkInAge(val);
                        if (walkInErrors.age) {
                          setWalkInErrors((prev) => ({ ...prev, age: undefined }));
                        }
                      }}
                    />
                    {walkInErrors.age && (
                      <Text style={styles.walkInErrorText}>{walkInErrors.age}</Text>
                    )}
                  </View>

                  {/* Gender */}
                  <View style={[styles.walkInFieldGroup, { flex: 1.35 }]}>
                    <Text
                      style={[
                        styles.walkInFieldLabel,
                        { color: theme.textMuted },
                      ]}
                    >
                      GENDER <Text style={styles.walkInRequiredStar}>*</Text>
                    </Text>
                    <View style={styles.genderButtonGroup}>
                      {(['Male', 'Female', 'Other'] as const).map((g) => {
                        const isSelected = walkInGender === g;
                        return (
                          <TouchableOpacity
                            key={g}
                            style={[
                              styles.genderBtn,
                              {
                                backgroundColor: isSelected
                                  ? theme.primaryDeep
                                  : theme.inputBg,
                                borderColor: isSelected
                                  ? theme.accent
                                  : theme.cardBorder,
                              },
                            ]}
                            activeOpacity={0.7}
                            onPress={() => setWalkInGender(g)}
                          >
                            <Text
                              style={[
                                styles.genderBtnText,
                                {
                                  color: isSelected
                                    ? '#ffffff'
                                    : theme.textDark,
                                  fontWeight: isSelected ? '700' : '500',
                                },
                              ]}
                            >
                              {g}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>

                {/* 4. Hospital Selection */}
                <View style={styles.walkInFieldGroup}>
                  <Text
                    style={[styles.walkInFieldLabel, { color: theme.textMuted }]}
                  >
                    HOSPITAL / CLINIC <Text style={styles.walkInRequiredStar}>*</Text>
                  </Text>
                  <View style={styles.hospitalSelectionCol}>
                    {filteredHospitals.map((hosp: HospitalInfo) => {
                      const isSelected = walkInHospitalId === hosp.id;
                      const remaining = walkInAllocations[hosp.id] ?? 0;
                      const isFull = remaining <= 0;

                      return (
                        <TouchableOpacity
                          key={hosp.id}
                          disabled={isFull}
                          style={[
                            styles.hospitalCardOption,
                            {
                              backgroundColor: isSelected
                                ? (isDark ? '#142a2d' : '#e6f7f9')
                                : theme.inputBg,
                              borderColor: isSelected
                                ? theme.accent
                                : theme.cardBorder,
                              opacity: isFull ? 0.5 : 1,
                            },
                          ]}
                          activeOpacity={0.75}
                          onPress={() => {
                            setWalkInHospitalId(hosp.id);
                            if (walkInErrors.hospital) {
                              setWalkInErrors((prev) => ({
                                ...prev,
                                hospital: undefined,
                              }));
                            }
                          }}
                        >
                          <View style={styles.hospOptionLeft}>
                            <View
                              style={[
                                styles.hospDotLarge,
                                { backgroundColor: hosp.accentColor },
                              ]}
                            />
                            <View>
                              <Text
                                style={[
                                  styles.hospOptionName,
                                  {
                                    color: theme.textDark,
                                    fontWeight: isSelected ? '700' : '600',
                                  },
                                ]}
                              >
                                {hosp.name}
                              </Text>
                              <Text
                                style={[
                                  styles.hospOptionRoom,
                                  { color: theme.textMuted },
                                ]}
                              >
                                {hosp.room}
                              </Text>
                            </View>
                          </View>

                          <TouchableOpacity
                            style={[
                              styles.hospRemainingBadge,
                              {
                                backgroundColor: isFull
                                  ? (isDark ? '#2a1616' : '#fee2e2')
                                  : (isDark ? '#112920' : '#dcfce7'),
                                borderColor: isFull
                                  ? (isDark ? '#7f1d1d' : '#fca5a5')
                                  : (isDark ? '#166534' : '#86efac'),
                                borderWidth: 1,
                              },
                            ]}
                            activeOpacity={0.7}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              handleOpenEditSlotsModal(hosp.id);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Edit ${hosp.shortName} available slots`}
                          >
                            <Text
                              style={[
                                styles.hospRemainingBadgeText,
                                {
                                  color: isFull ? '#dc2626' : '#15803d',
                                },
                              ]}
                            >
                              {isFull ? 'Full' : `${remaining} slots left`}
                            </Text>
                            <Ionicons
                              name="pencil"
                              size={11}
                              color={isFull ? '#dc2626' : '#15803d'}
                              style={{ marginLeft: 5 }}
                            />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {walkInErrors.hospital && (
                    <Text style={styles.walkInErrorText}>
                      {walkInErrors.hospital}
                    </Text>
                  )}
                </View>

                {/* 5. Reason for Consultation */}
                <View style={styles.walkInFieldGroup}>
                  <Text
                    style={[styles.walkInFieldLabel, { color: theme.textMuted }]}
                  >
                    REASON FOR VISIT <Text style={styles.walkInRequiredStar}>*</Text>
                  </Text>

                  {/* Fast quick-chips */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.quickChipsRow}
                  >
                    {[
                      'Urgent Consultation',
                      'Fever & Cold',
                      'Severe Headache',
                      'Chest Discomfort',
                      'Routine Follow-up',
                    ].map((chip) => (
                      <TouchableOpacity
                        key={chip}
                        style={[
                          styles.quickChip,
                          {
                            backgroundColor:
                              walkInReason === chip
                                ? theme.primaryDeep
                                : (isDark ? '#192b2e' : '#eaf4f6'),
                            borderColor:
                              walkInReason === chip
                                ? theme.accent
                                : theme.cardBorder,
                          },
                        ]}
                        activeOpacity={0.7}
                        onPress={() => {
                          setWalkInReason(chip);
                          if (walkInErrors.reason) {
                            setWalkInErrors((prev) => ({
                              ...prev,
                              reason: undefined,
                            }));
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.quickChipText,
                            {
                              color:
                                walkInReason === chip
                                  ? '#ffffff'
                                  : theme.primaryDeep,
                            },
                          ]}
                        >
                          {chip}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <TextInput
                    style={[
                      styles.walkInTextInput,
                      styles.walkInTextarea,
                      {
                        backgroundColor: theme.inputBg,
                        borderColor: walkInErrors.reason
                          ? '#ef4444'
                          : theme.cardBorder,
                        color: theme.textDark,
                      },
                    ]}
                    placeholder="Enter symptoms or consultation reason..."
                    placeholderTextColor={theme.textMuted}
                    value={walkInReason}
                    multiline
                    numberOfLines={2}
                    onChangeText={(val) => {
                      setWalkInReason(val);
                      if (walkInErrors.reason) {
                        setWalkInErrors((prev) => ({
                          ...prev,
                          reason: undefined,
                        }));
                      }
                    }}
                  />
                  {walkInErrors.reason && (
                    <Text style={styles.walkInErrorText}>
                      {walkInErrors.reason}
                    </Text>
                  )}
                </View>

                {/* Form Action Buttons */}
                <View style={styles.walkInFormBtnRow}>
                  <TouchableOpacity
                    style={[
                      styles.walkInCancelBtn,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                    activeOpacity={0.8}
                    onPress={handleCloseWalkInModal}
                  >
                    <Text
                      style={[
                        styles.walkInCancelBtnText,
                        { color: theme.textMedium },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.walkInSubmitBtn,
                      { backgroundColor: theme.primaryDeep },
                    ]}
                    activeOpacity={0.85}
                    onPress={handleSubmitWalkInSlot}
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={18}
                      color="#ffffff"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.walkInSubmitBtnText}>
                      Confirm & Add Slot
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* ─────────────────────────────────────────────────────────
          A. REMOVE CONFIRMATION MODAL (GUARANTEED TO WORK ON WEB)
         ───────────────────────────────────────────────────────── */}
      <Modal
        visible={isRemoveModalVisible && walkInToDelete !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setIsRemoveModalVisible(false);
          setWalkInToDelete(null);
        }}
      >
        <View style={styles.dialogBackdropOverlay}>
          <TouchableOpacity
            style={styles.backdropTapArea}
            activeOpacity={1}
            onPress={() => {
              setIsRemoveModalVisible(false);
              setWalkInToDelete(null);
            }}
          />

          <View
            style={[styles.dialogCard, { backgroundColor: theme.sheetBg }]}
            accessibilityRole="alert"
            aria-modal={true}
          >
            <View style={styles.dialogWarningIconWrap}>
              <Ionicons name="alert-circle" size={32} color="#dc2626" />
            </View>

            <Text style={[styles.dialogTitle, { color: theme.textDark }]}>
              Remove Walk-in Slot?
            </Text>

            <Text style={[styles.dialogBody, { color: theme.textMedium }]}>
              Are you sure you want to remove{' '}
              <Text style={{ fontWeight: '700', color: theme.textDark }}>
                {walkInToDelete?.patientName} ({walkInToDelete?.token})
              </Text>{' '}
              from the schedule? The walk-in allocation will be restored to{' '}
              {HOSPITALS[walkInToDelete?.hospitalId || 'cgh']?.shortName || 'clinic'}.
            </Text>

            <View style={styles.dialogButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.dialogKeepBtn,
                  { backgroundColor: isDark ? '#1e3034' : '#f1f5f9' },
                ]}
                onPress={() => {
                  setIsRemoveModalVisible(false);
                  setWalkInToDelete(null);
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Keep slot"
              >
                <Text style={[styles.dialogKeepBtnText, { color: theme.textMedium }]}>
                  Keep Slot
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dialogRemoveBtn}
                onPress={() => {
                  if (walkInToDelete) executeRemoveWalkIn(walkInToDelete);
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Confirm remove slot"
              >
                <Ionicons name="trash-outline" size={16} color="#ffffff" style={{ marginRight: 4 }} />
                <Text style={styles.dialogRemoveBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────
          B. EDIT AVAILABLE SLOTS MODAL
         ───────────────────────────────────────────────────────── */}
      <Modal
        visible={isEditSlotsModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsEditSlotsModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdropOverlay}
        >
          <TouchableOpacity
            style={styles.backdropTapArea}
            activeOpacity={1}
            onPress={() => setIsEditSlotsModalVisible(false)}
          />

          <View
            style={[
              styles.editSlotsSheetContainer,
              { backgroundColor: theme.sheetBg },
            ]}
          >
            <View style={styles.dragHandle} />

            <View style={styles.editSlotsSheetHeader}>
              <View>
                <Text style={[styles.editSlotsSheetTitle, { color: theme.textDark }]}>
                  Edit Available Slots
                </Text>
                <Text style={[styles.editSlotsSheetSubtitle, { color: theme.textMuted }]}>
                  Adjust walk-in queue capacity for today's clinic
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.sheetCloseBtn,
                  { backgroundColor: isDark ? '#192b2e' : '#f1f5f9' },
                ]}
                onPress={() => setIsEditSlotsModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close edit slots modal"
              >
                <Ionicons name="close" size={20} color={theme.textMedium} />
              </TouchableOpacity>
            </View>

            {/* Hospital Dropdown Selector */}
            <Text style={[styles.editSlotsSectionLabel, { color: theme.textMuted }]}>
              SELECT HOSPITAL / CLINIC
            </Text>

            <View style={styles.editSlotsDropdownWrap}>
              <TouchableOpacity
                style={[
                  styles.editSlotsDropdownTrigger,
                  {
                    backgroundColor: isDark ? '#142326' : '#f8fafc',
                    borderColor: isEditSlotsHospDropdownOpen ? theme.accent : theme.cardBorder,
                  },
                ]}
                onPress={() => setIsEditSlotsHospDropdownOpen((prev) => !prev)}
                activeOpacity={0.8}
                accessibilityRole="combobox"
                accessibilityLabel="Select hospital"
              >
                <View style={styles.editSlotsDropdownTriggerLeft}>
                  <View
                    style={[
                      styles.hospDotDropdown,
                      {
                        backgroundColor:
                          HOSPITALS[editSlotsHospitalId]?.accentColor || theme.accent,
                      },
                    ]}
                  />
                  <View>
                    <Text
                      style={[
                        styles.editSlotsDropdownSelectedName,
                        { color: theme.textDark },
                      ]}
                    >
                      {HOSPITALS[editSlotsHospitalId]?.name || 'City General Hospital'}
                    </Text>
                    <Text
                      style={[
                        styles.editSlotsDropdownSelectedSub,
                        { color: theme.textMuted },
                      ]}
                    >
                      {HOSPITALS[editSlotsHospitalId]?.room} ·{' '}
                      {walkInAllocations[editSlotsHospitalId] ?? 0} slots currently available
                    </Text>
                  </View>
                </View>

                <Ionicons
                  name={isEditSlotsHospDropdownOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={theme.accent}
                />
              </TouchableOpacity>

              {/* Dropdown Menu Items */}
              {isEditSlotsHospDropdownOpen && (
                <View
                  style={[
                    styles.editSlotsDropdownMenu,
                    {
                      backgroundColor: isDark ? '#16272a' : '#ffffff',
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  {Object.values(HOSPITALS).map((hosp) => {
                    const isSelected = editSlotsHospitalId === hosp.id;
                    const count = walkInAllocations[hosp.id] ?? hosp.walkInCapacity;

                    return (
                      <TouchableOpacity
                        key={hosp.id}
                        style={[
                          styles.editSlotsDropdownItem,
                          isSelected && {
                            backgroundColor: isDark ? '#1a3338' : '#e6f7f9',
                          },
                        ]}
                        onPress={() => {
                          setEditSlotsHospitalId(hosp.id);
                          setEditSlotsCount(count);
                          setIsEditSlotsHospDropdownOpen(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.editSlotsDropdownItemLeft}>
                          <View
                            style={[
                              styles.hospDotDropdown,
                              { backgroundColor: hosp.accentColor },
                            ]}
                          />
                          <View>
                            <Text
                              style={[
                                styles.editSlotsDropdownItemTitle,
                                {
                                  color: theme.textDark,
                                  fontWeight: isSelected ? '700' : '600',
                                },
                              ]}
                            >
                              {hosp.name}
                            </Text>
                            <Text
                              style={[
                                styles.editSlotsDropdownItemSub,
                                { color: theme.textMuted },
                              ]}
                            >
                              {hosp.room} · {hosp.shiftName}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.editSlotsDropdownItemRight}>
                          <View
                            style={[
                              styles.editSlotsDropdownBadge,
                              {
                                backgroundColor: isDark ? '#142023' : '#f1f5f9',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.editSlotsDropdownBadgeText,
                                { color: hosp.accentColor },
                              ]}
                            >
                              {count} slots
                            </Text>
                          </View>
                          {isSelected && (
                            <Ionicons
                              name="checkmark-circle"
                              size={18}
                              color={theme.accent}
                              style={{ marginLeft: 6 }}
                            />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Stepper Count Display */}
            <Text style={[styles.editSlotsSectionLabel, { color: theme.textMuted }]}>
              AVAILABLE WALK-IN SLOTS COUNT
            </Text>
            <View
              style={[
                styles.stepperContainer,
                {
                  backgroundColor: isDark ? '#142326' : '#f8fafc',
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.stepperActionBtn,
                  {
                    backgroundColor: isDark ? '#1e3236' : '#ffffff',
                    borderColor: theme.cardBorder,
                  },
                ]}
                onPress={() => setEditSlotsCount((prev) => Math.max(0, prev - 1))}
                disabled={editSlotsCount <= 0}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Decrease slots count"
              >
                <Ionicons
                  name="remove"
                  size={24}
                  color={editSlotsCount <= 0 ? '#94a3b8' : theme.accent}
                />
              </TouchableOpacity>

              <View style={styles.stepperValueCol}>
                <TextInput
                  style={[styles.stepperNumberInput, { color: theme.textDark }]}
                  keyboardType="numeric"
                  value={String(editSlotsCount)}
                  onChangeText={(val) => {
                    const num = parseInt(val, 10);
                    if (!isNaN(num)) {
                      setEditSlotsCount(Math.min(50, Math.max(0, num)));
                    } else if (val === '') {
                      setEditSlotsCount(0);
                    }
                  }}
                  selectTextOnFocus
                />
                <Text style={[styles.stepperSubtitle, { color: theme.textMuted }]}>
                  slots remaining
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.stepperActionBtn,
                  {
                    backgroundColor: isDark ? '#1e3236' : '#ffffff',
                    borderColor: theme.cardBorder,
                  },
                ]}
                onPress={() => setEditSlotsCount((prev) => Math.min(50, prev + 1))}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Increase slots count"
              >
                <Ionicons
                  name="add"
                  size={24}
                  color={theme.accent}
                />
              </TouchableOpacity>
            </View>

            {/* Quick Preset Buttons */}
            <Text style={[styles.editSlotsSectionLabel, { color: theme.textMuted }]}>
              QUICK PRESETS
            </Text>
            <View style={styles.presetsRow}>
              {[0, 3, 5, 8, 10, 15].map((preset) => {
                const isSelected = editSlotsCount === preset;
                return (
                  <TouchableOpacity
                    key={preset}
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: isSelected
                          ? theme.primaryDeep
                          : isDark
                          ? '#16272a'
                          : '#ffffff',
                        borderColor: isSelected ? theme.accent : theme.cardBorder,
                      },
                    ]}
                    onPress={() => setEditSlotsCount(preset)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        {
                          color: isSelected ? '#ffffff' : theme.textMedium,
                          fontWeight: isSelected ? '700' : '600',
                        },
                      ]}
                    >
                      {preset} slots
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Modal Actions */}
            <View style={styles.editSlotsActionsRow}>
              <TouchableOpacity
                style={[
                  styles.editSlotsCancelBtn,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.cardBorder,
                  },
                ]}
                onPress={() => setIsEditSlotsModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.editSlotsCancelBtnText, { color: theme.textMedium }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.editSlotsSaveBtn,
                  { backgroundColor: theme.primaryDeep },
                ]}
                onPress={handleSaveAvailableSlots}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.editSlotsSaveBtnText}>
                  Save Available Slots
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─────────────────────────────────────────────────────────
          C. EDIT WALK-IN PATIENT / APPOINTMENT MODAL
         ───────────────────────────────────────────────────────── */}
      <Modal
        visible={isEditWalkInModalVisible && editingWalkInAppt !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setIsEditWalkInModalVisible(false);
          setEditingWalkInAppt(null);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdropOverlay}
        >
          <TouchableOpacity
            style={styles.backdropTapArea}
            activeOpacity={1}
            onPress={() => {
              setIsEditWalkInModalVisible(false);
              setEditingWalkInAppt(null);
            }}
          />

          <View
            style={[
              styles.editWalkInSheetContainer,
              { backgroundColor: theme.sheetBg },
            ]}
          >
            <View style={styles.dragHandle} />

            <View style={styles.editSlotsSheetHeader}>
              <View>
                <Text style={[styles.editSlotsSheetTitle, { color: theme.textDark }]}>
                  Edit Walk-in Slot
                </Text>
                <Text style={[styles.editSlotsSheetSubtitle, { color: theme.textMuted }]}>
                  {editingWalkInAppt?.token} · {HOSPITALS[editingWalkInAppt?.hospitalId || 'cgh']?.shortName}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.sheetCloseBtn,
                  { backgroundColor: isDark ? '#192b2e' : '#f1f5f9' },
                ]}
                onPress={() => {
                  setIsEditWalkInModalVisible(false);
                  setEditingWalkInAppt(null);
                }}
              >
                <Ionicons name="close" size={20} color={theme.textMedium} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 380 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Patient Name */}
              <View style={styles.walkInFieldGroup}>
                <Text style={[styles.walkInFieldLabel, { color: theme.textMuted }]}>
                  PATIENT NAME *
                </Text>
                <View
                  style={[
                    styles.walkInInputWrap,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <TextInput
                    style={[styles.walkInInput, { color: theme.textDark }]}
                    placeholder="Patient Name"
                    placeholderTextColor={theme.textMuted}
                    value={editPatientName}
                    onChangeText={setEditPatientName}
                  />
                </View>
              </View>

              {/* Age & Gender */}
              <View style={styles.walkInRowGroup}>
                <View style={[styles.walkInFieldGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={[styles.walkInFieldLabel, { color: theme.textMuted }]}>
                    AGE
                  </Text>
                  <View
                    style={[
                      styles.walkInInputWrap,
                      {
                        backgroundColor: theme.inputBg,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                  >
                    <TextInput
                      style={[styles.walkInInput, { color: theme.textDark }]}
                      keyboardType="numeric"
                      placeholder="e.g. 35"
                      placeholderTextColor={theme.textMuted}
                      value={editPatientAge}
                      onChangeText={setEditPatientAge}
                    />
                  </View>
                </View>

                <View style={[styles.walkInFieldGroup, { flex: 1.5 }]}>
                  <Text style={[styles.walkInFieldLabel, { color: theme.textMuted }]}>
                    GENDER
                  </Text>
                  <View style={styles.genderRow}>
                    {(['Male', 'Female', 'Other'] as const).map((g) => {
                      const isSelected = editPatientGender === g;
                      return (
                        <TouchableOpacity
                          key={g}
                          style={[
                            styles.genderBtn,
                            {
                              backgroundColor: isSelected
                                ? theme.primaryDeep
                                : theme.inputBg,
                              borderColor: isSelected
                                ? theme.accent
                                : theme.cardBorder,
                            },
                          ]}
                          onPress={() => setEditPatientGender(g)}
                        >
                          <Text
                            style={[
                              styles.genderBtnText,
                              {
                                color: isSelected ? '#ffffff' : theme.textDark,
                                fontWeight: isSelected ? '700' : '500',
                              },
                            ]}
                          >
                            {g}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* Time & Status */}
              <View style={styles.walkInRowGroup}>
                <View style={[styles.walkInFieldGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={[styles.walkInFieldLabel, { color: theme.textMuted }]}>
                    TIME
                  </Text>
                  <View
                    style={[
                      styles.walkInInputWrap,
                      {
                        backgroundColor: theme.inputBg,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                  >
                    <TextInput
                      style={[styles.walkInInput, { color: theme.textDark }]}
                      placeholder="e.g. 03:51 PM"
                      placeholderTextColor={theme.textMuted}
                      value={editPatientTime}
                      onChangeText={setEditPatientTime}
                    />
                  </View>
                </View>

                <View style={[styles.walkInFieldGroup, { flex: 1.2 }]}>
                  <Text style={[styles.walkInFieldLabel, { color: theme.textMuted }]}>
                    STATUS
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {(['Waiting', 'Done'] as const).map((st) => {
                      const isSel = editPatientStatus === st;
                      return (
                        <TouchableOpacity
                          key={st}
                          style={[
                            styles.genderBtn,
                            {
                              flex: 1,
                              backgroundColor: isSel
                                ? st === 'Done'
                                  ? '#059669'
                                  : '#d97706'
                                : theme.inputBg,
                              borderColor: isSel ? 'transparent' : theme.cardBorder,
                            },
                          ]}
                          onPress={() => setEditPatientStatus(st)}
                        >
                          <Text
                            style={[
                              styles.genderBtnText,
                              {
                                color: isSel ? '#ffffff' : theme.textDark,
                                fontWeight: isSel ? '700' : '500',
                              },
                            ]}
                          >
                            {st}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* Reason */}
              <View style={styles.walkInFieldGroup}>
                <Text style={[styles.walkInFieldLabel, { color: theme.textMuted }]}>
                  REASON / SYMPTOMS
                </Text>
                <View
                  style={[
                    styles.walkInInputWrap,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <TextInput
                    style={[styles.walkInInput, { color: theme.textDark }]}
                    placeholder="Enter reason for visit"
                    placeholderTextColor={theme.textMuted}
                    value={editPatientReason}
                    onChangeText={setEditPatientReason}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.editSlotsActionsRow}>
              <TouchableOpacity
                style={[
                  styles.editSlotsCancelBtn,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.cardBorder,
                  },
                ]}
                onPress={() => {
                  setIsEditWalkInModalVisible(false);
                  setEditingWalkInAppt(null);
                }}
              >
                <Text style={[styles.editSlotsCancelBtnText, { color: theme.textMedium }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.editSlotsSaveBtn,
                  { backgroundColor: theme.primaryDeep },
                ]}
                onPress={handleSaveEditedWalkIn}
              >
                <Ionicons name="checkmark" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.editSlotsSaveBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─────────────────────────────────────────────────────────
          FLOATING TOAST NOTIFICATION
         ───────────────────────────────────────────────────────── */}
      {toastMessage && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              opacity: toastFade,
              backgroundColor: isDark ? '#1a3338' : '#0b4f5a',
            },
          ]}
        >
          <Ionicons
            name="information-circle-outline"
            size={18}
            color="#ffffff"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLESHEET
// Clean clinic aesthetic:
// - Max width 440px centered on desktop
// - Soft light-teal background (#eef6f8)
// - White cards with 20-22px rounded corners
// - Deep teal primary (#0b4f5a), teal accent (#0e8a96)
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  outerFrame: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
  },
  mobileContainer: {
    width: '100%',
    maxWidth: 440,
    flex: 1,
    position: 'relative',
    ...Platform.select({
      web: {
        fontFamily:
          'Lexend, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        boxShadow: '0 4px 24px rgba(11, 79, 90, 0.08)',
      },
    }),
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },

  // 1. Header Row
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  homeBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatarBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  doctorInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  doctorSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineMiniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  doctorSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  bellButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  redDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#ef4444',
  },

  // 2. Title Section
  titleSection: {
    marginBottom: 16,
  },
  dateBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerDateLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenTitle: {
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  filterButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonActive: {
    borderWidth: 0,
  },

  // 3. Week Strip
  weekStripContainer: {
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  weekControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  weekNavGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekNavArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekRangeText: {
    fontSize: 14,
    fontWeight: '700',
    marginHorizontal: 10,
  },
  todayPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
  },
  todayPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayBox: {
    width: 44,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
  },
  dayBoxSelected: {
    borderWidth: 0,
    elevation: 3,
    shadowColor: '#0b4f5a',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  dayBoxWeekend: {
    borderStyle: 'dashed',
  },
  dayWeekday: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  dayDateNum: {
    fontSize: 16,
    fontWeight: '700',
  },
  dayTextSelected: {
    color: '#d9f2f5',
  },
  dayTextSelectedBold: {
    color: '#ffffff',
    fontWeight: '800',
  },
  todayUnderline: {
    position: 'absolute',
    bottom: 7,
    width: 14,
    height: 2.5,
    borderRadius: 1.5,
  },
  leaveOffBadge: {
    position: 'absolute',
    top: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: '#fef3c7',
  },
  leaveOffText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#b45309',
    textTransform: 'uppercase',
  },

  // 4. Hospital Dropdown
  dropdownWrapper: {
    position: 'relative',
    zIndex: 50,
    marginBottom: 16,
  },
  dropdownPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  colorDotSmall: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  dropdownButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 100,
    elevation: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  dropdownMenuItemActive: {},
  dropdownMenuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownItemTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  dropdownItemSub: {
    fontSize: 11,
    marginTop: 1,
  },
  dropdownItemBadge: {
    fontSize: 12,
    fontWeight: '700',
  },

  // 5. Shift Cards
  shiftsSection: {
    marginBottom: 20,
    gap: 12,
  },
  shiftCard: {
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    position: 'relative',
    overflow: 'visible',
  },
  shiftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  shiftTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shiftIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  shiftNameText: {
    fontSize: 15,
    fontWeight: '800',
  },
  shiftTimeText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  hospitalTagRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  hospitalTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  hospitalTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressSection: {
    marginBottom: 14,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  statNumber: {
    fontWeight: '800',
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
  },
  shiftFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    position: 'relative',
  },
  avgConsultRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avgConsultText: {
    fontSize: 12,
    marginLeft: 5,
    fontWeight: '500',
  },
  breakPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  breakPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  breakDropdownMenu: {
    position: 'absolute',
    bottom: 40,
    right: 0,
    minWidth: 230,
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 35,
    zIndex: 999999,
  },
  breakDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  breakDropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  breakOptionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  breakDropdownItemTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  breakDropdownItemSub: {
    fontSize: 10.5,
    marginTop: 1,
  },
  endBreakDropdownItem: {
    justifyContent: 'center',
    paddingVertical: 10,
  },
  endBreakDropdownText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ef4444',
  },
  toggleAllShiftsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.2,
    marginTop: -4,
    marginBottom: 8,
    alignSelf: 'center',
  },
  toggleAllShiftsBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // State Card (On Leave / No Clinics)
  stateCard: {
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  stateCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
  },
  stateCardSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  blockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#fffbeb',
  },
  blockedPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
  },

  // 6. Timeline
  timelineSection: {
    marginBottom: 20,
  },
  timelineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  timelineTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineHeading: {
    fontSize: 18,
    fontWeight: '800',
    marginRight: 8,
  },
  patientCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  patientCountText: {
    fontSize: 11,
    fontWeight: '800',
  },
  currentClockRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clockPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  clockTimeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyTimelineBox: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyTimelineText: {
    fontSize: 13,
    fontWeight: '500',
  },
  appointmentsList: {
    gap: 10,
  },

  // Highlighted NOW ATTENDING Card
  nowAttendingCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 16,
    marginBottom: 4,
  },
  nowAttendingTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tokenCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0b4f5a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenCircleText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  nowAttendingBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  nowAttendingLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginRight: 6,
  },
  inRoomBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  inRoomText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  nowPatientName: {
    fontSize: 16,
    fontWeight: '800',
  },
  nowPatientSub: {
    fontSize: 12,
    marginTop: 2,
  },
  nowAttendingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  nowFooterLeft: {
    flexDirection: 'column',
    gap: 4,
  },
  elapsedText: {
    fontSize: 11,
    fontWeight: '500',
  },
  openEhrPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  openEhrText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },

  // Regular Timeline Row
  timelineRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
  },
  timelineRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  timeBlock: {
    width: 68,
    marginRight: 8,
  },
  timeTextMain: {
    fontSize: 13,
    fontWeight: '800',
  },
  patientInfoBlock: {
    flex: 1,
  },
  rowPatientName: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowReasonText: {
    fontSize: 11,
    marginTop: 2,
  },
  rowTagRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  rowRightPillGroup: {
    alignItems: 'flex-end',
    gap: 6,
    marginLeft: 8,
  },
  statusPillSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusPillSmallText: {
    fontSize: 10,
    fontWeight: '700',
  },
  removeWalkInRowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  removeWalkInRowBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#dc2626',
  },

  // 7. Add Walk-In
  walkInSection: {
    marginBottom: 20,
    alignItems: 'center',
  },
  addWalkInButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 22,
    marginBottom: 10,
    elevation: 3,
    shadowColor: '#0b4f5a',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  addWalkInButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  allocationsContainer: {
    alignItems: 'center',
    gap: 3,
  },
  allocationText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // 8. Bottom Navigation Bar (5 tabs preserved)
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    borderTopWidth: 1,
    elevation: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 3,
  },
  tabLabelActive: {
    fontWeight: '700',
  },

  // Modal Sheet
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheetContainer: {
    width: '100%',
    maxWidth: 440,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  sheetScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetAvatarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sheetAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sheetAvatarText: {
    fontSize: 17,
    fontWeight: '800',
  },
  sheetNameCol: {
    flex: 1,
  },
  sheetPatientName: {
    fontSize: 17,
    fontWeight: '800',
  },
  sheetDemographics: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  allergyAlertBox: {
    flexDirection: 'row',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
  },
  allergyIconCol: {
    marginRight: 10,
    paddingTop: 1,
  },
  allergyAlertTitle: {
    color: '#b91c1c',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  allergyAlertDesc: {
    color: '#991b1b',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  noAllergyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  noAllergyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoGrid: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  infoGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  infoValueReason: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  infoDivider: {
    height: 1,
    marginVertical: 10,
  },
  hospitalBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 18,
  },
  hospBoxTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  hospBoxName: {
    fontSize: 13,
    fontWeight: '800',
  },
  hospBoxSub: {
    fontSize: 12,
    fontWeight: '500',
  },
  sheetBtnRemoveWalkIn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1.2,
    borderColor: '#fca5a5',
    paddingVertical: 12,
    borderRadius: 16,
    marginBottom: 10,
  },
  sheetBtnRemoveWalkInText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '700',
  },
  sheetBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sheetBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 18,
    borderWidth: 1,
  },
  sheetBtnSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
  },
  sheetBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 18,
  },
  sheetBtnPrimaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Walk-in Registration Modal
  keyboardAvoidingWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  walkInModalSheet: {
    width: '100%',
    maxWidth: 440,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  walkInModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#00000010',
  },
  walkInModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  walkInIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  walkInModalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  walkInModalSubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  walkInModalScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  walkInFieldGroup: {
    marginBottom: 16,
  },
  walkInFieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  walkInRequiredStar: {
    color: '#ef4444',
  },
  walkInTextInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: '600',
  },
  walkInTextarea: {
    minHeight: 64,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  walkInRowGroup: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  genderButtonGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  genderBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderBtnText: {
    fontSize: 13,
  },
  hospitalSelectionCol: {
    gap: 8,
  },
  hospitalCardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.2,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  hospOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  hospDotLarge: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  hospOptionName: {
    fontSize: 13,
  },
  hospOptionRoom: {
    fontSize: 11,
    marginTop: 2,
  },
  hospRemainingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  hospRemainingBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    lineHeight: 15,
  },
  quickChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    paddingVertical: 2,
  },
  quickChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  walkInErrorText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    marginLeft: 2,
  },
  walkInFormBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    paddingBottom: 10,
  },
  walkInCancelBtn: {
    flex: 0.8,
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkInCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  walkInSubmitBtn: {
    flex: 1.2,
    flexDirection: 'row',
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkInSubmitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Toast
  toastContainer: {
    position: 'absolute',
    bottom: 84,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 999,
    elevation: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  toastText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },

  // ─────────────────────────────────────────────────────────
  // Walk-in Row Actions (Edit & Remove)
  // ─────────────────────────────────────────────────────────
  walkInActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editWalkInRowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#99f6e4',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  editWalkInRowBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0d9488',
  },

  // ─────────────────────────────────────────────────────────
  // Allocations Container with Edit Slots Controls
  // ─────────────────────────────────────────────────────────
  allocationsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  allocationsHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  editSlotsHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(14, 138, 150, 0.1)',
  },
  editSlotsHeaderBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  allocationRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  allocationRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  hospDotSmall: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  quickAdjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickAdjustBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickAdjustCount: {
    fontSize: 12,
    fontWeight: '800',
    minWidth: 18,
    textAlign: 'center',
  },
  allocationPencilBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },

  // Patient detail sheet buttons
  sheetWalkInBtnsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  sheetBtnEditWalkIn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#f0fdfa',
    borderWidth: 1.5,
    borderColor: '#99f6e4',
  },
  sheetBtnEditWalkInText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f766e',
  },

  // ─────────────────────────────────────────────────────────
  // Custom Modals Styling
  // ─────────────────────────────────────────────────────────
  dialogBackdropOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    padding: 20,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 10,
  },
  dialogWarningIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  dialogBody: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  dialogButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  dialogKeepBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogKeepBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  dialogRemoveBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#dc2626',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(220, 38, 38, 0.25)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  dialogRemoveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },

  // Edit Slots Bottom Sheet
  editSlotsSheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 20,
    maxHeight: '90%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 8,
  },
  editSlotsSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  editSlotsSheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  editSlotsSheetSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  editSlotsSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  hospitalPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  hospPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  hospDotTiny: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  hospPillText: {
    fontSize: 11,
  },

  // Stepper
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    marginBottom: 16,
    width: '100%',
  },
  stepperActionBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
    flexShrink: 0,
  },
  stepperValueCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  stepperNumberInput: {
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'center',
    width: 80,
    padding: 0,
    height: 42,
  },
  stepperSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },

  // Presets
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  presetChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 11,
  },

  editSlotsActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  editSlotsCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editSlotsCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  editSlotsSaveBtn: {
    flex: 1.6,
    height: 46,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(11, 79, 90, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 5,
    elevation: 3,
  },
  editSlotsSaveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },

  // Edit Walk-in Sheet
  editWalkInSheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 20,
    maxHeight: '92%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 8,
  },
  backdropTapArea: {
    flex: 1,
  },
  modalBackdropOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 14,
  },
  walkInInputWrap: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  walkInInput: {
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 6,
  },

  // ─────────────────────────────────────────────────────────
  // Clean Aligned Available Slots Bar
  // ─────────────────────────────────────────────────────────
  allocationsCleanBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1.2,
    marginTop: 14,
  },
  allocationsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  allocationsCleanTitle: {
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  editSlotsCleanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 12,
    borderWidth: 1.2,
  },
  editSlotsCleanBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // ─────────────────────────────────────────────────────────
  // Hospital Dropdown Selector in Edit Available Slots Modal
  // ─────────────────────────────────────────────────────────
  editSlotsDropdownWrap: {
    marginBottom: 16,
    position: 'relative',
    zIndex: 99,
  },
  editSlotsDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  editSlotsDropdownTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  hospDotDropdown: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginRight: 10,
  },
  editSlotsDropdownSelectedName: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  editSlotsDropdownSelectedSub: {
    fontSize: 11,
    marginTop: 2,
  },
  editSlotsDropdownMenu: {
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  editSlotsDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  editSlotsDropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  editSlotsDropdownItemTitle: {
    fontSize: 12.5,
  },
  editSlotsDropdownItemSub: {
    fontSize: 10.5,
    marginTop: 2,
  },
  editSlotsDropdownItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editSlotsDropdownBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  editSlotsDropdownBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
