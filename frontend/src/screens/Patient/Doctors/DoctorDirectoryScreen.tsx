import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PatientTheme } from '../../../constants/PatientTheme';
import { doctorApi } from '../../../services/doctorApi';
import { bookingApi } from '../../../services/bookingApi';
import { queueApi } from '../../../services/queueApi';
import { useAsyncResource } from '../../../hooks/useAsyncResource';
import type { Appointment, Doctor } from '../../../types/patient';
import { ScreenHeader } from '../../../components/patient/ScreenHeader';
import { ScreenLoader, MessageState } from '../../../components/patient/ScreenStates';
import { DoctorCard } from '../../../components/patient/DoctorCard';
import { AppointmentCard } from '../../../components/patient/AppointmentCard';
import { DesignImage } from '../../../components/patient/DesignImage';

type Tab = 'directory' | 'bookings';

export function DoctorDirectoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('directory');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState<string | null>(null);

  const departments = useAsyncResource(() => doctorApi.departments(), []);

  const doctors = useAsyncResource(
    () => doctorApi.list({ search: search.trim() || undefined, department: department || undefined }),
    [search, department],
  );

  // Only fetched while the bookings tab is open, so the directory does not pay for
  // a request the patient did not ask for.
  const bookings = useAsyncResource(
    () =>
      tab === 'bookings'
        ? bookingApi.list('upcoming')
        : Promise.resolve<{ appointments: Appointment[]; scope: string }>({
            appointments: [],
            scope: 'upcoming',
          }),
    [tab],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      tab === 'bookings' ? bookings.reload() : doctors.reload(),
      departments.reload(),
    ]);
    setRefreshing(false);
  }, [bookings, departments, doctors, tab]);

  const openDoctor = useCallback(
    (doctor: Doctor) => {
      router.push({ pathname: '/(patient)/doctor/[id]', params: { id: doctor.id } });
    },
    [router],
  );

  const confirmCancel = useCallback(
    (appointment: Appointment) => {
      Alert.alert(
        'Cancel this booking?',
        `${appointment.doctorName} · ${appointment.dateLabel ?? appointment.date} at ${appointment.slotTime}\n\nYou can book another time from the doctor list.`,
        [
          { text: 'Keep booking', style: 'cancel' },
          {
            text: 'Cancel booking',
            style: 'destructive',
            onPress: async () => {
              setWorking(appointment.id);
              try {
                await bookingApi.cancel(appointment.id, 'Cancelled by patient');
                await bookings.reload();
              } catch (error) {
                Alert.alert('Could not cancel', error instanceof Error ? error.message : 'Please try again.');
              } finally {
                setWorking(null);
              }
            },
          },
        ],
      );
    },
    [bookings],
  );

  const startReschedule = useCallback(
    (appointment: Appointment) => {
      if (!appointment.doctorId) {
        Alert.alert('Booking unavailable', 'This booking is no longer linked to a doctor.');
        return;
      }
      router.push({
        pathname: '/(patient)/doctor/[id]',
        params: { id: appointment.doctorId, rescheduleId: appointment.id },
      });
    },
    [router],
  );

  const checkIn = useCallback(
    (appointment: Appointment) => {
      Alert.alert('Check in now?', `Collect your queue number for ${appointment.department}.`, [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Check in',
          onPress: async () => {
            setWorking(appointment.id);
            try {
              await queueApi.checkIn(appointment.id);
              router.push('/(patient)/queue');
            } catch (error) {
              Alert.alert(
                'Could not check in',
                error instanceof Error ? error.message : 'Please try again.',
              );
            } finally {
              setWorking(null);
            }
          },
        },
      ]);
    },
    [router],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        {tab === 'directory' ? (
          <>
            <View style={styles.searchRow}>
              <View style={styles.search}>
                <DesignImage name="search" size={15} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search by name or speciality"
                  placeholderTextColor={PatientTheme.textMuted}
                  style={styles.searchInput}
                  autoCorrect={false}
                  returnKeyType="search"
                  accessibilityLabel="Search doctors"
                />
                {search ? (
                  <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityLabel="Clear search">
                    <Text style={styles.clear}>✕</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              <Chip label="All" active={!department} onPress={() => setDepartment(null)} />
              {(departments.data?.departments ?? []).map((name) => (
                <Chip
                  key={name}
                  label={name}
                  active={department === name}
                  onPress={() => setDepartment((current) => (current === name ? null : name))}
                />
              ))}
            </ScrollView>
          </>
        ) : null}
      </View>
    ),
    [department, departments.data, search, tab],
  );

  const doctorList = (
    <FlatList
      data={doctors.data?.doctors ?? []}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <DoctorCard doctor={item} onPress={() => openDoctor(item)} />}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={listHeader}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={PatientTheme.brand}
        />
      }
      ListEmptyComponent={
        doctors.loading ? (
          <ScreenLoader label="Loading doctors" />
        ) : doctors.error ? (
          <MessageState
            icon="help"
            title="Could not load doctors"
            description={doctors.error}
            actionLabel="Try again"
            onAction={doctors.reload}
          />
        ) : (
          <MessageState
            icon="stethoscope"
            title="No doctors found"
            description={
              search || department
                ? 'Try a different name or speciality.'
                : 'The clinic has not published its doctor list yet.'
            }
            actionLabel={search || department ? 'Clear filters' : undefined}
            onAction={search || department ? () => { setSearch(''); setDepartment(null); } : undefined}
          />
        )
      }
    />
  );

  const appointmentList = (
    <FlatList
      data={bookings.data?.appointments ?? []}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <AppointmentCard
          appointment={item}
          onReschedule={startReschedule}
          onCancel={confirmCancel}
          onCheckIn={checkIn}
        />
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PatientTheme.brand} />
      }
      ListEmptyComponent={
        bookings.loading ? (
          <ScreenLoader label="Loading your bookings" />
        ) : bookings.error ? (
          <MessageState
            icon="help"
            title="Could not load your bookings"
            description={bookings.error}
            actionLabel="Try again"
            onAction={bookings.reload}
          />
        ) : (
          <MessageState
            icon="calendar"
            title="No upcoming bookings"
            description="Find a doctor and pick a time that suits you."
            actionLabel="Find a doctor"
            onAction={() => setTab('directory')}
          />
        )
      }
    />
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + PatientTheme.spaceSm }]}>
      <ScreenHeader
        title={tab === 'directory' ? 'Find a doctor' : 'My bookings'}
        subtitle={
          tab === 'directory'
            ? 'Book a clinic time with a specialist'
            : 'Reschedule or cancel an appointment'
        }
      />

      <View style={styles.tabs}>
        <TabButton
          label="Directory"
          active={tab === 'directory'}
          onPress={() => setTab('directory')}
        />
        <TabButton label="My bookings" active={tab === 'bookings'} onPress={() => setTab('bookings')} />
      </View>

      {working ? <Text style={styles.working}>Working on it...</Text> : null}

      {tab === 'directory' ? doctorList : appointmentList}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.tabButton, active && styles.tabButtonActive, pressed && styles.pressed]}
    >
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PatientTheme.background,
  },
  tabs: {
    flexDirection: 'row',
    gap: PatientTheme.spaceSm,
    marginHorizontal: PatientTheme.spaceLg,
    marginBottom: PatientTheme.spaceSm,
    padding: 3,
    borderRadius: PatientTheme.radiusPill,
    backgroundColor: PatientTheme.surfaceMuted,
  },
  tabButton: {
    flex: 1,
    paddingVertical: PatientTheme.spaceSm,
    borderRadius: PatientTheme.radiusPill,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: PatientTheme.surface,
    ...PatientTheme.shadowCard,
  },
  tabLabel: {
    fontSize: PatientTheme.designType.body,
    fontWeight: '700',
    color: PatientTheme.textSecondary,
  },
  tabLabelActive: {
    color: PatientTheme.brandDeep,
  },
  working: {
    paddingHorizontal: PatientTheme.spaceLg,
    paddingBottom: PatientTheme.spaceSm,
    fontSize: PatientTheme.designType.caption,
    color: PatientTheme.textSecondary,
  },
  listContent: {
    paddingHorizontal: PatientTheme.spaceLg,
    paddingBottom: PatientTheme.spaceXxl,
  },
  listHeader: {
    gap: PatientTheme.spaceSm,
  },
  searchRow: {
    paddingTop: PatientTheme.spaceSm,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PatientTheme.spaceSm,
    paddingHorizontal: PatientTheme.spaceMd,
    paddingVertical: PatientTheme.spaceSm,
    borderRadius: PatientTheme.radiusPill,
    borderWidth: 1,
    borderColor: PatientTheme.border,
    backgroundColor: PatientTheme.surface,
  },
  searchInput: {
    flex: 1,
    fontSize: PatientTheme.designType.body,
    color: PatientTheme.textPrimary,
    paddingVertical: 2,
  },
  clear: {
    fontSize: PatientTheme.designType.body,
    color: PatientTheme.textMuted,
  },
  chips: {
    gap: PatientTheme.spaceSm,
    paddingVertical: PatientTheme.spaceSm,
  },
  chip: {
    paddingHorizontal: PatientTheme.spaceMd,
    paddingVertical: 6,
    borderRadius: PatientTheme.radiusPill,
    borderWidth: 1,
    borderColor: PatientTheme.border,
    backgroundColor: PatientTheme.surface,
  },
  chipActive: {
    backgroundColor: PatientTheme.brand,
    borderColor: PatientTheme.brand,
  },
  chipLabel: {
    fontSize: PatientTheme.designType.caption,
    fontWeight: '600',
    color: PatientTheme.textSecondary,
  },
  chipLabelActive: {
    color: PatientTheme.textOnBrand,
  },
  separator: {
    height: PatientTheme.spaceMd,
  },
  pressed: {
    opacity: 0.85,
  },
});
