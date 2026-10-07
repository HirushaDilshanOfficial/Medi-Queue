import { LocalizedText as Text } from '../../../i18n/LocalizedText';
import { useLanguage } from '../../../i18n/LanguageContext';
import React, { useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PatientTheme } from '../../../constants/PatientTheme';
import { patientApi } from '../../../services/patientApi';
import { useAsyncResource } from '../../../hooks/useAsyncResource';
import type { MedicalReport } from '../../../types/patient';
import { ScreenHeader } from '../../../components/patient/ScreenHeader';
import { ScreenLoader, MessageState } from '../../../components/patient/ScreenStates';
import { ReportRow } from '../../../components/patient/ReportRow';

export function MedicalReportsScreen() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const reports = useAsyncResource(() => patientApi.getReports(), []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reports.reload();
    setRefreshing(false);
  }, [reports]);

  const remove = useCallback(
    (report: MedicalReport) => {
      Alert.alert(
        t('Remove this report?'),
        t("“{value0}” will be taken off your list. The clinic's own copy of your record is not affected.", { value0: String(report.title) }),
        [
          { text: t('Keep it'), style: 'cancel' },
          {
            text: t('Remove'),
            style: 'destructive',
            onPress: async () => {
              setDeleting(report.id);
              try {
                await patientApi.deleteReport(report.id);
                await reports.reload();
              } catch (error) {
                Alert.alert(
                  t('Could not remove'),
                  error instanceof Error ? error.message : t('Please try again.'),
                );
              } finally {
                setDeleting(null);
              }
            },
          },
        ],
      );
    },
    [reports, t],
  );

  const items = reports.data?.reports ?? [];

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: insets.top + PatientTheme.spaceSm }}>
        <ScreenHeader
          title={t("Medical reports")}
          subtitle={t("Results you have lodged with the clinic")}
          showBack
          action={
            <Pressable
              onPress={() => router.push('/(patient)/profile/report/new')}
              accessibilityRole="button"
              accessibilityLabel={t("Lodge a report")}
              style={({ pressed }) => [styles.add, pressed && styles.pressed]}
            >
              <Text style={styles.addLabel}>{t("Add")}</Text>
            </Pressable>
          }
        />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PatientTheme.brand} />
        }
        ListHeaderComponent={
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              {t("Add the details of a report here so your doctor can find it before your next visit. You can attach a PDF or image up to 10 MB.")}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ReportRow
            report={item}
            onPress={() => router.push(`/(patient)/profile/report/${item.id}`)}
            onDelete={deleting === item.id ? undefined : () => remove(item)}
          />
        )}
        ListEmptyComponent={
          reports.loading ? (
            <ScreenLoader label={t("Loading your reports")} />
          ) : reports.error ? (
            <MessageState
              icon="help"
              title={t("Could not load your reports")}
              description={reports.error}
              actionLabel={t("Try again")}
              onAction={reports.reload}
            />
          ) : (
            <MessageState
              icon="clipboard"
              title={t("No reports yet")}
              description={t("Add a lab result, scan or referral and it will show up here for your doctor to review.")}
              actionLabel={t("Lodge a report")}
              onAction={() => router.push('/(patient)/profile/report/new')}
            />
          )
        }
        ListFooterComponent={
          deleting ? <Text style={styles.working}>{t("Removing your report...")}</Text> : null
        }
      />
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
  notice: {
    padding: PatientTheme.spaceMd,
    borderRadius: PatientTheme.radiusMd,
    backgroundColor: PatientTheme.surfaceMuted,
    marginBottom: PatientTheme.spaceMd,
  },
  noticeText: {
    fontSize: PatientTheme.designType.caption,
    color: PatientTheme.textSecondary,
    lineHeight: 16,
  },
  add: {
    paddingHorizontal: PatientTheme.spaceMd,
    paddingVertical: 6,
    borderRadius: PatientTheme.radiusPill,
    backgroundColor: PatientTheme.surfaceMuted,
  },
  addLabel: {
    fontSize: PatientTheme.designType.body,
    fontWeight: '700',
    color: PatientTheme.brand,
  },
  separator: {
    height: PatientTheme.spaceMd,
  },
  working: {
    paddingTop: PatientTheme.spaceMd,
    fontSize: PatientTheme.designType.caption,
    color: PatientTheme.textSecondary,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
});
