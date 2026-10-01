import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { PatientTheme } from '../../constants/PatientTheme';
import type { Doctor } from '../../types/patient';
import { DesignImage } from './DesignImage';

type Props = {
  doctor: Doctor;
  onPress: () => void;
};

// Avatar-fallback palette, chosen so long doctor names still look deliberate.
const AVATAR_TONES = [PatientTheme.brandRaised, '#2A6B57', '#6A4A86', '#8A5A2B', '#31607F'] as const;

function toneFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export function DoctorCard({ doctor, onPress }: Props) {
  const initials = doctor.initials || doctor.firstName.slice(0, 2).toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View ${doctor.name}, ${doctor.specialization}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.avatar, { backgroundColor: toneFor(doctor.id) }]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {doctor.displayName || doctor.name}
          </Text>
          {doctor.isAvailable ? <View style={styles.onlineDot} /> : null}
        </View>

        <Text style={styles.specialty} numberOfLines={1}>
          {doctor.specialization}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <DesignImage name="badge" size={12} />
            <Text style={styles.meta} numberOfLines={1}>
              {doctor.department}
            </Text>
          </View>
          {doctor.room ? (
            <View style={styles.metaItem}>
              <DesignImage name="home" size={12} />
              <Text style={styles.meta}>{doctor.room}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <DesignImage name="arrow" size={16} style={styles.chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PatientTheme.spaceMd,
    padding: PatientTheme.spaceMd,
    borderRadius: PatientTheme.radiusLg,
    borderWidth: 1,
    borderColor: PatientTheme.border,
    backgroundColor: PatientTheme.surface,
    ...PatientTheme.shadowCard,
  },
  pressed: {
    opacity: 0.9,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: PatientTheme.textOnBrand,
    fontSize: PatientTheme.designType.item,
    fontWeight: '800',
  },
  body: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    flexShrink: 1,
    fontSize: PatientTheme.designType.item,
    fontWeight: '700',
    color: PatientTheme.textPrimary,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: PatientTheme.success,
  },
  specialty: {
    fontSize: PatientTheme.designType.body,
    color: PatientTheme.brand,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PatientTheme.spaceMd,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  meta: {
    fontSize: PatientTheme.designType.caption,
    color: PatientTheme.textMuted,
  },
  chevron: {
    opacity: 0.5,
  },
});
