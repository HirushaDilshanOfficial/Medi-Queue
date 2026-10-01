import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { PatientTheme } from '../../constants/PatientTheme';
import { DesignImage, type DesignImageName } from './DesignImage';

type Props = {
  label: string;
  icon: DesignImageName;
  onPress?: () => void;
  width?: number;
};

export function SpecialtyCard({ label, icon, onPress, width = 82 }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.root, { width }, pressed && styles.pressed]}
    >
      <View style={styles.iconBubble}>
          <DesignImage name={icon} size={26} color={PatientTheme.brand} />
      </View>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: PatientTheme.surface,
    borderRadius: PatientTheme.radiusLg,
    borderWidth: 1,
    borderColor: PatientTheme.border,
    paddingVertical: PatientTheme.spaceMd,
    paddingHorizontal: PatientTheme.spaceSm,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PatientTheme.surfaceMuted,
    marginBottom: PatientTheme.spaceSm,
  },
  label: {
    color: PatientTheme.textPrimary,
    fontSize: PatientTheme.designType.caption,
    fontWeight: '600',
    textAlign: 'center',
  },
});
