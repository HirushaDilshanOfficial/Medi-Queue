import { LocalizedText as Text } from '../../../i18n/LocalizedText';
import { useLanguage } from '../../../i18n/LanguageContext';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import Svg, { Path } from 'react-native-svg';
import { bookingApi } from '../../../services/bookingApi';
import { patientApi } from '../../../services/patientApi';
import { doctorApi } from '../../../services/doctorApi';
import { queueApi } from '../../../services/queueApi';
import { useAsyncResource } from '../../../hooks/useAsyncResource';
import { usePolling } from '../../../hooks/usePolling';
import { todayKey } from '../../../utils/opdDates';
import { AppointmentCard } from '../../../components/patient/AppointmentCard';
import { ProfileIcon } from '../../../components/patient/ProfileIcon';
import type { Appointment } from '../../../types/patient';
import { QueuePassContent } from './QueuePassContent';
import { C, styles } from './queueStyles';

const POLL_INTERVAL_MS = 15_000;
type Sheet = 'options' | 'leave' | { title: string; body: string } | null;

export function LiveQueueScreen() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isFocused = useIsFocused();
  const [fontsLoaded, fontError] = useFonts({
    ProfileInter400: require('../../../../assets/fonts/Inter-400.ttf'),
    ProfileInter500: require('../../../../assets/fonts/Inter-500.ttf'),
    ProfileInter600: require('../../../../assets/fonts/Inter-600.ttf'),
    ProfileInter700: require('../../../../assets/fonts/Inter-700.ttf'),
    ProfileInter800: require('../../../../assets/fonts/Inter-800.ttf'),
  });
  const pass = useAsyncResource(() => queueApi.myPass(), []);
  const upcoming = useAsyncResource(() => bookingApi.list('upcoming'), []);
  const profile = useAsyncResource(() => patientApi.getProfile(), []);
  const activePass = pass.data?.pass ?? null;
  const activePassId = activePass?.id;
  const todaysAppointment = upcoming.data?.appointments.find(appointment => appointment.date === todayKey());
  const linkedAppointment = upcoming.data?.appointments.find(appointment => appointment.id === activePass?.appointmentId);
  const doctorId = linkedAppointment?.doctorId;
  const doctor = useAsyncResource(() => doctorId ? doctorApi.getById(doctorId) : Promise.resolve(null), [doctorId]);
  const [checkingIn, setCheckingIn] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const { reload: reloadPass, setData: setPass } = pass;
  const { reload: reloadUpcoming } = upcoming;
  const { reload: reloadProfile } = profile;
  const hasFocused = useRef(false);
  const buzzedPass = useRef<string | null>(null);
  const pollingEnabled = isFocused && Boolean(activePass) && !['completed', 'cancelled', 'no_show'].includes(activePass?.status ?? '');

  useFocusEffect(useCallback(() => {
    if (hasFocused.current) { reloadPass(); reloadUpcoming(); reloadProfile(); }
    hasFocused.current = true;
  }, [reloadPass, reloadUpcoming, reloadProfile]));

  // Preserve the QR and ticket ID while updating position and status.
  const poll = useCallback(async () => {
    try {
      const result = await queueApi.live();
      const livePass = result.pass;
      if (!livePass) {
        setPass(current => current?.pass?.id === activePassId ? { pass: null } : current);
        reloadUpcoming();
      }
      else if (activePassId !== livePass.id) { reloadPass(); reloadUpcoming(); }
      else setPass(current => {
        if (!current?.pass || current.pass.id !== livePass.id) return current;
        return { ...current, pass: { ...current.pass, live: result.live,
          status: livePass.status as typeof current.pass.status, calledAt: livePass.calledAt } };
      });
      setLastUpdate(Date.now()); setLiveError(null);
    } catch (error) {
      setLiveError('Live updates are temporarily unavailable. Showing the last known position and retrying.');
      throw error;
    }
  }, [setPass, reloadPass, reloadUpcoming, activePassId]);
  usePolling(poll, POLL_INTERVAL_MS, { enabled: pollingEnabled });

  useEffect(() => {
    if (!pollingEnabled) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pollingEnabled]);
  useEffect(() => {
    if (activePass?.status !== 'called' || buzzedPass.current === activePass.id) return;
    buzzedPass.current = activePass.id;
    if (Platform.OS !== 'web') Vibration.vibrate([0, 400, 200, 400]);
  }, [activePass?.id, activePass?.status]);

  const countdown = Math.max(0, Math.min(POLL_INTERVAL_MS / 1000, Math.ceil((lastUpdate + POLL_INTERVAL_MS - now) / 1000)));
  const refresh = () => { reloadPass(); reloadUpcoming(); reloadProfile(); };
  const home = () => router.replace('/(patient)');
  const message = (title: string, body: string) => { setActionError(null); setSheet({ title, body }); };
  const checkIn = async (appointment: Appointment) => {
    setCheckingIn(true);
    try { setPass(await queueApi.checkIn(appointment.id)); reloadUpcoming(); }
    catch (error) { message(t('Could not check in'), error instanceof Error ? error.message : t('Please try again.')); }
    finally { setCheckingIn(false); }
  };
  const leave = async () => {
    setLeaving(true); setActionError(null);
    try { await queueApi.leave(); setPass({ pass: null }); reloadUpcoming(); setSheet(null); }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Could not leave the queue. Please try again.'); }
    finally { setLeaving(false); }
  };
  const share = async () => {
    if (!activePass) return;
    const text = `Medi-Queue pass\n${activePass.department}\nQueue ${activePass.tokenNumber}\n${activePass.dateLong || activePass.queueDate}\n${activePass.room ?? 'Room assigned at clinic'}\nPass code: ${activePass.passCode}`;
    try {
      if (Platform.OS === 'web') {
        if (navigator.share) await navigator.share({ title: 'Medi-Queue pass', text });
        else message(t('Share ticket'), text);
      } else await Share.share({ title: 'Medi-Queue pass', message: text });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      message('Could not share your ticket', t('Please try again.'));
    }
  };

  if (!fontsLoaded && !fontError) return <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={C.primary} /></View>;

  return <View style={styles.root}>
    <View style={[styles.headerSafe, { paddingTop: insets.top }]}><View style={styles.header}>
      <View style={styles.logo}><ProfileIcon name="medical" color={C.surface} /></View>
      <View style={styles.grow}><Text style={styles.eyebrow}>{t("NATIONAL OPD")}</Text><Text style={styles.headerTitle}>{t("Live Queue Pass")}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Queue notifications")} onPress={() => message(t('Queue notifications'), activePass ? `Queue ${activePass.tokenNumber}: ${activePass.status.replace(/_/g, ' ')}. This screen updates automatically while you wait.` : 'Check in for an appointment to receive your live queue pass.')} style={styles.iconButton}><ProfileIcon name="bell" size={22} color={C.muted} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Open patient profile")} onPress={() => router.push('/(patient)/profile')} style={styles.profileButton}><ProfileIcon name="profile" size={18} color={C.surface} /></Pressable>
    </View></View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={Boolean(pass.data) && (pass.loading || upcoming.loading)} onRefresh={refresh} tintColor={C.primary} colors={[C.primary]} />}>
      <View style={styles.hero}>
        <Svg pointerEvents="none" style={styles.heroWaveRight} viewBox="0 0 260 140" fill="none" stroke="#1a6779" opacity={0.3}><Path d="M-20 120 C60 40 160 150 280 60" strokeWidth={2.5} /><Path d="M-10 140 C70 60 180 170 300 80" strokeWidth={1.75} /><Path d="M0 160 C80 80 200 190 320 100" strokeWidth={1} /></Svg>
        <Svg pointerEvents="none" style={styles.heroWaveLeft} viewBox="0 0 200 120" fill="none" stroke={C.aqua} opacity={0.15}><Path d="M-10 20 C50 80 140 10 220 90" strokeWidth={2} /></Svg>
        <View style={styles.heroRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Go back home")} onPress={home} style={({ pressed }) => [styles.lightButton, pressed && styles.pressed]}><ProfileIcon name="back" color={C.surface} /></Pressable>
          <View style={styles.grow}><Text style={styles.heroTitle}>{t("Queue Details")}</Text><Text numberOfLines={1} style={styles.heroSubtitle}>{activePass ? `Ticket ID: ${activePass.passCode}` : t('Your position updates automatically')}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Queue options")} onPress={() => { setActionError(null); setSheet('options'); }} style={({ pressed }) => [styles.lightButton, pressed && styles.pressed]}><ProfileIcon name="more" color={C.surface} /></Pressable>
        </View>
      </View>
      <View style={styles.stack}>
        {pass.error ? <View style={styles.stateCard}><Text style={styles.title}>{t("Could not reach the queue")}</Text><Text style={styles.error}>{pass.error}</Text><Pressable accessibilityRole="button" onPress={reloadPass} style={styles.walletButton}><Text style={styles.actionLabel}>{t("Try again")}</Text></Pressable></View> : null}
        {activePass ? <QueuePassContent pass={activePass} patientName={profile.data?.patient.fullName ?? '—'} doctor={doctor.data?.doctor}
          countdown={countdown} liveError={liveError} onHome={home} onShare={share}
          onWallet={() => message(t('Add to Wallet'), 'Apple Wallet and Google Wallet integration is not available yet. Keep this live pass open at check-in, or use Share ticket to share your pass details.')}
          onContact={() => message('Clinic contact', 'Ask at the clinic reception desk for assistance with your queue or consulting room. A clinic phone number has not been provided.')} /> :
          pass.loading || (upcoming.loading && !upcoming.data) ? <View style={styles.stateCard}><ActivityIndicator color={C.primary} /><Text style={styles.caption}>{t("Checking your queue pass and bookings…")}</Text></View> :
          pass.error ? null : todaysAppointment ? <View style={styles.stateCard}>
            <View style={styles.inline}><ProfileIcon name="calendar" /><Text style={styles.title}>{t("You have a booking today")}</Text></View>
            <Text style={styles.caption}>{todaysAppointment.slotTime} with {todaysAppointment.doctorName}</Text>
            <Text style={styles.caption}>{t("Check in to get your queue number and QR pass. You can leave the queue before you are called.")}</Text>
            <Pressable accessibilityRole="button" disabled={checkingIn} accessibilityState={{ disabled: checkingIn }} onPress={() => checkIn(todaysAppointment)} style={[styles.homeButton, checkingIn && styles.disabled]}><Text style={styles.homeLabel}>{checkingIn ? 'Checking in…' : 'Check in for my token'}</Text></Pressable>
          </View> : <View style={styles.stateCard}><ProfileIcon name="ticket" size={32} /><Text style={styles.title}>{t("No queue pass yet")}</Text><Text style={styles.caption}>{t("Check in on the day of your appointment to collect your queue number.")}</Text><Pressable accessibilityRole="button" onPress={() => router.push('/(patient)/doctors')} style={styles.homeButton}><Text style={styles.homeLabel}>{t("Book a clinic visit")}</Text></Pressable></View>}
        {upcoming.error && !activePass ? <View style={styles.stateCard}><Text style={styles.error}>{t("Your bookings could not be loaded.")}</Text><Pressable accessibilityRole="button" onPress={reloadUpcoming} style={styles.menuButton}><Text style={styles.actionLabel}>{t("Retry bookings")}</Text></Pressable></View> : null}
        {!activePass && Boolean(upcoming.data?.appointments.length) ? <View style={{ gap: 12 }}><Text style={styles.title}>{t("Your bookings")}</Text>{upcoming.data?.appointments.slice(0, 3).map(appointment => <AppointmentCard key={appointment.id} appointment={appointment} />)}</View> : null}
      </View>
    </ScrollView>
    <Modal transparent visible={sheet !== null} animationType="slide" onRequestClose={() => { if (!leaving) setSheet(null); }}>
      <View style={styles.modalOverlay}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("Close dialog")} disabled={leaving} onPress={() => setSheet(null)} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom) }]}>
          <View style={styles.sheetHandle} /><Text accessibilityRole="header" style={styles.title}>{sheet === 'options' ? t('Queue options') : sheet === 'leave' ? t('Leave the queue?') : sheet?.title}</Text>
          {sheet === 'options' ? <>
            <Pressable accessibilityRole="button" onPress={() => { refresh(); setSheet(null); }} style={styles.menuButton}><Text style={styles.actionLabel}>{t("Refresh queue")}</Text></Pressable>
            {activePass?.status === 'waiting' ? <Pressable accessibilityRole="button" onPress={() => setSheet('leave')} style={styles.menuButton}><Text style={styles.error}>{t("Leave queue")}</Text></Pressable> : null}
          </> : <Text selectable style={styles.sheetBody}>{sheet === 'leave' ? t('Your queue number will be released. Stay in the queue to keep your place.') : sheet?.body}</Text>}
          {actionError ? <Text accessibilityRole="alert" style={styles.error}>{actionError}</Text> : null}
          {sheet === 'leave' ? <Pressable accessibilityRole="button" disabled={leaving} onPress={leave} style={[styles.homeButton, leaving && styles.disabled]}><Text style={styles.homeLabel}>{leaving ? t('Leaving…') : t('Leave queue')}</Text></Pressable> : null}
          <Pressable accessibilityRole="button" disabled={leaving} onPress={() => setSheet(null)} style={styles.menuButton}><Text style={styles.actionLabel}>{sheet === 'leave' ? t('Stay in queue') : t('Done')}</Text></Pressable>
        </View>
      </View>
    </Modal>
  </View>;
}
