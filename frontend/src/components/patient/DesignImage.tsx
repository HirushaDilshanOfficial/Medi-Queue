import React from 'react';
import { View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';
import { PatientTheme } from '../../constants/PatientTheme';
import { patientIcons, type PatientIconName } from './icons/PatientIcons';

// Backwards-compatible icon renderer. The name set is unchanged from the
// previous PNG registry, so every call site keeps working; icons are now
// vector artwork and are tinted through the optional `color` prop instead of
// carrying a baked-in colour.
type Props = {
  name: PatientIconName;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<ViewStyle>;
};

export function DesignImage({ name, size = 24, color, style }: Props) {
  const Icon = patientIcons[name];
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Icon size={size} color={color ?? PatientTheme.brand} />
    </View>
  );
}

export type DesignImageName = PatientIconName;
