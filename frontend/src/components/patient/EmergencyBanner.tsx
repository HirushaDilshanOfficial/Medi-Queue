import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { PatientTheme } from '../../constants/PatientTheme';
import { DesignImage } from './DesignImage';

type Props = {
  helpline: string;
};

export function EmergencyBanner({ helpline }: Props) {
  const call = () => {
    Linking.openURL(`tel:${helpline}`).catch(() => {
      // A device without telephony throws; the banner stays tappable either way.
    });
  };

  return (
    <Pressable
      onPress={call}
      accessibilityRole="button"
      accessibilityLabel={`Call emergency helpline ${helpline}`}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      <View style={styles.iconWrap}>
          <DesignImage name="medical" size={20} color={PatientTheme.emergency} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>24/7 Emergency &amp; Helpline</Text>
        <Text style={styles.subtitle}>Accident, emergency and ambulance services</Text>
      </View>
      <View style={styles.callPill}>
        <Text style={styles.callText}>{helpline}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PatientTheme.spaceMd,
    backgroundColor: PatientTheme.surface,
    borderRadius: PatientTheme.radiusLg,
    borderWidth: 1,
    borderColor: PatientTheme.dangerSoft,
    borderLeftWidth: 4,
    borderLeftColor: PatientTheme.danger,
    paddingHorizontal: PatientTheme.spaceMd,
    paddingVertical: PatientTheme.spaceMd,
  },
  pressed: {
    opacity: 0.9,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PatientTheme.dangerSoft,
  },
  text: {
    flex: 1,
  },
  title: {
    color: PatientTheme.textPrimary,
    fontSize: PatientTheme.designType.body,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 1,
    color: PatientTheme.textSecondary,
    fontSize: PatientTheme.designType.caption,
  },
  callPill: {
    paddingHorizontal: PatientTheme.spaceMd,
    paddingVertical: 6,
    borderRadius: PatientTheme.radiusPill,
    backgroundColor: PatientTheme.danger,
  },
  callText: {
    color: PatientTheme.textOnBrand,
    fontSize: PatientTheme.designType.body,
    fontWeight: '800',
  },
});
