import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PatientTheme } from '../../../constants/PatientTheme';
import { patientApi } from '../../../services/patientApi';
import { useAsyncResource } from '../../../hooks/useAsyncResource';
import type { MedicalReport, PatientProfile, VisitRecord } from '../../../types/patient';
import { ScreenHeader } from '../../../components/patient/ScreenHeader';
import { ScreenLoader, MessageState } from '../../../components/patient/ScreenStates';
import { ServiceRow } from '../../../components/patient/ServiceRow';
import { Badge } from '../../../components/patient/Badge';
import { StatCard } from '../../../components/patient/StatCard';
import { ReportRow } from '../../../components/patient/ReportRow';

export function PatientProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const profile = useAsyncResource(() => patientApi.getProfile(), []);
  const history = useAsyncResource(() => patientApi.getHistory(), []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([profile.reload(), history.reload()]);
    setRefreshing(false);
  }, [history, profile]);

  const removeReport = useCallback(
    (report: MedicalReport) => {
      Alert.alert(
        'Remove this report?',
        `“${report.title}” will be taken off your list. The clinic's own copy of your record is not affected.`,
        [
          { text: 'Keep it', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              setDeleting(report.id);
              try {
                await patientApi.deleteReport(report.id);
                await history.reload();
              } catch (error) {
                Alert.alert(
                  'Could not remove',
                  error instanceof Error ? error.message : 'Please try again.',
                );
              } finally {
                setDeleting(null);
              }
            },
          },
        ],
      );
    },
    [history],
  );

  const recentVisits = useMemo(
    () => (history.data?.visits ?? []).slice(0, 3),
    [history.data],
  );

  const reports = history.data?.reports ?? [];

  if (profile.loading && !profile.data) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + PatientTheme.spaceSm }]}>
        <ScreenHeader title="My profile" />
        <ScreenLoader label="Loading your profile" />
      </View>
    );
  }

  if (profile.error && !profile.data) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + PatientTheme.spaceSm }]}>
        <ScreenHeader title="My profile" />
        <MessageState
          icon="help"
          title="Could not load your profile"
          description={profile.error}
          actionLabel="Try again"
          onAction={profile.reload}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PatientTheme.brand} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingTop: insets.top + PatientTheme.spaceSm }}>
          <ScreenHeader
            title="My profile"
            subtitle="Your details and your visit record"
            action={
              <Pressable
                onPress={() => router.push('/(patient)/profile/edit')}
                accessibilityRole="button"
                accessibilityLabel="Edit profile"
                style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
              >
                <Text style={styles.editLabel}>Edit</Text>
              </Pressable>
            }
          />
        </View>

        <ProfileCard patient={profile.data?.patient} />

        <View style={styles.statRow}>
          <StatCard
            value={String(history.data?.summary.totalVisits ?? 0)}
            label="Completed visits"
          />
          <StatCard value={String(history.data?.summary.reports ?? 0)} label="Reports" />
        </View>

        <View style={styles.section}>
          <ServiceRow
            label="Visit history"
            caption={
              history.loading
                ? 'Loading...'
                : history.data?.summary.totalVisits
                  ? `${history.data.summary.totalVisits} completed visits`
                  : 'Your past appointments'
            }
            icon="calendar"
            onPress={() => router.push('/(patient)/profile/history')}
          />
          <ServiceRow
            label="Medical reports"
            caption={
              reports.length
                ? `${reports.length} lodged with the clinic`
                : 'Upload a lab result or referral'
            }
            icon="clipboard"
            onPress={() => router.push('/(patient)/profile/reports')}
          />
        </View>

        {history.error ? (
          <Text style={styles.inlineError}>
            Could not load your visit history. Pull down to try again.
          </Text>
        ) : null}

        {recentVisits.length ? (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Recent visits</Text>
            <View style={styles.blockBody}>
              {recentVisits.map((visit) => (
                <VisitRow key={visit.id} visit={visit} />
              ))}
            </View>
          </View>
        ) : null}

        {history.data && !history.loading && !recentVisits.length ? (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Recent visits</Text>
            <MessageState
              icon="calendar"
              title="No visits yet"
              description="Once you have seen a doctor at the clinic, your visits will be listed here."
            />
          </View>
        ) : null}

        {reports.length ? (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Reports</Text>
            <View style={styles.blockBody}>
              {reports.slice(0, 2).map((report) => (
                <ReportRow
                  key={report.id}
                  report={report}
                  onDelete={deleting === report.id ? undefined : () => removeReport(report)}
                />
              ))}
            </View>
            {reports.length > 2 ? (
              <Pressable
                onPress={() => router.push('/(patient)/profile/reports')}
                accessibilityRole="button"
                style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}
              >
                <Text style={styles.seeAllLabel}>See all {reports.length} reports</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {deleting ? (
          <Text style={styles.working}>Removing your report...</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ProfileCard({ patient }: { patient: PatientProfile | null | undefined }) {
  if (!patient) return null;

  const details = [
    patient.age !== null ? `${patient.age} years` : null,
    patient.gender,
    patient.bloodGroup ? `${patient.bloodGroup} blood` : null,
  ].filter(Boolean);

  return (
    <View style={styles.profileCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(patient.fullName)}</Text>
      </View>

      <View style={styles.profileText}>
        <Text style={styles.profileName} numberOfLines={2}>
          {patient.fullName}
        </Text>
        {patient.nic ? <Text style={styles.profileNic}>NIC {patient.nic}</Text> : null}
        {details.length ? (
          <Text style={styles.profileDetails}>{details.join(' · ')}</Text>
        ) : null}
        {patient.district ? (
          <Text style={styles.profileDetails} numberOfLines={1}>
            {patient.district}
          </Text>
        ) : null}
      </View>

      {patient.allergies.length ? (
        <View style={styles.allergyWrap}>
          <Badge
            label={patient.allergies.length === 1 ? 'Allergy' : 'Allergies'}
            tone="warning"
          />
          <Text style={styles.allergyText} numberOfLines={2}>
            {patient.allergies.join(', ')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function VisitRow({ visit }: { visit: VisitRecord }) {
  return (
    <View style={styles.visitRow}>
      <Text style={styles.visitTitle} numberOfLines={1}>
        {visit.doctorName}
      </Text>
      <Text style={styles.visitMeta} numberOfLines={1}>
        {[visit.department, visit.dateLong ?? visit.date, visit.slotTime]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      {visit.reason ? (
        <Text style={styles.visitReason} numberOfLines={1}>
          {visit.reason}
        </Text>
      ) : null}
    </View>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PatientTheme.background,
  },
  scroll: {
    paddingBottom: PatientTheme.spaceXxl,
    gap: PatientTheme.spaceMd,
  },
  editButton: {
    paddingHorizontal: PatientTheme.spaceMd,
    paddingVertical: 6,
    borderRadius: PatientTheme.radiusPill,
    backgroundColor: PatientTheme.surfaceMuted,
  },
  editLabel: {
    fontSize: PatientTheme.designType.body,
    fontWeight: '700',
    color: PatientTheme.brand,
  },
  profileCard: {
    marginHorizontal: PatientTheme.spaceLg,
    padding: PatientTheme.spaceLg,
    borderRadius: PatientTheme.radiusXl,
    borderWidth: 1,
    borderColor: PatientTheme.border,
    backgroundColor: PatientTheme.surface,
    gap: PatientTheme.spaceSm,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PatientTheme.brand,
  },
  avatarText: {
    color: PatientTheme.textOnBrand,
    fontSize: PatientTheme.designType.hero,
    fontWeight: '800',
  },
  profileText: {
    gap: 2,
  },
  profileName: {
    fontSize: PatientTheme.designType.section,
    fontWeight: '800',
    color: PatientTheme.textPrimary,
  },
  profileNic: {
    fontSize: PatientTheme.designType.caption,
    color: PatientTheme.textSecondary,
  },
  profileDetails: {
    fontSize: PatientTheme.designType.body,
    color: PatientTheme.textSecondary,
  },
  allergyWrap: {
    marginTop: PatientTheme.spaceXs,
    gap: 4,
  },
  allergyText: {
    fontSize: PatientTheme.designType.caption,
    color: PatientTheme.textPrimary,
  },
  statRow: {
    flexDirection: 'row',
    gap: PatientTheme.spaceMd,
    paddingHorizontal: PatientTheme.spaceLg,
  },
  section: {
    paddingHorizontal: PatientTheme.spaceLg,
    gap: PatientTheme.spaceSm,
  },
  inlineError: {
    paddingHorizontal: PatientTheme.spaceLg,
    fontSize: PatientTheme.designType.caption,
    color: PatientTheme.danger,
  },
  block: {
    paddingHorizontal: PatientTheme.spaceLg,
    gap: PatientTheme.spaceSm,
  },
  blockTitle: {
    fontSize: PatientTheme.designType.section,
    fontWeight: '800',
    color: PatientTheme.textPrimary,
  },
  blockBody: {
    gap: PatientTheme.spaceSm,
  },
  seeAll: {
    alignSelf: 'flex-start',
    paddingVertical: PatientTheme.spaceXs,
  },
  seeAllLabel: {
    fontSize: PatientTheme.designType.body,
    fontWeight: '700',
    color: PatientTheme.brand,
  },
  visitRow: {
    paddingHorizontal: PatientTheme.spaceMd,
    paddingVertical: PatientTheme.spaceMd,
    borderRadius: PatientTheme.radiusLg,
    borderWidth: 1,
    borderColor: PatientTheme.border,
    backgroundColor: PatientTheme.surface,
    gap: 2,
  },
  visitTitle: {
    fontSize: PatientTheme.designType.item,
    fontWeight: '700',
    color: PatientTheme.textPrimary,
  },
  visitMeta: {
    fontSize: PatientTheme.designType.caption,
    color: PatientTheme.textSecondary,
  },
  visitReason: {
    fontSize: PatientTheme.designType.caption,
    color: PatientTheme.textMuted,
  },
  working: {
    paddingHorizontal: PatientTheme.spaceLg,
    fontSize: PatientTheme.designType.caption,
    color: PatientTheme.textSecondary,
  },
  pressed: {
    opacity: 0.85,
  },
});
