import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { DashboardHeader } from '../../../components/patient/DashboardHeader';
import { GreetingBlock } from '../../../components/patient/GreetingBlock';
import { QueueCard } from '../../../components/patient/QueueCard';
import { BookingBanner } from '../../../components/patient/BookingBanner';
import { SearchField } from '../../../components/patient/SearchField';
import { CheckupRow } from '../../../components/patient/CheckupRow';
import { QuickAction } from '../../../components/patient/QuickAction';
import { SectionHeader } from '../../../components/patient/SectionHeader';
import { SpecialtyCard } from '../../../components/patient/SpecialtyCard';
import { EventCard } from '../../../components/patient/EventCard';
import { EmergencyBanner } from '../../../components/patient/EmergencyBanner';
import { QualityStrip } from '../../../components/patient/QualityStrip';
import { ServiceRow } from '../../../components/patient/ServiceRow';
import { DesignImage } from '../../../components/patient/DesignImage';
import {
  ACTION_TILES,
  HOSPITAL_SERVICES,
  QUALITY_STATS,
  SPECIALTIES,
  EVENTS,
  DESIGN_FALLBACK,
} from './dashboardContent';

const TILE_GAP = 8;
const GRID_GAP = PatientTheme.spaceMd;

function firstNameOf(fullName: string | null | undefined): string | null {
  if (!fullName) return null;
  const trimmed = fullName.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0];
}

function tileWidth(count: number): number {
  const available = 414 - 32 - TILE_GAP * (count - 1);
  return Math.floor(available / count);
}

function gridWidth(count: number, columns: number): number {
  const available = 414 - 32 - GRID_GAP * (columns - 1);
  return Math.floor(available / columns);
}

