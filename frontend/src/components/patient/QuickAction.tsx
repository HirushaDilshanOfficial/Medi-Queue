import React from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { PatientTheme } from '../../constants/PatientTheme';

type QuickActionProps = {
  label: string;
  caption?: string;
  icon: string;
  onPress?: () => void;
  style?: ViewStyle;
};

export function QuickAction({ label, caption, icon, onPress, style }: QuickActionProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.container, pressed && styles.pressed, style]}
    >
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      {caption ? (
        <Text style={styles.caption} numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 104,
    backgroundColor: PatientTheme.surface,
    borderRadius: PatientTheme.radiusLg,
    borderWidth: 1,
    borderColor: PatientTheme.border,
    paddingVertical: PatientTheme.spaceMd,
    paddingHorizontal: PatientTheme.spaceSm,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PatientTheme.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: PatientTheme.spaceSm,
  },
  icon: {
    fontSize: 20,
  },
  label: {
    fontSize: PatientTheme.fontSizeCaption,
    fontWeight: '700',
    color: PatientTheme.textPrimary,
    textAlign: 'center',
  },
  caption: {
    marginTop: 2,
    fontSize: PatientTheme.fontSizeMicro,
    color: PatientTheme.textSecondary,
    textAlign: 'center',
  },
});
