import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PatientTheme } from '../../constants/PatientTheme';
import type { QueuePass } from '../../types/patient';
import { waitLabel } from '../../utils/opdDates';
import { DesignImage } from './DesignImage';
import { PassQr } from './PassQr';

type Props = {
  pass: QueuePass;
  onLeave?: () => void;
  refreshing?: boolean;
};

// The physical pass. The token number is the largest element because that is what
// gets called out across a clinic, and it has to be readable from arm's length.
export function QueuePassCard({ pass, onLeave, refreshing }: Props) {
  const live = pass.live;
  const called = pass.status === 'called' || pass.status === 'in_consultation';
  const finished = pass.status === 'completed' || pass.status === 'cancelled' || pass.status === 'no_show';

  const headline = called
    ? pass.status === 'in_consultation'
      ? 'You are in consultation'
      : 'Your turn has come'
    : live && live.position <= 1
      ? 'You are next'
      : live
        ? `${live.peopleAhead} ${live.peopleAhead === 1 ? 'person' : 'people'} ahead`
        : 'Please wait to be called';

  const subline = called
    ? pass.room
      ? `Please go to ${pass.room}`
      : 'Please go to the doctor'
    : live?.estimatedTurnAt
      ? `Estimated turn at ${live.estimatedTurnAt}`
      : 'We will update this as the queue moves';

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={PatientTheme.gradientQueue}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.top}
      >
        <View style={styles.topHeader}>
          <Text style={styles.label}>{pass.department.toUpperCase()}</Text>
          <View style={styles.liveBadge}>
            <View style={[styles.dot, called && styles.dotActive, finished && styles.dotMuted]} />
            <Text style={styles.liveLabel}>
              {called ? 'CALLED' : finished ? 'CLOSED' : 'LIVE'}
            </Text>
          </View>
        </View>

        <Text style={styles.tokenLabel}>YOUR QUEUE NUMBER</Text>
        <Text style={styles.token} accessibilityLabel={`Queue number ${pass.tokenLabel}`}>
          {pass.tokenLabel}
        </Text>

        <Text style={styles.headline}>{headline}</Text>
        <View style={styles.sublineRow}>
          <DesignImage name="clock" size={13} color={PatientTheme.accentSoft} />
          <Text style={styles.subline}>{subline}</Text>
        </View>

        {!finished ? (
          <Text style={styles.wait}>
            {live ? `Estimated wait ${waitLabel(live.waitMinutes)}` : 'Checking the queue...'}
          </Text>
        ) : null}
      </LinearGradient>

      <View style={styles.body}>
        <PassQr value={pass.qrValue} />

        <View style={styles.details}>
          <Detail icon="profile" label="Doctor" value={pass.doctorName ?? 'To be confirmed'} />
          <Detail icon="badge" label="Room" value={pass.room ?? 'Assigned at the desk'} />
          <Detail icon="calendar" label="Date" value={`${pass.dateLabel} · ${pass.dateLong}`} />
          {live?.servingNow ? (
            <Detail
              icon="ticket"
              label="Now serving"
              value={`${live.servingNow.doctorName ?? 'Doctor'} · A-${String(live.servingNow.tokenNumber).padStart(3, '0')}`}
            />
          ) : null}
        </View>

        <View style={styles.codeRow}>
          <Text style={styles.codeHint}>Pass code</Text>
          <Text style={styles.code} selectable>
            {pass.passCode}
          </Text>
        </View>

        {onLeave && !called && !finished ? (
          <Pressable
            onPress={onLeave}
            disabled={refreshing}
            accessibilityRole="button"
            style={({ pressed }) => [styles.leave, pressed && styles.pressed]}
          >
            <Text style={styles.leaveLabel}>Leave the queue</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: 'profile' | 'badge' | 'calendar' | 'ticket';
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detail}>
      <DesignImage name={icon} size={14} color={PatientTheme.brandMid} />
      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: PatientTheme.radiusXl,
    overflow: 'hidden',
    backgroundColor: PatientTheme.surface,
    ...PatientTheme.shadowRaised,
  },
  top: {
    padding: PatientTheme.spaceLg,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: PatientTheme.accentSoft,
    fontSize: PatientTheme.designType.caption,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: PatientTheme.spaceSm,
    paddingVertical: 3,
    borderRadius: PatientTheme.radiusPill,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: PatientTheme.accent,
  },
  dotActive: {
    backgroundColor: '#FFD166',
  },
  dotMuted: {
    backgroundColor: PatientTheme.textMuted,
  },
  liveLabel: {
    color: PatientTheme.textOnBrand,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tokenLabel: {
    marginTop: PatientTheme.spaceMd,
    color: PatientTheme.accentSoft,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  token: {
    color: PatientTheme.textOnBrand,
    fontSize: 54,
    lineHeight: 60,
    fontWeight: '800',
    letterSpacing: 1,
  },
  headline: {
    color: PatientTheme.textOnBrand,
    fontSize: PatientTheme.designType.section,
    fontWeight: '800',
  },
  sublineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  subline: {
    color: PatientTheme.accentSoft,
    fontSize: PatientTheme.designType.caption,
  },
  wait: {
    marginTop: PatientTheme.spaceSm,
    color: 'rgba(255,255,255,0.75)',
    fontSize: PatientTheme.designType.caption,
  },
  body: {
    padding: PatientTheme.spaceLg,
    alignItems: 'center',
    gap: PatientTheme.spaceMd,
  },
  details: {
    width: '100%',
    gap: PatientTheme.spaceSm,
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PatientTheme.spaceSm,
  },
  detailText: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 10,
    color: PatientTheme.textMuted,
  },
  detailValue: {
    fontSize: PatientTheme.designType.body,
    fontWeight: '600',
    color: PatientTheme.textPrimary,
  },
  codeRow: {
    alignItems: 'center',
    gap: 2,
  },
  codeHint: {
    fontSize: 9,
    color: PatientTheme.textMuted,
    letterSpacing: 0.5,
  },
  code: {
    fontSize: 11,
    fontWeight: '700',
    color: PatientTheme.brand,
    letterSpacing: 1,
  },
  leave: {
    marginTop: PatientTheme.spaceXs,
    paddingVertical: PatientTheme.spaceSm,
    paddingHorizontal: PatientTheme.spaceXl,
    borderRadius: PatientTheme.radiusPill,
    borderWidth: 1,
    borderColor: PatientTheme.borderStrong,
  },
  leaveLabel: {
    fontSize: PatientTheme.designType.body,
    fontWeight: '600',
    color: PatientTheme.textSecondary,
  },
  pressed: {
    opacity: 0.8,
  },
});
