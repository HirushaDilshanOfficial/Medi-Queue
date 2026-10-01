import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PatientTheme } from '../../../constants/PatientTheme';
import { doctorApi } from '../../../services/doctorApi';
import { bookingApi } from '../../../services/bookingApi';
import { HttpError } from '../../../services/http';
import { useAsyncResource } from '../../../hooks/useAsyncResource';
import type { SlotOption } from '../../../types/patient';
import { dayLabel, longDayLabel } from '../../../utils/opdDates';
import { ScreenHeader } from '../../../components/patient/ScreenHeader';
import { ScreenLoader, MessageState } from '../../../components/patient/ScreenStates';
import { DayStrip } from '../../../components/patient/DayStrip';
import { SlotGrid } from '../../../components/patient/SlotGrid';
import { DesignImage } from '../../../components/patient/DesignImage';

export function DoctorBookingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, rescheduleId } = useLocalSearchParams<{ id: string; rescheduleId?: string }>();

  const doctorId = Array.isArray(id) ? id[0] : id;
  const rescheduling = Array.isArray(rescheduleId) ? rescheduleId[0] : rescheduleId;

  const [chosenDate, setChosenDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState('');

  const doctor = useAsyncResource(
    () => doctorApi.getById(doctorId),
    [doctorId],
  );
  const days = useAsyncResource(
    () => bookingApi.bookableDays(doctorId),
    [doctorId],
  );

  // The first day the doctor has capacity is selected by default, so the screen is
  // useful immediately instead of showing an empty slot list. Deriving it beats
  // storing it in an effect, which would cost an extra render on every load.
  const firstAvailableDay = days.data?.days[0]?.date ?? null;
  const date = chosenDate ?? firstAvailableDay;

  const slots = useAsyncResource(
    () =>
      date
        ? bookingApi.slots(doctorId, date)
        : Promise.resolve<{ date: string; slots: SlotOption[] }>({ date: '', slots: [] }),
    [doctorId, date],
  );

  // Changing the day invalidates the time, so it is cleared in the handler rather
  // than in an effect.
  const selectDate = useCallback((next: string) => {
    setChosenDate(next);
    setTime(null);
  }, []);

  const confirm = useCallback(
    (label: string, action: () => Promise<void>) => {
      Alert.alert(label, 'This cannot be undone after the clinic starts.', [
        { text: 'Go back', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setSubmitting(true);
            try {
              await action();
            } catch (error) {
              Alert.alert(
                'Something went wrong',
                error instanceof HttpError ? error.message : 'Please try again.',
              );
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]);
    },
    [],
  );

  const submit = useCallback(() => {
    if (!date || !time) return;
    const trimmedReason = reason.trim();

    if (rescheduling) {
      confirm('Move this appointment?', async () => {
        await bookingApi.reschedule(rescheduling, date, time);
        router.back();
      });
      return;
    }

    confirm('Confirm this booking?', async () => {
      await bookingApi.create({
        doctorId,
        date,
        slotTime: time,
        reason: trimmedReason || undefined,
      });
      router.back();
    });
  }, [confirm, date, doctorId, reason, rescheduling, router, time]);

  if (doctor.loading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + PatientTheme.spaceSm }]}>
        <ScreenHeader title="Doctor" showBack />
        <ScreenLoader label="Loading doctor" />
      </View>
    );
  }

  if (doctor.error || !doctor.data?.doctor) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + PatientTheme.spaceSm }]}>
        <ScreenHeader title="Doctor" showBack />
        <MessageState
          icon="help"
          title="Could not load this doctor"
          description={doctor.error ?? 'The doctor may no longer be listed.'}
          actionLabel="Try again"
          onAction={doctor.reload}
        />
      </View>
    );
  }

  const profile = doctor.data.doctor;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ paddingTop: insets.top + PatientTheme.spaceSm }}>
        <ScreenHeader
          title={rescheduling ? 'Change appointment' : profile.displayName || profile.name}
          subtitle={rescheduling ? 'Pick a new time' : profile.specialization}
          showBack
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile.initials || profile.firstName.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.profileName}>{profile.displayName || profile.name}</Text>
            <Text style={styles.profileSpecialty}>{profile.specialization}</Text>
            {profile.qualifications ? (
              <Text style={styles.profileMeta}>{profile.qualifications}</Text>
            ) : null}
            <View style={styles.tagRow}>
              {profile.isAvailable ? (
                <Tag icon="clock" label="Accepting patients" tone={PatientTheme.successSoft} color={PatientTheme.success} />
              ) : (
                <Tag icon="clock" label="Not accepting now" tone={PatientTheme.warningSoft} color={PatientTheme.warning} />
              )}
              {profile.room ? (
                <Tag icon="badge" label={profile.room} tone={PatientTheme.surfaceCool} color={PatientTheme.brand} />
              ) : null}
            </View>
          </View>
        </View>

        {profile.about ? <Text style={styles.about}>{profile.about}</Text> : null}

        <SectionTitle title="Pick a day" />
        {days.loading ? (
          <ScreenLoader label="Checking the diary" />
        ) : days.error ? (
          <MessageState
            icon="help"
            title="Could not load the diary"
            description={days.error}
            actionLabel="Try again"
            onAction={days.reload}
          />
        ) : (
          <DayStrip days={days.data?.days ?? []} selected={date} onSelect={selectDate} />
        )}

        {date ? (
          <>
            <SectionTitle title={longDayLabel(date)} subtitle={dayLabel(date)} />
            <SlotGrid
              slots={slots.data?.slots ?? []}
              selected={time}
              onSelect={setTime}
              loading={slots.loading}
            />
            {slots.error ? (
              <Text style={styles.hint}>{slots.error}</Text>
            ) : null}
            {!!slots.data?.slots.length && !time ? (
              <Text style={styles.hint}>Select a time to continue</Text>
            ) : null}
          </>
        ) : null}

        {!rescheduling ? (
          <View style={styles.reasonBlock}>
            <SectionTitle title="Reason for visit" subtitle="Optional, helps the doctor prepare" />
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. recurring chest pain"
              placeholderTextColor={PatientTheme.textMuted}
              style={styles.reasonInput}
              maxLength={200}
              multiline
              accessibilityLabel="Reason for visit"
            />
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + PatientTheme.spaceMd }]}>
        <View style={styles.footerText}>
          <Text style={styles.footerLabel}>{rescheduling ? 'New time' : 'Your booking'}</Text>
          <Text style={styles.footerValue}>
            {date && time ? `${dayLabel(date)} · ${time}` : 'Choose a time'}
          </Text>
        </View>
        <Pressable
          onPress={submit}
          disabled={!date || !time || submitting}
          accessibilityRole="button"
          accessibilityState={{ disabled: !date || !time || submitting }}
          style={({ pressed }) => [
            styles.cta,
            (!date || !time || submitting) && styles.ctaDisabled,
            pressed && styles.pressed,
          ]}
        >
          {submitting ? (
            <ActivityIndicator color={PatientTheme.textOnBrand} size="small" />
          ) : (
            <Text style={styles.ctaLabel}>{rescheduling ? 'Move appointment' : 'Confirm booking'}</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionTitleText}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function Tag({
  icon,
  label,
  tone,
  color,
}: {
  icon: 'clock' | 'badge';
  label: string;
  tone: string;
  color: string;
}) {
  return (
    <View style={[styles.tag, { backgroundColor: tone }]}>
      <DesignImage name={icon} size={11} color={PatientTheme.brandMid} />
      <Text style={[styles.tagLabel, { color }]}>{label}</Text>
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
    gap: PatientTheme.spaceSm,
  },
  profileCard: {
    flexDirection: 'row',
    gap: PatientTheme.spaceMd,
    padding: PatientTheme.spaceMd,
    borderRadius: PatientTheme.radiusLg,
    borderWidth: 1,
    borderColor: PatientTheme.border,
    backgroundColor: PatientTheme.surface,
    ...PatientTheme.shadowCard,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PatientTheme.brandRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: PatientTheme.textOnBrand,
    fontSize: PatientTheme.designType.section,
    fontWeight: '800',
  },
  profileText: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    fontSize: PatientTheme.designType.section,
    fontWeight: '800',
    color: PatientTheme.textPrimary,
  },
  profileSpecialty: {
    fontSize: PatientTheme.designType.body,
    fontWeight: '600',
    color: PatientTheme.brand,
  },
  profileMeta: {
    fontSize: PatientTheme.designType.caption,
    color: PatientTheme.textSecondary,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: PatientTheme.spaceSm,
    paddingVertical: 3,
    borderRadius: PatientTheme.radiusPill,
  },
  tagLabel: {
    fontSize: 9,
    fontWeight: '700',
  },
  about: {
    fontSize: PatientTheme.designType.body,
    lineHeight: 18,
    color: PatientTheme.textSecondary,
  },
  sectionTitle: {
    marginTop: PatientTheme.spaceSm,
  },
  sectionTitleText: {
    fontSize: PatientTheme.designType.item,
    fontWeight: '800',
    color: PatientTheme.textPrimary,
  },
  sectionSubtitle: {
    fontSize: PatientTheme.designType.caption,
    color: PatientTheme.textMuted,
  },
  hint: {
    paddingHorizontal: PatientTheme.spaceLg,
    fontSize: PatientTheme.designType.caption,
    color: PatientTheme.textMuted,
  },
  reasonBlock: {
    gap: PatientTheme.spaceSm,
  },
  reasonInput: {
    minHeight: 64,
    padding: PatientTheme.spaceMd,
    borderRadius: PatientTheme.radiusMd,
    borderWidth: 1,
    borderColor: PatientTheme.border,
    backgroundColor: PatientTheme.surface,
    fontSize: PatientTheme.designType.body,
    color: PatientTheme.textPrimary,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PatientTheme.spaceMd,
    paddingHorizontal: PatientTheme.spaceLg,
    paddingTop: PatientTheme.spaceMd,
    borderTopWidth: 1,
    borderTopColor: PatientTheme.border,
    backgroundColor: PatientTheme.surface,
  },
  footerText: {
    flex: 1,
  },
  footerLabel: {
    fontSize: 10,
    color: PatientTheme.textMuted,
  },
  footerValue: {
    fontSize: PatientTheme.designType.item,
    fontWeight: '700',
    color: PatientTheme.textPrimary,
  },
  cta: {
    paddingHorizontal: PatientTheme.spaceXl,
    paddingVertical: PatientTheme.spaceMd,
    borderRadius: PatientTheme.radiusPill,
    backgroundColor: PatientTheme.brand,
  },
  ctaDisabled: {
    backgroundColor: PatientTheme.borderStrong,
  },
  ctaLabel: {
    fontSize: PatientTheme.designType.body,
    fontWeight: '700',
    color: PatientTheme.textOnBrand,
  },
  pressed: {
    opacity: 0.85,
  },
});
