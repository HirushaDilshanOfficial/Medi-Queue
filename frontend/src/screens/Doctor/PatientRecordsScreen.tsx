import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Image,
  Modal,
  StatusBar,
  useColorScheme,
  Platform,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  PatientRecord,
  PatientStatus,
  ALL_DUMMY_PATIENTS,
  fallbackAureliaRecord,
  filterPatientsList,
} from '../../services/patientRecordsService';
import { callSpecificTokenApi } from '../../services/doctorService';

export default function PatientRecordsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // State
  const [currentPatient, setCurrentPatient] = useState<PatientRecord>(fallbackAureliaRecord);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PatientStatus>('All');
  const [activeTab, setActiveTab] = useState<'home' | 'queue' | 'records' | 'schedule' | 'rx'>('records');

  // Modals
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isAllHistoryModalOpen, setIsAllHistoryModalOpen] = useState(false);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  // Scroll reference for smooth scrolling to top on patient selection
  const scrollViewRef = useRef<ScrollView>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.delay(2200),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => setToastMessage(null));
  };

  // Filtered patients list based on search and status
  const filteredPatients = useMemo(() => {
    return filterPatientsList(ALL_DUMMY_PATIENTS, searchQuery, statusFilter);
  }, [searchQuery, statusFilter]);

  // Select patient to make current patient
  const handleSelectPatient = (patient: PatientRecord) => {
    setCurrentPatient(patient);
    showToast(`Switched active record to ${patient.name}`);
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  // Start Consultation action
  const handleStartConsultation = () => {
    try {
      if (currentPatient?.tokenNumber) {
        callSpecificTokenApi(currentPatient.tokenNumber).catch(() => {});
      }
    } catch (e) {}

    try {
      router.push({
        pathname: '/(doctor)/prescription' as any,
        params: {
          tokenNumber: String(currentPatient.tokenNumber || 29),
          patientName: currentPatient.name,
        },
      });
    } catch (e) {
      router.push('/prescription' as any);
    }

    if (typeof window !== 'undefined') {
      setTimeout(() => {
        if (!window.location.pathname.includes('prescription')) {
          window.location.href = `/(doctor)/prescription?tokenNumber=${currentPatient.tokenNumber || 29}&patientName=${encodeURIComponent(currentPatient.name)}`;
        }
      }, 100);
    }
  };

  // Tab navigation handler
  const handleTabPress = (tab: 'home' | 'queue' | 'records' | 'schedule' | 'rx') => {
    setActiveTab(tab);
    if (tab === 'home') {
      try {
        router.push('/(doctor)/dashboard' as any);
      } catch (e) {
        router.push('/dashboard' as any);
      }
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          if (!window.location.pathname.includes('dashboard')) {
            window.location.href = '/(doctor)/dashboard';
          }
        }, 120);
      }
    } else if (tab === 'queue') {
      try {
        router.push('/(doctor)/queue' as any);
      } catch (e) {
        router.push('/queue' as any);
      }
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          if (!window.location.pathname.includes('queue')) {
            window.location.href = '/(doctor)/queue';
          }
        }, 120);
      }
    } else if (tab === 'records') {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    } else if (tab === 'schedule') {
      try {
        router.push('/(doctor)/schedule' as any);
      } catch (e) {
        router.push('/schedule' as any);
      }
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          if (!window.location.pathname.includes('schedule')) {
            window.location.href = '/(doctor)/schedule';
          }
        }, 120);
      }
    } else if (tab === 'rx') {
      try {
        router.push('/(doctor)/prescription' as any);
      } catch (e) {
        router.push('/prescription' as any);
      }
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          if (!window.location.pathname.includes('prescription')) {
            window.location.href = '/(doctor)/prescription';
          }
        }, 120);
      }
    }
  };

  // Theme palettes
  const theme = {
    bg: isDark ? '#0c1418' : '#eef6f8',
    cardBg: isDark ? '#152229' : '#ffffff',
    cardBorder: isDark ? '#1f333d' : '#e2eef1',
    textMain: isDark ? '#f1f5f9' : '#0f172a',
    textMuted: isDark ? '#94a3b8' : '#64748b',
    primary: '#0b4f5a',
    primaryHover: '#0e6370',
    accent: '#0e8a96',
    tint: isDark ? '#163b42' : '#d9f2f5',
    inputBg: isDark ? '#182730' : '#ffffff',
    inputBorder: isDark ? '#263d4a' : '#d2e7ec',
    subCardBg: isDark ? '#1a2a33' : '#f8fafc',
  };

  // Helper to extract initials safely
  const getInitials = (name: string) => {
    if (!name) return 'PT';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <SafeAreaView style={[styles.outerContainer, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <Animated.View style={[styles.toastContainer, { opacity: toastOpacity }]}>
          <Ionicons name="information-circle" size={18} color="#ffffff" style={{ marginRight: 8 }} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}

      {/* Centered responsive container (max 440px on desktop) */}
      <View style={[styles.innerContainer, { backgroundColor: theme.bg }]}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ========================================================= */}
          {/* 1. HEADER                                                 */}
          {/* ========================================================= */}
          <View style={styles.headerRow}>
            <View style={styles.doctorInfoCol}>
              <View style={styles.doctorAvatarBox}>
                <Text style={styles.doctorAvatarInitials}>EE</Text>
                <View style={styles.greenOnlineDot} />
              </View>

              <View style={styles.doctorTextWrap}>
                <Text style={[styles.doctorName, { color: theme.textMain }]}>Dr. Emilia Emelson</Text>
                <Text style={[styles.doctorSubtitle, { color: theme.accent }]}>Room 3B online</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.bellBtn, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
              onPress={() => showToast('No pending clinical alerts.')}
              activeOpacity={0.7}
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={20} color={theme.textMain} />
              <View style={styles.redBadgeDot} />
            </TouchableOpacity>
          </View>

          {/* ========================================================= */}
          {/* 2. SEARCH BAR (PILL SHAPE)                                */}
          {/* ========================================================= */}
          <View
            style={[
              styles.searchBarWrap,
              { backgroundColor: theme.inputBg, borderColor: theme.inputBorder },
            ]}
          >
            <Ionicons name="search-outline" size={19} color={theme.textMuted} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: theme.textMain }]}
              placeholder="Search patient name, token or NIC..."
              placeholderTextColor={theme.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={theme.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* ========================================================= */}
          {/* 3. CURRENT PATIENT SECTION (TOP, ALWAYS VISIBLE)          */}
          {/* ========================================================= */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionMainHeading, { color: theme.textMain }]}>CURRENT PATIENT</Text>
            <View style={[styles.activeStatusPill, { backgroundColor: theme.tint }]}>
              <View style={[styles.smallPulseDot, { backgroundColor: theme.accent }]} />
              <Text style={[styles.activeStatusPillText, { color: theme.primary }]}>{currentPatient.status}</Text>
            </View>
          </View>

          {/* 3.1 Patient Main Identity Card */}
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View style={styles.patientTopRow}>
              <View style={styles.patientAvatar}>
                {currentPatient.photoUrl ? (
                  <Image source={{ uri: currentPatient.photoUrl }} style={styles.patientAvatarImg} />
                ) : (
                  <Text style={styles.patientInitials}>{getInitials(currentPatient.name)}</Text>
                )}
              </View>

              <View style={styles.patientDetailsCol}>
                <View style={styles.patientNameLine}>
                  <Text style={[styles.patientNameText, { color: theme.textMain }]}>
                    {String(currentPatient.name || '')}
                  </Text>
                  {currentPatient.verified && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark-circle" size={14} color="#059669" />
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.patientMetaText, { color: theme.textMuted }]}>
                  {currentPatient.age} yrs • {currentPatient.gender} • Blood: {currentPatient.bloodGroup}
                </Text>
              </View>

              {/* Prominent TOKEN box on the right */}
              <View style={styles.tokenBox}>
                <Text style={styles.tokenBoxLabel}>TOKEN</Text>
                <Text style={styles.tokenBoxValue}>{currentPatient.tokenFormatted}</Text>
              </View>
            </View>

            <View style={[styles.cardDivider, { backgroundColor: theme.cardBorder }]} />

            {/* Below Divider: NIC & Registered Time with small icons */}
            <View style={styles.patientBottomRow}>
              <View style={styles.metaRowItem}>
                <MaterialCommunityIcons name="card-account-details-outline" size={15} color={theme.textMuted} />
                <Text style={[styles.metaRowText, { color: theme.textMuted }]}>
                  NIC: {String(currentPatient.nic || '')}
                </Text>
              </View>

              <View style={styles.metaRowItem}>
                <Ionicons name="time-outline" size={15} color={theme.textMuted} />
                <Text style={[styles.metaRowText, { color: theme.textMuted }]}>
                  Registered: {String(currentPatient.registeredTime || '')}
                </Text>
              </View>
            </View>
          </View>

          {/* 3.2 Allergy Alert Card */}
          {currentPatient.allergy?.hasAllergy ? (
            <View style={styles.allergyCardRisk}>
              <View style={styles.allergyHeaderRow}>
                <MaterialCommunityIcons name="alert-octagon" size={20} color="#b91c1c" />
                <Text style={styles.allergyTitleRisk}>{currentPatient.allergy.title}</Text>
              </View>
              <Text style={styles.allergyDescRisk}>{currentPatient.allergy.description}</Text>
            </View>
          ) : (
            <View style={[styles.allergyCardCalm, { borderColor: isDark ? '#1e382b' : '#bbf7d0' }]}>
              <View style={styles.allergyHeaderRow}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#15803d" />
                <Text style={styles.allergyTitleCalm}>No known allergies</Text>
              </View>
              <Text style={styles.allergyDescCalm}>
                {currentPatient.allergy?.description || 'No documented drug or food allergies on clinical record.'}
              </Text>
            </View>
          )}

          {/* 3.3 Current Vitals Section (2x2 Grid) */}
          <View style={styles.subHeadingRow}>
            <Text style={[styles.subSectionTitle, { color: theme.textMain }]}>Current vitals</Text>
            <Text style={[styles.subSectionSubtitle, { color: theme.textMuted }]}>
              {currentPatient.vitals?.triageTime || 'Triage: Recent'}
            </Text>
          </View>

          <View style={styles.vitalsGrid}>
            {/* Blood Pressure */}
            <View style={[styles.vitalCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              <View style={styles.vitalIconHeader}>
                <View style={[styles.vitalIconCircle, { backgroundColor: '#fee2e2' }]}>
                  <MaterialCommunityIcons name="heart-pulse" size={17} color="#dc2626" />
                </View>
                <Text style={[styles.vitalLabel, { color: theme.textMuted }]}>Blood Pressure</Text>
              </View>
              <View style={styles.vitalValueRow}>
                <Text style={[styles.vitalValue, { color: theme.textMain }]}>
                  {currentPatient.vitals?.bloodPressure || '--/--'}
                </Text>
                <Text style={[styles.vitalUnit, { color: theme.textMuted }]}>
                  {currentPatient.vitals?.bloodPressureUnit || 'mmHg'}
                </Text>
              </View>
            </View>

            {/* Heart Rate */}
            <View style={[styles.vitalCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              <View style={styles.vitalIconHeader}>
                <View style={[styles.vitalIconCircle, { backgroundColor: '#fef3c7' }]}>
                  <Ionicons name="fitness-outline" size={16} color="#d97706" />
                </View>
                <Text style={[styles.vitalLabel, { color: theme.textMuted }]}>Heart Rate</Text>
              </View>
              <View style={styles.vitalValueRow}>
                <Text style={[styles.vitalValue, { color: theme.textMain }]}>
                  {currentPatient.vitals?.heartRate || '--'}
                </Text>
                <Text style={[styles.vitalUnit, { color: theme.textMuted }]}>
                  {currentPatient.vitals?.heartRateUnit || 'bpm'}
                </Text>
              </View>
            </View>

            {/* Body Temp */}
            <View style={[styles.vitalCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              <View style={styles.vitalIconHeader}>
                <View style={[styles.vitalIconCircle, { backgroundColor: '#e0f2fe' }]}>
                  <MaterialCommunityIcons name="thermometer" size={17} color="#0284c7" />
                </View>
                <Text style={[styles.vitalLabel, { color: theme.textMuted }]}>Body Temp</Text>
              </View>
              <View style={styles.vitalValueRow}>
                <Text style={[styles.vitalValue, { color: theme.textMain }]}>
                  {currentPatient.vitals?.bodyTemp || '--'}
                </Text>
                <Text style={[styles.vitalUnit, { color: theme.textMuted }]}>
                  {currentPatient.vitals?.bodyTempUnit || '°F'}
                </Text>
              </View>
            </View>

            {/* Oxygen Sat (SpO2) with green "Normal" badge */}
            <View style={[styles.vitalCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              <View style={styles.vitalIconHeader}>
                <View style={[styles.vitalIconCircle, { backgroundColor: '#dcfce7' }]}>
                  <MaterialCommunityIcons name="lungs" size={17} color="#16a34a" />
                </View>
                <Text style={[styles.vitalLabel, { color: theme.textMuted }]}>Oxygen Sat (SpO2)</Text>
              </View>
              <View style={styles.vitalValueRow}>
                <Text style={[styles.vitalValue, { color: theme.textMain }]}>
                  {currentPatient.vitals?.spO2 || '99%'}
                </Text>
                <View style={styles.normalPillBadge}>
                  <Text style={styles.normalPillText}>{currentPatient.vitals?.spO2Status || 'Normal'}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 3.4 Diagnostic Imaging Section */}
          <View style={styles.subHeadingRow}>
            <Text style={[styles.subSectionTitle, { color: theme.textMain }]}>Diagnostic imaging</Text>
            <Text style={[styles.subSectionSubtitle, { color: theme.textMuted }]}>
              {currentPatient.imaging?.hasImaging
                ? currentPatient.imaging.subtitle || 'Recent'
                : 'No imaging on file'}
            </Text>
          </View>

          {currentPatient.imaging?.hasImaging ? (
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              <View style={styles.imagingCardRow}>
                <View style={styles.imagingThumbnailBox}>
                  {currentPatient.imaging.imageUrl ? (
                    <Image source={{ uri: currentPatient.imaging.imageUrl }} style={styles.imagingThumbnailImg} />
                  ) : (
                    <MaterialCommunityIcons name="image-outline" size={24} color="#0e8a96" />
                  )}
                  <View style={styles.imagingScanIconOverlay}>
                    <MaterialCommunityIcons name="scan-helper" size={14} color="#ffffff" />
                  </View>
                </View>

                <View style={styles.imagingInfoCol}>
                  <Text style={[styles.imagingTitle, { color: theme.textMain }]}>
                    {currentPatient.imaging.title || 'Diagnostic Imaging'}
                  </Text>
                  <Text style={[styles.imagingDesc, { color: theme.textMuted }]}>
                    {currentPatient.imaging.description || 'Radiology Suite'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.viewReportBtn}
                  onPress={() => setIsReportModalOpen(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.viewReportBtnText}>View report</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={[styles.emptyImagingCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              <MaterialCommunityIcons name="image-off-outline" size={24} color={theme.textMuted} style={{ marginBottom: 6 }} />
              <Text style={[styles.emptyImagingText, { color: theme.textMuted }]}>
                No imaging records on file for this patient.
              </Text>
            </View>
          )}

          {/* 3.5 Recent Visits & History Section */}
          <View style={styles.subHeadingRow}>
            <Text style={[styles.subSectionTitle, { color: theme.textMain }]}>Recent visits & history</Text>
            <TouchableOpacity onPress={() => setIsAllHistoryModalOpen(true)}>
              <Text style={[styles.subSectionSubtitleLink, { color: theme.accent }]}>
                All {currentPatient.recentVisits?.length || 0} Records
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, paddingVertical: 6 }]}>
            {(currentPatient.recentVisits || []).map((visit, index) => {
              const isLast = index === (currentPatient.recentVisits || []).length - 1;
              return (
                <View key={visit.id}>
                  <View style={styles.visitRow}>
                    <View style={[styles.visitIconWrap, { backgroundColor: theme.tint }]}>
                      <MaterialCommunityIcons
                        name={(visit.icon as any) || 'medical-bag'}
                        size={18}
                        color={theme.primary}
                      />
                    </View>

                    <View style={styles.visitDetailsCol}>
                      <View style={styles.visitTitleRow}>
                        <Text style={[styles.visitTitle, { color: theme.textMain }]}>
                          {visit.title}
                        </Text>
                        <Text style={[styles.visitDate, { color: theme.textMuted }]}>
                          {visit.date}
                        </Text>
                      </View>

                      <Text style={[styles.visitDesc, { color: theme.textMuted }]}>
                        {visit.details}
                      </Text>

                      {visit.statusBadge && (
                        <View style={styles.resolvedPill}>
                          <Ionicons name="checkmark-circle" size={11} color="#047857" style={{ marginRight: 3 }} />
                          <Text style={styles.resolvedPillText}>{visit.statusBadge}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {!isLast && <View style={[styles.visitDivider, { backgroundColor: theme.cardBorder }]} />}
                </View>
              );
            })}
          </View>

          {/* 3.6 Full-Width Dark Teal Pill Button: Start Consultation */}
          <TouchableOpacity
            style={styles.startConsultationBtn}
            onPress={handleStartConsultation}
            activeOpacity={0.88}
          >
            <MaterialCommunityIcons name="stethoscope" size={22} color="#ffffff" style={{ marginRight: 10 }} />
            <Text style={styles.startConsultationBtnText}>
              Start consultation with {currentPatient.shortName || currentPatient.name.split(' ')[0]}
            </Text>
          </TouchableOpacity>

          {/* ========================================================= */}
          {/* 4. ALL PATIENTS SECTION                                   */}
          {/* ========================================================= */}
          <View style={[styles.allPatientsHeaderRow, { borderTopColor: theme.cardBorder }]}>
            <View>
              <Text style={[styles.sectionMainHeading, { color: theme.textMain }]}>All patients</Text>
              <Text style={[styles.patientCountSub, { color: theme.textMuted }]}>
                {filteredPatients.length} of {ALL_DUMMY_PATIENTS.length} available
              </Text>
            </View>
          </View>

          {/* Filter Chips: All, Waiting, In consultation, Seen */}
          <View style={styles.filterChipsRow}>
            {(['All', 'Waiting', 'In consultation', 'Seen'] as PatientStatus[]).map((status) => {
              const isActive = statusFilter === status;
              return (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.filterChip,
                    isActive
                      ? { backgroundColor: theme.primary, borderColor: theme.primary }
                      : { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
                  ]}
                  onPress={() => setStatusFilter(status)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      isActive ? { color: '#ffffff' } : { color: theme.textMuted },
                    ]}
                  >
                    {status}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Patient Rows List */}
          <View style={styles.patientListContainer}>
            {filteredPatients.map((patient) => {
              const isCurrent = patient.id === currentPatient.id;
              const hasAllergy = patient.allergy?.hasAllergy;

              // Status Pill colors
              let statusBg = '#f1f5f9';
              let statusColor = '#475569';
              if (patient.status === 'Waiting') {
                statusBg = '#fef3c7';
                statusColor = '#b45309';
              } else if (patient.status === 'In consultation') {
                statusBg = '#dcfce7';
                statusColor = '#15803d';
              } else if (patient.status === 'Seen') {
                statusBg = '#e2e8f0';
                statusColor = '#64748b';
              }

              return (
                <TouchableOpacity
                  key={patient.id}
                  style={[
                    styles.patientRowCard,
                    {
                      backgroundColor: theme.cardBg,
                      borderColor: isCurrent ? theme.accent : theme.cardBorder,
                      borderWidth: isCurrent ? 2 : 1,
                    },
                  ]}
                  onPress={() => handleSelectPatient(patient)}
                  activeOpacity={0.85}
                >
                  {/* Initials Avatar */}
                  <View style={[styles.listAvatarBox, { backgroundColor: isCurrent ? theme.tint : '#e2e8f0' }]}>
                    <Text style={[styles.listAvatarText, { color: isCurrent ? theme.primary : '#334155' }]}>
                      {getInitials(patient.name)}
                    </Text>
                  </View>

                  {/* Middle Info */}
                  <View style={styles.listPatientInfoCol}>
                    <View style={styles.listPatientNameRow}>
                      <Text style={[styles.listPatientName, { color: theme.textMain }]} numberOfLines={1}>
                        {patient.name}
                      </Text>
                      {hasAllergy && (
                        <MaterialCommunityIcons
                          name="alert-circle"
                          size={15}
                          color="#dc2626"
                          style={{ marginLeft: 5 }}
                        />
                      )}
                    </View>

                    <Text style={[styles.listPatientMeta, { color: theme.textMuted }]}>
                      {patient.age} yrs • {patient.gender}
                    </Text>
                  </View>

                  {/* Right side: Token Number and Status Pill */}
                  <View style={styles.listPatientRightCol}>
                    <Text style={[styles.listTokenNumber, { color: theme.primary }]}>
                      {patient.tokenFormatted}
                    </Text>
                    <View style={[styles.listStatusPill, { backgroundColor: statusBg }]}>
                      <Text style={[styles.listStatusPillText, { color: statusColor }]}>
                        {patient.status}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Empty state when search finds nothing */}
            {filteredPatients.length === 0 && (
              <View style={[styles.emptySearchCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                <Ionicons name="search-outline" size={36} color={theme.textMuted} style={{ marginBottom: 10 }} />
                <Text style={[styles.emptySearchTitle, { color: theme.textMain }]}>No patients found</Text>
                <Text style={[styles.emptySearchDesc, { color: theme.textMuted }]}>
                  No patients match "{searchQuery}". Please check the patient's name, token number (#), or NIC.
                </Text>
                <TouchableOpacity
                  style={[styles.clearSearchBtn, { backgroundColor: theme.primary }]}
                  onPress={() => {
                    setSearchQuery('');
                    setStatusFilter('All');
                  }}
                >
                  <Text style={styles.clearSearchBtnText}>Reset Search & Filters</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* ========================================================= */}
        {/* 5. FIXED BOTTOM NAVIGATION BAR (5 TABS)                   */}
        {/* ========================================================= */}
        <View style={[styles.bottomTabBar, { backgroundColor: theme.cardBg, borderTopColor: theme.cardBorder }]}>
          {/* Home */}
          <TouchableOpacity style={styles.tabItem} onPress={() => handleTabPress('home')}>
            <Ionicons name="home-outline" size={22} color={activeTab === 'home' ? '#0d6371' : '#64748b'} />
            <Text style={[styles.tabLabel, activeTab === 'home' && styles.tabLabelActive]}>Home</Text>
          </TouchableOpacity>

          {/* Queue */}
          <TouchableOpacity style={styles.tabItem} onPress={() => handleTabPress('queue')}>
            <MaterialCommunityIcons
              name="ticket-confirmation-outline"
              size={23}
              color={activeTab === 'queue' ? '#0d6371' : '#64748b'}
            />
            <Text style={[styles.tabLabel, activeTab === 'queue' && styles.tabLabelActive]}>Queue</Text>
          </TouchableOpacity>

          {/* Records (ACTIVE) */}
          <TouchableOpacity style={styles.tabItem} onPress={() => handleTabPress('records')}>
            <MaterialCommunityIcons
              name="folder-account-outline"
              size={23}
              color={activeTab === 'records' ? '#0d6371' : '#64748b'}
            />
            <Text style={[styles.tabLabel, activeTab === 'records' && styles.tabLabelActive]}>Records</Text>
          </TouchableOpacity>

          {/* Schedule */}
          <TouchableOpacity style={styles.tabItem} onPress={() => handleTabPress('schedule')}>
            <MaterialCommunityIcons
              name="calendar-month-outline"
              size={22}
              color={activeTab === 'schedule' ? '#0d6371' : '#64748b'}
            />
            <Text style={[styles.tabLabel, activeTab === 'schedule' && styles.tabLabelActive]}>Schedule</Text>
          </TouchableOpacity>

          {/* Prescription */}
          <TouchableOpacity style={styles.tabItem} onPress={() => handleTabPress('rx')}>
            <MaterialCommunityIcons
              name="clipboard-edit-outline"
              size={22}
              color={activeTab === 'rx' ? '#0d6371' : '#64748b'}
            />
            <Text
              numberOfLines={1}
              style={[styles.tabLabel, activeTab === 'rx' && styles.tabLabelActive]}
            >
              Prescription
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ========================================================= */}
      {/* MODAL 1: DIAGNOSTIC IMAGING REPORT                        */}
      {/* ========================================================= */}
      <Modal visible={isReportModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textMain }]}>Diagnostic Imaging Report</Text>
              <TouchableOpacity onPress={() => setIsReportModalOpen(false)}>
                <Ionicons name="close" size={24} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            {currentPatient.imaging?.imageUrl && (
              <Image source={{ uri: currentPatient.imaging.imageUrl }} style={styles.modalReportImage} />
            )}

            <Text style={[styles.modalImageTitle, { color: theme.textMain }]}>
              {currentPatient.imaging?.title || 'Report'}
            </Text>
            <Text style={[styles.modalImageSubtitle, { color: theme.textMuted }]}>
              {currentPatient.imaging?.description || ''}
            </Text>

            <View style={styles.reportFindingsBox}>
              <Text style={styles.reportFindingsHeader}>Findings & Clinical Impression:</Text>
              <Text style={styles.reportFindingsText}>
                {currentPatient.imaging?.reportSummary || 'Examination completed. No active displacement noted.'}
              </Text>
            </View>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsReportModalOpen(false)}>
              <Text style={styles.modalCloseBtnText}>Close Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 2: ALL MEDICAL RECORDS ARCHIVE                      */}
      {/* ========================================================= */}
      <Modal visible={isAllHistoryModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textMain }]}>Medical History Archive</Text>
              <TouchableOpacity onPress={() => setIsAllHistoryModalOpen(false)}>
                <Ionicons name="close" size={24} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSub, { color: theme.textMuted }]}>
              Clinical episodes for {currentPatient.name} ({currentPatient.tokenFormatted}):
            </Text>

            <ScrollView style={{ maxHeight: 360 }}>
              {(currentPatient.recentVisits || []).map((item) => (
                <View key={item.id} style={[styles.archiveItem, { borderColor: theme.cardBorder }]}>
                  <View style={styles.archiveHeaderRow}>
                    <Text style={[styles.archiveTitle, { color: theme.textMain }]}>{item.title}</Text>
                    <Text style={[styles.archiveDate, { color: theme.textMuted }]}>{item.date}</Text>
                  </View>
                  <Text style={[styles.archiveDetails, { color: theme.textMuted }]}>{item.details}</Text>
                  {item.statusBadge && (
                    <View style={styles.resolvedPill}>
                      <Text style={styles.resolvedPillText}>{item.statusBadge}</Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsAllHistoryModalOpen(false)}>
              <Text style={styles.modalCloseBtnText}>Close Archive</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Desktop-centered wrapper: max-width 440px
  outerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    position: 'relative',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },

  // Floating Toast Notification
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 16 : 48,
    alignSelf: 'center',
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b4f5a',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  toastText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },

  // 1. Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 12,
  },
  doctorInfoCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  doctorAvatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0b4f5a',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: 'rgba(11, 79, 90, 0.25)',
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  doctorAvatarInitials: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
  },
  greenOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#10b981',
    borderWidth: 2.5,
    borderColor: '#ffffff',
  },
  doctorTextWrap: {
    marginLeft: 12,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  doctorSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
    shadowColor: 'rgba(0, 0, 0, 0.05)',
    shadowOpacity: 1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  redBadgeDot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },

  // 2. Search Bar
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 16,
    shadowColor: 'rgba(11, 79, 90, 0.04)',
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 8,
  },

  // Headings
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionMainHeading: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  activeStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  smallPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  activeStatusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Reusable Cards with 18-20px rounded corners
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    shadowColor: 'rgba(11, 79, 90, 0.05)',
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  // 3.1 Patient Main Card
  patientTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  patientAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0b4f5a',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  patientAvatarImg: {
    width: '100%',
    height: '100%',
  },
  patientInitials: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 17,
  },
  patientDetailsCol: {
    flex: 1,
    marginLeft: 12,
  },
  patientNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  patientNameText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  patientMetaText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
  },
  tokenBox: {
    backgroundColor: '#0b4f5a',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(11, 79, 90, 0.3)',
    shadowOpacity: 1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  tokenBoxLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#d9f2f5',
    letterSpacing: 0.5,
  },
  tokenBoxValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 1,
  },
  cardDivider: {
    height: 1,
    marginVertical: 12,
  },
  patientBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaRowText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // 3.2 Allergy Card
  allergyCardRisk: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  allergyCardCalm: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  allergyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  allergyTitleRisk: {
    fontSize: 13,
    fontWeight: '800',
    color: '#b91c1c',
  },
  allergyDescRisk: {
    fontSize: 12,
    color: '#991b1b',
    fontWeight: '500',
    lineHeight: 17,
  },
  allergyTitleCalm: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803d',
  },
  allergyDescCalm: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '500',
  },

  // Subheadings
  subHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  subSectionSubtitle: {
    fontSize: 11,
    fontWeight: '600',
  },
  subSectionSubtitleLink: {
    fontSize: 11,
    fontWeight: '700',
  },

  // 3.3 Vitals 2x2 Grid
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  vitalCard: {
    width: '48%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  vitalIconHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  vitalIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vitalLabel: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  vitalValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  vitalValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  vitalUnit: {
    fontSize: 11,
    fontWeight: '600',
  },
  normalPillBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  normalPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803d',
  },

  // 3.4 Diagnostic Imaging
  imagingCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imagingThumbnailBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  imagingThumbnailImg: {
    width: '100%',
    height: '100%',
  },
  imagingScanIconOverlay: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#0b4f5a',
    borderRadius: 4,
    padding: 2,
  },
  imagingInfoCol: {
    flex: 1,
    marginLeft: 12,
  },
  imagingTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  imagingDesc: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  viewReportBtn: {
    backgroundColor: '#d9f2f5',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  viewReportBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0b4f5a',
  },
  emptyImagingCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyImagingText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },

  // 3.5 Recent Visits
  visitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  visitIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  visitDetailsCol: {
    flex: 1,
  },
  visitTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  visitTitle: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    marginRight: 6,
  },
  visitDate: {
    fontSize: 11,
    fontWeight: '600',
  },
  visitDesc: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    marginTop: 2,
  },
  visitDivider: {
    height: 1,
  },
  resolvedPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 6,
  },
  resolvedPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },

  // 3.6 Full-Width Start Consultation Pill Button
  startConsultationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b4f5a',
    borderRadius: 26,
    paddingVertical: 15,
    marginTop: 6,
    marginBottom: 20,
    shadowColor: 'rgba(11, 79, 90, 0.3)',
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  startConsultationBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },

  // 4. All Patients Section
  allPatientsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 18,
    borderTopWidth: 1,
    marginBottom: 12,
  },
  patientCountSub: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  patientListContainer: {
    gap: 10,
  },
  patientRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 12,
    shadowColor: 'rgba(0, 0, 0, 0.03)',
    shadowOpacity: 1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  listAvatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listAvatarText: {
    fontSize: 15,
    fontWeight: '800',
  },
  listPatientInfoCol: {
    flex: 1,
    marginLeft: 12,
  },
  listPatientNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listPatientName: {
    fontSize: 14,
    fontWeight: '700',
  },
  listPatientMeta: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  listPatientRightCol: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  listTokenNumber: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  listStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  listStatusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Empty Search State
  emptySearchCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    marginTop: 6,
  },
  emptySearchTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySearchDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  clearSearchBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  clearSearchBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },

  // 5. Fixed Bottom Navigation Bar
  bottomTabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    elevation: 8,
    shadowColor: 'rgba(0, 0, 0, 0.06)',
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
  },
  tabItem: {
    alignItems: 'center',
    flex: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 4,
  },
  tabLabelActive: {
    color: '#0d6371',
    fontWeight: '700',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 22,
    padding: 22,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 12,
    marginBottom: 14,
  },
  modalReportImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#e2e8f0',
  },
  modalImageTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  modalImageSubtitle: {
    fontSize: 12,
    marginBottom: 12,
  },
  reportFindingsBox: {
    backgroundColor: '#f0fdfa',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#0e8a96',
  },
  reportFindingsHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0b4f5a',
    marginBottom: 4,
  },
  reportFindingsText: {
    fontSize: 12,
    color: '#134e4a',
    lineHeight: 17,
  },
  modalCloseBtn: {
    backgroundColor: '#0b4f5a',
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  modalCloseBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  archiveItem: {
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  archiveHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  archiveTitle: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  archiveDate: {
    fontSize: 11,
    fontWeight: '600',
  },
  archiveDetails: {
    fontSize: 12,
    lineHeight: 16,
  },
});
