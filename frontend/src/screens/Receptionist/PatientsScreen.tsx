import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Patient, PatientVisitHistoryItem } from '../../types';
import { usePatients, PatientListFilter } from '../../hooks';
import { verifyNic, getErrorMessage } from '../../services/api';
import {
  PatientCard,
  LoadingState,
  ErrorState,
  SectionHeader,
  Toast,
  ToastType,
  TokenBadge,
  StatusChip,
  EditPatientModal,
} from '../../components';

export interface PatientsScreenProps {
  navigation?: any;
  onNavigate?: (route: string) => void;
}

export const PatientsScreen: React.FC<PatientsScreenProps> = ({
  navigation,
  onNavigate,
}) => {
  const { t, locale } = useLanguage();
  const [query, setQuery] = useState<string>('');
  const [filter, setFilter] = useState<PatientListFilter>('all');
  const [verifyingNic, setVerifyingNic] = useState<boolean>(false);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastType, setToastType] = useState<ToastType>('success');
  const [toastVisible, setToastVisible] = useState<boolean>(false);

  const {
    list,
    selected,
    loading,
    error,
    selectedLoading,
    selectedError,
    refresh,
    selectPatient,
  } = usePatients(query, filter);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const handleClearQuery = () => {
    setQuery('');
  };

  const handleSelectPatient = (patient: Patient) => {
    const patientId = patient._id || patient.id || '';
    if (selected && (selected._id === patientId || selected.id === patientId)) {
      // Toggle off if already selected
      selectPatient(null);
    } else {
      selectPatient(patientId);
    }
  };

  const handleVerifyNic = async (patient: Patient) => {
    const patientId = patient._id || patient.id;
    if (!patientId || verifyingNic) return;

    if (!patient.nic || !patient.nic.trim()) {
      showToast(t('Patient has no NIC on record to verify'), 'warning');
      return;
    }

    try {
      setVerifyingNic(true);
      const res = await verifyNic(patientId);
      showToast(res.message || t('NIC verified successfully'), 'success');
      // Refresh selected profile and full list
      await selectPatient(patientId);
      await refresh();
    } catch (err: any) {
      const msg = getErrorMessage(err);
      showToast(msg || t('Failed to verify patient NIC'), 'error');
    } finally {
      setVerifyingNic(false);
    }
  };

  // Edit Patient Details Modal State
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);

  const handleOpenEditModal = (patientToEdit?: Patient | null) => {
    const target = patientToEdit || selected;
    if (!target) return;
    setEditingPatient(target);
    setEditModalVisible(true);
  };

  const handleEditSuccess = async (updated: Patient) => {
    showToast(t('Patient details updated successfully'), 'success');
    const patientId = updated._id || updated.id;
    if (patientId && selected && (selected._id === patientId || selected.id === patientId)) {
      await selectPatient(patientId);
    }
    await refresh();
  };

  const handleBookFutureSlot = () => {
    if (!selected) return;
    const existingId = selected._id || selected.id;
    const ageStr =
      selected.age !== undefined && selected.age !== null
        ? String(selected.age)
        : '';

    showToast(t("Prefilling OPD registration for {value0}...", { value0: String(selected.fullName) }), 'info');

    const params = {
      existingPatientId: existingId,
      name: selected.fullName,
      fullName: selected.fullName,
      nic: selected.nic || '',
      phone: selected.phone || '',
      age: ageStr,
      gender: selected.gender || '',
      patient: selected,
      intakeType: 'pre_booked',
    };

    if (navigation?.navigate) {
      navigation.navigate('RegisterTab', params);
    } else if (onNavigate) {
      onNavigate('register');
    }
  };

  const getInitials = (name: string): string => {
    if (!name) return 'P';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return 'N/A';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const dateObj = new Date(year, month, day);
        return dateObj.toLocaleDateString(locale, {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
      }
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString(locale, {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const isTodayDate = (dateStr?: string): boolean => {
    if (!dateStr) return false;
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    return dateStr.startsWith(todayStr);
  };

  const visits: PatientVisitHistoryItem[] = selected?.visitHistory || [];
  const activeStatusList = ['waiting', 'called', 'serving', 'checked_in', 'booked'];
  const activeTodayVisit = visits.find(
    (v) => isTodayDate(v.date) && activeStatusList.includes((v.status || '').toLowerCase())
  );
  const pastVisits = visits.filter((v) => v !== activeTodayVisit);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Toast Notification */}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        duration={2500}
        onDismiss={() => setToastVisible(false)}
      />

      {/* Screen Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="people" size={20} color={Colors.white} />
          </View>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>{t("Patient Directory")}</Text>
            <Text style={styles.headerSubtitle}>
              {t("Government OPD Central Registry")}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            style={styles.refreshIconButton}
            onPress={() => refresh()}
            activeOpacity={0.7}
            disabled={loading}
            accessibilityLabel="Refresh directory"
          >
            <Ionicons
              name="refresh"
              size={18}
              color={Colors.white}
              style={loading ? styles.rotatingIcon : undefined}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.refreshIconButton, { marginLeft: 8, backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}
            onPress={() => {
              if (navigation?.canGoBack?.()) {
                navigation.goBack();
              } else if (onNavigate) {
                onNavigate('home');
              } else if (navigation?.navigate) {
                navigation.navigate('HomeTab');
              }
            }}
            activeOpacity={0.7}
            accessibilityLabel="Close and return to dashboard"
          >
            <Ionicons name="close" size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading && list.length > 0}
            onRefresh={refresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        {/* ======================================================== */}
        {/* 1. SEARCH BAR FOR NIC / PHONE                             */}
        {/* ======================================================== */}
        <View style={styles.searchCard}>
          <View style={styles.searchBar}>
            <Ionicons
              name="search"
              size={20}
              color={Colors.primary}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder={t("Search by NIC or Phone number...")}
              placeholderTextColor={Colors.textLight}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel={t("Search by NIC or Phone number")}
            />
            {query.length > 0 ? (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClearQuery}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel={t("Clear search text")}
              >
                <Ionicons name="close-circle" size={19} color={Colors.textLight} />
              </TouchableOpacity>
            ) : (
              <View style={styles.qrPlaceholderIcon}>
                <MaterialCommunityIcons
                  name="qrcode-scan"
                  size={18}
                  color={Colors.textLight}
                />
              </View>
            )}
          </View>
        </View>

        {/* ======================================================== */}
        {/* 2. FILTER CHIPS ROW                                       */}
        {/* ======================================================== */}
        <View style={styles.filterSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipsRow}
          >
            {/* Filter: All Records */}
            <TouchableOpacity
              style={[
                styles.filterChip,
                filter === 'all' && styles.filterChipActive,
              ]}
              onPress={() => setFilter('all')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t("Filter all records")}
            >
              <Ionicons
                name="folder-open"
                size={14}
                color={filter === 'all' ? Colors.white : Colors.secondary}
                style={styles.chipIcon}
              />
              <Text
                style={[
                  styles.filterChipText,
                  filter === 'all' && styles.filterChipTextActive,
                ]}
              >
                {t("All Records")}</Text>
            </TouchableOpacity>

            {/* Filter: Pre-Booked */}
            <TouchableOpacity
              style={[
                styles.filterChip,
                filter === 'pre_booked' && styles.filterChipActive,
              ]}
              onPress={() => setFilter('pre_booked')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Filter pre-booked patients"
            >
              <Ionicons
                name="calendar"
                size={14}
                color={filter === 'pre_booked' ? Colors.white : '#059669'}
                style={styles.chipIcon}
              />
              <Text
                style={[
                  styles.filterChipText,
                  filter === 'pre_booked' && styles.filterChipTextActive,
                ]}
              >{t("Pre-Booked")}</Text>
            </TouchableOpacity>

            {/* Filter: Walk-In */}
            <TouchableOpacity
              style={[
                styles.filterChip,
                filter === 'walk_in' && styles.filterChipActive,
              ]}
              onPress={() => setFilter('walk_in')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Filter walk-in patients"
            >
              <Ionicons
                name="walk"
                size={14}
                color={filter === 'walk_in' ? Colors.white : Colors.primary}
                style={styles.chipIcon}
              />
              <Text
                style={[
                  styles.filterChipText,
                  filter === 'walk_in' && styles.filterChipTextActive,
                ]}
              >{t("Walk-In")}</Text>
            </TouchableOpacity>

            {/* Filter: Visited Today */}
            <TouchableOpacity
              style={[
                styles.filterChip,
                filter === 'visited_today' && styles.filterChipActive,
              ]}
              onPress={() => setFilter('visited_today')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t("Filter visited today")}
            >
              <Ionicons
                name="today"
                size={14}
                color={filter === 'visited_today' ? Colors.white : Colors.secondary}
                style={styles.chipIcon}
              />
              <Text
                style={[
                  styles.filterChipText,
                  filter === 'visited_today' && styles.filterChipTextActive,
                ]}
              >
                {t("Visited Today")}</Text>
            </TouchableOpacity>

            {/* Filter: Recent */}
            <TouchableOpacity
              style={[
                styles.filterChip,
                filter === 'recent' && styles.filterChipActive,
              ]}
              onPress={() => setFilter('recent')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t("Filter recent patients")}
            >
              <Ionicons
                name="time"
                size={14}
                color={filter === 'recent' ? Colors.white : Colors.secondary}
                style={styles.chipIcon}
              />
              <Text
                style={[
                  styles.filterChipText,
                  filter === 'recent' && styles.filterChipTextActive,
                ]}
              >
                {t("Recent")}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* ======================================================== */}
        {/* 3. SELECTED PATIENT HERO CARD                             */}
        {/* ======================================================== */}
        {selected ? (
          <View style={styles.selectedSection}>
            <SectionHeader
              title={t("Selected Patient")}
              subtitle={t("Full profile & identity verification")}
              rightElement={
                <TouchableOpacity
                  style={styles.deselectButton}
                  onPress={() => selectPatient(null)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={14} color={Colors.textMedium} style={{ marginRight: 3 }} />
                  <Text style={styles.deselectButtonText}>{t("Deselect")}</Text>
                </TouchableOpacity>
              }
            />

            {selectedLoading ? (
              <View style={styles.selectedLoadingCard}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.selectedLoadingText}>{t("Updating patient profile...")}</Text>
              </View>
            ) : selectedError ? (
              <View style={styles.selectedErrorCard}>
                <Ionicons name="alert-circle" size={18} color={Colors.danger} style={{ marginRight: 6 }} />
                <Text style={styles.selectedErrorText}>{t(selectedError)}</Text>
              </View>
            ) : (
              <View style={styles.selectedCard}>
                {/* Top Info Row: Avatar + Name + Verification Badge */}
                <View style={styles.selectedTopRow}>
                  <View style={styles.selectedAvatar}>
                    <Text style={styles.selectedAvatarText}>
                      {getInitials(selected.fullName)}
                    </Text>
                  </View>

                  <View style={styles.selectedMainInfo}>
                    <View style={styles.selectedNameRow}>
                      <Text style={styles.selectedName} numberOfLines={1}>
                        {selected.fullName}
                      </Text>
                      {selected.nicVerified ? (
                        <MaterialIcons
                          name="verified"
                          size={18}
                          color={Colors.primary}
                          style={styles.verifiedIcon}
                        />
                      ) : null}
                    </View>

                    {/* Sub Row: Age, Gender, District */}
                    <View style={styles.selectedSubRow}>
                      {selected.age ? (
                        <Text style={styles.selectedSubText}>{selected.age} {t("yrs")}</Text>
                      ) : null}
                      {selected.gender ? (
                        <Text style={styles.selectedSubText}>
                          • {t(selected.gender.charAt(0).toUpperCase() + selected.gender.slice(1))}
                        </Text>
                      ) : null}
                      {selected.district ? (
                        <Text style={styles.selectedSubText}>• {selected.district}</Text>
                      ) : null}
                    </View>
                  </View>

                  {/* Blood Group Badge */}
                  {selected.bloodGroup ? (
                    <View style={styles.selectedBloodBadge}>
                      <Text style={styles.selectedBloodText}>{selected.bloodGroup}</Text>
                    </View>
                  ) : null}

                  {/* Edit Patient Icon Button */}
                  <TouchableOpacity
                    style={styles.selectedEditButton}
                    onPress={() => handleOpenEditModal(selected)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={t("Edit patient details")}
                  >
                    <Ionicons name="create-outline" size={18} color={Colors.primary} />
                  </TouchableOpacity>
                </View>

                {/* ── NIC VERIFICATION STATUS / ACTION ── */}
                {selected.nicVerified ? (
                  // Verified: Green Banner
                  <View style={styles.verifiedRecordBanner}>
                    <Ionicons
                      name="shield-checkmark"
                      size={16}
                      color="#047857"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.verifiedRecordText}>
                      {t("Verified single record (NIC validated)")}</Text>
                  </View>
                ) : selected.nic && selected.nic.trim().length > 0 ? (
                  // Has NIC but unverified: "Verify NIC" Action Button
                  <TouchableOpacity
                    style={[
                      styles.verifyNicButton,
                      verifyingNic && styles.buttonDisabled,
                    ]}
                    onPress={() => handleVerifyNic(selected)}
                    disabled={verifyingNic}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={t("Verify Patient NIC")}
                  >
                    {verifyingNic ? (
                      <ActivityIndicator
                        size="small"
                        color={Colors.white}
                        style={{ marginRight: 8 }}
                      />
                    ) : (
                      <Ionicons
                        name="shield-checkmark"
                        size={16}
                        color={Colors.white}
                        style={{ marginRight: 8 }}
                      />
                    )}
                    <Text style={styles.verifyNicButtonText}>
                      {verifyingNic ? t('Verifying NIC...') : t('Verify NIC')}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  // No NIC: Clear Information Message
                  <View style={styles.noNicNoticeBanner}>
                    <Ionicons
                      name="information-circle"
                      size={16}
                      color="#D97706"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.noNicNoticeText}>
                      {t("Patient has no NIC on record.")}</Text>
                  </View>
                )}

                {/* Details Grid: NIC, Phone, District, Visits */}
                <View style={styles.selectedDetailsGrid}>
                  <View style={styles.detailGridItem}>
                    <Ionicons name="card-outline" size={14} color={Colors.textMedium} style={{ marginRight: 5 }} />
                    <Text style={styles.detailLabel}>{t("NIC:")}</Text>
                    <Text style={styles.detailValue}>
                      {selected.nic || t('Not registered')}
                    </Text>
                  </View>

                  <View style={styles.detailGridItem}>
                    <Ionicons name="call-outline" size={14} color={Colors.textMedium} style={{ marginRight: 5 }} />
                    <Text style={styles.detailLabel}>{t("Phone:")}</Text>
                    <Text style={styles.detailValue}>{selected.phone}</Text>
                  </View>

                  <View style={styles.detailGridItem}>
                    <Ionicons name="location-outline" size={14} color={Colors.textMedium} style={{ marginRight: 5 }} />
                    <Text style={styles.detailLabel}>{t("District:")}</Text>
                    <Text style={styles.detailValue}>
                      {selected.district || t('General / Colombo')}
                    </Text>
                  </View>

                  <View style={styles.detailGridItem}>
                    <Ionicons name="medical-outline" size={14} color={Colors.textMedium} style={{ marginRight: 5 }} />
                    <Text style={styles.detailLabel}>{t("Visits:")}</Text>
                    <Text style={styles.detailValue}>
                      {selected.visitHistory?.length || 0} {t("recorded")}</Text>
                  </View>
                </View>

                {/* ── QUICK DESK ACTIONS CARD ── */}
                <View style={styles.quickDeskCard}>
                  <View style={styles.quickDeskHeader}>
                    <View style={styles.quickDeskTitleRow}>
                      <View style={styles.quickDeskIconWrap}>
                        <Ionicons name="flash" size={15} color={Colors.primary} />
                      </View>
                      <Text style={styles.quickDeskTitle}>{t("Quick Desk Actions")}</Text>
                    </View>
                  </View>

                  {/* Quick Info Grid */}
                  <View style={styles.quickDeskGrid}>
                    {/* 1. Emergency Contact */}
                    <View style={styles.quickDeskRow}>
                      <View style={styles.quickDeskLabelCol}>
                        <Ionicons name="call-outline" size={14} color={Colors.textMedium} style={{ marginRight: 6 }} />
                        <Text style={styles.quickDeskLabel}>{t("Emergency Contact:")}</Text>
                      </View>
                      <View style={styles.quickDeskValueCol}>
                        {selected.emergencyContact?.name || selected.emergencyContact?.phone ? (
                          <Text style={styles.quickDeskValueText}>
                            {selected.emergencyContact.name || t('Named Kin')}
                            {selected.emergencyContact.phone ? ` • ${selected.emergencyContact.phone}` : ''}
                            {selected.emergencyContact.relationship ? ` (${selected.emergencyContact.relationship})` : ''}
                          </Text>
                        ) : (
                          <Text style={styles.notRecordedText}>{t("Not recorded")}</Text>
                        )}
                      </View>
                    </View>

                    {/* 2. Blood Group */}
                    <View style={styles.quickDeskRow}>
                      <View style={styles.quickDeskLabelCol}>
                        <Ionicons name="water-outline" size={14} color="#DC2626" style={{ marginRight: 6 }} />
                        <Text style={styles.quickDeskLabel}>{t("Blood Group:")}</Text>
                      </View>
                      <View style={styles.quickDeskValueCol}>
                        {selected.bloodGroup ? (
                          <View style={styles.quickBloodBadge}>
                            <Text style={styles.quickBloodText}>{selected.bloodGroup}</Text>
                          </View>
                        ) : (
                          <Text style={styles.notRecordedText}>{t("Not recorded")}</Text>
                        )}
                      </View>
                    </View>

                    {/* 3. Allergies (Shown in red with severity) */}
                    <View style={styles.quickDeskRow}>
                      <View style={styles.quickDeskLabelCol}>
                        <Ionicons name="alert-circle-outline" size={14} color="#DC2626" style={{ marginRight: 6 }} />
                        <Text style={styles.quickDeskLabel}>{t("Allergies:")}</Text>
                      </View>
                      <View style={styles.quickDeskValueCol}>
                        {selected.allergies && selected.allergies.length > 0 ? (
                          <View style={styles.allergiesWrap}>
                            {selected.allergies.map((alg, i) => (
                              <View key={`allergy-${i}`} style={styles.allergyBadge}>
                                <Ionicons name="warning" size={11} color="#DC2626" style={{ marginRight: 4 }} />
                                <Text style={styles.allergyText}>
                                  {alg.name || t('Allergy')}
                                  {alg.severity ? ` (${alg.severity})` : ''}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.notRecordedText}>{t("Not recorded")}</Text>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Two Action Buttons */}
                  <View style={styles.quickDeskButtonsRow}>
                    <TouchableOpacity
                      style={styles.updateDetailsButton}
                      onPress={() => handleOpenEditModal(selected)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={t("Update Patient Details")}
                    >
                      <Ionicons name="create-outline" size={16} color={Colors.white} style={{ marginRight: 6 }} />
                      <Text style={styles.updateDetailsButtonText}>{t("Update Patient Details")}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.bookFutureSlotButton}
                      onPress={handleBookFutureSlot}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={t("Book Future OPD Slot")}
                    >
                      <Ionicons name="calendar-outline" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
                      <Text style={styles.bookFutureSlotButtonText}>{t("Book Future OPD Slot")}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* ── VISIT & APPOINTMENT HISTORY TIMELINE SECTION ── */}
                <View style={styles.historySection}>
                  <SectionHeader
                    title={t("Visit & Appointment History")}
                    subtitle={t("Chronological consultations & queue encounters")}
                    rightElement={
                      <View style={styles.encounterCountChip}>
                        <Ionicons name="medical" size={12} color={Colors.primary} style={{ marginRight: 4 }} />
                        <Text style={styles.encounterCountText}>
                          {visits.length} {visits.length === 1 ? t('Encounter') : t('Encounters')}
                        </Text>
                      </View>
                    }
                  />

                  {visits.length === 0 ? (
                    <View style={styles.historyEmptyCard}>
                      <View style={styles.historyEmptyIconCircle}>
                        <Ionicons name="calendar-outline" size={26} color={Colors.textLight} />
                      </View>
                      <Text style={styles.historyEmptyTitle}>{t("No previous visits")}</Text>
                      <Text style={styles.historyEmptySubtitle}>
                        {t("This patient does not have any recorded consultations or queue encounters yet.")}</Text>
                    </View>
                  ) : (
                    <View style={styles.timelineContainer}>
                      {/* Today's Active Token (Shown First) */}
                      {activeTodayVisit ? (
                        <View style={styles.timelineItem}>
                          {/* Indicator column */}
                          <View style={styles.timelineIndicatorColumn}>
                            <View style={styles.activeTimelineDot}>
                              <View style={styles.activeTimelineInnerDot} />
                            </View>
                            {pastVisits.length > 0 ? <View style={styles.timelineLine} /> : null}
                          </View>

                          {/* Active Token Card */}
                          <View style={styles.activeTokenCard}>
                            <View style={styles.activeTokenHeaderRow}>
                              <View style={styles.activeTokenBadgeRow}>
                                <TokenBadge
                                  tokenLabel={
                                    activeTodayVisit.tokenNumber
                                      ? `OPD-${String(activeTodayVisit.tokenNumber).padStart(3, '0')}`
                                      : 'OPD-001'
                                  }
                                  priority="normal"
                                  size="small"
                                />
                                <StatusChip
                                  status="waiting"
                                  label={t("In Waiting Queue")}
                                  size="small"
                                  style={styles.inQueueChip}
                                />
                              </View>
                              <View style={styles.todayDateBadge}>
                                <Text style={styles.todayDateText}>
                                  {t("Today")}{activeTodayVisit.slotTime ? ` • ${activeTodayVisit.slotTime}` : ''}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.timelineBodyDetails}>
                              <View style={styles.timelineDetailRow}>
                                <Ionicons name="business" size={14} color={Colors.primary} style={{ marginRight: 6 }} />
                                <Text style={styles.timelineDepartmentText}>
                                  {t(activeTodayVisit.department || 'General OPD')}
                                </Text>
                              </View>
                              <View style={styles.timelineDetailRow}>
                                <Ionicons name="person" size={14} color={Colors.secondary} style={{ marginRight: 6 }} />
                                <Text style={styles.timelineDoctorText}>
                                  {activeTodayVisit.doctorName || activeTodayVisit.doctorDetails?.name || t('Doctor Pending Assignment')}
                                </Text>
                                {activeTodayVisit.doctorDetails?.room ? (
                                  <Text style={styles.timelineRoomText}>
                                    ({activeTodayVisit.doctorDetails.room})
                                  </Text>
                                ) : null}
                              </View>
                            </View>

                            {activeTodayVisit.notes && activeTodayVisit.notes.trim() ? (
                              <View style={styles.clinicalNotesBox}>
                                <View style={styles.clinicalNotesHeader}>
                                  <Ionicons name="document-text" size={13} color={Colors.primary} style={{ marginRight: 4 }} />
                                  <Text style={styles.clinicalNotesTitle}>{t("Clinical Note / Prescription")}</Text>
                                </View>
                                <Text style={styles.clinicalNotesContent}>{activeTodayVisit.notes.trim()}</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      ) : null}

                      {/* Past Visits Timeline */}
                      {pastVisits.map((visit, index) => {
                        const isLast = index === pastVisits.length - 1;
                        return (
                          <View key={visit._id || `past-visit-${index}`} style={styles.timelineItem}>
                            {/* Indicator column */}
                            <View style={styles.timelineIndicatorColumn}>
                              <View style={styles.pastTimelineDot}>
                                <Ionicons name="checkmark" size={10} color={Colors.white} />
                              </View>
                              {!isLast ? <View style={styles.timelineLine} /> : null}
                            </View>

                            {/* Past Visit Card */}
                            <View style={styles.pastVisitCard}>
                              <View style={styles.pastVisitHeaderRow}>
                                <View style={styles.pastVisitDateRow}>
                                  <Ionicons name="calendar-outline" size={14} color={Colors.textMedium} style={{ marginRight: 5 }} />
                                  <Text style={styles.pastVisitDateText}>
                                    {formatDate(visit.date)}
                                  </Text>
                                  {visit.slotTime ? (
                                    <Text style={styles.pastVisitTimeText}>• {visit.slotTime}</Text>
                                  ) : null}
                                </View>
                                <StatusChip
                                  status={visit.status || 'completed'}
                                  size="small"
                                />
                              </View>

                              <View style={styles.timelineBodyDetails}>
                                <View style={styles.timelineDetailRow}>
                                  <Ionicons name="business-outline" size={14} color={Colors.textMedium} style={{ marginRight: 6 }} />
                                  <Text style={styles.pastDepartmentText}>
                                    {t(visit.department || 'General OPD')}
                                  </Text>
                                </View>
                                <View style={styles.timelineDetailRow}>
                                  <Ionicons name="person-outline" size={14} color={Colors.textMedium} style={{ marginRight: 6 }} />
                                  <Text style={styles.pastDoctorText}>
                                    {visit.doctorName || visit.doctorDetails?.name || t('Assigned OPD Physician')}
                                  </Text>
                                  {visit.doctorDetails?.room ? (
                                    <Text style={styles.timelineRoomText}>({visit.doctorDetails.room})</Text>
                                  ) : null}
                                </View>
                              </View>

                              {visit.notes && visit.notes.trim() ? (
                                <View style={styles.clinicalNotesBox}>
                                  <View style={styles.clinicalNotesHeader}>
                                    <Ionicons name="document-text-outline" size={13} color="#0D9488" style={{ marginRight: 4 }} />
                                    <Text style={styles.clinicalNotesTitle}>{t("Clinical Note / Prescription")}</Text>
                                  </View>
                                  <Text style={styles.clinicalNotesContent}>{visit.notes.trim()}</Text>
                                </View>
                              ) : null}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        ) : null}

        {/* ======================================================== */}
        {/* 4. RESULTS LIST & STATES                                  */}
        {/* ======================================================== */}
        <View style={styles.resultsSection}>
          <SectionHeader
            title={
              query.trim().length >= 3
                ? t("Search Results ({value0})", { value0: String(list.length) })
                : t("Patient Records ({value0})", { value0: String(list.length) })
            }
            subtitle={
              query.trim().length >= 3
                ? t("Matching \"{value0}\"", { value0: String(query.trim()) })
                : filter === 'pre_booked'
                ? t('Pre-booked online appointment patients')
                : filter === 'walk_in'
                ? t('Walk-in registered OPD patients')
                : filter === 'visited_today'
                ? t('Patients with consultations recorded today')
                : filter === 'recent'
                ? t('Patients active in the past 30 days')
                : t('All registered government OPD records')
            }
          />

          {loading && list.length === 0 ? (
            <View style={styles.stateCard}>
              <LoadingState
                message={t("Loading patient directory records...")}
                size="large"
                fullscreen={false}
              />
            </View>
          ) : error && list.length === 0 ? (
            <View style={styles.stateCard}>
              <ErrorState
                title={t("Unable to load patients")}
                message={error}
                onRetry={refresh}
                retryLabel="Retry Patient Search"
                fullscreen={false}
              />
            </View>
          ) : list.length > 0 ? (
            list.map((patient: Patient) => {
              const patientId = patient._id || patient.id || '';
              const isSelected =
                selected && (selected._id === patientId || selected.id === patientId);

              return (
                <PatientCard
                  key={patientId}
                  patient={patient}
                  onPress={() => handleSelectPatient(patient)}
                  onEditPress={() => handleOpenEditModal(patient)}
                  style={[
                    styles.resultPatientCard,
                    isSelected && styles.resultPatientCardSelected,
                  ]}
                  rightElement={
                    isSelected ? (
                      <View style={styles.selectedCheckmarkBox}>
                        <Ionicons name="checkmark" size={16} color={Colors.white} />
                      </View>
                    ) : (
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={Colors.textLight}
                      />
                    )
                  }
                />
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <Ionicons
                  name={query.trim().length >= 3 ? 'search-outline' : 'people-outline'}
                  size={36}
                  color={Colors.textLight}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {query.trim().length >= 3
                  ? t('No matching patient records')
                  : t('No patients found')}
              </Text>
              <Text style={styles.emptySubtitle}>
                {query.trim().length >= 3
                  ? t("No registered patients match \"{value0}\". Try searching with a different NIC or phone number.", { value0: String(query.trim()) })
                  : t('There are currently no patient records matching the selected filter.')}
              </Text>
              {query.length > 0 ? (
                <TouchableOpacity
                  style={styles.emptyClearButton}
                  onPress={handleClearQuery}
                  activeOpacity={0.7}
                >
                  <Text style={styles.emptyClearButtonText}>{t("Clear Search")}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>

        {/* Bottom spacer for tab bar / safe layout */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* ======================================================== */}
      {/* 5. EDIT PATIENT DETAILS MODAL                            */}
      {/* ======================================================== */}
      <EditPatientModal
        visible={editModalVisible}
        patient={editingPatient}
        onClose={() => setEditModalVisible(false)}
        onSuccess={handleEditSuccess}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#D0E8ED',
    marginTop: 1,
    fontWeight: '500',
  },
  refreshIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  rotatingIcon: {
    transform: [{ rotate: '45deg' }],
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // ─────────────────────────────────────────────────────────
  // Search Bar Styles
  // ─────────────────────────────────────────────────────────
  searchCard: {
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    minHeight: 48, // 48px touch target
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textDark,
    paddingVertical: 10,
  },
  clearButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrPlaceholderIcon: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─────────────────────────────────────────────────────────
  // Filter Chips Styles
  // ─────────────────────────────────────────────────────────
  filterSection: {
    marginBottom: 16,
  },
  filterChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  chipIcon: {
    marginRight: 5,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textDark,
  },
  filterChipTextActive: {
    color: Colors.white,
  },

  // ─────────────────────────────────────────────────────────
  // Selected Patient Hero Card Styles
  // ─────────────────────────────────────────────────────────
  selectedSection: {
    marginBottom: 20,
  },
  deselectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 32,
  },
  deselectButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMedium,
  },
  selectedCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  selectedTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
  },
  selectedAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.tint,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  selectedAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary,
  },
  selectedMainInfo: {
    flex: 1,
  },
  selectedNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textDark,
    flexShrink: 1,
  },
  verifiedIcon: {
    marginLeft: 5,
  },
  selectedSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    flexWrap: 'wrap',
  },
  selectedSubText: {
    fontSize: 12,
    color: Colors.textMedium,
    marginRight: 4,
  },
  selectedBloodBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  selectedBloodText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DC2626',
  },
  selectedEditButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.tint,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  // ── NIC Verification & Notice Styles ──
  verifiedRecordBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 12,
  },
  verifiedRecordText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#047857',
  },
  verifyNicButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44, // 44px touch target
    marginBottom: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  verifyNicButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.2,
  },
  noNicNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 12,
  },
  noNicNoticeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
  },
  buttonDisabled: {
    opacity: 0.65,
  },

  selectedDetailsGrid: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  detailGridItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.textMedium,
    fontWeight: '600',
    marginRight: 6,
    minWidth: 50,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textDark,
    flex: 1,
  },
  selectedLoadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectedLoadingText: {
    fontSize: 13,
    color: Colors.textMedium,
    marginLeft: 8,
    fontWeight: '600',
  },
  selectedErrorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  selectedErrorText: {
    fontSize: 12,
    color: Colors.danger,
    fontWeight: '600',
    flex: 1,
  },

  // ─────────────────────────────────────────────────────────
  // Quick Desk Actions Card Styles
  // ─────────────────────────────────────────────────────────
  quickDeskCard: {
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E0F2FE',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickDeskHeader: {
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  quickDeskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickDeskIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: Colors.tint,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  quickDeskTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textDark,
  },
  quickDeskGrid: {
    gap: 8,
    marginBottom: 12,
  },
  quickDeskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  quickDeskLabelCol: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 140,
  },
  quickDeskLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMedium,
  },
  quickDeskValueCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  quickDeskValueText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textDark,
    textAlign: 'right',
  },
  notRecordedText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textLight,
    fontStyle: 'italic',
  },
  quickBloodBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  quickBloodText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DC2626',
  },
  allergiesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'flex-end',
  },
  allergyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  allergyText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DC2626',
  },
  quickDeskButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  updateDetailsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    minHeight: 44, // 44px touch target
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 2,
  },
  updateDetailsButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.white,
  },
  bookFutureSlotButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    minHeight: 44, // 44px touch target
  },
  bookFutureSlotButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },

  // ─────────────────────────────────────────────────────────
  // Update Patient Details Modal Styles
  // ─────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textDark,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Colors.textMedium,
    marginTop: 2,
    fontWeight: '600',
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalFormScroll: {
    marginTop: 12,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 6,
  },
  modalTextInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textDark,
    minHeight: 44,
  },
  bloodGroupSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  bloodChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bloodChipSelected: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  bloodChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textDark,
  },
  bloodChipTextSelected: {
    color: Colors.white,
  },
  severitySelectorRow: {
    flexDirection: 'row',
    gap: 6,
  },
  severityChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  severityChipSelected: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  severityChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DC2626',
  },
  severityChipTextSelected: {
    color: Colors.white,
  },
  modalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  modalCancelButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMedium,
  },
  modalSaveButton: {
    flex: 1.5,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  modalSaveButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.white,
  },

  // ─────────────────────────────────────────────────────────
  // Visit & Appointment History Timeline Styles
  // ─────────────────────────────────────────────────────────
  historySection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  encounterCountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.tint,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  encounterCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  historyEmptyCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
  },
  historyEmptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  historyEmptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textDark,
    marginBottom: 2,
  },
  historyEmptySubtitle: {
    fontSize: 12,
    color: Colors.textMedium,
    textAlign: 'center',
  },

  // ── Timeline Structure ──
  timelineContainer: {
    marginTop: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  timelineIndicatorColumn: {
    alignItems: 'center',
    width: 28,
    marginRight: 8,
    paddingTop: 6,
  },
  activeTimelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#BAE6FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTimelineInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  pastTimelineDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E2E8F0',
    marginTop: 4,
    marginBottom: -6,
  },

  // ── Active Token Card ──
  activeTokenCard: {
    flex: 1,
    backgroundColor: '#F0FDFA',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#99F6E4',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  activeTokenHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 6,
  },
  activeTokenBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inQueueChip: {
    marginLeft: 2,
  },
  todayDateBadge: {
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  todayDateText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F766E',
  },

  // ── Past Visit Card ──
  pastVisitCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pastVisitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 6,
  },
  pastVisitDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pastVisitDateText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textDark,
  },
  pastVisitTimeText: {
    fontSize: 12,
    color: Colors.textMedium,
    marginLeft: 4,
    fontWeight: '600',
  },

  // ── Shared Timeline Card Content ──
  timelineBodyDetails: {
    gap: 4,
    marginBottom: 4,
  },
  timelineDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineDepartmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  timelineDoctorText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textDark,
  },
  timelineRoomText: {
    fontSize: 11,
    color: Colors.textMedium,
    marginLeft: 4,
    fontWeight: '500',
  },
  pastDepartmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textDark,
  },
  pastDoctorText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textDark,
  },

  // ── Clinical Notes Box ──
  clinicalNotesBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  clinicalNotesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  clinicalNotesTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  clinicalNotesContent: {
    fontSize: 12,
    color: Colors.textDark,
    lineHeight: 16,
    fontWeight: '500',
  },

  // ─────────────────────────────────────────────────────────
  // Results Section & Patient Card Overrides
  // ─────────────────────────────────────────────────────────
  resultsSection: {
    marginBottom: 20,
  },
  resultPatientCard: {
    marginBottom: 10,
  },
  resultPatientCardSelected: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: '#F0FDFA',
  },
  selectedCheckmarkBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stateCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textDark,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textMedium,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
    marginBottom: 12,
  },
  emptyClearButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.tint,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    minHeight: 44, // 44px touch target
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  emptyClearButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  bottomSpacer: {
    height: 40,
  },
});

export default PatientsScreen;
