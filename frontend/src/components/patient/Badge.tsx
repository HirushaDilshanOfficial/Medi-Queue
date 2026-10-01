import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { PatientTheme } from '../../constants/PatientTheme';

type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONES: Record<Tone, { bg: string; fg: string }> = {
  brand: { bg: PatientTheme.surfaceMuted, fg: PatientTheme.brand },
  success: { bg: PatientTheme.successSoft, fg: PatientTheme.success },
  warning: { bg: PatientTheme.warningSoft, fg: PatientTheme.warning },
  danger: { bg: PatientTheme.dangerSoft, fg: PatientTheme.danger },
  info: { bg: PatientTheme.infoSoft, fg: PatientTheme.info },
  neutral: { bg: PatientTheme.surfaceCool, fg: PatientTheme.textSecondary },
};

type BadgeProps = {
  label: string;
  tone?: Tone;
  style?: ViewStyle;
};

export function Badge({ label, tone = 'brand', style }: BadgeProps) {
  const { bg, fg } = TONES[tone];

  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[styles.badgeText, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: PatientTheme.spaceMd,
    paddingVertical: PatientTheme.spaceXs + 1,
    borderRadius: PatientTheme.radiusPill,
  },
  badgeText: {
    fontSize: PatientTheme.fontSizeMicro,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
