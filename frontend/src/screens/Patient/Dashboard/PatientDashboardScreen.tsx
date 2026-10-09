import { LanguageSwitcher } from '../../../i18n/LanguageSwitcher';
import { dayLabel } from '../../../utils/opdDates';
import { LocalizedText as Text } from '../../../i18n/LocalizedText';
import { useLanguage } from '../../../i18n/LanguageContext';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthToken } from '../../../services/http';
import { BASE_URL } from '../../../config';
import EmergencyBanner from '../../../components/EmergencyBanner';

function StatCard({ value, label, icon, onPress }: { value: number | null | undefined; label: string; icon: DesignImageName; onPress: () => void }) {
  const { t } = useLanguage();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value ?? 'unavailable'}`} onPress={onPress} style={({ pressed }) => [styles.stat, pressed && styles.pressed]}>
    <View style={styles.statIcon}><DesignImage name={icon} size={18} color={C.secondary} /></View>
    <View><Text style={styles.statValue}>{value ?? '—'}</Text><Text style={styles.statLabel}>{t(label ?? '')}</Text></View>
  </Pressable>;
}

function SectionHeading({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  const { t } = useLanguage();
  return <View style={styles.sectionHeading}><Text accessibilityRole="header" style={styles.sectionTitle}>{t(title ?? '')}</Text>{action && onPress ?
    <Pressable accessibilityRole="button" accessibilityLabel={`${action}: ${title}`} onPress={onPress} style={styles.textButton}><Text style={styles.link}>{action}</Text><DesignImage name="arrow" size={12} color={C.secondary} /></Pressable> : null}</View>;
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

  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(timer); }, []);

  const checkUnreadNotifications = async () => {
    setUnreadCount(0);
    try {
      setUnreadCount(await notificationApi.unreadCount());
    } catch (e) {
      console.log('Failed to fetch notifications', e);
    }
  };

  useFocusEffect(useCallback(() => {
    if (hasFocused.current) reload();
    hasFocused.current = true;
    checkUnreadNotifications();
    void reloadClinics();
  }, [reload, reloadClinics]));

  const data = dashboard.data;
  const name = data?.patient.fullName.trim().split(/\s+/)[0] || 'there';
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Colombo' }).format(now));
  const daypart = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const dateLabel = now.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Colombo' });
  const pass = data?.stats.activePass;
  const next = data?.nextAppointment;
  const ahead = pass?.position == null ? null : Math.max(0, pass.position - 1);
  const called = pass?.status === 'called' || pass?.status === 'in_consultation';
  const wide = width >= 760;
  const columns = wide ? 4 : 2;
  const specialtyWidth = (Math.min(width, 1120) - 40 - (columns - 1) * 10) / columns;
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

  if (!fontsLoaded && !fontError) return <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color={C.primary} accessibilityLabel={t("Loading dashboard")} /></View>;

  return <View style={styles.root}>
    <EmergencyBanner />
    <View style={[styles.headerSafe, { paddingTop: insets.top }]}><View style={styles.header}>
      <View style={styles.logo}><DesignImage name="medical" size={22} color="#fff" /></View>
      <View style={styles.grow}><Text style={styles.eyebrow}>MEDI-QUEUE</Text><Text style={styles.headerTitle}>{t("Home Dashboard")}</Text></View>
      <View style={{ position: 'relative' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("Notifications")} onPress={notifications} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><DesignImage name="bell" size={20} color={C.primary} /></Pressable>
        {unreadCount > 0 && (
          <View style={{
            position: 'absolute', top: -2, right: -2, backgroundColor: 'red', borderRadius: 10,
            width: 18, height: 18, justifyContent: 'center', alignItems: 'center', zIndex: 10
          }}>
            <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        )}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Open profile")} onPress={profile} style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}><DesignImage name="profile" size={20} color={C.primary} /></Pressable>
      <LanguageSwitcher tone="light" />
    </View></View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={Boolean(data) && dashboard.loading} onRefresh={reload} tintColor={C.primary} colors={[C.primary]} />}>
      <View style={styles.intro}>
        <View style={styles.introTop}><Text style={styles.overline}>{t("PATIENT DASHBOARD")}</Text><View style={styles.datePill}><DesignImage name="calendar" size={14} color={C.primary} /><Text style={styles.dateText}>{dateLabel}</Text></View></View>
        <Text accessibilityRole="header" style={styles.greeting}>{t(`Good ${daypart}`)}, {name}</Text>
        <Text style={styles.subtitle}>{t("Your appointments, queue and health records, all in one place.")}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Search doctor or clinic")} onPress={doctors} style={({ pressed }) => [styles.search, pressed && styles.pressed]}><DesignImage name="search" size={20} color={C.secondary} /><Text style={styles.searchText}>{t("Search a doctor or clinic")}</Text><DesignImage name="arrow" size={14} color={C.secondary} /></Pressable>
      {dashboard.loading && !data ? <View style={styles.status}><ActivityIndicator color={C.primary} /><Text style={styles.statusText}>{t("Loading your dashboard…")}</Text></View> : null}
      {dashboard.error ? <View style={styles.error}><Text style={styles.errorTitle}>{t("We could not refresh your dashboard")}</Text><Text style={styles.statusText}>{dashboard.error}</Text><Pressable accessibilityRole="button" onPress={reload} style={[styles.textButton, { alignSelf: 'flex-start' }]}><Text style={styles.link}>{t("Try again")}</Text></Pressable></View> : null}
      <View style={styles.stats}>
        <StatCard value={data?.stats.upcomingAppointments} label={t("Upcoming visits")} icon="calendar" onPress={bookings} />
        <StatCard value={data?.stats.completedVisits} label={t("Completed visits")} icon="medical" onPress={history} />
        <StatCard value={data?.stats.reports} label={t("Medical reports")} icon="clipboard" onPress={reports} />
      </View>
      <LinearGradient colors={[C.primary, C.teal]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.booking}>
        <View pointerEvents="none" style={styles.bookingDecoration} />
        <View style={styles.bookingTop}><DesignImage name="calendar" size={18} color={C.aqua} /><Text style={styles.bookingEyebrow}>{t("YOUR NEXT STEP TO BETTER HEALTH")}</Text></View>
        <View style={{ gap: 6 }}><Text style={styles.bookingTitle}>{t("Care starts with an appointment.")}</Text><Text style={styles.bookingBody}>{t("Find your specialist, choose a clinic and book a time that works for you.")}</Text></View>
        <View style={styles.bookingFooter}><View style={styles.bookingMeta}><DesignImage name="stethoscope" size={16} color={C.aqua} /><Text style={styles.bookingMetaText}>{t("General & specialist clinics")}</Text></View><Pressable accessibilityRole="button" onPress={doctors} style={({ pressed }) => [styles.bookButton, pressed && styles.pressed]}><Text style={styles.bookButtonLabel}>{t("Book appointment")}</Text><DesignImage name="arrow" size={16} color={C.primary} /></Pressable></View>
      </LinearGradient>
      <View style={styles.section}>
        <SectionHeading title={t("Your care at a glance")} />
        <View style={[styles.overview, wide && styles.wideRow]}>
          <View style={[styles.careCard, wide && styles.wideCard]}>
            <View style={styles.cardTop}><Text style={styles.cardType}>{t("NEXT APPOINTMENT")}</Text><View style={styles.badge}><Text style={styles.badgeLabel}>{next ? t('Upcoming') : data ? t('Not booked') : t('Loading')}</Text></View></View>
            <View style={{ gap: 6 }}><Text style={styles.careHeading}>{next ? next.doctorName : data ? t('Plan your next visit') : t('Your next visit')}</Text><Text style={styles.careDescription}>{next ? t(next.department) : data ? t('Book a consultation when you need care.') : t('Your appointment details will appear here.')}</Text></View>
            <View style={styles.cardMeta}><DesignImage name="calendar" size={14} color={C.secondary} /><Text style={styles.careDescription}>{next ? `${dayLabel(next.date, undefined, locale)} · ${next.slotTime}` : t('Choose your preferred date and time')}</Text></View>
            <Pressable accessibilityRole="button" onPress={next ? bookings : doctors} style={({ pressed }) => [styles.cardFooter, pressed && styles.pressed]}><Text style={styles.link}>{next ? t('View appointment') : t('Find a doctor')}</Text><DesignImage name="arrow" size={14} color={C.secondary} /></Pressable>
          </View>
          <View style={[styles.careCard, wide && styles.wideCard]}>
            <View style={styles.cardTop}><Text style={styles.cardType}>{t("LIVE QUEUE")}</Text><View style={styles.badge}><Text style={styles.badgeLabel}>{pass ? called ? t('Your turn') : t('Active') : data ? t('No active pass') : t('Loading')}</Text></View></View>
            <View style={{ gap: 4 }}><Text style={pass ? styles.careNumber : styles.careHeading}>{pass ? `#${pass.tokenNumber}` : t('Your place in line')}</Text><Text style={styles.careDescription}>{pass ? t(pass.department) : t('Check in on the day of your appointment.')}</Text></View>
            <View style={styles.cardMeta}><DesignImage name="clock" size={14} color={C.secondary} /><Text style={styles.careDescription}>{pass ? called ? pass.room ? t('Please go to {room}', { room: pass.room }) : t('Please go to the clinic desk') : ahead === null ? t('Follow your live queue here') : ahead === 0 ? t('You are next') : t('{count} people ahead of you', { count: ahead }) : t('Your position updates automatically')}</Text></View>
            {pass?.estimatedTurnAt && !called ? <Text style={styles.careDescription}>{t("Estimated turn:")}{' '}{pass.estimatedTurnAt}</Text> : null}
            <Pressable accessibilityRole="button" onPress={queue} style={({ pressed }) => [styles.cardFooter, pressed && styles.pressed]}><Text style={styles.link}>{pass ? t('Open queue pass') : t('Go to queue')}</Text><DesignImage name="arrow" size={14} color={C.secondary} /></Pressable>
          </View>
          <View style={[styles.careCard, wide && styles.wideCard]}>
            <View style={styles.cardTop}><Text style={styles.cardType}>{t("HEALTH RECORDS")}</Text><DesignImage name="clipboard" size={18} color={C.secondary} /></View>
            <View style={{ gap: 6 }}><Text style={styles.careHeading}>{t("Your health, organized.")}</Text><Text style={styles.careDescription}>{t("Keep your visit history and medical documents within reach.")}</Text></View>
            <Text style={styles.careDescription}>{data ? t('{visits} completed visits · {reports} reports', { visits: data.stats.completedVisits ?? '—', reports: data.stats.reports ?? '—' }) : t('Your records will appear once loaded.')}</Text>
            <Pressable accessibilityRole="button" onPress={profile} style={({ pressed }) => [styles.cardFooter, pressed && styles.pressed]}><Text style={styles.link}>{t("View my records")}</Text><DesignImage name="arrow" size={14} color={C.secondary} /></Pressable>
          </View>
        </View>
      </View>
      <View style={styles.section}>
        <SectionHeading title={t("Quick actions")} action={t("Help")} onPress={help} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.actionScroll} contentContainerStyle={styles.actionContent}>
          {ACTION_TILES.map(tile => <Pressable key={tile.key} accessibilityRole="button" accessibilityLabel={`${t(tile.label)} ${t(tile.caption)}`} onPress={quickActions[tile.key]} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><View style={styles.actionIcon}><DesignImage name={tile.icon} size={20} color={C.secondary} /></View><Text style={styles.actionLabel}>{t(tile.label)}{'\n'}{t(tile.caption)}</Text></Pressable>)}
        </ScrollView>
      </View>
      <View style={styles.section}>
        <SectionHeading
          title={t("Hospital clinics")}
          action={clinics.data && clinics.data.clinics.length > 16 ? (showAllClinics ? t('Show featured') : t('View all clinics')) : undefined}
          onPress={() => setShowAllClinics((value) => !value)}
        />
        <Text style={styles.sectionCaption}>{t("Find the right specialist for your care.")}</Text>
        {clinics.loading && !clinics.data ? (
          <View style={styles.status}><ActivityIndicator color={C.primary} /><Text style={styles.statusText}>{t("Loading clinics…")}</Text></View>
        ) : clinics.error ? (
          <View style={styles.error}><Text style={styles.errorTitle}>{t("Could not load clinics")}</Text><Text style={styles.statusText}>{clinics.error}</Text><Pressable onPress={clinics.reload} style={styles.textButton}><Text style={styles.link}>{t("Try again")}</Text></Pressable></View>
        ) : clinics.data?.clinics.length ? (
          <View style={styles.specialties}>{(showAllClinics ? clinics.data.clinics : clinics.data.clinics.slice(0, 16)).map((clinic) => <Pressable key={clinic._id} accessibilityRole="button" accessibilityLabel={t(clinic.name)} onPress={() => router.push({ pathname: '/(patient)/doctors', params: { tab: 'directory', view: '', search: '', department: clinic.department, hospitalId: clinic.hospital?._id ?? '' } })} style={({ pressed }) => [styles.specialty, { width: specialtyWidth }, pressed && styles.pressed]}><View style={styles.specialtyIcon}><DesignImage name="stethoscope" size={20} color={C.secondary} /></View><Text style={styles.specialtyLabel}>{t(clinic.name.replace(/ Clinic$/, ''))}</Text><DesignImage name="arrow" size={12} color={C.secondary} /></Pressable>)}</View>
        ) : (
          <View style={styles.emptyActivity}><Text style={styles.activityTitle}>{t("No clinics available")}</Text><Text style={styles.sectionCaption}>{t("Your hospital has not enabled any clinics yet.")}</Text></View>
        )}
      </View>
      <View style={styles.section}>
        <SectionHeading title={t("Recent activity")} action={t("View history")} onPress={history} />
        <View style={styles.activityCard}>
          {data?.recentActivity.length ? data.recentActivity.slice(0, 4).map((item, index) => <React.Fragment key={`${item.type}-${item.id}`}>
            {index ? <View style={styles.divider} /> : null}
            <Pressable accessibilityRole="button" accessibilityLabel={item.type === 'appointment' ? item.title.split(' · ').map((part, index) => index === 0 ? part : t(part)).join(' · ') : item.title} onPress={item.type === 'report' ? reports : history} style={({ pressed }) => [styles.activityRow, pressed && styles.pressed]}><View style={styles.actionIcon}><DesignImage name={item.type === 'report' ? 'clipboard' : 'calendar'} size={18} color={C.secondary} /></View><View style={styles.grow}><Text style={styles.activityTitle}>{item.type === 'appointment' ? item.title.split(' · ').map((part, index) => index === 0 ? part : t(part)).join(' · ') : item.title}</Text><Text style={styles.activityCaption}>{[item.type === 'report' ? t(item.dateLabel ?? '') : item.date ? dayLabel(item.date, undefined, locale) : '', t(item.status.replace(/_/g, ' '))].filter(Boolean).join(' · ')}</Text></View><DesignImage name="arrow" size={14} color={C.secondary} /></Pressable>
          </React.Fragment>) : <View style={styles.emptyActivity}><Text style={styles.activityTitle}>{data ? t('No recent activity yet') : t('Your recent activity')}</Text><Text style={styles.sectionCaption}>{data ? t('Your appointments and reports will be listed here.') : t('Activity will appear once your dashboard loads.')}</Text></View>}
        </View>
      </View>
      <View style={styles.section}>
        <SectionHeading title={t("Events & health insights")} action={t("See all")} onPress={() => showMessage(t('Events & Health Insights'), EVENTS.map(event => `${t(event.title)}\n${t(event.description)}\n${t(event.schedule)}`).join('\n\n'))} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.events} contentContainerStyle={styles.eventContent}>{EVENTS.map(event => <Pressable key={event.key} accessibilityRole="button" accessibilityLabel={t(event.title)} onPress={() => showMessage(t(event.title), `${t(event.description)}\n\n${t(event.schedule)}`)} style={({ pressed }) => [styles.eventCard, pressed && styles.pressed]}><Image source={event.image} style={styles.eventImage} resizeMode="cover" /><View style={styles.eventBadge}><Text style={styles.eventBadgeText}>{t(event.badge)}</Text></View><View style={styles.eventBody}><Text style={styles.eventTitle}>{t(event.title)}</Text><Text style={styles.eventDescription}>{t(event.description)}</Text><View style={styles.cardMeta}><DesignImage name="calendar" size={13} color={C.secondary} /><Text style={styles.eventSchedule}>{t(event.schedule)}</Text></View></View></Pressable>)}</ScrollView>
      </View>
    </ScrollView>
    <Modal transparent visible={Boolean(sheet)} animationType="slide" onRequestClose={() => setSheet(null)}>
      <View style={styles.modalOverlay}><Pressable accessibilityRole="button" accessibilityLabel={t("Close dialog")} onPress={() => setSheet(null)} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}><Text accessibilityRole="header" style={styles.sectionTitle}>{sheet?.title}</Text><ScrollView><Text style={styles.sheetBody}>{sheet?.body}</Text></ScrollView><Pressable accessibilityRole="button" onPress={() => setSheet(null)} style={styles.sheetButton}><Text style={styles.sheetButtonLabel}>{t("Done")}</Text></Pressable></View>
      </View>
    </Modal>
  </View>;
}
