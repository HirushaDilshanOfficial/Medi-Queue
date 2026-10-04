import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { DesignImage, type DesignImageName } from '../../../components/patient/DesignImage';
import { patientApi } from '../../../services/patientApi';
import { HttpError } from '../../../services/http';
import type { DashboardPayload } from '../../../types/patient';
import { ACTION_TILES, EVENTS, SPECIALTIES } from './dashboardContent';

const C = { background: '#f3faff', primary: '#004c5b', teal: '#176577', secondary: '#00696e', aqua: '#84f4fb', pale: '#e6f6ff', icon: '#e0f0f9', text: '#0e1e23', muted: '#3f484b' };

function IconButton({ icon, label, onPress, light = false }: { icon: DesignImageName; label: string; onPress: () => void; light?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.iconButton, light && styles.lightButton, pressed && styles.pressed]}><DesignImage name={icon} size={22} color={light ? '#fff' : C.muted} /></Pressable>;
}

function Wave({ ticket = false }: { ticket?: boolean }) {
  return <Svg pointerEvents="none" style={ticket ? styles.ticketWave : styles.heroWave} viewBox={ticket ? '0 0 100 60' : '0 0 200 200'} preserveAspectRatio="none">
    {ticket ? <><Path d="M10 0 C40 45 60 15 100 35 L100 60 L0 60 Z" fill={C.teal} opacity={0.2} /><Path d="M0 20 C30 5 60 50 100 25" stroke={C.teal} strokeWidth={2} opacity={0.2} /></> : <><Path d="M20 180 C60 130 100 170 150 110 C190 60 170 20 210 0" stroke="#fff" strokeWidth={4} fill="none" /><Path d="M0 140 C50 100 90 140 140 80 C180 30 160 10 200 0" stroke="#fff" strokeWidth={2} fill="none" /></>}
  </Svg>;
}

