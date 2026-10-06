import React from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { PatientTheme } from '../../constants/PatientTheme';

type QuickActionProps = {
  label: string;
  caption?: string;
  icon: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  width?: number;
};

export function QuickAction({
  label,
  caption,
  icon,
  onPress,
  style,
  width = 82,
}: QuickActionProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.container,
        { width },
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={styles.iconWrap}>{icon}</View>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
      {caption ? (
        <Text style={styles.caption} numberOfLines={2}>
          {caption}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: PatientTheme.surface,
    borderRadius: PatientTheme.radiusLg,
    borderWidth: 1,
    borderColor: PatientTheme.border,
    paddingVertical: PatientTheme.spaceMd,
    paddingHorizontal: PatientTheme.spaceSm,
    alignItems: 'flex-start',
  },
  pressed: {
    opacity: 0.75,
  },
  iconWrap: {
    width: 32,
    height: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: PatientTheme.spaceSm,
  },
  label: {
    fontSize: PatientTheme.designType.caption,
    fontWeight: '700',
    color: PatientTheme.textPrimary,
    textAlign: 'left',
  },
  caption: {
    marginTop: 2,
    fontSize: PatientTheme.designType.caption,
    color: PatientTheme.textSecondary,
    textAlign: 'left',
  },
});
