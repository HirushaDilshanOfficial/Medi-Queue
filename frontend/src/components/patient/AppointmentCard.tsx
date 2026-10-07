import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { PatientTheme } from '../../constants/PatientTheme';
import type { Appointment } from '../../types/patient';
import { waitLabel } from '../../utils/opdDates';
import { DesignImage } from './DesignImage';

type Props = {
  appointment: Appointment;
  onReschedule?: (appointment: Appointment) => void;
  onCancel?: (appointment: Appointment) => void;
  onCheckIn?: (appointment: Appointment) => void;
};

const STATUS_STYLES: Record<string, { label: string; color: string; background: string }> = {
  booked: { label: 'Confirmed', color: PatientTheme.brand, background: PatientTheme.infoSoft },
  checked_in: { label: 'Checked in', color: PatientTheme.success, background: PatientTheme.successSoft },
  in_consultation: { label: 'In consultation', color: PatientTheme.success, background: PatientTheme.successSoft },
  completed: { label: 'Completed', color: PatientTheme.textSecondary, background: PatientTheme.surfaceMuted },
  no_show: { label: 'Missed', color: PatientTheme.warning, background: PatientTheme.warningSoft },
  cancelled: { label: 'Cancelled', color: PatientTheme.danger, background: PatientTheme.dangerSoft },
};

export function AppointmentCard({ appointment, onReschedule, onCancel, onCheckIn }: Props) {
  const { t } = useLanguage();
  const status = STATUS_STYLES[appointment.status] ?? STATUS_STYLES.booked;
  const live = appointment.live;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.dateLabel}>
            {appointment.dateLabel ?? appointment.date} · {appointment.slotTime}
          </Text>
          <Text style={styles.doctor} numberOfLines={1}>
            {appointment.doctorName}
          </Text>
          <Text style={styles.department} numberOfLines={1}>
            {appointment.department}
            {appointment.room ? ` · ${appointment.room}` : ''}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: status.background }]}>
          <Text style={[styles.badgeLabel, { color: status.color }]}>{t(status.label)}</Text>
        </View>
      </View>

      {live && appointment.status === 'checked_in' ? (
        <View style={styles.liveStrip}>
          <DesignImage name="ticket" size={13} color={PatientTheme.brandMid} />
          <Text style={styles.liveText}>
            {t("Queue")}{' '}{appointment.tokenNumber ? `A-${String(appointment.tokenNumber).padStart(3, '0')}` : ''} ·{' '}
            {live.position <= 1 ? t('You are next') : `${live.peopleAhead} ahead`}
            {live.estimatedTurnAt ? ` · ~${live.estimatedTurnAt}` : ''}
          </Text>
        </View>
      ) : null}

      {live && live.position > 1 && appointment.status === 'checked_in' ? (
        <Text style={styles.waitHint}>{t("Estimated wait")}{' '}{waitLabel(live.waitMinutes)}</Text>
      ) : null}

      {appointment.reason ? <Text style={styles.reason}>“{appointment.reason}”</Text> : null}

      {appointment.canCancel || appointment.canReschedule || appointment.status === 'booked' ? (
        <View style={styles.actions}>
          {appointment.status === 'booked' && onCheckIn ? (
            <Pressable
              onPress={() => onCheckIn(appointment)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.button, styles.buttonPrimary, pressed && styles.pressed]}
            >
              <Text style={styles.buttonPrimaryLabel}>{t("Check in")}</Text>
            </Pressable>
          ) : null}

          {appointment.canReschedule && onReschedule ? (
            <Pressable
              onPress={() => onReschedule(appointment)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            >
              <Text style={styles.buttonLabel}>{t("Reschedule")}</Text>
            </Pressable>
          ) : null}

          {appointment.canCancel && onCancel ? (
            <Pressable
              onPress={() => onCancel(appointment)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            >
              <Text style={[styles.buttonLabel, styles.buttonDanger]}>{t("Cancel")}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: PatientTheme.spaceMd,
    borderRadius: PatientTheme.radiusLg,
    borderWidth: 1,
    borderColor: PatientTheme.border,
    backgroundColor: PatientTheme.surface,
    gap: PatientTheme.spaceSm,
    ...PatientTheme.shadowCard,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: PatientTheme.spaceSm,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  dateLabel: {
    fontSize: PatientTheme.designType.caption,
    fontWeight: '700',
    color: PatientTheme.brand,
    letterSpacing: 0.3,
  },
  doctor: {
    fontSize: PatientTheme.designType.item,
    fontWeight: '700',
    color: PatientTheme.textPrimary,
  },
  department: {
    fontSize: PatientTheme.designType.body,
    color: PatientTheme.textSecondary,
  },
  badge: {
    paddingHorizontal: PatientTheme.spaceSm,
    paddingVertical: 4,
    borderRadius: PatientTheme.radiusPill,
  },
  badgeLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  liveStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    padding: PatientTheme.spaceSm,
    borderRadius: PatientTheme.radiusMd,
    backgroundColor: PatientTheme.surfaceCool,
  },
  liveText: {
    flex: 1,
    fontSize: PatientTheme.designType.caption,
    fontWeight: '600',
    color: PatientTheme.brandDeep,
  },
  waitHint: {
    fontSize: PatientTheme.designType.caption,
    color: PatientTheme.textMuted,
  },
  reason: {
    fontSize: PatientTheme.designType.body,
    fontStyle: 'italic',
    color: PatientTheme.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: PatientTheme.spaceSm,
    marginTop: PatientTheme.spaceXs,
  },
  button: {
    flex: 1,
    paddingVertical: PatientTheme.spaceSm,
    borderRadius: PatientTheme.radiusMd,
    borderWidth: 1,
    borderColor: PatientTheme.borderStrong,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: PatientTheme.brand,
    borderColor: PatientTheme.brand,
  },
  buttonPrimaryLabel: {
    fontSize: PatientTheme.designType.body,
    fontWeight: '700',
    color: PatientTheme.textOnBrand,
  },
  buttonLabel: {
    fontSize: PatientTheme.designType.body,
    fontWeight: '600',
    color: PatientTheme.textPrimary,
  },
  buttonDanger: {
    color: PatientTheme.danger,
  },
  pressed: {
    opacity: 0.85,
  },
});
