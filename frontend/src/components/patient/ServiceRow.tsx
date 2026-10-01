import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { PatientTheme } from '../../constants/PatientTheme';
import { DesignImage, type DesignImageName } from './DesignImage';

type Props = {
  label: string;
  caption?: string;
  badge?: string;
  icon: DesignImageName;
  onPress?: () => void;
  style?: object;
};

export function ServiceRow({ label, caption, badge, icon, onPress, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.root, pressed && styles.pressed, style]}
    >
      <View style={styles.iconWrap}>
        <DesignImage name={icon} size={20} />
      </View>
      <View style={styles.text}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {caption ? (
          <Text style={styles.caption} numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : (
        <DesignImage name="arrow" size={14} style={styles.arrow} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PatientTheme.spaceMd,
    backgroundColor: PatientTheme.surface,
    borderRadius: PatientTheme.radiusLg,
    borderWidth: 1,
    borderColor: PatientTheme.border,
    paddingHorizontal: PatientTheme.spaceMd,
    paddingVertical: PatientTheme.spaceMd,
  },
  pressed: {
    opacity: 0.85,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PatientTheme.surfaceMuted,
  },
  text: {
    flex: 1,
  },
  label: {
    color: PatientTheme.textPrimary,
    fontSize: PatientTheme.designType.body,
    fontWeight: '600',
  },
  caption: {
    marginTop: 1,
    color: PatientTheme.textSecondary,
    fontSize: PatientTheme.designType.caption,
  },
  badge: {
    paddingHorizontal: PatientTheme.spaceSm,
    paddingVertical: 3,
    borderRadius: PatientTheme.radiusPill,
    backgroundColor: PatientTheme.successSoft,
  },
  badgeText: {
    color: PatientTheme.success,
    fontSize: PatientTheme.designType.caption,
    fontWeight: '700',
  },
  arrow: {
    opacity: 0.5,
  },
});
