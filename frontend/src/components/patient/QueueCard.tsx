import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PatientTheme } from '../../constants/PatientTheme';
import { DesignImage } from './DesignImage';

type Props = {
  clinicName: string;
  clinicSubline: string;
  tokenNumber: number;
  room: string | null;
  eta: string | null;
  onPress?: () => void;
  /**
   * False when the patient holds no live pass. The design shows a token number, so
   * without this the dashboard would display a fabricated one; the card turns into
   * a check-in prompt instead.
   */
  hasPass?: boolean;
};

export function QueueCard({
  clinicName,
  clinicSubline,
  tokenNumber,
  room,
  eta,
  onPress,
  hasPass = true,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        hasPass ? 'View your active queue pass' : 'Check in to get a queue number'
      }
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={['#1A6779', '#176577', '#0E1E23']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.body}
      >
        <View style={styles.headerRow}>
          <DesignImage name="ticket" size={20} />
          <View style={styles.headerText}>
            <Text style={styles.label}>{hasPass ? 'ACTIVE QUEUE' : 'LIVE QUEUE'}</Text>
            <Text style={styles.clinic} numberOfLines={1}>
              {hasPass ? clinicName : 'No active pass today'}
            </Text>
            <Text style={styles.clinicSubline} numberOfLines={1}>
              {hasPass ? clinicSubline : 'Check in on the day of your appointment'}
            </Text>
          </View>
          {hasPass ? <View style={styles.liveDot} /> : null}
        </View>

        <View style={styles.divider} />

        {hasPass ? (
          <>
            <View style={styles.numberRow}>
              <View>
                <Text style={styles.numberLabel}>Queue</Text>
                <Text style={styles.number}>{tokenNumber}</Text>
              </View>
              <View style={styles.roomBlock}>
                <DesignImage name="badge" size={14} />
                <Text style={styles.room}>{room ?? 'Room assigned at the desk'}</Text>
              </View>
            </View>

            <View style={styles.etaRow}>
              <DesignImage name="clock" size={13} />
              <Text style={styles.eta}>{eta ?? 'We will update your turn shortly'}</Text>
            </View>
          </>
        ) : (
          <View style={styles.checkInRow}>
            <Text style={styles.checkInLabel}>Open the queue to check in</Text>
            <DesignImage name="arrow" size={16} style={styles.checkInArrow} />
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: PatientTheme.radiusXl,
    overflow: 'hidden',
    ...PatientTheme.shadowRaised,
  },
  pressed: {
    opacity: 0.9,
  },
  body: {
    padding: PatientTheme.spaceLg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  headerText: {
    flex: 1,
    marginLeft: PatientTheme.spaceMd,
  },
  label: {
    color: PatientTheme.accentSoft,
    fontSize: PatientTheme.designType.caption,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  clinic: {
    marginTop: 4,
    color: PatientTheme.textOnBrand,
    fontSize: PatientTheme.designType.item,
    fontWeight: '700',
  },
  clinicSubline: {
    marginTop: 2,
    color: PatientTheme.accentSoft,
    fontSize: PatientTheme.designType.caption,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    backgroundColor: PatientTheme.accent,
  },
  divider: {
    height: 1,
    marginVertical: PatientTheme.spaceMd,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  numberLabel: {
    color: PatientTheme.accentSoft,
    fontSize: PatientTheme.designType.caption,
  },
  number: {
    color: PatientTheme.textOnBrand,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
  },
  roomBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingBottom: 4,
  },
  room: {
    color: PatientTheme.textOnBrand,
    fontSize: PatientTheme.designType.caption,
    fontWeight: '600',
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: PatientTheme.spaceSm,
  },
  eta: {
    color: PatientTheme.textOnBrand,
    fontSize: PatientTheme.designType.caption,
  },
  checkInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checkInLabel: {
    color: PatientTheme.textOnBrand,
    fontSize: PatientTheme.designType.item,
    fontWeight: '700',
  },
  checkInArrow: {
    opacity: 0.7,
  },
});
