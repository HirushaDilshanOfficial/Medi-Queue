import React from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';
import { PatientTheme } from '../../constants/PatientTheme';
import { DesignImage } from './DesignImage';

type Props = {
  onPress?: () => void;
};

export function SearchField({ onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="search"
      accessibilityLabel="Search doctor or clinic"
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
          <DesignImage name="search" size={18} color={PatientTheme.textMuted} />
      <Text style={styles.placeholder}>Search doctor or clinic</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PatientTheme.spaceSm,
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
  placeholder: {
    color: PatientTheme.textMuted,
    fontSize: PatientTheme.designType.item,
  },
});
