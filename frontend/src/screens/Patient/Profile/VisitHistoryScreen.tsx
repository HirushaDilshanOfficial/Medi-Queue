import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PatientTheme } from '../../../constants/PatientTheme';
import { patientApi } from '../../../services/patientApi';
import { useAsyncResource } from '../../../hooks/useAsyncResource';
import type { VisitRecord } from '../../../types/patient';
import { ScreenHeader } from '../../../components/patient/ScreenHeader';
import { ScreenLoader, MessageState } from '../../../components/patient/ScreenStates';
import { ReportRow } from '../../../components/patient/ReportRow';
import { Badge } from '../../../components/patient/Badge';
import { DesignImage } from '../../../components/patient/DesignImage';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  completed: 'success',
  no_show: 'danger',
  cancelled: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  completed: 'Seen',
  no_show: 'Missed',
  cancelled: 'Cancelled',
  booked: 'Did not attend',
  checked_in: 'Checked in',
  in_consultation: 'In the room',
};

export function VisitHistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [refreshing, setRefreshing] = useState(false);
  const history = useAsyncResource(() => patientApi.getHistory(), []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await history.reload();
    setRefreshing(false);
  }, [history]);

  const visits = history.data?.visits ?? [];
  const summary = history.data?.summary;
  const reports = history.data?.reports ?? [];

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: insets.top + PatientTheme.spaceSm }}>
        <ScreenHeader
          title="Visit history"
          subtitle="Every appointment you have booked"
          showBack
        />
      </View>

      <FlatList
        data={visits}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PatientTheme.brand} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            {summary ? (
              <View style={styles.summaryRow}>
                <SummaryTile value={summary.totalVisits} label="Seen" />
                <SummaryTile value={summary.noShow} label="Missed" />
                <SummaryTile value={summary.cancelled} label="Cancelled" />
              </View>
            ) : null}

            {/* Reports filed against a visit live on that visit's row, so a patient
                looking back at a consultation can see the paperwork that came out
                of it. */}
            {reports.length ? (
              <View style={styles.looseReports}>
                <Text style={styles.looseTitle}>Reports not linked to a visit</Text>
                {reports.map((report) => (
                  <ReportRow key={report.id} report={report} />
                ))}
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => <VisitCard visit={item} />}
        ListEmptyComponent={
          history.loading ? (
            <ScreenLoader label="Loading your visits" />
          ) : history.error ? (
            <MessageState
              icon="help"
              title="Could not load your visits"
              description={history.error}
              actionLabel="Try again"
              onAction={history.reload}
            />
          ) : (
            <MessageState
              icon="calendar"
              title="No visits yet"
              description="Once you have booked and seen a doctor at the clinic, the visit will appear here."
              actionLabel="Book a doctor"
              onAction={() => router.push('/(patient)/doctors')}
            />
          )
        }
      />
    </View>
  );
}

function SummaryTile({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryValue}>{String(value)}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function VisitCard({ visit }: { visit: VisitRecord }) {
  const tone = STATUS_TONE[visit.status] ?? 'neutral';
  const label = STATUS_LABEL[visit.status] ?? visit.status;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.dateBlock}>
          <Text style={styles.dateDay}>
            {visit.date ? visit.date.slice(8, 10) : '--'}
          </Text>
          <Text style={styles.dateMonth}>
            {visit.dateLabel && visit.dateLabel.length <= 11 ? visit.dateLabel.slice(0, 3) : ''}
          </Text>
        </View>

        <View style={styles.cardText}>
          <Text style={styles.doctor} numberOfLines={1}>
            {visit.doctorName}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {[visit.department, visit.slotTime, visit.room].filter(Boolean).join(' · ')}
          </Text>
          {visit.reason ? (
            <Text style={styles.reason} numberOfLines={2}>
              {visit.reason}
            </Text>
          ) : null}
        </View>

        <Badge label={label} tone={tone} />
      </View>

      {visit.reportCount > 0 ? (
        <View style={styles.reportLink}>
          <DesignImage name="clipboard" size={12} />
          <Text style={styles.reportLinkText}>
            {visit.reportCount} {visit.reportCount === 1 ? 'report' : 'reports'} filed
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PatientTheme.background,
  },
  list: {
    paddingHorizontal: PatientTheme.spaceLg,
    paddingBottom: PatientTheme.spaceXxl,
  },
  header: {
    gap: PatientTheme.spaceMd,
    marginBottom: PatientTheme.spaceSm,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: PatientTheme.spaceSm,
  },
  summaryTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: PatientTheme.spaceMd,
    borderRadius: PatientTheme.radiusLg,
    borderWidth: 1,
    borderColor: PatientTheme.border,
    backgroundColor: PatientTheme.surface,
  },
  summaryValue: {
    fontSize: PatientTheme.designType.section,
    fontWeight: '800',
    color: PatientTheme.brandDeep,
  },
  summaryLabel: {
    marginTop: 2,
    fontSize: PatientTheme.designType.caption,
    fontWeight: '600',
    color: PatientTheme.textSecondary,
  },
  looseReports: {
    gap: PatientTheme.spaceSm,
  },
  looseTitle: {
    fontSize: PatientTheme.designType.item,
    fontWeight: '800',
    color: PatientTheme.textPrimary,
  },
  separator: {
    height: PatientTheme.spaceMd,
  },
  card: {
    padding: PatientTheme.spaceMd,
    borderRadius: PatientTheme.radiusLg,
    borderWidth: 1,
    borderColor: PatientTheme.border,
    backgroundColor: PatientTheme.surface,
    gap: PatientTheme.spaceSm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: PatientTheme.spaceMd,
  },
  dateBlock: {
    width: 44,
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: PatientTheme.radiusMd,
    backgroundColor: PatientTheme.surfaceMuted,
  },
  dateDay: {
    fontSize: PatientTheme.designType.section,
    fontWeight: '800',
    color: PatientTheme.brandDeep,
  },
  dateMonth: {
    fontSize: PatientTheme.designType.caption,
    fontWeight: '700',
    color: PatientTheme.textSecondary,
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  doctor: {
    fontSize: PatientTheme.designType.item,
    fontWeight: '700',
    color: PatientTheme.textPrimary,
  },
  meta: {
    fontSize: PatientTheme.designType.caption,
    color: PatientTheme.textSecondary,
  },
  reason: {
    fontSize: PatientTheme.designType.caption,
    color: PatientTheme.textMuted,
    lineHeight: 16,
  },
  reportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: PatientTheme.spaceSm,
    borderTopWidth: 1,
    borderTopColor: PatientTheme.border,
  },
  reportLinkText: {
    fontSize: PatientTheme.designType.caption,
    fontWeight: '600',
    color: PatientTheme.brand,
  },
});
