import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
  Vibration,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useRouter } from 'expo-router';
import { PatientTheme } from '../../../constants/PatientTheme';
import { bookingApi } from '../../../services/bookingApi';
import { queueApi } from '../../../services/queueApi';
import { useAsyncResource } from '../../../hooks/useAsyncResource';
import { usePolling } from '../../../hooks/usePolling';
import { todayKey } from '../../../utils/opdDates';
import type { Appointment, LiveQueueState, QueuePass } from '../../../types/patient';
import { ScreenHeader } from '../../../components/patient/ScreenHeader';
import { ScreenLoader, MessageState } from '../../../components/patient/ScreenStates';
import { QueuePassCard } from '../../../components/patient/QueuePassCard';
import { AppointmentCard } from '../../../components/patient/AppointmentCard';
import { DesignImage } from '../../../components/patient/DesignImage';

// 15s keeps the position feeling live without hammering the API. The polling hook
// backs this off on failure and stops entirely in the background.
const POLL_INTERVAL_MS = 15_000;

export function LiveQueueScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isFocused = useIsFocused();

  const [refreshing, setRefreshing] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  const pass = useAsyncResource(() => queueApi.myPass(), []);
  const today = useAsyncResource(() => bookingApi.list('upcoming'), []);

  const todaysAppointment = today.data?.appointments.find(
    (appointment) => appointment.date === todayKey(),
  );

  // Poll the lightweight live endpoint, then patch the pass in place so the QR
  // code and pass code are not regenerated on every tick.
  const patchLive = useCallback(
    (live: LiveQueueState | null, status?: string, calledAt?: string | null) => {
      pass.setData((current) => {
        if (!current?.pass) return current;
        const next: QueuePass = {
          ...current.pass,
          live: live ?? current.pass.live,
          status: (status as QueuePass['status']) ?? current.pass.status,
          calledAt: calledAt === undefined ? current.pass.calledAt : calledAt,
        };
        return { ...current, pass: next };
      });
    },
    [pass],
  );

  const poll = useCallback(async () => {
    const result = await queueApi.live();
    patchLive(result.live, result.pass?.status, result.pass?.calledAt);
  }, [patchLive]);

  usePolling(poll, POLL_INTERVAL_MS, { enabled: isFocused });

  // A haptic the moment the patient is called is the single most useful signal in
  // a noisy waiting room, where the phone is often on silent. Keyed on the token
  // so it fires once per patient rather than on every poll.
  const lastStatus = pass.data?.pass?.status;
  const lastToken = pass.data?.pass?.tokenNumber ?? null;
  const buzzedToken = useRef<number | null>(null);

  useEffect(() => {
    if (lastStatus !== 'called' || lastToken === null) return;
    if (buzzedToken.current === lastToken) return;
    buzzedToken.current = lastToken;
    if (Platform.OS !== 'web') Vibration.vibrate([0, 400, 200, 400]);
  }, [lastStatus, lastToken]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([pass.reload(), today.reload()]);
    setRefreshing(false);
  }, [pass, today]);

  const checkIn = useCallback(
    (appointment: Appointment) => {
      setCheckingIn(true);
      queueApi
        .checkIn(appointment.id)
        .then(async (result) => {
          pass.setData({ pass: result.pass });
          await today.reload();
        })
        .catch((error) => {
          Alert.alert(
            'Could not check in',
            error instanceof Error ? error.message : 'Please try again.',
          );
        })
        .finally(() => setCheckingIn(false));
    },
    [pass, today],
  );

  const leaveQueue = useCallback(() => {
    Alert.alert('Leave the queue?', 'Your queue number will be released.', [
      { text: 'Stay', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await queueApi.leave();
            await Promise.all([pass.reload(), today.reload()]);
          } catch (error) {
            Alert.alert(
              'Could not leave the queue',
              error instanceof Error ? error.message : 'Please try again.',
            );
          }
        },
      },
    ]);
  }, [pass, today]);

  if (pass.loading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + PatientTheme.spaceSm }]}>
        <ScreenHeader title="Live queue" subtitle="Your position updates automatically" />
        <ScreenLoader label="Checking your queue pass" />
      </View>
    );
  }

  const activePass = pass.data?.pass ?? null;

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: insets.top + PatientTheme.spaceSm }}>
        <ScreenHeader
          title="Live queue"
          subtitle={activePass ? activePass.department : 'Your position updates automatically'}
          action={
            <View style={styles.liveTag}>
              <View style={styles.liveDot} />
              <Text style={styles.liveTagText}>LIVE</Text>
            </View>
          }
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + PatientTheme.spaceXxl }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PatientTheme.brand} />
        }
      >
        {pass.error ? (
          <MessageState
            icon="help"
            title="Could not reach the queue"
            description={pass.error}
            actionLabel="Try again"
            onAction={pass.reload}
          />
        ) : activePass ? (
          <>
            <QueuePassCard pass={activePass} onLeave={leaveQueue} refreshing={refreshing} />
            <WaitNotice pass={activePass} />
          </>
        ) : todaysAppointment ? (
          <View style={styles.checkInCard}>
            <View style={styles.checkInHeader}>
              <DesignImage name="calendar" size={20} color={PatientTheme.brand} />
              <View style={styles.checkInText}>
                <Text style={styles.checkInTitle}>You have a booking today</Text>
                <Text style={styles.checkInSub}>
                  {todaysAppointment.slotTime} with {todaysAppointment.doctorName}
                </Text>
              </View>
            </View>

            <Text style={styles.checkInBody}>
              Check in to get your queue number and pass. You can leave the queue at any time before you
              are called.
            </Text>

            <Pressable
              onPress={() => checkIn(todaysAppointment)}
              disabled={checkingIn}
              accessibilityRole="button"
              accessibilityState={{ disabled: checkingIn }}
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
            >
              <Text style={styles.ctaLabel}>{checkingIn ? 'Checking in...' : 'Check in for my token'}</Text>
            </Pressable>
          </View>
        ) : (
          <MessageState
            icon="ticket"
            title="No queue pass yet"
            description="Check in on the day of an appointment to collect your queue number."
            actionLabel="Book a clinic visit"
            onAction={() => router.push('/(patient)/doctors')}
          />
        )}

        {today.data?.appointments.length && !activePass ? (
          <View style={styles.upcoming}>
            <Text style={styles.upcomingTitle}>Your bookings</Text>
            <View style={styles.upcomingList}>
              {today.data.appointments.slice(0, 3).map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

// Explains what to do next. A patient who is two places away and a patient who has
// been called need very different guidance, and guessing wrong wastes a doctor's
// time.
function WaitNotice({ pass }: { pass: QueuePass }) {
  const live = pass.live;
  if (!live) return null;

  if (pass.status === 'in_consultation') {
    return (
      <Notice
        tone="success"
        icon="medical"
        title="You are with the doctor"
        body="Your consultation is under way. Follow up at the pharmacy desk if you need a prescription."
      />
    );
  }

  if (pass.status === 'called') {
    return (
      <Notice
        tone="warning"
        icon="bell"
        title="Please go to the counter now"
        body={`${pass.doctorName ?? 'The doctor'} is waiting. Ask at the desk to be shown to ${pass.room ?? 'the consulting room'}.`}
      />
    );
  }

  if (live.position <= 1) {
    return (
      <Notice
        tone="warning"
        icon="bell"
        title="Stay close by"
        body="You are next. Keep your phone on loud and stay in this department."
      />
    );
  }

  if (live.peopleAhead <= 3) {
    return (
      <Notice
        tone="info"
        icon="clock"
        title="Nearly your turn"
        body={`${live.peopleAhead} ${live.peopleAhead === 1 ? 'person is' : 'people are'} ahead of you. Stay in the waiting area.`}
      />
    );
  }

  return (
    <Notice
      tone="info"
      icon="clock"
      title="You are in the queue"
      body="This screen updates on its own. You can leave the department and come back before your turn."
    />
  );
}

function Notice({
  tone,
  icon,
  title,
  body,
}: {
  tone: 'info' | 'success' | 'warning';
  icon: 'bell' | 'clock' | 'medical';
  title: string;
  body: string;
}) {
  const palette = {
    info: { background: PatientTheme.infoSoft, color: PatientTheme.brand },
    success: { background: PatientTheme.successSoft, color: PatientTheme.success },
    warning: { background: PatientTheme.warningSoft, color: PatientTheme.warning },
  }[tone];

  return (
    <View style={[styles.notice, { backgroundColor: palette.background }]}>
      <DesignImage name={icon} size={16} color={palette.color} />
      <View style={styles.noticeText}>
        <Text style={[styles.noticeTitle, { color: palette.color }]}>{title}</Text>
        <Text style={styles.noticeBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PatientTheme.background,
  },
  content: {
    paddingHorizontal: PatientTheme.spaceLg,
    paddingTop: PatientTheme.spaceSm,
    gap: PatientTheme.spaceLg,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: PatientTheme.spaceSm,
    paddingVertical: 4,
    borderRadius: PatientTheme.radiusPill,
    backgroundColor: PatientTheme.successSoft,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: PatientTheme.success,
  },
  liveTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: PatientTheme.success,
    letterSpacing: 0.5,
  },
  checkInCard: {
    padding: PatientTheme.spaceLg,
    borderRadius: PatientTheme.radiusLg,
    borderWidth: 1,
    borderColor: PatientTheme.border,
    backgroundColor: PatientTheme.surface,
    gap: PatientTheme.spaceMd,
    ...PatientTheme.shadowCard,
  },
  checkInHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PatientTheme.spaceSm,
  },
  checkInText: {
    flex: 1,
  },
  checkInTitle: {
    fontSize: PatientTheme.designType.item,
    fontWeight: '800',
    color: PatientTheme.textPrimary,
  },
  checkInSub: {
    fontSize: PatientTheme.designType.caption,
    color: PatientTheme.textSecondary,
  },
  checkInBody: {
    fontSize: PatientTheme.designType.body,
    lineHeight: 18,
    color: PatientTheme.textSecondary,
  },
  cta: {
    paddingVertical: PatientTheme.spaceMd,
    borderRadius: PatientTheme.radiusPill,
    backgroundColor: PatientTheme.brand,
    alignItems: 'center',
  },
  ctaLabel: {
    fontSize: PatientTheme.designType.item,
    fontWeight: '700',
    color: PatientTheme.textOnBrand,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: PatientTheme.spaceSm,
    padding: PatientTheme.spaceMd,
    borderRadius: PatientTheme.radiusMd,
  },
  noticeText: {
    flex: 1,
    gap: 2,
  },
  noticeTitle: {
    fontSize: PatientTheme.designType.body,
    fontWeight: '800',
  },
  noticeBody: {
    fontSize: PatientTheme.designType.caption,
    lineHeight: 16,
    color: PatientTheme.textSecondary,
  },
  upcoming: {
    gap: PatientTheme.spaceSm,
  },
  upcomingTitle: {
    fontSize: PatientTheme.designType.item,
    fontWeight: '800',
    color: PatientTheme.textPrimary,
  },
  upcomingList: {
    gap: PatientTheme.spaceMd,
  },
  pressed: {
    opacity: 0.85,
  },
});