export function PatientDashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Keep the daypart label correct if the app stays open across noon or evening.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

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
  const next = data?.nextAppointment ?? null;
  const activePass = data?.stats?.activePass ?? null;

  const greetingName = useMemo(
    () => firstNameOf(patient?.fullName) ?? DESIGN_FALLBACK.greetingName,
    [patient?.fullName],
  );

  const tileW = useMemo(() => tileWidth(ACTION_TILES.length), []);
  const specialtyW = useMemo(() => gridWidth(SPECIALTIES.length, 4), []);
  const eventW = useMemo(() => gridWidth(EVENTS.length, 2), []);

  const activeDoctors = data?.stats?.activeDoctors ?? DESIGN_FALLBACK.doctorsOnline;
  const avatarInitial = (greetingName[0] ?? 'P').toUpperCase();

  const hasPass = Boolean(activePass);

  const queueClinicName = activePass?.department
    ? `${activePass.department} Queue`
    : DESIGN_FALLBACK.clinicName;

  // `position` counts the patient themself, so the number of people ahead is one
  // less. Both branches avoid saying "0 of waiting".
  const ahead = activePass?.position ? Math.max(0, activePass.position - 1) : 0;
  const queueSubline = activePass
    ? ahead === 0
      ? 'You are next'
      : `${ahead} ${ahead === 1 ? 'person' : 'people'} ahead of you`
    : DESIGN_FALLBACK.clinicSubline;

  const queueToken = activePass?.tokenNumber ?? DESIGN_FALLBACK.tokenNumber;
  const queueRoom = activePass?.room ?? DESIGN_FALLBACK.room;
  const queueEta = activePass?.estimatedTurnAt ?? null;

  const checkupTitle = next?.doctorName
    ? `Checkup with ${next.doctorName}`
    : DESIGN_FALLBACK.checkupTitle;
  const checkupBadge = next?.dateLabel ?? DESIGN_FALLBACK.checkupBadge;

  const bookingMetaPrimary = next
    ? `Next: ${next.dateLabel ?? next.date} at ${next.slotTime}`
    : 'No upcoming booking';
  const bookingMetaSecondary = `${activeDoctors} doctors on duty today`;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + PatientTheme.spaceMd },
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
        <DashboardHeader
          activeDoctors={activeDoctors}
          avatarInitial={avatarInitial}
          onProfilePress={() => router.push('/(patient)/profile')}
        />

        <GreetingBlock name={greetingName} hour={now.getHours()} />

        <EmergencyBanner helpline={DESIGN_FALLBACK.helpline} />

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={PatientTheme.brand} />
            <Text style={styles.loaderText}>Loading your dashboard…</Text>
          </View>
        ) : null}

        {error && !loading ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>We could not load your dashboard</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Pressable
              onPress={() => load('initial')}
              accessibilityRole="button"
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        <QueueCard
          clinicName={queueClinicName}
          clinicSubline={queueSubline}
          tokenNumber={queueToken}
          room={queueRoom}
          eta={queueEta}
          hasPass={hasPass}
          onPress={() => router.push('/(patient)/queue')}
        />

        <BookingBanner
          metaPrimary={bookingMetaPrimary}
          metaSecondary={bookingMetaSecondary}
          onPress={() => router.push('/(patient)/doctors')}
        />

        <SearchField onPress={() => router.push('/(patient)/doctors')} />

        <CheckupRow
          title={checkupTitle}
          badge={checkupBadge}
          onPress={() => router.push('/(patient)/profile')}
        />

        <View style={styles.tilesRow}>
          {ACTION_TILES.map((tile) => (
            <QuickAction
              key={tile.key}
              label={tile.label}
              caption={tile.caption}
              width={tileW}
              icon={<DesignImage name={tile.icon} size={24} color={PatientTheme.brand} />}
              onPress={() => router.push('/(patient)/doctors')}
            />
          ))}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Hospital Services" />
          <View style={styles.serviceList}>
            {HOSPITAL_SERVICES.map((service) => (
              <ServiceRow
                key={service.key}
                label={service.label}
                caption={service.caption}
                icon={service.icon}
                badge={service.key === 'lab-reports' ? '2 new' : undefined}
                onPress={() => router.push('/(patient)/doctors')}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Care Quality" />
          <QualityStrip stats={QUALITY_STATS} />
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="Hospital Clinics"
            onSeeAllPress={() => router.push('/(patient)/doctors')}
          />
          <View style={styles.specialtyGrid}>
            {SPECIALTIES.map((specialty) => (
              <SpecialtyCard
                key={specialty.key}
                label={specialty.label}
                icon={specialty.icon}
                width={specialtyW}
                onPress={() => router.push('/(patient)/doctors')}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="Events & Health Insights"
            onSeeAllPress={() => router.push('/(patient)/profile')}
          />
          <EventCard
            title={EVENTS[0].title}
            description={EVENTS[0].description}
            schedule={EVENTS[0].schedule}
            image={EVENTS[0].image}
            badge={EVENTS[0].badge}
            onPress={() => router.push('/(patient)/profile')}
          />
          <View style={styles.eventRow}>
            {EVENTS.slice(1).map((event) => (
              <EventCard
                key={event.key}
                title={event.title}
                description={event.description}
                schedule={event.schedule}
                image={event.image}
                badge={event.badge}
                style={{ width: eventW }}
                onPress={() => router.push('/(patient)/profile')}
              />
            ))}
          </View>
        </View>
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
    paddingHorizontal: 16,
    paddingBottom: PatientTheme.spaceXxl,
    gap: PatientTheme.spaceMd,
  },
  loader: {
    alignItems: 'center',
    gap: PatientTheme.spaceSm,
    paddingVertical: PatientTheme.spaceXl,
  },
  loaderText: {
    color: PatientTheme.textSecondary,
    fontSize: PatientTheme.designType.body,
  },
  errorCard: {
    backgroundColor: PatientTheme.dangerSoft,
    borderColor: PatientTheme.dangerSoft,
    borderRadius: PatientTheme.radiusLg,
    padding: PatientTheme.spaceLg,
    borderWidth: 1,
  },
  errorTitle: {
    color: PatientTheme.danger,
    fontSize: PatientTheme.designType.item,
    fontWeight: '700',
  },
  errorBody: {
    marginTop: PatientTheme.spaceXs,
    color: PatientTheme.textSecondary,
    fontSize: PatientTheme.designType.body,
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
    fontSize: PatientTheme.designType.caption,
    fontWeight: '700',
  },
  tilesRow: {
    flexDirection: 'row',
    gap: TILE_GAP,
  },
  serviceList: {
    gap: PatientTheme.spaceSm,
  },
  section: {
    marginTop: PatientTheme.spaceSm,
    gap: PatientTheme.spaceMd,
  },
  specialtyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  eventRow: {
    flexDirection: 'row',
    gap: GRID_GAP,
  },
});
