import { LanguageSwitcher } from '../../../i18n/LanguageSwitcher';
import { dayLabel } from '../../../utils/opdDates';
import { LocalizedText as Text } from '../../../i18n/LocalizedText';
import { useLanguage } from '../../../i18n/LanguageContext';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { DesignImage, type DesignImageName } from '../../../components/patient/DesignImage';
import { patientApi } from '../../../services/patientApi';
import { notificationApi } from '../../../services/notificationApi';
import { useAsyncResource } from '../../../hooks/useAsyncResource';
import { ACTION_TILES, EVENTS } from './dashboardContent';
import { clinicApi } from '../../../services/clinicApi';
import { C, styles } from './dashboardStyles';
import EmergencyBanner from '../../../components/EmergencyBanner';

function SectionHeading({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  const { t } = useLanguage();
  return (
    <View style={styles.sectionHeading}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>{t(title ?? '')}</Text>
      {action && onPress ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${action}: ${title}`} onPress={onPress} style={styles.textButton}>
          <Text style={styles.link}>{action}</Text>
          <DesignImage name="arrow" size={12} color={C.secondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

function getClinicIcon(department?: string, name?: string): DesignImageName {
  const text = `${department || ''} ${name || ''}`.toLowerCase();
  if (text.includes('cardio') || text.includes('heart')) return 'heart';
  if (text.includes('neuro') || text.includes('brain')) return 'brain';
  if (text.includes('paed') || text.includes('pediatr') || text.includes('child')) return 'child';
  if (text.includes('eye') || text.includes('ophthalm')) return 'eye';
  if (text.includes('ent') || text.includes('ear') || text.includes('throat')) return 'ear';
  if (text.includes('ortho') || text.includes('spine') || text.includes('bone')) return 'spine';
  if (text.includes('nephr') || text.includes('kidney') || text.includes('uro')) return 'kidney';
  if (text.includes('psych') || text.includes('mind') || text.includes('mental')) return 'mind';
  if (text.includes('pharm') || text.includes('pill')) return 'pill';
  if (text.includes('screen') || text.includes('lab') || text.includes('pathol')) return 'screening';
  if (text.includes('surg') || text.includes('medic') || text.includes('general')) return 'medical';
  return 'stethoscope';
}

export function PatientDashboardScreen() {
  const { t, locale } = useLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [fontsLoaded, fontError] = useFonts({
    ProfileInter400: require('../../../../assets/fonts/Inter-400.ttf'),
    ProfileInter500: require('../../../../assets/fonts/Inter-500.ttf'),
    ProfileInter600: require('../../../../assets/fonts/Inter-600.ttf'),
    ProfileInter700: require('../../../../assets/fonts/Inter-700.ttf'),
  });
  const dashboard = useAsyncResource(() => patientApi.getDashboard(), []);
  const clinics = useAsyncResource(() => clinicApi.list(), []);
  const { reload } = dashboard;
  const reloadClinics = clinics.reload;
  const hasFocused = useRef(false);
  const [now, setNow] = useState(() => new Date());
  const [sheet, setSheet] = useState<{ title: string; body: string } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showAllClinics, setShowAllClinics] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const checkUnreadNotifications = async () => {
    setUnreadCount(0);
    try {
      setUnreadCount(await notificationApi.unreadCount());
    } catch (e) {
      console.log('Failed to fetch notifications', e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (hasFocused.current) reload();
      hasFocused.current = true;
      checkUnreadNotifications();
      void reloadClinics();
    }, [reload, reloadClinics])
  );

  const data = dashboard.data;
  const name = data?.patient.fullName.trim().split(/\s+/)[0] || 'there';
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Colombo' }).format(now));
  const daypart = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const pass = data?.stats.activePass;
  const next = data?.nextAppointment;
  const ahead = pass?.position == null ? null : Math.max(0, pass.position - 1);
  const called = pass?.status === 'called' || pass?.status === 'in_consultation';

  const uniqueClinics = useMemo(() => {
    if (!clinics.data?.clinics) return [];
    const map = new Map<string, typeof clinics.data.clinics[0]>();
    for (const clinic of clinics.data.clinics) {
      const rawName = clinic.department || clinic.name || '';
      const cleanKey = rawName.replace(/ Clinic$/i, '').trim().toLowerCase();
      if (!cleanKey) continue;
      if (!map.has(cleanKey)) {
        map.set(cleanKey, clinic);
      }
    }
    return Array.from(map.values());
  }, [clinics.data]);

  const openDirectory = (view = '') => router.push({ pathname: '/(patient)/doctors', params: { tab: 'directory', view, department: '', hospitalId: '', search: '' } });
  const doctors = () => openDirectory();
  const bookings = () => router.push({ pathname: '/(patient)/doctors', params: { tab: 'bookings' } });
  const queue = () => router.push('/(patient)/queue');
  const profile = () => router.push('/(patient)/profile');
  const reports = () => router.push('/(patient)/profile/reports');
  const history = () => router.push('/(patient)/profile/history');

  const quickActions: Record<(typeof ACTION_TILES)[number]['key'], () => void> = {
    'clinic-registration': () => openDirectory('registration'),
    'doctor-schedule': () => openDirectory('schedule'),
    'doctor-appointment': bookings,
    'clinics-queue': queue,
    'medicine-queue': () => router.push({ pathname: '/(patient)/profile/report/new', params: { category: 'Prescription' } }),
  };

  const showMessage = (title: string, body: string) => setSheet({ title, body });
  const notifications = () => router.push('/notifications');
  const help = () => showMessage(t('How can we help?'), t('Book a slot in Doctors, then open Queue on the day of your appointment to check in and follow your turn. Your visit history and medical reports are available in Profile.'));

  if (!fontsLoaded && !fontError) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={C.primary} accessibilityLabel={t("Loading dashboard")} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <EmergencyBanner />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={Boolean(data) && dashboard.loading} onRefresh={reload} tintColor={C.primary} colors={[C.primary]} />}
      >
        {/* Full-width Hospital Hero Header Section */}
        <ImageBackground
          source={require('../../../../assets/images/patient/patient-dashboard-hero.jpg')}
          style={styles.fullHeroHeaderContainer}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['rgba(0, 43, 76, 0.76)', 'rgba(0, 76, 91, 0.88)', 'rgba(243, 250, 255, 1)']}
            locations={[0, 0.65, 1]}
            style={styles.fullHeroOverlay}
          >
            {/* Header controls over hero backdrop */}
            <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
              <View style={styles.logo}><DesignImage name="medical" size={20} color="#fff" /></View>
              <View style={styles.grow}>
                <Text style={styles.eyebrowLight}>NATIONAL OPD</Text>
                <Text style={styles.headerTitleLight}>{t("Home Dashboard")}</Text>
              </View>
              <LanguageSwitcher tone="dark" />
              <View style={{ position: 'relative' }}>
                <Pressable accessibilityRole="button" accessibilityLabel={t("Notifications")} onPress={notifications} style={({ pressed }) => [styles.headerIconBtnLight, pressed && styles.pressed]}>
                  <DesignImage name="bell" size={18} color="#fff" />
                </Pressable>
                {unreadCount > 0 && (
                  <View style={{
                    position: 'absolute', top: -2, right: -2, backgroundColor: '#E53935', borderRadius: 10,
                    width: 18, height: 18, justifyContent: 'center', alignItems: 'center', zIndex: 10
                  }}>
                    <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={t("Open profile")} onPress={profile} style={({ pressed }) => [styles.avatarLight, pressed && styles.pressed]}>
                <DesignImage name="profile" size={18} color="#fff" />
              </Pressable>
            </View>

            {/* Hero Greeting & Glass Active Queue Card */}
            <View style={styles.heroContentContainer}>
              <View style={styles.topHeroHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.topHeroGreeting}>{t(`Good ${daypart}`)}, {name}</Text>
                  <Text style={styles.topHeroSubtitle}>{t("Let us to make you better")}</Text>
                </View>
                <Pressable onPress={help} style={styles.topHeroIconBtn}>
                  <DesignImage name="help" size={16} color="#fff" />
                </Pressable>
              </View>

              <Text style={styles.activeQueueEyebrow}>{t("ACTIVE QUEUE")}</Text>

              <View style={styles.glassActiveQueueCard}>
                <View style={styles.activeQueueHeader}>
                  <View style={styles.activeQueueBadge}>
                    <DesignImage name="ticket" size={16} color={C.aqua} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activeQueueTitle}>{pass ? t(pass.department) : t("Orthopedic Clinic Queue")}</Text>
                    <Text style={styles.activeQueueSubline}>
                      {pass ? (ahead === null ? t("Follow your live queue") : t("Current Queue {pos} of {total}", { pos: String(pass.position ?? 1), total: 17 })) : t("Current Queue 3 of 17")}
                    </Text>
                  </View>
                  <Pressable onPress={queue} style={styles.activeQueueArrowBtn}>
                    <DesignImage name="arrow" size={14} color="#fff" />
                  </Pressable>
                </View>

                <View style={styles.whitePassBox}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.whitePassTitle}>
                      {pass ? `Queue ${pass.tokenNumber}` : `Queue 6`}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <DesignImage name="clock" size={12} color={C.muted} />
                      <Text style={styles.whitePassTime}>
                        {pass ? (called ? t("Your turn now") : pass.estimatedTurnAt ? t("Your turn at {time}", { time: pass.estimatedTurnAt }) : t("In queue")) : t("Your turn at 11:12 WITA")}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.roomTag}>
                    <Text style={styles.roomTagText}>{pass?.room ? pass.room : "Room 304"}</Text>
                  </View>
                </View>
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>

        {/* Main Dashboard Container */}
        <View style={styles.mainContainer}>
          {/* 1. Book Doctor Appointment Card */}
          <View style={styles.bookAppointmentCard}>
            <View style={styles.bookCardTopRow}>
              <View style={styles.instantPill}>
                <DesignImage name="calendar" size={12} color={C.aqua} />
                <Text style={styles.instantPillText}>{t("Instant OPD Slot Reservation")}</Text>
              </View>
              <View style={styles.liveSlotsTag}>
                <Text style={styles.liveSlotsText}>{t("Live Slots")}</Text>
              </View>
            </View>

            <Text style={styles.bookCardTitle}>{t("Book Doctor Appointment")}</Text>
            <Text style={styles.bookCardBody}>
              {t("Skip waiting lines. Choose your specialist, OPD clinic & preferred time slot instantly.")}
            </Text>

            <View style={styles.bookCardFooter}>
              <View style={styles.metaRow}>
                <DesignImage name="badge" size={14} color={C.aqua} />
                <Text style={styles.metaText}>{t("General & Specialist")}</Text>
              </View>
              <View style={styles.metaRow}>
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.aqua }} />
                <Text style={styles.metaText}>{t("Today Available")}</Text>
              </View>
              <Pressable onPress={doctors} style={styles.bookSlotButton}>
                <Text style={styles.bookSlotButtonText}>{t("Book Slot Now")}</Text>
                <DesignImage name="arrow" size={12} color={C.primary} />
              </Pressable>
            </View>
          </View>

          {/* 2. Search Bar */}
          <Pressable accessibilityRole="button" accessibilityLabel={t("Search doctor or clinic")} onPress={doctors} style={({ pressed }) => [styles.pillSearch, pressed && styles.pressed]}>
            <DesignImage name="search" size={18} color={C.secondary} />
            <Text style={styles.pillSearchText}>{t("Search doctor or clinic")}</Text>
          </Pressable>

          {/* 3. Next Medical Checkup Bar */}
          <Pressable onPress={next ? bookings : doctors} style={styles.checkupBar}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={styles.checkupIconCircle}>
                <DesignImage name="bell" size={14} color={C.aqua} />
              </View>
              <Text style={styles.checkupText} numberOfLines={1}>
                {next ? t("Next: Dr. {doc}", { doc: next.doctorName }) : t("Your next medical checkup")}
              </Text>
            </View>
            <View style={styles.tomorrowBadge}>
              <DesignImage name="calendar" size={12} color={C.primary} />
              <Text style={styles.tomorrowBadgeText}>
                {next ? dayLabel(next.date, undefined, locale) : t("Tomorrow")}
              </Text>
            </View>
          </Pressable>

          {/* 4. Quick Actions 5-Tile Row */}
          <View style={styles.quickActionsGrid}>
            {ACTION_TILES.map(tile => (
              <Pressable key={tile.key} accessibilityRole="button" accessibilityLabel={`${t(tile.label)} ${t(tile.caption)}`} onPress={quickActions[tile.key]} style={({ pressed }) => [styles.quickActionTile, pressed && styles.pressed]}>
                <View style={styles.quickActionIconCircle}>
                  <DesignImage name={tile.icon} size={20} color={C.secondary} />
                </View>
                <Text style={styles.quickActionTileText}>
                  {t(tile.label)}{'\n'}{t(tile.caption)}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* 5. Hospital Clinics 4-Column Grid */}
          <View style={styles.section}>
            <SectionHeading
              title={t("Hospital Clinics")}
              action={uniqueClinics.length > 8 ? (showAllClinics ? t('Show featured') : t('See All')) : undefined}
              onPress={() => setShowAllClinics((value) => !value)}
            />
            {clinics.loading && !clinics.data ? (
              <View style={styles.status}><ActivityIndicator color={C.primary} /><Text style={styles.statusText}>{t("Loading clinics…")}</Text></View>
            ) : clinics.error ? (
              <View style={styles.error}><Text style={styles.errorTitle}>{t("Could not load clinics")}</Text><Text style={styles.statusText}>{clinics.error}</Text><Pressable onPress={clinics.reload} style={styles.textButton}><Text style={styles.link}>{t("Try again")}</Text></Pressable></View>
            ) : uniqueClinics.length ? (
              <View style={styles.specialtiesGrid}>
                {(showAllClinics ? uniqueClinics : uniqueClinics.slice(0, 8)).map((clinic) => {
                  const displayName = clinic.name.replace(/ Clinic$/i, '');
                  const iconName = getClinicIcon(clinic.department, clinic.name);
                  return (
                    <Pressable
                      key={clinic._id}
                      accessibilityRole="button"
                      accessibilityLabel={t(clinic.name)}
                      onPress={() => router.push({ pathname: '/(patient)/doctors', params: { tab: 'directory', view: '', search: '', department: clinic.department, hospitalId: clinic.hospital?._id ?? '' } })}
                      style={({ pressed }) => [styles.specialtyCircleTile, pressed && styles.pressed]}
                    >
                      <View style={styles.specialtyCircle}>
                        <DesignImage name={iconName} size={22} color={C.secondary} />
                      </View>
                      <Text style={styles.specialtyCircleLabel} numberOfLines={1} ellipsizeMode="tail">
                        {t(displayName)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyActivity}><Text style={styles.activityTitle}>{t("No clinics available")}</Text><Text style={styles.sectionCaption}>{t("Your hospital has not enabled any clinics yet.")}</Text></View>
            )}
          </View>

          {/* 6. Recent Activity */}
          <View style={styles.section}>
            <SectionHeading title={t("Recent activity")} action={t("View history")} onPress={history} />
            <View style={styles.activityCard}>
              {data?.recentActivity.length ? data.recentActivity.slice(0, 4).map((item, index) => (
                <React.Fragment key={`${item.type}-${item.id}`}>
                  {index ? <View style={styles.divider} /> : null}
                  <Pressable accessibilityRole="button" accessibilityLabel={item.type === 'appointment' ? item.title.split(' · ').map((part, idx) => idx === 0 ? part : t(part)).join(' · ') : item.title} onPress={item.type === 'report' ? reports : history} style={({ pressed }) => [styles.activityRow, pressed && styles.pressed]}>
                    <View style={styles.quickActionIconCircle}><DesignImage name={item.type === 'report' ? 'clipboard' : 'calendar'} size={18} color={C.secondary} /></View>
                    <View style={styles.grow}>
                      <Text style={styles.activityTitle}>{item.type === 'appointment' ? item.title.split(' · ').map((part, idx) => idx === 0 ? part : t(part)).join(' · ') : item.title}</Text>
                      <Text style={styles.activityCaption}>{[item.type === 'report' ? t(item.dateLabel ?? '') : item.date ? dayLabel(item.date, undefined, locale) : '', t(item.status.replace(/_/g, ' '))].filter(Boolean).join(' · ')}</Text>
                    </View>
                    <DesignImage name="arrow" size={14} color={C.secondary} />
                  </Pressable>
                </React.Fragment>
              )) : (
                <View style={styles.emptyActivity}><Text style={styles.activityTitle}>{data ? t('No recent activity yet') : t('Your recent activity')}</Text><Text style={styles.sectionCaption}>{data ? t('Your appointments and reports will be listed here.') : t('Activity will appear once your dashboard loads.')}</Text></View>
              )}
            </View>
          </View>

          {/* 7. Events & Health Insights */}
          <View style={styles.section}>
            <SectionHeading title={t("Events & health insights")} action={t("See all")} onPress={() => showMessage(t('Events & Health Insights'), EVENTS.map(event => `${t(event.title)}\n${t(event.description)}\n${t(event.schedule)}`).join('\n\n'))} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.events} contentContainerStyle={styles.eventContent}>
              {EVENTS.map(event => (
                <Pressable key={event.key} accessibilityRole="button" accessibilityLabel={t(event.title)} onPress={() => showMessage(t(event.title), `${t(event.description)}\n\n${t(event.schedule)}`)} style={({ pressed }) => [styles.eventCard, pressed && styles.pressed]}>
                  <Image source={event.image} style={styles.eventImage} resizeMode="cover" />
                  <View style={styles.eventBadge}><Text style={styles.eventBadgeText}>{t(event.badge)}</Text></View>
                  <View style={styles.eventBody}>
                    <Text style={styles.eventTitle}>{t(event.title)}</Text>
                    <Text style={styles.eventDescription}>{t(event.description)}</Text>
                    <View style={styles.metaRow}><DesignImage name="calendar" size={13} color={C.secondary} /><Text style={styles.eventSchedule}>{t(event.schedule)}</Text></View>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </ScrollView>

      {/* Modal */}
      <Modal transparent visible={Boolean(sheet)} animationType="slide" onRequestClose={() => setSheet(null)}>
        <View style={styles.modalOverlay}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Close dialog")} onPress={() => setSheet(null)} style={StyleSheet.absoluteFill} />
          <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>{sheet?.title}</Text>
            <ScrollView><Text style={styles.sheetBody}>{sheet?.body}</Text></ScrollView>
            <Pressable accessibilityRole="button" onPress={() => setSheet(null)} style={styles.sheetButton}>
              <Text style={styles.sheetButtonLabel}>{t("Done")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
