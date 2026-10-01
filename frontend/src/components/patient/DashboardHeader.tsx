import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { PatientTheme } from '../../constants/PatientTheme';
import { DesignImage } from './DesignImage';

type Props = {
  onBellPress?: () => void;
};

export function DashboardHeader({ onBellPress }: Props) {
  return (
    <View style={styles.root}>
      <DesignImage name="medical" size={30} style={styles.logo} />
      <View style={styles.titles}>
        <Text style={styles.eyebrow}>NATIONAL OPD</Text>
        <Text style={styles.title}>Home Dashboard</Text>
      </View>
      <Pressable
        onPress={onBellPress}
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        hitSlop={8}
        style={styles.bell}
      >
        <DesignImage name="bell" size={22} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: PatientTheme.spaceMd,
  },
  logo: {
    marginRight: PatientTheme.spaceMd,
  },
  titles: {
    flex: 1,
  },
  eyebrow: {
    color: PatientTheme.brandMid,
    fontSize: PatientTheme.designType.caption,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  title: {
    marginTop: 2,
    color: PatientTheme.textPrimary,
    fontSize: PatientTheme.designType.section,
    fontWeight: '800',
  },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PatientTheme.surface,
    borderWidth: 1,
    borderColor: PatientTheme.border,
  },
});
