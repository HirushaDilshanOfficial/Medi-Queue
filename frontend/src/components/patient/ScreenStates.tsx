import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { PatientTheme } from '../../constants/PatientTheme';
import { DesignImage, type DesignImageName } from './DesignImage';

// Shared loading / empty / error treatment, so the three new screens read as one
// feature rather than three different ones.

export function ScreenLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <View style={styles.centered} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={PatientTheme.brand} />
      <Text style={styles.centeredTitle}>{label}</Text>
    </View>
  );
}

type MessageProps = {
  icon?: DesignImageName;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function MessageState({ icon = 'stethoscope', title, description, actionLabel, onAction }: MessageProps) {
  return (
    <View style={styles.centered}>
      <DesignImage name={icon} size={44} color={PatientTheme.brandMid} />
      <Text style={styles.centeredTitle}>{title}</Text>
      <Text style={styles.centeredBody}>{description}</Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: PatientTheme.spaceXxl,
    paddingHorizontal: PatientTheme.spaceXl,
    gap: PatientTheme.spaceSm,
  },
  centeredTitle: {
    marginTop: PatientTheme.spaceXs,
    fontSize: PatientTheme.designType.item,
    fontWeight: '700',
    color: PatientTheme.textPrimary,
    textAlign: 'center',
  },
  centeredBody: {
    fontSize: PatientTheme.designType.body,
    color: PatientTheme.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  action: {
    marginTop: PatientTheme.spaceMd,
    paddingHorizontal: PatientTheme.spaceXl,
    paddingVertical: PatientTheme.spaceMd,
    borderRadius: PatientTheme.radiusPill,
    backgroundColor: PatientTheme.brand,
  },
  actionPressed: {
    opacity: 0.85,
  },
  actionLabel: {
    color: PatientTheme.textOnBrand,
    fontSize: PatientTheme.designType.item,
    fontWeight: '700',
  },
});
