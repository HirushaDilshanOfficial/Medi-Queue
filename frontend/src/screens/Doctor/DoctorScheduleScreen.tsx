import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  Platform,
  useColorScheme,
  Animated,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  HOSPITALS,
  HospitalInfo,
  ScheduleAppointment,
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

  // Selected patient for bottom detail sheet
  const [selectedPatient, setSelectedPatient] = useState<ScheduleAppointment | null>(null);

  // Active bottom navigation tab
  const [activeTab, setActiveTab] = useState<'home' | 'queue' | 'records' | 'schedule' | 'rx'>(
    'schedule'
  );

  // Consultation elapsed counter for active patient
  const [elapsedMinutes, setElapsedMinutes] = useState(6);

  // Toast feedback system
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastFade] = useState(new Animated.Value(0));

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
    setIsHospitalDropdownOpen(false);
  };

  // Jump to Today (Tue Oct 6, 2026)
  const handleJumpToday = () => {
    const today = parseDateKey(REFERENCE_TODAY);
    setWeekAnchorDate(today);
    setSelectedDateKey(REFERENCE_TODAY);
    setSelectedHospitalId('all');
    setIsHospitalDropdownOpen(false);
    showToast('Jumped to Today (Oct 6, 2026)');
  };

  // Select day on week strip
  const handleSelectDay = (key: string) => {
    setSelectedDateKey(key);
    setSelectedHospitalId('all'); // Resets to "All hospitals" when day changes
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

  // Filtered appointments based on hospital dropdown
  const filteredAppointments = useMemo(() => {
    if (selectedHospitalId === 'all') {
      return dayAppointments;
    }
    return dayAppointments.filter((a) => a.hospitalId === selectedHospitalId);
  }, [dayAppointments, selectedHospitalId]);

  // Filtered shift cards based on hospital dropdown
  const filteredHospitals = useMemo(() => {
    if (selectedHospitalId === 'all') {
      return dayHospitals;
    }
    return dayHospitals.filter((h) => h.id === selectedHospitalId);
  }, [dayHospitals, selectedHospitalId]);

  // Patient now attending (if any in filtered list)
  const nowAttendingPatient = useMemo(() => {
    return filteredAppointments.find((a) => a.status === 'Now attending');
  }, [filteredAppointments]);

  // Other appointments (Done, Waiting, Scheduled)
  const regularAppointments = useMemo(() => {
    return filteredAppointments.filter((a) => a.status !== 'Now attending');
  }, [filteredAppointments]);

  // ─────────────────────────────────────────────────────────
  // WALK-IN SLOT HANDLER
  // ─────────────────────────────────────────────────────────

  const handleAddWalkInSlot = () => {
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
    const targetHospitalId =
      selectedHospitalId !== 'all' ? selectedHospitalId : dayHospitals[0]?.id || 'cgh';
    const remaining = walkInAllocations[targetHospitalId] ?? 0;

    if (remaining <= 0) {
      const hName = HOSPITALS[targetHospitalId]?.shortName || 'Selected hospital';
      showToast(`No walk-in slots remaining for ${hName}`);
      return;
    }

    // Decrement allocation
    setWalkInAllocations((prev) => ({
      ...prev,
      [targetHospitalId]: (prev[targetHospitalId] || 0) - 1,
    }));

    // Create walk-in appointment
    const targetHospital = HOSPITALS[targetHospitalId];
    const walkInTokenNum = 50 + Math.floor(Math.random() * 40);
    const newAppointment: ScheduleAppointment = {
      id: `walkin-${Date.now()}`,
      time: '11:15 AM',
      patientName: `Walk-in Patient #${Math.floor(100 + Math.random() * 900)}`,
      reason: 'Urgent Consultation',
      token: `Token #${String(walkInTokenNum).padStart(3, '0')}`,
      status: 'Waiting',
      hospitalId: targetHospitalId,
      age: 34,
      sex: 'Male',
      bloodGroup: 'B+',
      nic: `1992${Math.floor(10000000 + Math.random() * 90000000)}`,
      phone: '077 555 0192',
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

    showToast(
      `+ Added walk-in token ${newAppointment.token} at ${targetHospital.shortName}`
    );
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
  const isTodaySelected = selectedDateKey === REFERENCE_TODAY;

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

                {/* Jump to Today Button */}
                <TouchableOpacity
                  style={[
                    styles.todayPill,
                    {
                      backgroundColor: isTodaySelected
                        ? theme.primaryDeep
                        : theme.tint,
                    },
                  ]}
                  onPress={handleJumpToday}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.todayPillText,
                      {
                        color: isTodaySelected ? '#ffffff' : theme.primaryDeep,
                      },
                    ]}
                  >
                    Today
                  </Text>
                </TouchableOpacity>
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
                      {dayAppointments.length} appts
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
                          {count} appts
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
            <View style={styles.shiftsSection}>
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
              ) : filteredHospitals.length === 0 ? (
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
                /* Scenario C: Render shift card per hospital */
                filteredHospitals.map((hosp: HospitalInfo) => {
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

                      {/* Card Footer: Avg 9m / patient & Break button */}
                      <View
                        style={[
                          styles.shiftFooter,
                          { borderTopColor: theme.divider },
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

                        <TouchableOpacity
                          style={[
                            styles.breakPillButton,
                            {
                              backgroundColor: theme.tint,
                              borderColor: theme.cardBorder,
                            },
                          ]}
                          activeOpacity={0.8}
                          onPress={() =>
                            showToast(
                              `15m break scheduled after current consultation at ${hosp.shortName}`
                            )
                          }
                        >
                          <MaterialCommunityIcons
                            name="coffee-outline"
                            size={14}
                            color={theme.primaryDeep}
                            style={{ marginRight: 4 }}
                          />
                          <Text
                            style={[
                              styles.breakPillText,
                              { color: theme.primaryDeep },
                            ]}
                          >
                            Take 15m break
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
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
            <View style={styles.timelineSection}>
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
              {filteredAppointments.length === 0 ? (
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
                    No appointments on this timeline
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

                        {/* Status Pill */}
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
                  "{Hospital}: 4 walk-in allocations remaining"
                - Tapping adds walk-in (today only) & reduces count
               ───────────────────────────────────────────────────────── */}
            <View style={styles.walkInSection}>
              <TouchableOpacity
                style={[
                  styles.addWalkInButton,
                  { backgroundColor: theme.primaryDeep },
                ]}
                activeOpacity={0.85}
                onPress={handleAddWalkInSlot}
              >
                <Ionicons
                  name="add"
                  size={20}
                  color="#ffffff"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.addWalkInButtonText}>
                  + Add walk-in slot
                </Text>
              </TouchableOpacity>

              {/* Allocations remaining text */}
              <View style={styles.allocationsContainer}>
                {filteredHospitals.map((hosp: HospitalInfo) => {
                  const remaining = walkInAllocations[hosp.id] ?? 0;
                  return (
                    <Text
                      key={hosp.id}
                      style={[
                        styles.allocationText,
                        { color: theme.textMuted },
                      ]}
                    >
                      {hosp.shortName}: {remaining} walk-in allocations remaining
                    </Text>
                  );
                })}
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
  statusPillSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  statusPillSmallText: {
    fontSize: 10,
    fontWeight: '700',
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
});
