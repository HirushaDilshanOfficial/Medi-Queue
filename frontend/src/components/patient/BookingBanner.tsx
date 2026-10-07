import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { PatientTheme } from '../../constants/PatientTheme';
import { DesignImage } from './DesignImage';

type Props = {
  metaPrimary: string;
  metaSecondary: string;
  onPress?: () => void;
};

export function BookingBanner({ metaPrimary, metaSecondary, onPress }: Props) {
  const { t } = useLanguage();
  return (
    <View style={styles.root}>
      <View style={styles.topRow}>
          <DesignImage name="hourglass" size={14} color={PatientTheme.warning} />
        <Text style={styles.kicker} numberOfLines={1}>
          {t("Instant OPD Slot Reservation")}</Text>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{t("Live Slots")}</Text>
        </View>
      </View>

      <Text style={styles.title}>{t("Book Doctor Appointment")}</Text>
      <Text style={styles.body}>
        {t("Skip waiting lines. Choose your specialist, OPD clinic & preferred time slot instantly.")}</Text>

      <View style={styles.footer}>
        <View style={styles.chip}>
          <Text style={styles.chipText} numberOfLines={2}>
            {metaPrimary}
          </Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipText} numberOfLines={2}>
            {metaSecondary}
          </Text>
          <View style={styles.availableDot} />
        </View>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={t("Book slot now")}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>{t("Book Slot Now")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: PatientTheme.surface,
    borderRadius: PatientTheme.radiusXl,
    borderWidth: 1,
    borderColor: PatientTheme.border,
    padding: PatientTheme.spaceLg,
    ...PatientTheme.shadowCard,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  kicker: {
    flex: 1,
    color: PatientTheme.textSecondary,
    fontSize: PatientTheme.designType.caption,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: PatientTheme.spaceSm,
    paddingVertical: 3,
    borderRadius: PatientTheme.radiusPill,
    backgroundColor: PatientTheme.successSoft,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: PatientTheme.success,
  },
  liveText: {
    color: PatientTheme.success,
    fontSize: PatientTheme.designType.caption,
    fontWeight: '700',
  },
  title: {
    marginTop: PatientTheme.spaceMd,
    color: PatientTheme.textPrimary,
    fontSize: PatientTheme.designType.section,
    fontWeight: '800',
  },
  body: {
    marginTop: 4,
    color: PatientTheme.textSecondary,
    fontSize: PatientTheme.designType.body,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PatientTheme.spaceSm,
    marginTop: PatientTheme.spaceLg,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: PatientTheme.spaceSm,
    paddingVertical: 5,
    borderRadius: PatientTheme.radiusSm,
    backgroundColor: PatientTheme.surfaceMuted,
  },
  chipText: {
    color: PatientTheme.brand,
    fontSize: PatientTheme.designType.caption,
    fontWeight: '600',
  },
  availableDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: PatientTheme.success,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: PatientTheme.spaceSm,
    borderRadius: PatientTheme.radiusPill,
    backgroundColor: PatientTheme.brand,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: PatientTheme.textOnBrand,
    fontSize: PatientTheme.designType.body,
    fontWeight: '700',
  },
});
