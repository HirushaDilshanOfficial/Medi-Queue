import { LanguageSwitcher } from '../../../i18n/LanguageSwitcher';
import { LocalizedText as Text } from '../../../i18n/LocalizedText';
import { useLanguage } from '../../../i18n/LanguageContext';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Vibration, View } from 'react-native';
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
import { longDayLabel, todayKey } from '../../../utils/opdDates';
import { AppointmentCard } from '../../../components/patient/AppointmentCard';
import { ProfileIcon } from '../../../components/patient/ProfileIcon';
import type { Appointment } from '../../../types/patient';
import { QueuePassContent } from './QueuePassContent';
import { C, styles } from './queueStyles';

const POLL_INTERVAL_MS = 15_000;
type Sheet = 'options' | 'leave' | { title: string; body: string } | null;

export function LiveQueueScreen() {
  const { t, locale } = useLanguage();
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
  const activePasses = pass.data?.passes ?? (activePass ? [activePass] : []);
  const doctorPasses = activePasses.filter((queuePass, index, passes) => {
    const doctorKey = queuePass.doctorId
      ?? `${queuePass.doctorName ?? 'assigned-doctor'}|${queuePass.department}`;
    return passes.findIndex((candidate) => (
      (candidate.doctorId
        ?? `${candidate.doctorName ?? 'assigned-doctor'}|${candidate.department}`) === doctorKey
    )) === index;
  });
  const [selectedPassId, setSelectedPassId] = useState<string | null>(null);
  const [doctorMenuOpen, setDoctorMenuOpen] = useState(false);
  const selectedPass = doctorPasses.find((item) => item.id === selectedPassId) ?? doctorPasses[0] ?? null;
  const todaysAppointment = upcoming.data?.appointments.find(appointment => appointment.date === todayKey());
  const linkedAppointment = upcoming.data?.appointments.find(appointment => appointment.id === selectedPass?.appointmentId);
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
  const pollingEnabled = isFocused && activePasses.length > 0 && !activePasses.every((item) => ['completed', 'cancelled', 'no_show'].includes(item.status));

  useFocusEffect(useCallback(() => {
    if (hasFocused.current) { reloadPass(); reloadUpcoming(); reloadProfile(); }
    hasFocused.current = true;
  }, [reloadPass, reloadUpcoming, reloadProfile]));

  // Preserve the QR and ticket ID while updating position and status.
  const poll = useCallback(async () => {
    try {
      const result = await queueApi.myPass();
      if (!result.pass) {
        setPass({ pass: null, passes: [] });
        reloadUpcoming();
      }
      else setPass(result);
      setLastUpdate(Date.now()); setLiveError(null);
    } catch (error) {
      setLiveError('Live updates are temporarily unavailable. Showing the last known position and retrying.');
      throw error;
    }
  }, [setPass, reloadUpcoming]);
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
  const cancelAppointment = (appointment: Appointment) => {
    const cancel = async () => {
      try {
        await bookingApi.cancel(appointment.id);
        reloadUpcoming();
        reloadPass();
      } catch (error) {
        message(t('Could not cancel appointment'), error instanceof Error ? error.message : t('Please try again.'));
      }
    };
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(t('Cancel appointment?'))) void cancel();
      return;
    }
    Alert.alert(
      t('Cancel appointment?'),
      t('This appointment and its queue token will be cancelled.'),
      [
        { text: t('Keep appointment'), style: 'cancel' },
        {
          text: t('Cancel appointment'),
          style: 'destructive',
          onPress: () => void cancel(),
        },
      ],
    );
  };
  const leave = async () => {
    setLeaving(true); setActionError(null);
    try { await queueApi.leave(); setPass({ pass: null }); reloadUpcoming(); setSheet(null); }
    catch (error) { setActionError(error instanceof Error ? error.message : t('Could not leave the queue. Please try again.')); }
    finally { setLeaving(false); }
  };
  const share = async () => {
    if (!selectedPass) return;
    const text = [t('Medi-Queue pass'), t(selectedPass.department), t('Queue #{number}', { number: selectedPass.tokenNumber }), longDayLabel(selectedPass.queueDate, locale), selectedPass.room ?? t('Room assigned at clinic'), `${t('Pass code:')} ${selectedPass.passCode}`].join('\n');
    try {
      if (Platform.OS === 'web') {
        if (navigator.share) await navigator.share({ title: t('Medi-Queue pass'), text });
        else message(t('Share ticket'), text);
      } else await Share.share({ title: 'Medi-Queue pass', message: text });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      message(t('Could not share your ticket'), t('Please try again.'));
    }
  };

  if (!fontsLoaded && !fontError) return <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={C.primary} /></View>;

  return <View style={styles.root}>
    <View style={[styles.headerSafe, { paddingTop: insets.top }]}><View style={styles.header}>
      <View style={styles.logo}><ProfileIcon name="medical" color={C.surface} /></View>
      <View style={styles.grow}><Text style={styles.eyebrow}>{t("NATIONAL OPD")}</Text><Text style={styles.headerTitle}>{t("Live Queue Pass")}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Queue notifications")} onPress={() => message(t('Queue notifications'), activePass ? t("Queue {value0}: {value1}. This screen updates automatically while you wait.", { value0: String(activePass.tokenNumber), value1: t(activePass.status) }) : t('Check in for an appointment to receive your live queue pass.'))} style={styles.iconButton}><ProfileIcon name="bell" size={22} color={C.muted} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Open patient profile")} onPress={() => router.push('/(patient)/profile')} style={styles.profileButton}><ProfileIcon name="profile" size={18} color={C.surface} /></Pressable>
      <LanguageSwitcher tone="light" />
    </View></View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={Boolean(pass.data) && (pass.loading || upcoming.loading)} onRefresh={refresh} tintColor={C.primary} colors={[C.primary]} />}>
      <View style={styles.hero}>
        <Svg pointerEvents="none" style={styles.heroWaveRight} viewBox="0 0 260 140" fill="none" stroke="#1a6779" opacity={0.3}><Path d="M-20 120 C60 40 160 150 280 60" strokeWidth={2.5} /><Path d="M-10 140 C70 60 180 170 300 80" strokeWidth={1.75} /><Path d="M0 160 C80 80 200 190 320 100" strokeWidth={1} /></Svg>
        <Svg pointerEvents="none" style={styles.heroWaveLeft} viewBox="0 0 200 120" fill="none" stroke={C.aqua} opacity={0.15}><Path d="M-10 20 C50 80 140 10 220 90" strokeWidth={2} /></Svg>
        <View style={styles.heroRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Go back home")} onPress={home} style={({ pressed }) => [styles.lightButton, pressed && styles.pressed]}><ProfileIcon name="back" color={C.surface} /></Pressable>
          <View style={styles.grow}><Text style={styles.heroTitle}>{t("Queue Details")}</Text><Text numberOfLines={1} style={styles.heroSubtitle}>{selectedPass ? t("Ticket ID: {value0}", { value0: String(selectedPass.passCode) }) : t('Your position updates automatically')}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Queue options")} onPress={() => { setActionError(null); setSheet('options'); }} style={({ pressed }) => [styles.lightButton, pressed && styles.pressed]}><ProfileIcon name="more" color={C.surface} /></Pressable>
        </View>
      </View>
      <View style={styles.stack}>
        {doctorPasses.length > 1 ? (
          <View style={styles.stateCard}>
            <Text style={styles.small}>{t('Select doctor booking')}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('Select doctor booking')} onPress={() => setDoctorMenuOpen(true)} style={styles.doctorSelect}>
              <Text numberOfLines={1} style={styles.doctorSelectText}>{selectedPass?.doctorName ?? t('Choose a doctor')}</Text>
              <ProfileIcon name="chevronDown" size={18} color={C.primary} />
            </Pressable>
          </View>
        ) : null}
        {pass.error ? <View style={styles.stateCard}><Text style={styles.title}>{t("Could not reach the queue")}</Text><Text style={styles.error}>{pass.error}</Text><Pressable accessibilityRole="button" onPress={reloadPass} style={styles.walletButton}><Text style={styles.actionLabel}>{t("Try again")}</Text></Pressable></View> : null}
        {selectedPass ? <QueuePassContent pass={selectedPass} patientName={profile.data?.patient.fullName ?? '—'} doctor={doctor.data?.doctor}
          countdown={countdown} liveError={liveError} onHome={home} onShare={share}
          onWallet={() => message(t('Add to Wallet'), t('Apple Wallet and Google Wallet integration is not available yet. Keep this live pass open at check-in, or use Share ticket to share your pass details.'))}
          onContact={() => message(t('Clinic contact'), t('Ask at the clinic reception desk for assistance with your queue or consulting room. A clinic phone number has not been provided.'))} /> :
          pass.loading || (upcoming.loading && !upcoming.data) ? <View style={styles.stateCard}><ActivityIndicator color={C.primary} /><Text style={styles.caption}>{t("Checking your queue pass and bookings…")}</Text></View> :
          pass.error ? null : todaysAppointment ? <View style={styles.stateCard}>
            <View style={styles.inline}><ProfileIcon name="calendar" /><Text style={styles.title}>{t("You have a booking today")}</Text></View>
            <Text style={styles.caption}>{todaysAppointment.slotTime} {t("with")}{' '}{todaysAppointment.doctorName}</Text>
            <Text style={styles.caption}>{t("Check in to get your queue number and QR pass. You can leave the queue before you are called.")}</Text>
            <Pressable accessibilityRole="button" disabled={checkingIn} accessibilityState={{ disabled: checkingIn }} onPress={() => checkIn(todaysAppointment)} style={[styles.homeButton, checkingIn && styles.disabled]}><Text style={styles.homeLabel}>{checkingIn ? t('Checking in…') : t('Check in for my token')}</Text></Pressable>
          </View> : <View style={styles.stateCard}><ProfileIcon name="ticket" size={32} /><Text style={styles.title}>{t("No queue pass yet")}</Text><Text style={styles.caption}>{t("Check in on the day of your appointment to collect your queue number.")}</Text><Pressable accessibilityRole="button" onPress={() => router.push('/(patient)/doctors')} style={styles.homeButton}><Text style={styles.homeLabel}>{t("Book a clinic visit")}</Text></Pressable></View>}
        {upcoming.error && !activePass ? <View style={styles.stateCard}><Text style={styles.error}>{t("Your bookings could not be loaded.")}</Text><Pressable accessibilityRole="button" onPress={reloadUpcoming} style={styles.menuButton}><Text style={styles.actionLabel}>{t("Retry bookings")}</Text></Pressable></View> : null}
        {Boolean(upcoming.data?.appointments.length) ? <View style={{ gap: 12 }}><Text style={styles.title}>{t("Your bookings")}</Text>{upcoming.data?.appointments.map(appointment => <AppointmentCard key={appointment.id} appointment={appointment} onCheckIn={checkIn} onCancel={cancelAppointment} />)}</View> : null}
      </View>
    </ScrollView>
    <Modal transparent visible={doctorMenuOpen} animationType="fade" onRequestClose={() => setDoctorMenuOpen(false)}>
      <View style={styles.modalOverlay}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Close doctor selection')} onPress={() => setDoctorMenuOpen(false)} style={StyleSheet.absoluteFill} />
        <View style={styles.doctorMenu}>
          <Text style={styles.title}>{t('Select doctor booking')}</Text>
          {doctorPasses.map((queuePass) => (
            <Pressable key={queuePass.id} onPress={() => { setSelectedPassId(queuePass.id); setDoctorMenuOpen(false); }} style={styles.doctorOption}>
              <View style={styles.grow}>
                <Text style={styles.actionLabel}>{queuePass.doctorName ?? t('Assigned doctor')}</Text>
                <Text style={styles.small}>{t(queuePass.department ?? '')} · {queuePass.tokenLabel} · {longDayLabel(queuePass.queueDate, locale)}</Text>
              </View>
              {queuePass.id === selectedPass?.id ? <ProfileIcon name="check" size={18} color={C.secondary} /> : null}
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
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
