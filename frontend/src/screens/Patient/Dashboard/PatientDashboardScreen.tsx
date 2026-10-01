import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PatientTheme } from '../../../constants/PatientTheme';
import { patientApi } from '../../../services/patientApi';
import { HttpError } from '../../../services/http';
import type { DashboardPayload } from '../../../types/patient';
import { GradientCard, Card } from '../../../components/patient/GradientCard';
import { StatCard } from '../../../components/patient/StatCard';
import { QuickAction } from '../../../components/patient/QuickAction';
import { Badge } from '../../../components/patient/Badge';

function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function firstNameOf(fullName: string | null | undefined): string {
  if (!fullName) return 'there';
  const trimmed = fullName.trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0];
}

export function PatientDashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true);
    try {
      const payload = await patientApi.getDashboard();
      setData(payload);
      setError(null);
    } catch (err) {
      const message =
        err instanceof HttpError ? err.message : 'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // The fetch resolves asynchronously, so state updates happen after the
    // effect body returns rather than synchronously during it.
    let cancelled = false;

    const run = async () => {
      try {
        const payload = await patientApi.getDashboard();
        if (cancelled) return;
        setData(payload);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof HttpError ? err.message : 'Something went wrong. Please try again.';
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  const patient = data?.patient ?? null;
  const stats = data?.stats ?? null;
  const next = data?.nextAppointment ?? null;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + PatientTheme.spaceLg },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load('refresh')}
            tintColor={PatientTheme.brand}
            colors={[PatientTheme.brand]}
          />
        }
      >
        {/* ---- HEADER / GREETING ---- */}
        <GradientCard variant="header" style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerText}>
              <Text style={styles.greeting}>
                {greetingFor(new Date().getHours())}
              </Text>
              <Text style={styles.name} numberOfLines={1}>
                {patient ? firstNameOf(patient.fullName) : 'there'}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/(patient)/profile')}
              accessibilityRole="button"
              accessibilityLabel="Open profile"
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>
                {patient ? firstNameOf(patient.fullName)[0]?.toUpperCase() : 'P'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.headerMeta}>
            <Badge
              label={patient?.district || 'Sri Lanka'}
              tone="brand"
              style={styles.headerBadge}
            />
            {patient?.bloodGroup ? (
              <Badge label={patient.bloodGroup} tone="brand" style={styles.headerBadge} />
            ) : null}
          </View>
        </GradientCard>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={PatientTheme.brand} />
            <Text style={styles.loaderText}>Loading your dashboard…</Text>
          </View>
        ) : null}

        {error && !loading ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorTitle}>We could not load your dashboard</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Pressable onPress={() => load('initial')} style={styles.retryButton}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </Card>
        ) : null}

        {/* ---- NEXT APPOINTMENT / ACTIVE PASS ---- */}
        {next ? (
          <GradientCard variant="brand" style={styles.passCard}>
            <View style={styles.passHeader}>
              <View>
                <Text style={styles.passLabel}>Next appointment</Text>
                <Text style={styles.passDoctor} numberOfLines={1}>
                  {next.doctorName}
                </Text>
              </View>
              <Badge label={next.status} tone="success" />
            </View>

            <View style={styles.passDivider} />

            <View style={styles.passRow}>
              <View style={styles.passMeta}>
                <Text style={styles.passMetaLabel}>Department</Text>
                <Text style={styles.passMetaValue} numberOfLines={1}>
                  {next.department}
                </Text>
              </View>
              <View style={styles.passMeta}>
                <Text style={styles.passMetaLabel}>Date</Text>
                <Text style={styles.passMetaValue} numberOfLines={1}>
                  {next.date}
                </Text>
              </View>
              <View style={styles.passMeta}>
                <Text style={styles.passMetaLabel}>Time</Text>
                <Text style={styles.passMetaValue} numberOfLines={1}>
                  {next.slotTime}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => router.push('/(patient)/queue')}
              style={styles.passButton}
              accessibilityRole="button"
            >
              <Text style={styles.passButtonText}>View queue pass</Text>
            </Pressable>
          </GradientCard>
        ) : null}

        {/* ---- QUICK ACTIONS ---- */}
        <Text style={styles.sectionTitle}>Quick actions</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.actionsRow}
        >
          <QuickAction
            label="Find a doctor"
            caption="Browse OPD"
            icon="🔍"
            onPress={() => router.push('/(patient)/doctors')}
          />
          <QuickAction
            label="Book OPD"
            caption="Pick a slot"
            icon="📅"
            onPress={() => router.push('/(patient)/doctors')}
          />
          <QuickAction
            label="My queue"
            caption="Live pass"
            icon="🎫"
            onPress={() => router.push('/(patient)/queue')}
          />
          <QuickAction
            label="My profile"
            caption="History"
            icon="👤"
            onPress={() => router.push('/(patient)/profile')}
          />
        </ScrollView>

        {/* ---- STATS ---- */}
        <Text style={styles.sectionTitle}>At a glance</Text>
        <View style={styles.statsRow}>
          <StatCard
            value={stats?.activeDoctors ?? 0}
            label="Doctors on duty"
            icon="👨‍⚕️"
          />
          <StatCard
            value={stats?.departments ?? 0}
            label="Departments"
            icon="🏥"
            style={styles.statGap}
          />
          <StatCard
            value={stats?.upcomingAppointments ?? 0}
            label="Upcoming"
            icon="🗓️"
            style={styles.statGap}
          />
        </View>

        {/* ---- PROFILE SUMMARY ---- */}
        {patient ? (
          <>
            <Text style={styles.sectionTitle}>Your details</Text>
            <Card>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Full name</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {patient.fullName}
                </Text>
              </View>
              <View style={styles.hairline} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>NIC</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {patient.nic || 'Not added'}
                </Text>
              </View>
              <View style={styles.hairline} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Phone</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {patient.phone || 'Not added'}
                </Text>
              </View>
              {patient.allergies.length ? (
                <>
                  <View style={styles.hairline} />
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Allergies</Text>
                    <Text style={styles.detailValue} numberOfLines={1}>
                      {patient.allergies.join(', ')}
                    </Text>
                  </View>
                </>
              ) : null}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PatientTheme.background,
  },
  content: {
    paddingHorizontal: PatientTheme.spaceLg,
    paddingBottom: PatientTheme.spaceXxl,
    gap: PatientTheme.spaceMd,
  },
  header: {
    padding: PatientTheme.spaceLg,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: PatientTheme.spaceMd,
  },
  headerText: {
    flex: 1,
  },
  greeting: {
    color: PatientTheme.accentSoft,
    fontSize: PatientTheme.fontSizeCaption,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  name: {
    marginTop: PatientTheme.spaceXs,
    color: PatientTheme.textOnBrand,
    fontSize: PatientTheme.fontSizeDisplay,
    fontWeight: '800',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: PatientTheme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: PatientTheme.brandDeep,
    fontSize: PatientTheme.fontSizeHeading,
    fontWeight: '800',
  },
  headerMeta: {
    flexDirection: 'row',
    gap: PatientTheme.spaceSm,
    marginTop: PatientTheme.spaceMd,
  },
  headerBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  loader: {
    alignItems: 'center',
    gap: PatientTheme.spaceSm,
    paddingVertical: PatientTheme.spaceXl,
  },
  loaderText: {
    color: PatientTheme.textSecondary,
    fontSize: PatientTheme.fontSizeBody,
  },
  errorCard: {
    borderColor: PatientTheme.dangerSoft,
    backgroundColor: PatientTheme.dangerSoft,
  },
  errorTitle: {
    color: PatientTheme.danger,
    fontSize: PatientTheme.fontSizeSubheading,
    fontWeight: '700',
  },
  errorBody: {
    marginTop: PatientTheme.spaceXs,
    color: PatientTheme.textSecondary,
    fontSize: PatientTheme.fontSizeBody,
  },
  retryButton: {
    marginTop: PatientTheme.spaceMd,
    alignSelf: 'flex-start',
    backgroundColor: PatientTheme.danger,
    borderRadius: PatientTheme.radiusPill,
    paddingHorizontal: PatientTheme.spaceLg,
    paddingVertical: PatientTheme.spaceSm,
  },
  retryText: {
    color: PatientTheme.textOnBrand,
    fontSize: PatientTheme.fontSizeCaption,
    fontWeight: '700',
  },
  sectionTitle: {
    marginTop: PatientTheme.spaceSm,
    color: PatientTheme.textPrimary,
    fontSize: PatientTheme.fontSizeSubheading,
    fontWeight: '700',
  },
  actionsRow: {
    gap: PatientTheme.spaceMd,
    paddingRight: PatientTheme.spaceLg,
  },
  statsRow: {
    flexDirection: 'row',
  },
  statGap: {
    marginLeft: PatientTheme.spaceMd,
  },
  passCard: {
    padding: PatientTheme.spaceLg,
  },
  passHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: PatientTheme.spaceMd,
  },
  passLabel: {
    color: PatientTheme.accentSoft,
    fontSize: PatientTheme.fontSizeMicro,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  passDoctor: {
    marginTop: PatientTheme.spaceXs,
    color: PatientTheme.textOnBrand,
    fontSize: PatientTheme.fontSizeHeading,
    fontWeight: '800',
  },
  passDivider: {
    height: 1,
    marginVertical: PatientTheme.spaceMd,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  passRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: PatientTheme.spaceSm,
  },
  passMeta: {
    flex: 1,
  },
  passMetaLabel: {
    color: PatientTheme.accentSoft,
    fontSize: PatientTheme.fontSizeMicro,
  },
  passMetaValue: {
    marginTop: 2,
    color: PatientTheme.textOnBrand,
    fontSize: PatientTheme.fontSizeBody,
    fontWeight: '700',
  },
  passButton: {
    marginTop: PatientTheme.spaceLg,
    backgroundColor: PatientTheme.accent,
    borderRadius: PatientTheme.radiusPill,
    paddingVertical: PatientTheme.spaceMd,
    alignItems: 'center',
  },
  passButtonText: {
    color: PatientTheme.brandDeep,
    fontSize: PatientTheme.fontSizeBody,
    fontWeight: '800',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: PatientTheme.spaceMd,
    paddingVertical: PatientTheme.spaceSm,
  },
  detailLabel: {
    color: PatientTheme.textSecondary,
    fontSize: PatientTheme.fontSizeBody,
  },
  detailValue: {
    flex: 1,
    textAlign: 'right',
    color: PatientTheme.textPrimary,
    fontSize: PatientTheme.fontSizeBody,
    fontWeight: '600',
  },
  hairline: {
    height: 1,
    backgroundColor: PatientTheme.border,
  },
});