export function PatientDashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(timer); }, []);
  const load = useCallback(async () => {
    setRefreshing(true);
    try { setData(await patientApi.getDashboard()); setError(null); }
    catch (err) { setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => {
    let cancelled = false;
    patientApi.getDashboard().then(payload => { if (!cancelled) { setData(payload); setError(null); } }).catch(err => { if (!cancelled) setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const name = data?.patient.fullName.trim().split(/\s+/)[0] || 'there';
  const daypart = now.getHours() < 12 ? 'Morning' : now.getHours() < 17 ? 'Afternoon' : 'Evening';
  const pass = data?.stats.activePass;
  const next = data?.nextAppointment;
  const ahead = pass?.position == null ? null : Math.max(0, pass.position - 1);
  const doctors = () => router.push('/(patient)/doctors');
  const queue = () => router.push('/(patient)/queue');
  const profile = () => router.push('/(patient)/profile');
  const notifications = () => Alert.alert('Appointment reminders', next ? `${next.doctorName}\n${next.dateLabel ?? next.date} at ${next.slotTime}` : 'You have no upcoming appointments. Book a doctor to get started.');
  const help = () => Alert.alert('How can we help?', 'Book a slot in Doctors, then open Queue on the day of your appointment to check in and follow your turn. Your appointments and medical reports are available in Profile.');

  return <View style={styles.root}>
    <View style={[styles.headerSafe, { paddingTop: insets.top }]}><View style={styles.header}>
      <View style={styles.logo}><DesignImage name="medical" size={20} color="#fff" /></View>
      <View style={styles.grow}><Text style={styles.eyebrow}>NATIONAL OPD</Text><Text style={styles.headerTitle}>Home Dashboard</Text></View>
      <IconButton icon="bell" label="Notifications" onPress={notifications} />
      <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={profile} style={styles.avatar}><DesignImage name="profile" size={18} color="#fff" /></Pressable>
    </View></View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={C.primary} colors={[C.primary]} />}>
      <View style={styles.hero}>
        <Wave />
        <View style={styles.greetingRow}><View style={styles.grow}><Text style={styles.greeting}>{daypart}, {name}</Text><Text style={styles.subtitle}>Let us make you better</Text></View><IconButton icon="bell" label="Appointment reminders" onPress={notifications} light /><IconButton icon="help" label="Help and FAQ" onPress={help} light /></View>
        <Text style={styles.queueLabel}>{pass ? 'ACTIVE QUEUE' : 'LIVE QUEUE'}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={pass ? 'View your active queue pass' : 'Open queue to check in'} onPress={queue} style={({ pressed }) => [styles.queueWidget, pressed && styles.pressed]}>
          <View style={styles.queueHeading}><View style={styles.clinicIcon}><DesignImage name="spine" size={20} color="#fff" /></View><View style={styles.grow}><Text style={styles.clinicTitle}>{pass ? `${pass.department} Queue` : 'No active pass today'}</Text><Text style={styles.clinicSubtitle}>{pass ? ahead === null ? 'Follow your live queue here' : ahead === 0 ? 'You are next' : `${ahead} ${ahead === 1 ? 'person' : 'people'} ahead of you` : 'Check in on the day of your appointment'}</Text></View><View style={styles.queueArrow}><DesignImage name="arrow" size={18} color="#fff" /></View></View>
          <View style={styles.ticket}><Wave ticket /><View style={styles.ticketText}><Text style={styles.queueNumber}>{pass ? `Queue ${pass.tokenNumber}` : 'Get your queue pass'}</Text><View style={styles.etaRow}><DesignImage name="clock" size={14} color={C.secondary} /><Text style={styles.eta}>{pass ? pass.estimatedTurnAt ? `Your turn at ${pass.estimatedTurnAt}` : 'Your turn estimate will appear here' : 'Open the queue to check in'}</Text></View></View>{pass?.room ? <View style={styles.roomPill}><Text style={styles.room}>{pass.room}</Text></View> : null}</View>
        </Pressable>
        <View style={styles.dots}><View style={styles.activeDot} /><View style={styles.dot} /><View style={styles.dot} /></View>
      </View>
      <View style={styles.body}>
        {loading ? <View style={styles.status}><ActivityIndicator color={C.primary} /><Text style={styles.statusText}>Loading your dashboard…</Text></View> : null}
        {error && !loading ? <View style={styles.error}><Text style={styles.errorTitle}>We could not load your dashboard</Text><Text style={styles.statusText}>{error}</Text><Pressable accessibilityRole="button" onPress={load} style={styles.retry}><Text style={styles.link}>Try again</Text></Pressable></View> : null}
        <LinearGradient colors={[C.primary, C.teal]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.booking}>
          <View pointerEvents="none" style={styles.bookingDecoration} />
          <View style={styles.bookingTop}><View style={styles.reservationPill}><DesignImage name="calendar" size={16} color={C.aqua} /><Text style={styles.reservation}>Instant OPD Slot Reservation</Text></View><View style={styles.livePill}><Text style={styles.live}>Live Slots</Text></View></View>
          <Text style={styles.bookingTitle}>Book Doctor Appointment</Text><Text style={styles.bookingBody}>Skip waiting lines. Choose your specialist, OPD clinic & preferred time slot instantly.</Text>
          <View style={styles.bookingFooter}><View style={styles.bookingMeta}><DesignImage name="badge" size={13} color="#afecff" /><Text style={styles.meta}>General & Specialist</Text><Text style={styles.metaBullet}>•</Text><Text style={styles.meta}>Today Available</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Book slot now" onPress={doctors} style={({ pressed }) => [styles.bookButton, pressed && styles.pressed]}><Text style={styles.bookButtonText}>Book Slot Now</Text><DesignImage name="arrow" size={18} color={C.primary} /></Pressable></View>
        </LinearGradient>
        <Pressable accessibilityRole="button" accessibilityLabel="Search doctor or clinic" onPress={doctors} style={styles.search}><DesignImage name="search" size={22} color={C.secondary} /><Text style={styles.searchText}>Search doctor or clinic</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={notifications} style={styles.checkup}><DesignImage name="bell" size={20} color={C.aqua} /><Text style={styles.checkupTitle} numberOfLines={1}>{next ? `Checkup with ${next.doctorName}` : 'Your next medical checkup'}</Text><View style={styles.checkupBadge}><DesignImage name="calendar" size={14} color="#fff" /><Text style={styles.checkupDate}>{next ? next.dateLabel ?? next.date : 'No booking'}</Text></View></Pressable>
        <View style={styles.actions}>{ACTION_TILES.map(tile => <Pressable key={tile.key} accessibilityRole="button" accessibilityLabel={`${tile.label} ${tile.caption}`} onPress={tile.key === 'clinics-queue' || tile.key === 'medicine-queue' ? queue : doctors} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><View style={styles.actionIcon}><DesignImage name={tile.icon} size={22} color={C.secondary} /></View><Text style={styles.actionLabel}>{tile.label}{'\n'}{tile.caption}</Text></Pressable>)}</View>
        <View style={styles.section}><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Hospital Clinics</Text><Pressable accessibilityRole="button" accessibilityLabel="See all hospital clinics" onPress={doctors} hitSlop={8}><Text style={styles.link}>See All</Text></Pressable></View><View style={styles.specialties}>{SPECIALTIES.map(specialty => <Pressable key={specialty.key} accessibilityRole="button" accessibilityLabel={specialty.label} onPress={doctors} style={({ pressed }) => [styles.specialty, pressed && styles.pressed]}><View style={styles.specialtyIcon}><DesignImage name={specialty.icon} size={22} color={C.secondary} /></View><Text style={styles.specialtyLabel}>{specialty.label}</Text></Pressable>)}</View></View>
        <View style={styles.section}><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Events & Health Insights</Text><Pressable accessibilityRole="button" accessibilityLabel="See all health insights" onPress={() => Alert.alert('Events & Health Insights', EVENTS.map(event => `${event.title}\n${event.description}\n${event.schedule}`).join('\n\n'))} hitSlop={8}><Text style={styles.link}>See All</Text></Pressable></View><ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.events} contentContainerStyle={styles.eventContent}>{EVENTS.map(event => <Pressable key={event.key} accessibilityRole="button" accessibilityLabel={event.title} onPress={() => Alert.alert(event.title, `${event.description}\n\n${event.schedule}`)} style={({ pressed }) => [styles.eventCard, pressed && styles.pressed]}><Image source={event.image} style={styles.eventImage} resizeMode="cover" /><View style={styles.eventBadge}><Text style={styles.eventBadgeText}>{event.badge}</Text></View><View style={styles.eventBody}><Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text><Text style={styles.eventDescription} numberOfLines={1}>{event.description}</Text><Text style={styles.eventSchedule}>{event.schedule}</Text></View></Pressable>)}</ScrollView></View>
      </View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background }, content: { paddingBottom: 32 },
  headerSafe: { backgroundColor: C.background, zIndex: 1, boxShadow: '0 1px 8px rgba(0,0,0,0.04)' },
  header: { height: 64, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1, minWidth: 0 },
  logo: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: C.secondary, fontSize: 11, letterSpacing: 1 }, headerTitle: { fontSize: 18, fontWeight: '600', color: C.text },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, lightButton: { backgroundColor: 'rgba(255,255,255,0.15)' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }, pressed: { opacity: 0.75 },
  hero: { backgroundColor: C.teal, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, overflow: 'hidden', boxShadow: '0 3px 5px rgba(0,0,0,0.12)' },
  heroWave: { position: 'absolute', width: 256, height: 256, right: -32, top: -48, opacity: 0.1 }, greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  greeting: { color: '#fff', fontSize: 22, fontWeight: '700', letterSpacing: -0.3 }, subtitle: { color: C.aqua, fontSize: 11, marginTop: 2 },
  queueLabel: { color: C.aqua, fontSize: 11, fontWeight: '500', letterSpacing: 0.5, marginBottom: 4 }, queueWidget: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 8 },
  queueHeading: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 4, paddingVertical: 6 },
  clinicIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  clinicTitle: { color: '#fff', fontSize: 14, fontWeight: '600' }, clinicSubtitle: { color: '#8dd0e5', fontSize: 11, marginTop: 2 },
  queueArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  ticket: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, overflow: 'hidden', minHeight: 82 },
  ticketWave: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 112, height: '100%' }, ticketText: { flex: 1 }, queueNumber: { color: C.primary, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  etaRow: { flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: 2 }, eta: { color: C.muted, fontSize: 11, flex: 1 },
  roomPill: { backgroundColor: C.pale, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 }, room: { color: C.primary, fontSize: 11 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 16 }, activeDot: { width: 20, height: 6, borderRadius: 3, backgroundColor: '#fff' }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  body: { paddingHorizontal: 20, paddingTop: 16, gap: 16 }, status: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }, statusText: { color: C.muted, fontSize: 12 },
  error: { backgroundColor: '#ffdad6', borderRadius: 12, padding: 12, gap: 6 }, errorTitle: { color: '#93000a', fontWeight: '600', fontSize: 14 }, retry: { alignSelf: 'flex-start', paddingVertical: 8 },
  booking: { borderRadius: 16, padding: 16, overflow: 'hidden', boxShadow: '0 3px 6px rgba(0,0,0,0.12)' },
  bookingDecoration: { position: 'absolute', right: -24, bottom: -24, width: 130, height: 120, borderTopLeftRadius: 50, borderTopRightRadius: 40, backgroundColor: 'rgba(255,255,255,0.15)', transform: [{ rotate: '-10deg' }] },
  bookingTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  reservationPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 1 }, reservation: { color: C.aqua, fontSize: 11, flexShrink: 1 },
  livePill: { backgroundColor: C.aqua, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }, live: { fontSize: 11, fontWeight: '700', color: '#002022' },
  bookingTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 10 }, bookingBody: { color: 'rgba(255,255,255,0.85)', fontSize: 12, lineHeight: 16, marginTop: 3 },
  bookingFooter: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }, bookingMeta: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 130, gap: 4 },
  meta: { color: '#afecff', fontSize: 11, flexShrink: 1 }, metaBullet: { color: '#8dd0e5', fontSize: 12, marginHorizontal: 4 },
  bookButton: { backgroundColor: '#fff', borderRadius: 30, paddingHorizontal: 16, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 6 }, bookButtonText: { color: C.primary, fontSize: 12, fontWeight: '700' },
  search: { backgroundColor: '#fff', borderRadius: 30, minHeight: 44, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }, searchText: { color: '#6f797c', fontSize: 14 },
  checkup: { backgroundColor: C.primary, borderRadius: 30, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }, checkupTitle: { color: '#fff', fontSize: 12, fontWeight: '600', flex: 1 },
  checkupBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', maxWidth: '45%' }, checkupDate: { color: '#fff', fontSize: 11, flexShrink: 1 },
  actions: { flexDirection: 'row', gap: 6, paddingTop: 4 }, action: { flex: 1, alignItems: 'center' }, actionIcon: { width: 42, height: 42, borderRadius: 26, backgroundColor: C.pale, alignItems: 'center', justifyContent: 'center' }, actionLabel: { color: C.text, fontSize: 11, lineHeight: 14, textAlign: 'center', marginTop: 6 },
  section: { gap: 8, paddingTop: 4 }, sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, sectionTitle: { color: C.text, fontSize: 18, fontWeight: '600', flexShrink: 1 }, link: { color: C.secondary, fontSize: 14, fontWeight: '600' },
  specialties: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 }, specialty: { width: '25%', alignItems: 'center' }, specialtyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.icon, alignItems: 'center', justifyContent: 'center' }, specialtyLabel: { color: C.text, fontSize: 11, textAlign: 'center', marginTop: 4 },
  events: { marginHorizontal: -20 }, eventContent: { paddingHorizontal: 20, paddingBottom: 4, gap: 16 }, eventCard: { width: 240, borderRadius: 16, backgroundColor: '#fff', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }, eventImage: { width: '100%', height: 112 },
  eventBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: C.primary, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }, eventBadgeText: { color: '#fff', fontSize: 11, fontWeight: '500' }, eventBody: { padding: 8, gap: 4 }, eventTitle: { color: C.secondary, fontSize: 11 }, eventDescription: { color: C.text, fontSize: 12, fontWeight: '600' }, eventSchedule: { color: C.muted, fontSize: 12 },
});
