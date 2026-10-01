import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { PatientTheme } from '../../constants/PatientTheme';

type StatCardProps = {
  value: string | number;
  label: string;
  icon?: string;
  style?: ViewStyle;
};

export function StatCard({ value, label, icon, style }: StatCardProps) {
  return (
    <View style={[styles.container, style]}>
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PatientTheme.surface,
    borderRadius: PatientTheme.radiusLg,
    borderWidth: 1,
    borderColor: PatientTheme.border,
    paddingVertical: PatientTheme.spaceMd,
    paddingHorizontal: PatientTheme.spaceSm,
    alignItems: 'center',
  },
  icon: {
    fontSize: 18,
    marginBottom: PatientTheme.spaceXs,
  },
  value: {
    fontSize: PatientTheme.fontSizeTitle,
    fontWeight: '800',
    color: PatientTheme.brandDeep,
  },
  label: {
    marginTop: 2,
    fontSize: PatientTheme.fontSizeMicro,
    fontWeight: '600',
    color: PatientTheme.textSecondary,
    textAlign: 'center',
  },
});
