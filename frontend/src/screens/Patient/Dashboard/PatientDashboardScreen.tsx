import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { DesignImage, type DesignImageName } from '../../../components/patient/DesignImage';
import { patientApi } from '../../../services/patientApi';
import { useAsyncResource } from '../../../hooks/useAsyncResource';
import { ACTION_TILES, EVENTS, SPECIALTIES } from './dashboardContent';
import { C, styles } from './dashboardStyles';

function StatCard({ value, label, icon, onPress }: { value: number | null | undefined; label: string; icon: DesignImageName; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value ?? 'unavailable'}`} onPress={onPress} style={({ pressed }) => [styles.stat, pressed && styles.pressed]}>
    <View style={styles.statIcon}><DesignImage name={icon} size={18} color={C.secondary} /></View>
    <View><Text style={styles.statValue}>{value ?? '—'}</Text><Text style={styles.statLabel}>{label}</Text></View>
  </Pressable>;
}

function SectionHeading({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return <View style={styles.sectionHeading}><Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>{action && onPress ?
    <Pressable accessibilityRole="button" accessibilityLabel={`${action}: ${title}`} onPress={onPress} style={styles.textButton}><Text style={styles.link}>{action}</Text><DesignImage name="arrow" size={12} color={C.secondary} /></Pressable> : null}</View>;
}

export function PatientDashboardScreen() {
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
  const { reload } = dashboard;
  const hasFocused = useRef(false);
  const [now, setNow] = useState(() => new Date());
  const [sheet, setSheet] = useState<{ title: string; body: string } | null>(null);
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(timer); }, []);
  useFocusEffect(useCallback(() => {
    if (hasFocused.current) reload();
    hasFocused.current = true;
  }, [reload]));

  const data = dashboard.data;
  const name = data?.patient.fullName.trim().split(/\s+/)[0] || 'there';
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Colombo' }).format(now));
  const daypart = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const dateLabel = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Colombo' });
  const pass = data?.stats.activePass;
  const next = data?.nextAppointment;
  const ahead = pass?.position == null ? null : Math.max(0, pass.position - 1);
  const called = pass?.status === 'called' || pass?.status === 'in_consultation';
  const wide = width >= 760;
  const columns = wide ? 4 : 2;
  const specialtyWidth = (Math.min(width, 1120) - 40 - (columns - 1) * 10) / columns;
  const doctors = () => router.push('/(patient)/doctors');
  const queue = () => router.push('/(patient)/queue');
  const profile = () => router.push('/(patient)/profile');
  const reports = () => router.push('/(patient)/profile/reports');
  const history = () => router.push('/(patient)/profile/history');
  const showMessage = (title: string, body: string) => setSheet({ title, body });
  const notifications = () => showMessage('Appointment reminders', !data ? 'Your appointment information is currently unavailable. Refresh the dashboard to try again.' : next ? `${next.doctorName}\n${next.department}\n${next.dateLabel ?? next.date} at ${next.slotTime}` : 'You have no upcoming appointments. Open Doctors to book a visit.');
  const help = () => showMessage('How can we help?', 'Book a slot in Doctors, then open Queue on the day of your appointment to check in and follow your turn. Your visit history and medical reports are available in Profile.');

  if (!fontsLoaded && !fontError) return <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color={C.primary} accessibilityLabel="Loading dashboard" /></View>;

  return <View style={styles.root}>
    <View style={[styles.headerSafe, { paddingTop: insets.top }]}><View style={styles.header}>
      <View style={styles.logo}><DesignImage name="medical" size={22} color="#fff" /></View>
      <View style={styles.grow}><Text style={styles.eyebrow}>MEDI-QUEUE</Text><Text style={styles.headerTitle}>Home Dashboard</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={notifications} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><DesignImage name="bell" size={20} color={C.primary} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={profile} style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}><DesignImage name="profile" size={20} color={C.primary} /></Pressable>
    </View></View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={Boolean(data) && dashboard.loading} onRefresh={reload} tintColor={C.primary} colors={[C.primary]} />}>
      <View style={styles.intro}>
        <View style={styles.introTop}><Text style={styles.overline}>PATIENT DASHBOARD</Text><View style={styles.datePill}><DesignImage name="calendar" size={14} color={C.primary} /><Text style={styles.dateText}>{dateLabel}</Text></View></View>
        <Text accessibilityRole="header" style={styles.greeting}>Good {daypart}, {name}</Text>
        <Text style={styles.subtitle}>Your appointments, queue and health records, all in one place.</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Search doctor or clinic" onPress={doctors} style={({ pressed }) => [styles.search, pressed && styles.pressed]}><DesignImage name="search" size={20} color={C.secondary} /><Text style={styles.searchText}>Search a doctor or clinic</Text><DesignImage name="arrow" size={14} color={C.secondary} /></Pressable>
      {dashboard.loading && !data ? <View style={styles.status}><ActivityIndicator color={C.primary} /><Text style={styles.statusText}>Loading your dashboard…</Text></View> : null}
      {dashboard.error ? <View style={styles.error}><Text style={styles.errorTitle}>We could not refresh your dashboard</Text><Text style={styles.statusText}>{dashboard.error}</Text><Pressable accessibilityRole="button" onPress={reload} style={[styles.textButton, { alignSelf: 'flex-start' }]}><Text style={styles.link}>Try again</Text></Pressable></View> : null}
      <View style={styles.stats}>
        <StatCard value={data?.stats.upcomingAppointments} label="Upcoming visits" icon="calendar" onPress={doctors} />
        <StatCard value={data?.stats.completedVisits} label="Completed visits" icon="medical" onPress={history} />
        <StatCard value={data?.stats.reports} label="Medical reports" icon="clipboard" onPress={reports} />
      </View>
      <LinearGradient colors={[C.primary, C.teal]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.booking}>
        <View pointerEvents="none" style={styles.bookingDecoration} />
        <View style={styles.bookingTop}><DesignImage name="calendar" size={18} color={C.aqua} /><Text style={styles.bookingEyebrow}>YOUR NEXT STEP TO BETTER HEALTH</Text></View>
        <View style={{ gap: 6 }}><Text style={styles.bookingTitle}>Care starts with an appointment.</Text><Text style={styles.bookingBody}>Find your specialist, choose a clinic and book a time that works for you.</Text></View>
        <View style={styles.bookingFooter}><View style={styles.bookingMeta}><DesignImage name="stethoscope" size={16} color={C.aqua} /><Text style={styles.bookingMetaText}>General &amp; specialist clinics</Text></View><Pressable accessibilityRole="button" onPress={doctors} style={({ pressed }) => [styles.bookButton, pressed && styles.pressed]}><Text style={styles.bookButtonLabel}>Book appointment</Text><DesignImage name="arrow" size={16} color={C.primary} /></Pressable></View>
      </LinearGradient>
      <View style={styles.section}>
        <SectionHeading title="Your care at a glance" />
        <View style={[styles.overview, wide && styles.wideRow]}>
          <View style={[styles.careCard, wide && styles.wideCard]}>
            <View style={styles.cardTop}><Text style={styles.cardType}>NEXT APPOINTMENT</Text><View style={styles.badge}><Text style={styles.badgeLabel}>{next ? 'Upcoming' : data ? 'Not booked' : 'Loading'}</Text></View></View>
            <View style={{ gap: 6 }}><Text style={styles.careHeading}>{next ? next.doctorName : data ? 'Plan your next visit' : 'Your next visit'}</Text><Text style={styles.careDescription}>{next ? next.department : data ? 'Book a consultation when you need care.' : 'Your appointment details will appear here.'}</Text></View>
            <View style={styles.cardMeta}><DesignImage name="calendar" size={14} color={C.secondary} /><Text style={styles.careDescription}>{next ? `${next.dateLabel ?? next.date} · ${next.slotTime}` : 'Choose your preferred date and time'}</Text></View>
            <Pressable accessibilityRole="button" onPress={next ? notifications : doctors} style={({ pressed }) => [styles.cardFooter, pressed && styles.pressed]}><Text style={styles.link}>{next ? 'View appointment' : 'Find a doctor'}</Text><DesignImage name="arrow" size={14} color={C.secondary} /></Pressable>
          </View>
          <View style={[styles.careCard, wide && styles.wideCard]}>
            <View style={styles.cardTop}><Text style={styles.cardType}>LIVE QUEUE</Text><View style={styles.badge}><Text style={styles.badgeLabel}>{pass ? called ? 'Your turn' : 'Active' : data ? 'No active pass' : 'Loading'}</Text></View></View>
            <View style={{ gap: 4 }}><Text style={pass ? styles.careNumber : styles.careHeading}>{pass ? `#${pass.tokenNumber}` : 'Your place in line'}</Text><Text style={styles.careDescription}>{pass ? pass.department : 'Check in on the day of your appointment.'}</Text></View>
            <View style={styles.cardMeta}><DesignImage name="clock" size={14} color={C.secondary} /><Text style={styles.careDescription}>{pass ? called ? pass.room ? `Please go to ${pass.room}` : 'Please go to the clinic desk' : ahead === null ? 'Follow your live queue here' : ahead === 0 ? 'You are next' : `${ahead} ${ahead === 1 ? 'person' : 'people'} ahead of you` : 'Your position updates automatically'}</Text></View>
            {pass?.estimatedTurnAt && !called ? <Text style={styles.careDescription}>Estimated turn: {pass.estimatedTurnAt}</Text> : null}
            <Pressable accessibilityRole="button" onPress={queue} style={({ pressed }) => [styles.cardFooter, pressed && styles.pressed]}><Text style={styles.link}>{pass ? 'Open queue pass' : 'Go to queue'}</Text><DesignImage name="arrow" size={14} color={C.secondary} /></Pressable>
          </View>
          <View style={[styles.careCard, wide && styles.wideCard]}>
            <View style={styles.cardTop}><Text style={styles.cardType}>HEALTH RECORDS</Text><DesignImage name="clipboard" size={18} color={C.secondary} /></View>
            <View style={{ gap: 6 }}><Text style={styles.careHeading}>Your health, organized.</Text><Text style={styles.careDescription}>Keep your visit history and medical documents within reach.</Text></View>
            <Text style={styles.careDescription}>{data ? `${data.stats.completedVisits ?? '—'} completed visits · ${data.stats.reports ?? '—'} reports` : 'Your records will appear once loaded.'}</Text>
            <Pressable accessibilityRole="button" onPress={profile} style={({ pressed }) => [styles.cardFooter, pressed && styles.pressed]}><Text style={styles.link}>View my records</Text><DesignImage name="arrow" size={14} color={C.secondary} /></Pressable>
          </View>
        </View>
      </View>
      <View style={styles.section}>
        <SectionHeading title="Quick actions" action="Help" onPress={help} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.actionScroll} contentContainerStyle={styles.actionContent}>
          {ACTION_TILES.map(tile => <Pressable key={tile.key} accessibilityRole="button" accessibilityLabel={`${tile.label} ${tile.caption}`} onPress={tile.key === 'clinics-queue' || tile.key === 'medicine-queue' ? queue : doctors} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><View style={styles.actionIcon}><DesignImage name={tile.icon} size={20} color={C.secondary} /></View><Text style={styles.actionLabel}>{tile.label}{'\n'}{tile.caption}</Text></Pressable>)}
        </ScrollView>
      </View>
      <View style={styles.section}>
        <SectionHeading title="Hospital clinics" action="See all" onPress={doctors} />
        <Text style={styles.sectionCaption}>Find the right specialist for your care.</Text>
        <View style={styles.specialties}>{SPECIALTIES.map(specialty => <Pressable key={specialty.key} accessibilityRole="button" accessibilityLabel={specialty.label} onPress={doctors} style={({ pressed }) => [styles.specialty, { width: specialtyWidth }, pressed && styles.pressed]}><View style={styles.specialtyIcon}><DesignImage name={specialty.icon} size={20} color={C.secondary} /></View><Text style={styles.specialtyLabel}>{specialty.label}</Text><DesignImage name="arrow" size={12} color={C.secondary} /></Pressable>)}</View>
      </View>
      <View style={styles.section}>
        <SectionHeading title="Recent activity" action="View history" onPress={history} />
        <View style={styles.activityCard}>
          {data?.recentActivity.length ? data.recentActivity.slice(0, 4).map((item, index) => <React.Fragment key={`${item.type}-${item.id}`}>
            {index ? <View style={styles.divider} /> : null}
            <Pressable accessibilityRole="button" accessibilityLabel={item.title} onPress={item.type === 'report' ? reports : history} style={({ pressed }) => [styles.activityRow, pressed && styles.pressed]}><View style={styles.actionIcon}><DesignImage name={item.type === 'report' ? 'clipboard' : 'calendar'} size={18} color={C.secondary} /></View><View style={styles.grow}><Text style={styles.activityTitle}>{item.title}</Text><Text style={styles.activityCaption}>{[item.dateLabel ?? item.date, item.status.replace(/_/g, ' ')].filter(Boolean).join(' · ')}</Text></View><DesignImage name="arrow" size={14} color={C.secondary} /></Pressable>
          </React.Fragment>) : <View style={styles.emptyActivity}><Text style={styles.activityTitle}>{data ? 'No recent activity yet' : 'Your recent activity'}</Text><Text style={styles.sectionCaption}>{data ? 'Your appointments and reports will be listed here.' : 'Activity will appear once your dashboard loads.'}</Text></View>}
        </View>
      </View>
      <View style={styles.section}>
        <SectionHeading title="Events & health insights" action="See all" onPress={() => showMessage('Events & Health Insights', EVENTS.map(event => `${event.title}\n${event.description}\n${event.schedule}`).join('\n\n'))} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.events} contentContainerStyle={styles.eventContent}>{EVENTS.map(event => <Pressable key={event.key} accessibilityRole="button" accessibilityLabel={event.title} onPress={() => showMessage(event.title, `${event.description}\n\n${event.schedule}`)} style={({ pressed }) => [styles.eventCard, pressed && styles.pressed]}><Image source={event.image} style={styles.eventImage} resizeMode="cover" /><View style={styles.eventBadge}><Text style={styles.eventBadgeText}>{event.badge}</Text></View><View style={styles.eventBody}><Text style={styles.eventTitle}>{event.title}</Text><Text style={styles.eventDescription}>{event.description}</Text><View style={styles.cardMeta}><DesignImage name="calendar" size={13} color={C.secondary} /><Text style={styles.eventSchedule}>{event.schedule}</Text></View></View></Pressable>)}</ScrollView>
      </View>
    </ScrollView>
    <Modal transparent visible={Boolean(sheet)} animationType="slide" onRequestClose={() => setSheet(null)}>
      <View style={styles.modalOverlay}><Pressable accessibilityRole="button" accessibilityLabel="Close dialog" onPress={() => setSheet(null)} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}><Text accessibilityRole="header" style={styles.sectionTitle}>{sheet?.title}</Text><ScrollView><Text style={styles.sheetBody}>{sheet?.body}</Text></ScrollView><Pressable accessibilityRole="button" onPress={() => setSheet(null)} style={styles.sheetButton}><Text style={styles.sheetButtonLabel}>Done</Text></Pressable></View>
      </View>
    </Modal>
  </View>;
}
