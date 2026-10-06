import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { PatientTheme } from '../../constants/PatientTheme';
import { DesignImage, type DesignImageName } from './DesignImage';
import type { MedicalReport, ReportStatus } from '../../types/patient';
import { timestampLabel } from '../../utils/opdDates';

type Props = {
  report: MedicalReport;
  onPress?: () => void;
  onDelete?: () => void;
};

// Human wording for a report's review state. `pending` is not a failure: the
// report is simply not looked at yet, so it must not read as a problem.
const STATUS_TEXT: Record<ReportStatus, string> = {
  pending: 'With the clinic',
  reviewed: 'Reviewed by a doctor',
};

export function ReportRow({ report, onPress, onDelete }: Props) {
  const dated = timestampLabel(report.reportDate ?? report.createdAt);

  return (
    <View style={styles.root}>
      <Pressable
        onPress={onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={`${report.title}${dated ? `, dated ${dated}` : ''}`}
        disabled={!onPress}
        style={({ pressed }) => [styles.main, pressed && onPress ? styles.pressed : null]}
      >
        <View style={styles.iconWrap}>
          <DesignImage name="clipboard" size={18} color={PatientTheme.brand} />
        </View>

        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={2}>
            {report.title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {[report.category, dated].filter(Boolean).join(' · ')}
          </Text>
          {report.notes ? (
            <Text style={styles.notes} numberOfLines={2}>
              {report.notes}
            </Text>
          ) : null}
          <View
            style={[
              styles.status,
              report.status === 'reviewed' ? styles.statusReviewed : styles.statusPending,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                report.status === 'reviewed' ? styles.statusTextReviewed : styles.statusTextPending,
              ]}
            >
              {STATUS_TEXT[report.status]}
            </Text>
          </View>
        </View>
      </Pressable>

      {onDelete ? (
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${report.title}`}
          hitSlop={8}
          style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
        >
          <Text style={styles.deleteLabel}>Remove</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// Compact row for the activity feed, where the category and date are enough.
export function ReportActivityRow({
  title,
  meta,
  icon = 'clipboard',
}: {
  title: string;
  meta: string | null;
  icon?: DesignImageName;
}) {
  return (
    <View style={styles.activityRow}>
      <View style={styles.activityIcon}>
          <DesignImage name={icon} size={14} color={PatientTheme.brandMid} />
      </View>
      <View style={styles.activityText}>
        <Text style={styles.activityTitle} numberOfLines={1}>
          {title}
        </Text>
        {meta ? (
          <Text style={styles.activityMeta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: PatientTheme.surface,
    borderRadius: PatientTheme.radiusLg,
    borderWidth: 1,
    borderColor: PatientTheme.border,
    paddingHorizontal: PatientTheme.spaceMd,
    paddingTop: PatientTheme.spaceMd,
    paddingBottom: PatientTheme.spaceSm,
  },
  main: {
    flexDirection: 'row',
    gap: PatientTheme.spaceMd,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PatientTheme.surfaceMuted,
  },
  text: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: PatientTheme.designType.item,
    fontWeight: '700',
    color: PatientTheme.textPrimary,
  },
  meta: {
    fontSize: PatientTheme.designType.caption,
    color: PatientTheme.textSecondary,
  },
  notes: {
    fontSize: PatientTheme.designType.caption,
    color: PatientTheme.textSecondary,
    lineHeight: 16,
  },
  status: {
    alignSelf: 'flex-start',
    marginTop: 3,
    paddingHorizontal: PatientTheme.spaceSm,
    paddingVertical: 3,
    borderRadius: PatientTheme.radiusPill,
  },
  statusPending: {
    backgroundColor: PatientTheme.warningSoft,
  },
  statusReviewed: {
    backgroundColor: PatientTheme.successSoft,
  },
  statusText: {
    fontSize: PatientTheme.designType.caption,
    fontWeight: '700',
  },
  statusTextPending: {
    color: PatientTheme.warning,
  },
  statusTextReviewed: {
    color: PatientTheme.success,
  },
  delete: {
    alignSelf: 'flex-end',
    paddingTop: PatientTheme.spaceSm,
    paddingBottom: 2,
    paddingLeft: PatientTheme.spaceMd,
  },
  deleteLabel: {
    fontSize: PatientTheme.designType.caption,
    fontWeight: '700',
    color: PatientTheme.danger,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PatientTheme.spaceSm,
  },
  activityIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PatientTheme.surfaceMuted,
  },
  activityText: {
    flex: 1,
  },
  activityTitle: {
    fontSize: PatientTheme.designType.body,
    fontWeight: '600',
    color: PatientTheme.textPrimary,
  },
  activityMeta: {
    fontSize: PatientTheme.designType.caption,
    color: PatientTheme.textSecondary,
  },
  pressed: {
    opacity: 0.85,
  },
});
