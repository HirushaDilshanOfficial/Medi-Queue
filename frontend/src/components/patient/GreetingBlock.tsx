import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PatientTheme } from '../../constants/PatientTheme';

type Props = {
  name: string;
  hour: number;
};

function daypartFor(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function GreetingBlock({ name, hour }: Props) {
  return (
    <View style={styles.root}>
      <Text style={styles.greeting} numberOfLines={1}>
        {daypartFor(hour)}, {name}
      </Text>
      <Text style={styles.subtitle}>Let us make you better</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingBottom: PatientTheme.spaceLg,
  },
  greeting: {
    color: PatientTheme.textPrimary,
    fontSize: PatientTheme.designType.hero,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 4,
    color: PatientTheme.textSecondary,
    fontSize: PatientTheme.designType.caption,
  },
});
