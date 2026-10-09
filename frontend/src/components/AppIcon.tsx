import React from 'react';
import { View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { patientIcons, type PatientIconName } from './patient/icons/PatientIcons';

const paths = {
  mail: 'M3 5h18v14H3V5Zm0 1 9 7 9-7',
  lock: 'M6 10h12v11H6V10Zm2 0V6a4 4 0 0 1 8 0v4m-4 5v2',
  eyeOff: 'm3 3 18 18M10.5 6.1A10 10 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3 3.5M6.2 7.2A19 19 0 0 0 2 12s4 6 10 6a11 11 0 0 0 4.5-1M10 10a3 3 0 0 0 4 4',
  building: 'M3 8h18L12 2 3 8Zm1 3v8m5-8v8m6-8v8m5-8v8M2 22h20M2 19h20',
  chart: 'M3 3v18h18M7 16v-5m5 5V6m5 10v-8',
  back: 'M20 12H4m6-6-6 6 6 6',
  forward: 'M4 12h16m-6-6 6 6-6 6',
  close: 'm6 6 12 12M18 6 6 18',
  flag: 'M4 22V3c4-3 8 3 16 0v11c-8 3-12-3-16 0',
} as const;

type Props = {
  name: PatientIconName | keyof typeof paths;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<ViewStyle>;
};

/** Shared vector icons for authentication and administrative screens. */
export function AppIcon({ name, size = 24, color = '#004c5b', style }: Props) {
  const Icon = patientIcons[name as PatientIconName];
  return <View accessible={false} pointerEvents="none" style={[{ width: size, height: size, flexShrink: 0 }, style]}>
    {Icon ? <Icon size={size} color={color} /> : <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d={paths[name as keyof typeof paths]} />
      {name === 'building' ? <Circle cx={12} cy={6} r={0.7} fill={color} stroke="none" /> : null}
    </Svg>}
  </View>;
}
