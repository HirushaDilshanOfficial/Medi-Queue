import { LocalizedText as Text } from '../../../i18n/LocalizedText';
import { useLanguage } from '../../../i18n/LanguageContext';
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { PatientTheme } from '../../../constants/PatientTheme';
import { doctorApi } from '../../../services/doctorApi';
import { clinicApi, type Clinic } from '../../../services/clinicApi';
import { bookingApi } from '../../../services/bookingApi';
import { queueApi } from '../../../services/queueApi';
import { useAsyncResource } from '../../../hooks/useAsyncResource';
import type { Appointment, Doctor } from '../../../types/patient';
import { ScreenHeader } from '../../../components/patient/ScreenHeader';
import { ScreenLoader, MessageState } from '../../../components/patient/ScreenStates';
import { DoctorCard } from '../../../components/patient/DoctorCard';
import { AppointmentCard } from '../../../components/patient/AppointmentCard';
import { DesignImage } from '../../../components/patient/DesignImage';
import { AppIcon } from '../../../components/AppIcon';

type Tab = 'directory' | 'bookings';

export function DoctorDirectoryScreen() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ department?: string; hospitalId?: string; tab?: string; search?: string; view?: string }>();

  const requestedTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const tab: Tab = requestedTab === 'bookings' ? 'bookings' : 'directory';
  const setTab = useCallback((next: Tab) => router.setParams({ tab: next }), [router]);
  // Tab screens stay mounted. Read filters from the URL so subsequent dashboard
  // links replace the previous clinic and search rather than keeping stale state.
  const search = (Array.isArray(params.search) ? params.search[0] : params.search) ?? '';
  const department = (Array.isArray(params.department) ? params.department[0] : params.department) || null;
  const hospitalId = (Array.isArray(params.hospitalId) ? params.hospitalId[0] : params.hospitalId) || null;
  const view = Array.isArray(params.view) ? params.view[0] : params.view;
  const setSearch = useCallback((value: string) => router.setParams({ search: value }), [router]);
  const setClinic = useCallback((department: string | null, hospitalId: string | null) => {
    router.setParams({ department: department ?? '', hospitalId: hospitalId ?? '', search: '' });
  }, [router]);
  const [showAllClinics, setShowAllClinics] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState<string | null>(null);

  const departments = useAsyncResource(() => doctorApi.departments(), []);
  const clinics = useAsyncResource(() => clinicApi.list(), []);

  const doctors = useAsyncResource(
    () => doctorApi.list({ search: search.trim() || undefined, department: department || undefined, hospitalId: hospitalId || undefined }),
    [search, department, hospitalId],
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
  const reloadDoctors = doctors.reload;
  const reloadDepartments = departments.reload;
  const reloadClinics = clinics.reload;
  const reloadBookings = bookings.reload;

  useFocusEffect(
    useCallback(() => {
      if (tab === 'bookings') void reloadBookings();
      else void reloadDoctors();
      void reloadDepartments();
      void reloadClinics();
    }, [reloadBookings, reloadClinics, reloadDepartments, reloadDoctors, tab]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      tab === 'bookings' ? reloadBookings() : reloadDoctors(),
      reloadDepartments(),
      reloadClinics(),
    ]);
    setRefreshing(false);
  }, [reloadBookings, reloadClinics, reloadDepartments, reloadDoctors, tab]);

  const openDoctor = useCallback(
    (doctor: Doctor) => {
      router.push({ pathname: '/(patient)/doctor/[id]', params: { id: doctor.id, section: view === 'schedule' ? 'Schedule' : 'Appointment' } });
    },
    [router, view],
  );

  const confirmCancel = useCallback(
    (appointment: Appointment) => {
      const cancel = async () => {
        setWorking(appointment.id);
        try {
          await bookingApi.cancel(appointment.id, 'Cancelled by patient');
          bookings.setData(current => current ? { ...current, appointments: current.appointments.filter(item => item.id !== appointment.id) } : current);
          bookings.reload();
          router.push({ pathname: '/(patient)/profile/history', params: { status: 'cancelled' } });
        } catch (error) {
          Alert.alert(t('Could not cancel'), error instanceof Error ? error.message : t('Please try again.'));
        } finally {
          setWorking(null);
        }
      };
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.confirm(t('Cancel this booking?'))) void cancel();
        return;
      }
      Alert.alert(
        t('Cancel this booking?'),
        t("{value0} · {value1} at {value2}\n\nYou can book another time from the doctor list.", { value0: String(appointment.doctorName), value1: String(appointment.dateLabel ?? appointment.date), value2: String(appointment.slotTime) }),
        [
          { text: t('Keep booking'), style: 'cancel' },
          {
            text: t('Cancel booking'),
            style: 'destructive',
            onPress: () => void cancel(),
          },
        ],
      );
    },
    [bookings, router, t],
  );

  const startReschedule = useCallback(
    (appointment: Appointment) => {
      if (!appointment.doctorId) {
        Alert.alert(t('Booking unavailable'), t('This booking is no longer linked to a doctor.'));
        return;
      }
      router.push({
        pathname: '/(patient)/doctor/[id]',
        params: { id: appointment.doctorId, rescheduleId: appointment.id },
      });
    },
    [router, t],
  );

  const checkIn = useCallback(
    (appointment: Appointment) => {
      const checkInNow = async () => {
        setWorking(appointment.id);
        try {
          await queueApi.checkIn(appointment.id);
          router.push('/(patient)/queue');
        } catch (error) {
          Alert.alert(
            t('Could not check in'),
            error instanceof Error ? error.message : t('Please try again.'),
          );
        } finally {
          setWorking(null);
        }
      };
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.confirm(t("Collect your queue number for {value0}?", { value0: String(appointment.department) }))) void checkInNow();
        return;
      }
      Alert.alert(t('Check in now?'), t("Collect your queue number for {value0}.", { value0: String(appointment.department) }), [
        { text: t('Not yet'), style: 'cancel' },
        {
          text: t('Check in'),
          onPress: () => void checkInNow(),
        },
      ]);
    },
    [router, t],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        {tab === 'directory' ? (
          <>
            <View style={styles.searchRow}>
              <View style={styles.search}>
                <DesignImage name="search" size={15} color={PatientTheme.textMuted} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t("Search by name or speciality")}
                  placeholderTextColor={PatientTheme.textMuted}
                  style={styles.searchInput}
                  autoCorrect={false}
                  returnKeyType="search"
                  accessibilityLabel={t("Search doctors")}
                />
                {search ? (
                  <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityLabel={t("Clear search")}>
                    <AppIcon name="close" size={16} color={PatientTheme.textSecondary} />
                  </Pressable>
                ) : null}
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              <Chip
                label={t("All")}
                active={!department && !hospitalId}
                onPress={() => {
                  setClinic(null, null);
                }}
              />
              {(showAllClinics ? clinics.data?.clinics ?? [] : (clinics.data?.clinics ?? []).slice(0, 16)).map((clinic: Clinic) => (
                <Chip
                  key={clinic._id}
                  label={clinic.name.replace(/ Clinic$/, '')}
                  active={department === clinic.department && hospitalId === (clinic.hospital?._id ?? null)}
                  onPress={() => {
                    const active = department === clinic.department && hospitalId === (clinic.hospital?._id ?? null);
                    setClinic(active ? null : clinic.department, active ? null : clinic.hospital?._id ?? null);
                  }}
                />
              ))}
              {(clinics.data?.clinics?.length ?? 0) > 16 ? (
                <Chip
                  label={showAllClinics ? t('Featured clinics') : t('View all clinics')}
                  active={false}
                  onPress={() => setShowAllClinics((value) => !value)}
                />
              ) : null}
            </ScrollView>
          </>
        ) : null}
      </View>
    ),
    [clinics.data, department, hospitalId, search, setClinic, setSearch, showAllClinics, tab, t],
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
          <ScreenLoader label={t("Loading doctors")} />
        ) : doctors.error ? (
          <MessageState
            icon="help"
            title={t("Could not load doctors")}
            description={doctors.error}
            actionLabel={t("Try again")}
            onAction={doctors.reload}
          />
        ) : (
          <MessageState
            icon="stethoscope"
            title={t("No doctors found")}
            description={
              search || department
                ? t('Try a different name or speciality.')
                : t('The clinic has not published its doctor list yet.')
            }
            actionLabel={search || department || hospitalId ? t('Clear filters') : undefined}
            onAction={search || department || hospitalId ? () => {
              setSearch('');
              setClinic(null, null);
            } : undefined}
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
          <ScreenLoader label={t("Loading your bookings")} />
        ) : bookings.error ? (
          <MessageState
            icon="help"
            title={t("Could not load your bookings")}
            description={bookings.error}
            actionLabel={t("Try again")}
            onAction={bookings.reload}
          />
        ) : (
          <MessageState
            icon="calendar"
            title={t("No upcoming bookings")}
            description={t("Find a doctor and pick a time that suits you.")}
            actionLabel={t("Find a doctor")}
            onAction={() => setTab('directory')}
          />
        )
      }
    />
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + PatientTheme.spaceSm }]}>
      <ScreenHeader
        title={tab === 'bookings' ? t('My bookings') : view === 'schedule' ? t('Doctor Schedule') : view === 'registration' ? t('Clinic Registration') : t('Find a doctor')}
        subtitle={
          tab === 'directory'
            ? view === 'schedule' ? t('Select a doctor to view available dates and times') : t('Book a clinic time with a specialist')
            : t('Reschedule or cancel an appointment')
        }
      />

      <View style={styles.tabs}>
        <TabButton
          label={t("Directory")}
          active={tab === 'directory'}
          onPress={() => setTab('directory')}
        />
        <TabButton label={t("My bookings")} active={tab === 'bookings'} onPress={() => setTab('bookings')} />
      </View>

      {working ? <Text style={styles.working}>{t("Working on it...")}</Text> : null}

      {tab === 'directory' ? doctorList : appointmentList}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { t } = useLanguage();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{t(label ?? '')}</Text>
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
  const { t } = useLanguage();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.tabButton, active && styles.tabButtonActive, pressed && styles.pressed]}
    >
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t(label ?? '')}</Text>
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
