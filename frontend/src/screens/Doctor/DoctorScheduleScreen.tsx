import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StatusBar,
  Image,
  Modal,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  fetchDoctorSchedule,
  addWalkInSlotApi,
  toggleDoctorBreakApi,
  DoctorScheduleData,
  ScheduleTimelineItem,
  toDateKey,
  formatRealtimeDateHeader,
  formatRealtimeClock,
  getRealtimeWeekDays,
} from '../../services/doctorService';

interface DoctorScheduleScreenProps {
  navigation?: any;
}

export default function DoctorScheduleScreen({ navigation }: DoctorScheduleScreenProps) {
  const { t } = useLanguage();
  const [data, setData] = useState<DoctorScheduleData>(fallbackScheduleData);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDayKey, setSelectedDayKey] = useState<string>(toDateKey(new Date()));
  const [liveClock, setLiveClock] = useState<string>(formatRealtimeClock(new Date()));
  const [activeTab, setActiveTab] = useState<'home' | 'queue' | 'records' | 'schedule' | 'rx'>('schedule');

  // Modals
  const [isWalkinModalOpen, setIsWalkinModalOpen] = useState(false);
  const [walkinName, setWalkinName] = useState('');
  const [walkinReason, setWalkinReason] = useState('');
  const [walkinAge, setWalkinAge] = useState('');
  const [walkinGender, setWalkinGender] = useState('Male');
  const [isSubmittingWalkin, setIsSubmittingWalkin] = useState(false);

  // EHR Modal for active patient
  const [isEhrModalOpen, setIsEhrModalOpen] = useState(false);
  const [ehrNotes, setEhrNotes] = useState('Patient reports mild recurring lower back stiffness after prolonged sitting. Range of motion intact. No radiating numbness.');

  // Break state modal
  const [isBreakModalOpen, setIsBreakModalOpen] = useState(false);
  const [breakTimerSeconds, setBreakTimerSeconds] = useState(15 * 60);
  const [breakActive, setBreakActive] = useState(false);

  // Filter
  const [activeFilter, setActiveFilter] = useState<'all' | 'done' | 'attending' | 'waiting' | 'scheduled'>('all');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Live timer for consultation elapsed
  const [elapsedMinutes, setElapsedMinutes] = useState(6);

  const loadSchedule = useCallback(async (dateKey: string) => {
    try {
      const res = await fetchDoctorSchedule(dateKey);
      if (res) {
        setData(res);
      }
    } catch (err) {
      console.log('Error fetching schedule:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSchedule(selectedDayKey);
  }, [loadSchedule, selectedDayKey]);

  // Live clock tick (every 10s)
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setLiveClock(formatRealtimeClock(new Date()));
    }, 10000);
    return () => clearInterval(clockTimer);
  }, []);

  // Elapsed timer tick
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedMinutes((prev) => prev + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Break countdown timer
  useEffect(() => {
    let interval: any = null;
    if (breakActive && breakTimerSeconds > 0) {
      interval = setInterval(() => {
        setBreakTimerSeconds((sec) => Math.max(0, sec - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [breakActive, breakTimerSeconds]);

  const onRefresh = () => {
    setRefreshing(true);
    loadSchedule(selectedDayKey);
  };

  const handleSelectDay = (dateKey: string) => {
    setSelectedDayKey(dateKey);
    const todayKey = toDateKey(new Date());

    // Calculate real-time dynamic date header for the selected day
    const [y, m, d] = dateKey.split('-').map(Number);
    const selectedDate = (!isNaN(y) && !isNaN(m) && !isNaN(d)) ? new Date(y, m - 1, d) : new Date();
    const dynamicHeader = formatRealtimeDateHeader(selectedDate);

    if (dateKey === todayKey) {
      setData((prev) => ({
        ...prev,
        dateHeader: dynamicHeader,
        selectedDayKey: dateKey,
      }));
      loadSchedule(dateKey);
    } else {
      loadSchedule(dateKey);
      setData((prev) => ({
        ...prev,
        dateHeader: dynamicHeader,
        selectedDayKey: dateKey,
        timeline: [],
      }));
    }
  };

  const handleTakeBreak = async () => {
    setIsBreakModalOpen(true);
  };

  const confirmStartBreak = async (minutes: number = 15) => {
    setBreakActive(true);
    setBreakTimerSeconds(minutes * 60);
    setData((prev) => ({
      ...prev,
      shift: {
        ...prev.shift,
        status: 'On Break',
        isOnBreak: true,
      },
    }));
    await toggleDoctorBreakApi(minutes);
    setIsBreakModalOpen(false);
    Alert.alert(t('Break Started'), t("Enjoy your {value0}-minute rest. Shift status set to \"On Break\".", { value0: String(minutes) }));
  };

  const resumeShift = async () => {
    setBreakActive(false);
    setData((prev) => ({
      ...prev,
      shift: {
        ...prev.shift,
        status: 'In Progress',
        isOnBreak: false,
      },
    }));
    await toggleDoctorBreakApi(0);
    Alert.alert(t('Shift Resumed'), t('Doctor is back online in Room 3B.'));
  };

  const handleAddWalkinSlot = async () => {
    if (!walkinName.trim()) {
      Alert.alert(t('Validation Error'), t('Please enter the patient name.'));
      return;
    }

    setIsSubmittingWalkin(true);
    const newCapacity = data.shift.totalCapacity + 1;
    const nextTokenNum = newCapacity;
    const reasonText = walkinReason.trim() || 'Urgent Walk-in Checkup';

    const newSlot: ScheduleTimelineItem = {
      id: `slot-walkin-${Date.now()}`,
      time: '12:00 PM',
      timeHour: '12:00',
      timePeriod: 'PM',
      patientName: walkinName.trim(),
      reason: `${reasonText} • Token #${String(nextTokenNum).padStart(3, '0')}`,
      tokenNumber: nextTokenNum,
      status: 'waiting',
      age: parseInt(walkinAge) || 30,
      gender: walkinGender,
    };

    // Update state immediately
    setData((prev) => ({
      ...prev,
      shift: {
        ...prev.shift,
        totalCapacity: prev.shift.totalCapacity + 1,
        waitingCount: prev.shift.waitingCount + 1,
        remainingWalkinSlots: Math.max(0, prev.shift.remainingWalkinSlots - 1),
      },
      timeline: [...prev.timeline, newSlot],
    }));

    await addWalkInSlotApi({
      patientName: walkinName.trim(),
      reason: reasonText,
      age: parseInt(walkinAge) || 30,
      gender: walkinGender,
    });

    setIsSubmittingWalkin(false);
    setIsWalkinModalOpen(false);
    setWalkinName('');
    setWalkinReason('');
    setWalkinAge('');

    Alert.alert(
      t('Walk-in Added'),
      t("Walk-in slot assigned for {value0} with Token #{value1}", { value0: String(newSlot.patientName), value1: String(String(nextTokenNum).padStart(3, '0')) })
    );
  };

  const handleTabPress = (tab: 'home' | 'queue' | 'records' | 'schedule' | 'rx') => {
    setActiveTab(tab);
    if (tab === 'home') {
      try {
        router.push('/(doctor)/dashboard' as any);
      } catch (e) {
        router.push('/dashboard' as any);
      }
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          if (!window.location.pathname.includes('dashboard')) {
            window.location.href = '/(doctor)/dashboard';
          }
        }, 120);
      }
    } else if (tab === 'queue') {
      try {
        router.push('/(doctor)/queue' as any);
      } catch (e) {
        router.push('/queue' as any);
      }
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          if (!window.location.pathname.includes('queue')) {
            window.location.href = '/(doctor)/queue';
          }
        }, 120);
      }
    } else if (tab === 'records') {
      try {
        router.push('/(doctor)/records' as any);
      } catch (e) {
        router.push('/records' as any);
      }
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          if (!window.location.pathname.includes('records')) {
            window.location.href = '/(doctor)/records';
          }
        }, 120);
      }
    } else if (tab === 'schedule') {
      // already on schedule
    } else if (tab === 'rx') {
      try {
        router.push('/(doctor)/prescription' as any);
      } catch (e) {
        router.push('/prescription' as any);
      }
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          if (!window.location.pathname.includes('prescription')) {
            window.location.href = '/(doctor)/prescription';
          }
        }, 120);
      }
    }
  };

  // Filtered timeline
  const filteredTimeline = useMemo(() => {
    if (activeFilter === 'all') return data.timeline;
    if (activeFilter === 'done') return data.timeline.filter((s) => s.status === 'done');
    if (activeFilter === 'attending') return data.timeline.filter((s) => s.status === 'now_attending');
    if (activeFilter === 'waiting') return data.timeline.filter((s) => s.status === 'waiting');
    if (activeFilter === 'scheduled') return data.timeline.filter((s) => s.status === 'scheduled');
    return data.timeline;
  }, [data.timeline, activeFilter]);

  const doctor = data.doctor;
  const shift = data.shift;
  const totalCapacity = shift.totalCapacity || 32;
  const consultedCount = shift.consultedCount || 18;
  const waitingCount = shift.waitingCount || 14;
  const progressRatio = Math.min(1, Math.max(0, consultedCount / totalCapacity));

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Main Content Area */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0d6371']} />}
      >
        {/* ========================================================= */}
        {/* 1. TOP PROFILE APP BAR                                    */}
        {/* ========================================================= */}
        <View style={styles.topProfileBar}>
          <View style={styles.profileLeft}>
            <View style={styles.avatarWrapper}>
              <Image
                source={{
                  uri:
                    doctor.avatarUrl ||
                    'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=200',
                }}
                style={styles.avatarImg}
              />
              <View style={styles.onlineGreenDot} />
            </View>
            <View style={styles.profileTextWrap}>
              <Text style={styles.profileName}>{doctor.name || t('Doctor')}</Text>
              <View style={styles.roomStatusRow}>
                <Text style={styles.roomStatusDot}>•</Text>
                <Text style={styles.roomStatusText}>{doctor.room || t('Room 3B Online')}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => Alert.alert(t('Notifications'), t('1 high priority walk-in request pending approval.'))}
          >
            <Ionicons name="notifications" size={22} color="#334155" />
            <View style={styles.redBadgeDot} />
          </TouchableOpacity>
        </View>

        {/* ========================================================= */}
        {/* 2. DATE SUBTITLE & HEADER TITLE WITH FILTER BUTTON       */}
        {/* ========================================================= */}
        <View style={styles.dateAndHeaderSection}>
          <View style={styles.dateSubRow}>
            <Ionicons name="calendar-outline" size={15} color="#0d6371" style={{ marginRight: 6 }} />
            <Text style={styles.dateSubText}>{data.dateHeader || formatRealtimeDateHeader(new Date())}</Text>
          </View>

          <View style={styles.titleWithFilterRow}>
            <Text style={styles.screenHeading}>{t("My Schedule")}</Text>
            <TouchableOpacity
              style={styles.filterBtn}
              onPress={() => setIsFilterModalOpen(true)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="tune-variant" size={20} color="#0d6371" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ========================================================= */}
        {/* 3. WEEKLY DAY SELECTOR STRIP (CAROUSEL)                  */}
        {/* ========================================================= */}
        <View style={styles.weekStripContainer}>
          {data.weekDays.map((item) => {
            const isSelected = item.dateKey === selectedDayKey;
            return (
              <TouchableOpacity
                key={item.dateKey}
                style={[styles.dayCard, isSelected && styles.dayCardActive]}
                onPress={() => handleSelectDay(item.dateKey)}
                activeOpacity={0.85}
              >
                <Text style={[styles.dayNameText, isSelected && styles.dayNameTextActive]}>
                  {item.dayName}
                </Text>
                <Text style={[styles.dayNumberText, isSelected && styles.dayNumberTextActive]}>
                  {item.dayNumber}
                </Text>
                {isSelected && <View style={styles.activeDayDot} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ========================================================= */}
        {/* 4. CURRENT SHIFT CARD (MORNING OPD SHIFT)                 */}
        {/* ========================================================= */}
        <View style={styles.shiftCard}>
          {/* Shift Header */}
          <View style={styles.shiftHeaderRow}>
            <View style={styles.shiftTitleLeft}>
              <View style={styles.shiftIconBox}>
                <MaterialCommunityIcons name="briefcase-plus-outline" size={19} color="#0d6371" />
              </View>
              <View>
                <Text style={styles.shiftTitleText}>{shift.title || t('Morning OPD Shift')}</Text>
                <View style={styles.shiftSubRow}>
                  <Text style={styles.shiftSubTime}>{shift.timeRange || '08:30 AM – 01:00 PM'}</Text>
                  <Text style={styles.shiftSubBullet}>•</Text>
                  <Text style={styles.shiftSubRoom}>{shift.room || t('Room 3B Ortho')}</Text>
                </View>
              </View>
            </View>

            {/* Shift Status Pill */}
            <View
              style={[
                styles.shiftStatusPill,
                shift.isOnBreak && { backgroundColor: '#fef3c7' },
              ]}
            >
              <View
                style={[
                  styles.shiftStatusGreenDot,
                  shift.isOnBreak && { backgroundColor: '#f59e0b' },
                ]}
              />
              <Text
                style={[
                  styles.shiftStatusText,
                  shift.isOnBreak && { color: '#b45309' },
                ]}
              >
                {t(shift.status ?? '') || t('In Progress')}
              </Text>
            </View>
          </View>

          {/* Counts & Progress Bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressCountsRow}>
              <Text style={styles.consultedCountText}>{consultedCount} {t("Consulted")}</Text>
              <Text style={styles.waitingCountText}>{waitingCount} {t("Waiting")}</Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${progressRatio * 100}%` }]} />
            </View>
          </View>

          {/* Shift Footer Row */}
          <View style={styles.shiftFooterRow}>
            <View style={styles.avgTimeWrap}>
              <Ionicons name="time-outline" size={16} color="#526b78" style={{ marginRight: 5 }} />
              <Text style={styles.avgTimeText}>{t("Avg.")}{' '}{shift.avgMinutesPerPatient || 9}{t("m / patient")}</Text>
            </View>

            {shift.isOnBreak ? (
              <TouchableOpacity
                style={[styles.breakBtn, { backgroundColor: '#ecfdf5' }]}
                onPress={resumeShift}
                activeOpacity={0.8}
              >
                <Ionicons name="play" size={15} color="#047857" style={{ marginRight: 5 }} />
                <Text style={[styles.breakBtnText, { color: '#047857' }]}>{t("Resume Shift")}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.breakBtn}
                onPress={handleTakeBreak}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="coffee-outline" size={16} color="#0d6371" style={{ marginRight: 5 }} />
                <Text style={styles.breakBtnText}>{t("Take 15m Break")}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ========================================================= */}
        {/* 5. TODAY'S TIMELINE SECTION HEADER                       */}
        {/* ========================================================= */}
        <View style={styles.timelineHeaderRow}>
          <View style={styles.timelineTitleWrap}>
            <Text style={styles.timelineTitle}>{t("Today's Timeline")}</Text>
            <View style={styles.patientsCountBadge}>
              <Text style={styles.patientsCountText}>{totalCapacity} {t("Patients")}</Text>
            </View>
          </View>
          <Text style={styles.currentSlotText}>{t("Current:")}{' '}{liveClock}</Text>
        </View>

        {/* ========================================================= */}
        {/* 6. TIMELINE APPOINTMENT LIST                             */}
        {/* ========================================================= */}
        <View style={styles.timelineList}>
          {filteredTimeline.map((item) => {
            // Case A: NOW ATTENDING HERO CARD
            if (item.status === 'now_attending' || item.isNowAttending) {
              return (
                <View key={item.id} style={styles.nowAttendingCard}>
                  {/* Top content row */}
                  <View style={styles.attendingContentRow}>
                    {/* Cyan circle with Token number */}
                    <View style={styles.tokenCircleCyan}>
                      <Text style={styles.tokenNumberBig}>{item.tokenNumber}</Text>
                    </View>

                    {/* Middle patient details */}
                    <View style={styles.attendingDetailsWrap}>
                      <View style={styles.nowAttendingBadgeRow}>
                        <Text style={styles.nowAttendingLabel}>{t("NOW ATTENDING •")}</Text>
                        <View style={styles.inRoomPill}>
                          <Ionicons name="enter-outline" size={13} color="#ffffff" style={{ marginRight: 4 }} />
                          <Text style={styles.inRoomPillText}>{t("In Room")}</Text>
                        </View>
                      </View>
                      <Text style={styles.attendingPatientName}>{item.patientName}</Text>
                      <Text style={styles.attendingReason}>{item.reason}</Text>
                    </View>
                  </View>

                  {/* Bottom footer with elapsed counter and EHR button */}
                  <View style={styles.attendingFooterRow}>
                    <View style={styles.elapsedCounterWrap}>
                      <Ionicons name="time-outline" size={15} color="#526b78" style={{ marginRight: 5 }} />
                      <Text style={styles.elapsedCounterText}>
                        {t("Consultation elapsed:")}{' '}{elapsedMinutes} {t("min")}</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.openEhrBtn}
                      onPress={() => setIsEhrModalOpen(true)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.openEhrBtnText}>{t("Open EHR")}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }

            // Case B: Standard Timeline Slots (Done / Waiting / Scheduled)
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.standardSlotRow}
                onPress={() => {
                  Alert.alert(
                    t("Token #{value0} - {value1}", { value0: String(item.tokenNumber), value1: String(item.patientName) }),
                    t("Reason: {value0}\nStatus: {value1}\nTime: {value2}", { value0: String(item.reason), value1: t(item.status.toUpperCase()), value2: String(item.time) })
                  );
                }}
                activeOpacity={0.7}
              >
                {/* Left Time Column */}
                <View style={styles.slotTimeColumn}>
                  <Text style={styles.slotTimeHour}>{item.timeHour}</Text>
                  <Text style={styles.slotTimePeriod}>{item.timePeriod}</Text>
                </View>

                {/* Middle Patient info */}
                <View style={styles.slotPatientInfo}>
                  <Text style={styles.slotPatientName}>{item.patientName}</Text>
                  <Text style={styles.slotReasonSub}>{item.reason}</Text>
                </View>

                {/* Right Status Badge */}
                <View style={styles.slotStatusRight}>
                  {item.status === 'done' && (
                    <View style={styles.badgeDone}>
                      <Ionicons name="checkmark" size={13} color="#526b78" style={{ marginRight: 3 }} />
                      <Text style={styles.badgeDoneText}>{t("Done")}</Text>
                    </View>
                  )}

                  {item.status === 'waiting' && (
                    <View style={styles.badgeWaiting}>
                      <Text style={styles.hourglassEmoji}>⏳</Text>
                      <Text style={styles.badgeWaitingText}>{t("Waiting")}</Text>
                    </View>
                  )}

                  {item.status === 'scheduled' && (
                    <View style={styles.badgeScheduled}>
                      <Text style={styles.badgeScheduledText}>{t("Scheduled")}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ========================================================= */}
        {/* 7. PRIMARY ACTION BUTTON: + ADD WALK-IN SLOT             */}
        {/* ========================================================= */}
        <View style={styles.walkinSection}>
          <TouchableOpacity
            style={styles.addWalkinBtn}
            onPress={() => setIsWalkinModalOpen(true)}
            activeOpacity={0.88}
          >
            <Ionicons name="person-add" size={18} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.addWalkinBtnText}>{t("+ Add Walk-in Slot")}</Text>
          </TouchableOpacity>

          <Text style={styles.walkinRemainingSubtext}>
            {t("Room 3B capacity:")}{' '}{shift.remainingWalkinSlots || 4} {t("walk-in allocations remaining for today")}</Text>
        </View>
      </ScrollView>

      {/* ========================================================= */}
      {/* 8. BOTTOM NAVIGATION BAR (5 TABS)                         */}
      {/* ========================================================= */}
      <View style={styles.bottomTabBar}>
        {/* Home */}
        <TouchableOpacity style={styles.tabItem} onPress={() => handleTabPress('home')}>
          <Ionicons name="home-outline" size={22} color={activeTab === 'home' ? '#0d6371' : '#64748b'} />
          <Text style={[styles.tabLabel, activeTab === 'home' && styles.tabLabelActive]}>{t("Home")}</Text>
        </TouchableOpacity>

        {/* Queue */}
        <TouchableOpacity style={styles.tabItem} onPress={() => handleTabPress('queue')}>
          <MaterialCommunityIcons
            name="ticket-confirmation-outline"
            size={23}
            color={activeTab === 'queue' ? '#0d6371' : '#64748b'}
          />
          <Text style={[styles.tabLabel, activeTab === 'queue' && styles.tabLabelActive]}>{t("Queue")}</Text>
        </TouchableOpacity>

        {/* Records */}
        <TouchableOpacity style={styles.tabItem} onPress={() => handleTabPress('records')}>
          <MaterialCommunityIcons
            name="folder-account-outline"
            size={22}
            color={activeTab === 'records' ? '#0d6371' : '#64748b'}
          />
          <Text style={[styles.tabLabel, activeTab === 'records' && styles.tabLabelActive]}>{t("Records")}</Text>
        </TouchableOpacity>

        {/* Schedule */}
        <TouchableOpacity style={styles.tabItem} onPress={() => handleTabPress('schedule')}>
          <MaterialCommunityIcons
            name="calendar-month-outline"
            size={22}
            color={activeTab === 'schedule' ? '#0d6371' : '#64748b'}
          />
          <Text style={[styles.tabLabel, activeTab === 'schedule' && styles.tabLabelActive]}>{t("Schedule")}</Text>
        </TouchableOpacity>

        {/* Prescription */}
        <TouchableOpacity style={styles.tabItem} onPress={() => handleTabPress('rx')}>
          <MaterialCommunityIcons
            name="clipboard-edit-outline"
            size={22}
            color={activeTab === 'rx' ? '#0d6371' : '#64748b'}
          />
          <Text
            numberOfLines={1}
            style={[styles.tabLabel, activeTab === 'rx' && styles.tabLabelActive]}
          >
            {t("Prescription")}</Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================= */}
      {/* MODAL 1: ADD WALK-IN SLOT                                 */}
      {/* ========================================================= */}
      <Modal visible={isWalkinModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="account-plus-outline" size={24} color="#0d6371" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>{t("Add Walk-in Slot")}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsWalkinModalOpen(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={styles.inputLabel}>{t("Patient Full Name *")}</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Ruwan Wickramasinghe"
                placeholderTextColor="#94a3b8"
                value={walkinName}
                onChangeText={setWalkinName}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{t("Age")}</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. 35"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={walkinAge}
                    onChangeText={setWalkinAge}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{t("Gender")}</Text>
                  <View style={styles.genderRow}>
                    {['Male', 'Female'].map((g) => (
                      <TouchableOpacity
                        key={g}
                        style={[styles.genderChip, walkinGender === g && styles.genderChipActive]}
                        onPress={() => setWalkinGender(g)}
                      >
                        <Text style={[styles.genderChipText, walkinGender === g && styles.genderChipTextActive]}>
                          {t(g)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <Text style={styles.inputLabel}>{t("Chief Complaint / Reason")}</Text>
              <TextInput
                style={[styles.textInput, { height: 70, textAlignVertical: 'top' }]}
                placeholder={t("e.g. Severe acute knee twist, dressing renewal")}
                placeholderTextColor="#94a3b8"
                multiline
                value={walkinReason}
                onChangeText={setWalkinReason}
              />

              <View style={styles.tokenNoticeBox}>
                <Ionicons name="information-circle-outline" size={18} color="#0d6371" style={{ marginRight: 6 }} />
                <Text style={styles.tokenNoticeText}>
                  {t("Allocating next Token #")}{String(totalCapacity + 1).padStart(3, '0')} {t("for Room 3B today.")}</Text>
              </View>
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsWalkinModalOpen(false)}
              >
                <Text style={styles.modalCancelBtnText}>{t("Cancel")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleAddWalkinSlot}
                disabled={isSubmittingWalkin}
              >
                {isSubmittingWalkin ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>{t("Confirm & Add Slot")}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 2: OPEN EHR (PATIENT MEDICAL RECORD)                 */}
      {/* ========================================================= */}
      <Modal visible={isEhrModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '88%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.ehrModalToken}>
                    {data.currentPatient ? t("Token #{value0}", { value0: String(data.currentPatient.tokenNumber) }) : t('No active token')}
                  </Text>
                  <Text style={styles.modalTitle}>{data.currentPatient?.patientName || t('No active patient')}</Text>
                </View>
                <Text style={styles.ehrSub}>{t("Male, 48 Years • File REC-841 • Room 3B")}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsEhrModalOpen(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Vitals summary cards */}
              <Text style={styles.sectionHeaderSmall}>{t("RECORDED VITALS (10:15 AM)")}</Text>
              <View style={styles.vitalsGrid}>
                <View style={styles.vitalCard}>
                  <Text style={styles.vitalLabel}>{t("Blood Pressure")}</Text>
                  <Text style={styles.vitalValue}>124/82</Text>
                  <Text style={styles.vitalUnit}>{t("mmHg (Normal)")}</Text>
                </View>
                <View style={styles.vitalCard}>
                  <Text style={styles.vitalLabel}>{t("Heart Rate")}</Text>
                  <Text style={styles.vitalValue}>76</Text>
                  <Text style={styles.vitalUnit}>bpm</Text>
                </View>
                <View style={styles.vitalCard}>
                  <Text style={styles.vitalLabel}>{t("Body Temp")}</Text>
                  <Text style={styles.vitalValue}>98.6</Text>
                  <Text style={styles.vitalUnit}>°F</Text>
                </View>
                <View style={styles.vitalCard}>
                  <Text style={styles.vitalLabel}>SpO2</Text>
                  <Text style={styles.vitalValue}>98%</Text>
                  <Text style={styles.vitalUnit}>{t("Room Air")}</Text>
                </View>
              </View>

              {/* Diagnosis / Complaint */}
              <Text style={styles.sectionHeaderSmall}>{t("REASON FOR VISIT")}</Text>
              <View style={styles.complaintBox}>
                <Text style={styles.complaintText}>
                  {t("Spine checkup & lumbar mobility assessment. Follow-up after 4 weeks of physiotherapy.")}</Text>
              </View>

              {/* Doctor's Clinical Consultation Notes */}
              <Text style={styles.sectionHeaderSmall}>{t("DOCTOR CLINICAL NOTES")}</Text>
              <TextInput
                style={styles.ehrNotesInput}
                multiline
                value={ehrNotes}
                onChangeText={setEhrNotes}
              />
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsEhrModalOpen(false)}
              >
                <Text style={styles.modalCancelBtnText}>{t("Close")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={() => {
                  setIsEhrModalOpen(false);
                  Alert.alert(t('Notes Saved'), t('Clinical observation recorded. Ready for prescription.'));
                }}
              >
                <Text style={styles.modalSubmitBtnText}>{t("Save Consultation")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 3: TAKE BREAK SELECTION                             */}
      {/* ========================================================= */}
      <Modal visible={isBreakModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="coffee" size={24} color="#0d6371" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>{t("Doctor Break")}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsBreakModalOpen(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: '#475569', marginBottom: 16 }}>
              {t("Pausing consultations notifies the queue display and waiting patients in Room 3B.")}</Text>

            <TouchableOpacity
              style={styles.breakOptionCard}
              onPress={() => confirmStartBreak(15)}
            >
              <MaterialCommunityIcons name="clock-fast" size={22} color="#0d6371" style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.breakOptionTitle}>{t("Take 15-Minute Tea Break")}</Text>
                <Text style={styles.breakOptionDesc}>{t("Recommended for standard rest intermission")}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.breakOptionCard}
              onPress={() => confirmStartBreak(30)}
            >
              <MaterialCommunityIcons name="silverware-fork-knife" size={22} color="#0d6371" style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.breakOptionTitle}>{t("Take 30-Minute Meal Break")}</Text>
                <Text style={styles.breakOptionDesc}>{t("Lunch and prayer intermission")}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalCancelBtn, { width: '100%', marginTop: 8 }]}
              onPress={() => setIsBreakModalOpen(false)}
            >
              <Text style={styles.modalCancelBtnText}>{t("Cancel")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 4: FILTER TIMELINE                                  */}
      {/* ========================================================= */}
      <Modal visible={isFilterModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="filter-variant" size={24} color="#0d6371" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>{t("Filter Timeline")}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsFilterModalOpen(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 8, marginVertical: 12 }}>
              {[
                { key: 'all', label: 'All Patients' },
                { key: 'attending', label: 'Now Attending' },
                { key: 'waiting', label: 'Waiting in Lobby' },
                { key: 'done', label: 'Done / Completed' },
                { key: 'scheduled', label: 'Scheduled Appointments' },
              ].map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={[
                    styles.filterOptionRow,
                    activeFilter === f.key && styles.filterOptionRowActive,
                  ]}
                  onPress={() => {
                    setActiveFilter(f.key as any);
                    setIsFilterModalOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      activeFilter === f.key && styles.filterOptionTextActive,
                    ]}
                  >
                    {t(f.label ?? '')}
                  </Text>
                  {activeFilter === f.key && (
                    <Ionicons name="checkmark-circle" size={18} color="#0d6371" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fbfd',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
  },

  // 1. TOP PROFILE BAR
  topProfileBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: '#e2e8f0',
  },
  onlineGreenDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  profileTextWrap: {
    marginLeft: 10,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  roomStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  roomStatusDot: {
    fontSize: 14,
    color: '#0d6371',
    marginRight: 4,
    fontWeight: '900',
  },
  roomStatusText: {
    fontSize: 12,
    color: '#0d6371',
    fontWeight: '600',
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#edf2f7',
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  redBadgeDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },

  // 2. DATE SUBTITLE & HEADER TITLE
  dateAndHeaderSection: {
    marginTop: 14,
    marginBottom: 12,
  },
  dateSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dateSubText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0d6371',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  titleWithFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenHeading: {
    fontSize: 27,
    fontWeight: '800',
    color: '#0f242d',
    letterSpacing: -0.3,
  },
  filterBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#e6f3f6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d2ebef',
  },

  // 3. WEEKLY DAY SELECTOR STRIP
  weekStripContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  dayCard: {
    flex: 1,
    marginHorizontal: 3.5,
    backgroundColor: '#edf6f8',
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCardActive: {
    backgroundColor: '#0c424c',
    shadowColor: '#0c424c',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 4,
  },
  dayNameText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    marginBottom: 4,
  },
  dayNameTextActive: {
    color: '#99f6e4',
    fontWeight: '600',
  },
  dayNumberText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  dayNumberTextActive: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 20,
  },
  activeDayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#22d3ee',
    marginTop: 4,
  },

  // 4. SHIFT CARD (MORNING OPD SHIFT)
  shiftCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5eef2',
    shadowColor: '#0f2932',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 22,
  },
  shiftHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  shiftTitleLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  shiftIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#e3f5f8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  shiftTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f242d',
  },
  shiftSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  shiftSubTime: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  shiftSubBullet: {
    fontSize: 12,
    color: '#94a3b8',
    marginHorizontal: 6,
  },
  shiftSubRoom: {
    fontSize: 12,
    color: '#0d6371',
    fontWeight: '600',
  },
  shiftStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#c7f4f8',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  shiftStatusGreenDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#059669',
    marginRight: 5,
  },
  shiftStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0d6371',
  },

  // Shift Progress
  progressSection: {
    marginTop: 16,
  },
  progressCountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  consultedCountText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f242d',
  },
  waitingCountText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#d8f2f6',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#0c4954',
  },

  // Shift Footer
  shiftFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f6f8',
  },
  avgTimeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avgTimeText: {
    fontSize: 12,
    color: '#526b78',
    fontWeight: '500',
  },
  breakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f5f8',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  breakBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0c4c57',
  },

  // 5. TODAY'S TIMELINE HEADER
  timelineHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  timelineTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f242d',
    marginRight: 8,
  },
  patientsCountBadge: {
    backgroundColor: '#edf6f8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dceef2',
  },
  patientsCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0d6371',
  },
  currentSlotText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0891b2',
  },

  // 6. TIMELINE LIST
  timelineList: {
    gap: 10,
    marginBottom: 20,
  },

  // HERO CARD: NOW ATTENDING
  nowAttendingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    borderLeftWidth: 5,
    borderLeftColor: '#0b5662',
    borderWidth: 1,
    borderColor: '#e1ecf0',
    shadowColor: '#0d5560',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 3,
  },
  attendingContentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tokenCircleCyan: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#c7f3f8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  tokenNumberBig: {
    fontSize: 18,
    fontWeight: '800',
    color: '#084b55',
  },
  attendingDetailsWrap: {
    flex: 1,
  },
  nowAttendingBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  nowAttendingLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0c6f7e',
    letterSpacing: 0.5,
  },
  inRoomPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0c4650',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
  },
  inRoomPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  attendingPatientName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f242d',
    marginTop: 1,
  },
  attendingReason: {
    fontSize: 12,
    color: '#0a6c7b',
    fontWeight: '600',
    marginTop: 2,
  },
  attendingFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f6f8',
  },
  elapsedCounterWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  elapsedCounterText: {
    fontSize: 12,
    color: '#526b78',
    fontWeight: '500',
  },
  openEhrBtn: {
    backgroundColor: '#b6f1f7',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  openEhrBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#084b55',
  },

  // STANDARD TIMELINE SLOT ROW
  standardSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#e8f0f3',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  slotTimeColumn: {
    width: 52,
    marginRight: 10,
  },
  slotTimeHour: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f242d',
  },
  slotTimePeriod: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 1,
  },
  slotPatientInfo: {
    flex: 1,
  },
  slotPatientName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f242d',
  },
  slotReasonSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  slotStatusRight: {
    marginLeft: 10,
  },

  // Status Badges
  badgeDone: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef3f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeDoneText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  badgeWaiting: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d8f4f7',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  hourglassEmoji: {
    fontSize: 11,
    marginRight: 3,
  },
  badgeWaitingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0d6371',
  },
  badgeScheduled: {
    backgroundColor: '#eef3f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeScheduledText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },

  // 7. PRIMARY ACTION: ADD WALK-IN SLOT
  walkinSection: {
    marginTop: 6,
    marginBottom: 10,
    alignItems: 'center',
  },
  addWalkinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0c4650',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 25,
    shadowColor: '#0c4650',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  addWalkinBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  walkinRemainingSubtext: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },

  // 8. BOTTOM NAVIGATION BAR
  bottomTabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5edf2',
    paddingVertical: 10,
    elevation: 8,
    shadowColor: 'rgba(0, 0, 0, 0.05)',
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
  },
  tabItem: {
    alignItems: 'center',
    flex: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 4,
  },
  tabLabelActive: {
    color: '#0d6371',
    fontWeight: '700',
  },

  // MODAL COMMON STYLES
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f242d',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    marginTop: 10,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
  },
  genderChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  genderChipActive: {
    backgroundColor: '#0c4650',
    borderColor: '#0c4650',
  },
  genderChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  genderChipTextActive: {
    color: '#ffffff',
  },
  tokenNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f6f8',
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  tokenNoticeText: {
    fontSize: 12,
    color: '#0d6371',
    fontWeight: '600',
    flex: 1,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  modalSubmitBtn: {
    flex: 1.6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#0c4650',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },

  // EHR SPECIFIC
  ehrModalToken: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0d6371',
    backgroundColor: '#d8f4f7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 8,
  },
  ehrSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  sectionHeaderSmall: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
    marginTop: 14,
    marginBottom: 8,
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vitalCard: {
    width: '48%',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  vitalLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  vitalValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f242d',
    marginTop: 2,
  },
  vitalUnit: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 1,
  },
  complaintBox: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  complaintText: {
    fontSize: 13,
    color: '#1e293b',
    lineHeight: 18,
  },
  ehrNotesInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: '#0f172a',
    height: 80,
    textAlignVertical: 'top',
  },

  // BREAK OPTIONS
  breakOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  breakOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f242d',
  },
  breakOptionDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },

  // FILTER OPTIONS
  filterOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterOptionRowActive: {
    backgroundColor: '#e6f6f8',
    borderColor: '#b9e6ec',
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  filterOptionTextActive: {
    color: '#0d6371',
    fontWeight: '700',
  },
});
