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
  // Asiri presents its quality figures as navy stat boxes separated by a 2px
  // cyan rule, rather than a light card with hairline dividers.
  root: {
    flexDirection: 'row',
    backgroundColor: PatientTheme.brand,
    borderRadius: PatientTheme.radiusLg,
    paddingVertical: PatientTheme.spaceLg,
    overflow: 'hidden',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: PatientTheme.spaceSm,
  },
  cellBorder: {
    borderLeftWidth: 2,
    borderLeftColor: PatientTheme.accentLine,
  },
  value: {
    color: PatientTheme.textOnBrand,
    fontSize: PatientTheme.fontSizeHeading + 4,
    fontWeight: PatientTheme.weight.heavy,
  },
  label: {
    marginTop: 2,
    color: PatientTheme.accentSoft,
    fontSize: PatientTheme.designType.caption,
    textAlign: 'center',
  },
});
