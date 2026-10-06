import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Patient } from '../../types';
import { usePatients, PatientListFilter } from '../../hooks';
import {
  PatientCard,
  LoadingState,
  ErrorState,
  SectionHeader,
} from '../../components';

export interface PatientsScreenProps {
  navigation?: any;
  onNavigate?: (route: string) => void;
}

export const PatientsScreen: React.FC<PatientsScreenProps> = ({
  navigation,
  onNavigate,
}) => {
  const [query, setQuery] = useState<string>('');
  const [filter, setFilter] = useState<PatientListFilter>('all');

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

  const getInitials = (name: string): string => {
    if (!name) return 'P';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Screen Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="people" size={20} color={Colors.white} />
          </View>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Patient Directory</Text>
            <Text style={styles.headerSubtitle}>
              Government OPD Central Registry
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.refreshIconButton}
          onPress={() => refresh()}
          activeOpacity={0.7}
          disabled={loading}
        >
          <Ionicons
            name="refresh"
            size={18}
            color={Colors.white}
            style={loading ? styles.rotatingIcon : undefined}
          />
        </TouchableOpacity>
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
              placeholder="Search by NIC or Phone number..."
              placeholderTextColor={Colors.textLight}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search by NIC or Phone number"
            />
            {query.length > 0 ? (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClearQuery}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Clear search text"
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
          <View style={styles.filterChipsRow}>
            {/* Filter: All Records */}
            <TouchableOpacity
              style={[
                styles.filterChip,
                filter === 'all' && styles.filterChipActive,
              ]}
              onPress={() => setFilter('all')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Filter all records"
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
                All Records
              </Text>
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
              accessibilityLabel="Filter visited today"
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
                Visited Today
              </Text>
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
              accessibilityLabel="Filter recent patients"
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
                Recent
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ======================================================== */}
        {/* 3. SELECTED PATIENT HERO CARD                             */}
        {/* ======================================================== */}
        {selected ? (
          <View style={styles.selectedSection}>
            <SectionHeader
              title="Selected Patient"
              subtitle="Full profile & identity details"
              rightElement={
                <TouchableOpacity
                  style={styles.deselectButton}
                  onPress={() => selectPatient(null)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={14} color={Colors.textMedium} style={{ marginRight: 3 }} />
                  <Text style={styles.deselectButtonText}>Deselect</Text>
                </TouchableOpacity>
              }
            />

            {selectedLoading ? (
              <View style={styles.selectedLoadingCard}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.selectedLoadingText}>Updating patient profile...</Text>
              </View>
            ) : selectedError ? (
              <View style={styles.selectedErrorCard}>
                <Ionicons name="alert-circle" size={18} color={Colors.danger} style={{ marginRight: 6 }} />
                <Text style={styles.selectedErrorText}>{selectedError}</Text>
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
                        <Text style={styles.selectedSubText}>{selected.age} yrs</Text>
                      ) : null}
                      {selected.gender ? (
                        <Text style={styles.selectedSubText}>
                          • {selected.gender.charAt(0).toUpperCase() + selected.gender.slice(1)}
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
                </View>

                {/* "Verified single record" Banner / Badge */}
                {selected.nicVerified ? (
                  <View style={styles.verifiedRecordBanner}>
                    <Ionicons
                      name="shield-checkmark"
                      size={15}
                      color="#047857"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.verifiedRecordText}>
                      Verified single record (NIC validated)
                    </Text>
                  </View>
                ) : null}

                {/* Details Grid: NIC, Phone, District, Visits */}
                <View style={styles.selectedDetailsGrid}>
                  <View style={styles.detailGridItem}>
                    <Ionicons name="card-outline" size={14} color={Colors.textMedium} style={{ marginRight: 5 }} />
                    <Text style={styles.detailLabel}>NIC:</Text>
                    <Text style={styles.detailValue}>
                      {selected.nic || 'Not registered'}
                    </Text>
                  </View>

                  <View style={styles.detailGridItem}>
                    <Ionicons name="call-outline" size={14} color={Colors.textMedium} style={{ marginRight: 5 }} />
                    <Text style={styles.detailLabel}>Phone:</Text>
                    <Text style={styles.detailValue}>{selected.phone}</Text>
                  </View>

                  <View style={styles.detailGridItem}>
                    <Ionicons name="location-outline" size={14} color={Colors.textMedium} style={{ marginRight: 5 }} />
                    <Text style={styles.detailLabel}>District:</Text>
                    <Text style={styles.detailValue}>
                      {selected.district || 'General / Colombo'}
                    </Text>
                  </View>

                  <View style={styles.detailGridItem}>
                    <Ionicons name="medical-outline" size={14} color={Colors.textMedium} style={{ marginRight: 5 }} />
                    <Text style={styles.detailLabel}>Visits:</Text>
                    <Text style={styles.detailValue}>
                      {selected.visitHistory?.length || 0} recorded
                    </Text>
                  </View>
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
                ? `Search Results (${list.length})`
                : `Patient Records (${list.length})`
            }
            subtitle={
              query.trim().length >= 3
                ? `Matching "${query.trim()}"`
                : filter === 'visited_today'
                ? 'Patients with consultations recorded today'
                : filter === 'recent'
                ? 'Patients active in the past 30 days'
                : 'All registered government OPD records'
            }
          />

          {loading && list.length === 0 ? (
            <View style={styles.stateCard}>
              <LoadingState
                message="Loading patient directory records..."
                size="large"
                fullscreen={false}
              />
            </View>
          ) : error && list.length === 0 ? (
            <View style={styles.stateCard}>
              <ErrorState
                title="Unable to load patients"
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
                  ? 'No matching patient records'
                  : 'No patients found'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {query.trim().length >= 3
                  ? `No registered patients match "${query.trim()}". Try searching with a different NIC or phone number.`
                  : 'There are currently no patient records matching the selected filter.'}
              </Text>
              {query.length > 0 ? (
                <TouchableOpacity
                  style={styles.emptyClearButton}
                  onPress={handleClearQuery}
                  activeOpacity={0.7}
                >
                  <Text style={styles.emptyClearButtonText}>Clear Search</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>

        {/* Bottom spacer for tab bar / safe layout */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
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
  },
  filterChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // 44px touch target
    paddingHorizontal: 8,
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
  verifiedRecordBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 12,
  },
  verifiedRecordText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#047857',
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
