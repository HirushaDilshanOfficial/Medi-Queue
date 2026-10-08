import { LocalizedText as Text } from '../../../i18n/LocalizedText';
import { useLanguage } from '../../../i18n/LanguageContext';
import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
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

const HISTORY_FILTERS = {
  completed: { title: 'Seen appointments', empty: 'No seen appointments', description: 'Your completed appointments will appear here.' },
  no_show: { title: 'Missed appointments', empty: 'No missed appointments', description: 'Appointments you did not attend will appear here.' },
  cancelled: { title: 'Cancelled appointments', empty: 'No cancelled appointments', description: 'Appointments you cancel will appear here immediately.' },
} as const;
type HistoryFilter = keyof typeof HISTORY_FILTERS;

export function VisitHistoryScreen() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string }>();
  const requestedStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const status: HistoryFilter | null = requestedStatus === 'completed' || requestedStatus === 'no_show' || requestedStatus === 'cancelled' ? requestedStatus : null;
  const filter = status ? HISTORY_FILTERS[status] : null;

  const history = useAsyncResource(() => patientApi.getHistory(), []);
  const reload = history.reload;

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const visits = (history.data?.visits ?? []).filter(visit => !status || visit.status === status);
  const summary = history.data?.summary;
  const reports = history.data?.reports ?? [];

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: insets.top + PatientTheme.spaceSm }}>
        <ScreenHeader
          title={t(filter?.title ?? 'Visit history')}
          subtitle={t("Every appointment you have booked")}
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
          <RefreshControl refreshing={history.loading && Boolean(history.data)} onRefresh={reload} tintColor={PatientTheme.brand} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            {summary ? (
              <View style={styles.summaryRow}>
                <SummaryTile value={summary.totalVisits} label={t("Seen")} selected={status === 'completed'} onPress={() => router.setParams({ status: 'completed' })} />
                <SummaryTile value={summary.noShow} label={t("Missed")} selected={status === 'no_show'} onPress={() => router.setParams({ status: 'no_show' })} />
                <SummaryTile value={summary.cancelled} label={t("Cancelled")} selected={status === 'cancelled'} onPress={() => router.setParams({ status: 'cancelled' })} />
              </View>
            ) : null}
            {status ? <Pressable accessibilityRole="button" onPress={() => router.setParams({ status: '' })} style={styles.allButton}><Text style={styles.allLabel}>{t('Show all appointments')}</Text></Pressable> : null}

            {/* Reports filed against a visit live on that visit's row, so a patient
                looking back at a consultation can see the paperwork that came out
                of it. */}
            {!status && reports.length ? (
              <View style={styles.looseReports}>
                <Text style={styles.looseTitle}>{t("Reports not linked to a visit")}</Text>
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
            <ScreenLoader label={t("Loading your visits")} />
          ) : history.error ? (
            <MessageState
              icon="help"
              title={t("Could not load your visits")}
              description={history.error}
              actionLabel={t("Try again")}
              onAction={history.reload}
            />
          ) : (
            <MessageState
              icon="calendar"
              title={t(filter?.empty ?? 'No visits yet')}
              description={t(filter?.description ?? 'Once you have booked and seen a doctor at the clinic, the visit will appear here.')}
              actionLabel={t("Book a doctor")}
              onAction={() => router.push('/(patient)/doctors')}
            />
          )
        }
      />
    </View>
  );
}

function SummaryTile({ value, label, selected, onPress }: { value: number; label: string; selected: boolean; onPress: () => void }) {
  const { t } = useLanguage();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.summaryTile, selected && styles.summarySelected, pressed && { opacity: 0.8 }]}>
      <Text style={styles.summaryValue}>{String(value)}</Text>
      <Text style={styles.summaryLabel}>{t(label ?? '')}</Text>
    </Pressable>
  );
}

function VisitCard({ visit }: { visit: VisitRecord }) {
  const { t, locale } = useLanguage();
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
            {visit.date ? new Date(`${visit.date}T00:00:00Z`).toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' }) : ''}
          </Text>
        </View>

        <View style={styles.cardText}>
          <Text style={styles.doctor} numberOfLines={1}>
            {visit.doctorName}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {[t(visit.department), visit.slotTime, visit.room].filter(Boolean).join(' · ')}
          </Text>
          {visit.reason ? (
            <Text style={styles.reason} numberOfLines={2}>
              {visit.reason}
            </Text>
          ) : null}
        </View>

        <Badge label={t(label)} tone={tone} />
      </View>

      {visit.reportCount > 0 ? (
        <View style={styles.reportLink}>
          <DesignImage name="clipboard" size={12} color={PatientTheme.brandMid} />
          <Text style={styles.reportLinkText}>
            {visit.reportCount} {visit.reportCount === 1 ? t('report') : t('reports')} {t("filed")}</Text>
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
  summarySelected: {
    borderColor: PatientTheme.brand,
    backgroundColor: PatientTheme.surfaceMuted,
    borderWidth: 2,
  },
  allButton: { alignSelf: 'flex-start', paddingVertical: PatientTheme.spaceSm },
  allLabel: { color: PatientTheme.brand, fontWeight: '700' },
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
