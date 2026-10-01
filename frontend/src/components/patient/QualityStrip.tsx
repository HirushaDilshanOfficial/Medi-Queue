import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PatientTheme } from '../../constants/PatientTheme';

type Stat = { key: string; value: string; label: string };

type Props = {
  stats: readonly Stat[];
};

export function QualityStrip({ stats }: Props) {
  return (
    <View style={styles.root}>
      {stats.map((stat, index) => (
        <View
          key={stat.key}
          style={[styles.cell, index > 0 && styles.cellBorder]}
        >
          <Text style={styles.value}>{stat.value}</Text>
          <Text style={styles.label} numberOfLines={2}>
            {stat.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    backgroundColor: PatientTheme.surface,
    borderRadius: PatientTheme.radiusLg,
    borderWidth: 1,
    borderColor: PatientTheme.border,
    paddingVertical: PatientTheme.spaceMd,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: PatientTheme.spaceSm,
  },
  cellBorder: {
    borderLeftWidth: 1,
    borderLeftColor: PatientTheme.border,
  },
  value: {
    color: PatientTheme.brand,
    fontSize: PatientTheme.designType.section,
    fontWeight: '800',
  },
  label: {
    marginTop: 2,
    color: PatientTheme.textSecondary,
    fontSize: PatientTheme.designType.caption,
    textAlign: 'center',
  },
});
