import React from 'react';
import { View, StyleSheet, ViewProps, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PatientTheme } from '../../constants/PatientTheme';

const PALETTES = {
  brand: PatientTheme.gradientQueue,
  header: PatientTheme.gradientHeader,
  accent: PatientTheme.gradientAccent,
  surface: PatientTheme.gradientCard,
} as const;

export type GradientVariant = keyof typeof PALETTES;

type GradientCardProps = ViewProps & {
  colors?: readonly string[];
  variant?: GradientVariant;
  padded?: boolean;
  style?: ViewStyle | ViewStyle[];
  children: React.ReactNode;
};

export function GradientCard({
  colors,
  variant = 'brand',
  padded = true,
  style,
  children,
  ...rest
}: GradientCardProps) {
  return (
    <LinearGradient
      colors={[...PALETTES[variant], ...(colors ?? [])] as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[padded && styles.padded, style]}
      {...rest}
    >
      {children}
    </LinearGradient>
  );
}

type CardProps = ViewProps & {
  style?: ViewStyle | ViewStyle[];
  children: React.ReactNode;
};

export function Card({ style, children, ...rest }: CardProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  padded: {
    borderRadius: PatientTheme.radiusXl,
    padding: PatientTheme.spaceLg,
  },
  card: {
    backgroundColor: PatientTheme.surface,
    borderRadius: PatientTheme.radiusLg,
    padding: PatientTheme.spaceLg,
    borderWidth: 1,
    borderColor: PatientTheme.border,
  },
});

export { PALETTES as gradientPalettes };
export type { CardProps, GradientCardProps };
