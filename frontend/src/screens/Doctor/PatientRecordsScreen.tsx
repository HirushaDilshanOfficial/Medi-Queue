import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Image,
  Alert,
  Modal,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  fetchPatientRecordsApi,
  PatientRecord,
  fallbackAureliaRecord,
  QUICK_PATIENTS_LIST,
} from '../../services/patientRecordsService';

export default function PatientRecordsScreen() {
  const [data, setData] = useState<PatientRecord>(fallbackAureliaRecord);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('Aurelia Sisca');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'queue' | 'records' | 'schedule' | 'rx'>('records');
  const [showAllHistory, setShowAllHistory] = useState(false);

  // Modal states
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isAllHistoryModalOpen, setIsAllHistoryModalOpen] = useState(false);

  const loadRecord = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const res = await fetchPatientRecordsApi(query);
      setData(res);
    } catch (err) {
      console.log('Error loading patient record:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecord('Aurelia');
  }, [loadRecord]);

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
      // already on records
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

  // Select patient from quick list
  const handleSelectPatient = (name: string) => {
    setSearchQuery(name);
    setShowSearchDropdown(false);
    loadRecord(name);
  };

  // Start Consultation Action
  const handleStartConsultation = () => {
    Alert.alert(
      `Start Consultation with ${data.shortName || data.name}`,
      `Call Token ${data.tokenFormatted} into Room 3B and open outpatient consultation?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Begin Consultation',
          onPress: () => {
            try {
              router.push('/(doctor)/prescription' as any);
            } catch (e) {
              router.push('/prescription' as any);
            }
          },
        },
      ]
    );
  };

  const visibleVisits = showAllHistory ? data.recentVisits : data.recentVisits.slice(0, 2);

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#f4f9fc" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ========================================================= */}
        {/* 1. TOP PROFILE BAR                                        */}
        {/* ========================================================= */}
        <View style={styles.topProfileBar}>
          <View style={styles.profileLeft}>
            <View style={styles.avatarContainer}>
              <Image
                source={{
                  uri: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=200',
                }}
                style={styles.doctorAvatarImg}
              />
              <View style={styles.onlineDotOnAvatar} />
            </View>

            <View style={styles.profileTextWrap}>
              <Text style={styles.profileDoctorName}>Dr. Emilia Emelson</Text>
              <View style={styles.onlineBadgeRow}>
                <View style={styles.onlineGreenDot} />
                <Text style={styles.onlineBadgeText}>Room 3B Online</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => Alert.alert('Notifications', 'No pending clinical alerts.')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={21} color="#334155" />
            <View style={styles.redBadgeDot} />
          </TouchableOpacity>
        </View>

        {/* ========================================================= */}
        {/* 2. SEARCH BAR                                             */}
        {/* ========================================================= */}
        <View style={styles.searchBarWrap}>
          <View style={styles.searchInputCard}>
            <Ionicons name="search-outline" size={20} color="#0d6371" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search patient name, token or NIC..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                setShowSearchDropdown(true);
              }}
              onFocus={() => setShowSearchDropdown(true)}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setShowSearchDropdown(false);
                }}
                style={styles.clearSearchBtn}
              >
                <Ionicons name="close-circle" size={19} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Quick autocomplete dropdown */}
          {showSearchDropdown && (
            <View style={styles.searchDropdown}>
              {QUICK_PATIENTS_LIST.map((p) => (
                <TouchableOpacity
                  key={p.token}
                  style={styles.dropdownItem}
                  onPress={() => handleSelectPatient(p.name)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons
                      name="account-outline"
                      size={17}
                      color="#0d6371"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.dropdownName}>{p.name}</Text>
                  </View>
                  <View style={styles.dropdownBadge}>
                    <Text style={styles.dropdownBadgeText}>{p.token}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ========================================================= */}
        {/* 3. PATIENT SUMMARY CARD                                    */}
        {/* ========================================================= */}
        <View style={styles.patientCard}>
          {/* Top row: Avatar, Info, Token */}
          <View style={styles.patientCardTopRow}>
            <Image source={{ uri: data.photoUrl }} style={styles.patientPhoto} />

            <View style={styles.patientInfoCol}>
              <View style={styles.patientNameRow}>
                <Text style={styles.patientNameText}>{data.name}</Text>
                {data.verified && (
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedBadgeText}>Verified</Text>
                  </View>
                )}
              </View>

              <Text style={styles.patientSubMeta}>
                {data.age} yrs • {data.gender} • Blood: {data.bloodGroup}
              </Text>
            </View>

            {/* Token Badge */}
            <View style={styles.tokenBox}>
              <Text style={styles.tokenLabel}>TOKEN</Text>
              <Text style={styles.tokenNumber}>{data.tokenFormatted}</Text>
            </View>
          </View>

          {/* Bottom row: NIC & Registration info */}
          <View style={styles.patientCardBottomRow}>
            <View style={styles.metaItemRow}>
              <MaterialCommunityIcons
                name="card-account-details-outline"
                size={16}
                color="#0d6371"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.metaItemText}>NIC: {data.nic}</Text>
            </View>

            <View style={styles.metaItemRow}>
              <MaterialCommunityIcons
                name="calendar-clock-outline"
                size={16}
                color="#0d6371"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.metaItemText}>Registered: {data.registeredTime}</Text>
            </View>
          </View>
        </View>

        {/* ========================================================= */}
        {/* 4. HIGH RISK ALLERGY ALERT CARD                           */}
        {/* ========================================================= */}
        {data.allergy && (
          <View style={styles.allergyCard}>
            <View style={styles.allergyIconCircle}>
              <MaterialCommunityIcons name="alert" size={20} color="#dc2626" />
            </View>

            <View style={styles.allergyTextWrap}>
              <Text style={styles.allergyTitle}>{data.allergy.title}</Text>
              <Text style={styles.allergyDesc}>{data.allergy.description}</Text>
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* 5. CURRENT VITALS SECTION (2x2 GRID)                      */}
        {/* ========================================================= */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>CURRENT VITALS</Text>
          <Text style={styles.sectionSubLink}>{data.vitals.triageTime}</Text>
        </View>

        <View style={styles.vitalsGrid}>
          {/* Card 1: Blood Pressure */}
          <View style={styles.vitalCard}>
            <View style={[styles.vitalIconSquare, { backgroundColor: '#e0f2fe' }]}>
              <MaterialCommunityIcons name="gauge" size={20} color="#0284c7" />
            </View>
            <View style={styles.vitalTextCol}>
              <Text style={styles.vitalCardLabel}>Blood Pressure</Text>
              <View style={styles.vitalValueRow}>
                <Text style={styles.vitalCardValue}>{data.vitals.bloodPressure}</Text>
                <Text style={styles.vitalCardUnit}> {data.vitals.bloodPressureUnit}</Text>
              </View>
            </View>
          </View>

          {/* Card 2: Heart Rate */}
          <View style={styles.vitalCard}>
            <View style={[styles.vitalIconSquare, { backgroundColor: '#e0f7fa' }]}>
              <MaterialCommunityIcons name="heart" size={20} color="#0d9488" />
            </View>
            <View style={styles.vitalTextCol}>
              <Text style={styles.vitalCardLabel}>Heart Rate</Text>
              <View style={styles.vitalValueRow}>
                <Text style={styles.vitalCardValue}>{data.vitals.heartRate}</Text>
                <Text style={styles.vitalCardUnit}> {data.vitals.heartRateUnit}</Text>
              </View>
            </View>
          </View>

          {/* Card 3: Body Temp */}
          <View style={styles.vitalCard}>
            <View style={[styles.vitalIconSquare, { backgroundColor: '#e0f2fe' }]}>
              <MaterialCommunityIcons name="thermometer" size={20} color="#0284c7" />
            </View>
            <View style={styles.vitalTextCol}>
              <Text style={styles.vitalCardLabel}>Body Temp</Text>
              <View style={styles.vitalValueRow}>
                <Text style={styles.vitalCardValue}>{data.vitals.bodyTemp}</Text>
                <Text style={styles.vitalCardUnit}> {data.vitals.bodyTempUnit}</Text>
              </View>
            </View>
          </View>

          {/* Card 4: Oxygen Saturation */}
          <View style={styles.vitalCard}>
            <View style={[styles.vitalIconSquare, { backgroundColor: '#e0f7fa' }]}>
              <MaterialCommunityIcons name="weather-windy" size={20} color="#0d9488" />
            </View>
            <View style={styles.vitalTextCol}>
              <Text style={styles.vitalCardLabel}>Oxygen Sat (SpO2)</Text>
              <View style={styles.vitalValueRow}>
                <Text style={styles.vitalCardValue}>{data.vitals.spO2}</Text>
                <Text style={styles.vitalNormalTag}> {data.vitals.spO2Status}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ========================================================= */}
        {/* 6. DIAGNOSTIC IMAGING                                     */}
        {/* ========================================================= */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>DIAGNOSTIC IMAGING</Text>
          <Text style={styles.sectionSubMuted}>{data.imaging.subtitle}</Text>
        </View>

        <View style={styles.imagingCard}>
          {/* X-Ray Image Preview with Scan Overlay */}
          <View style={styles.xrayThumbnailWrap}>
            <Image source={{ uri: data.imaging.imageUrl }} style={styles.xrayThumbnail} />
            <View style={styles.xrayOverlayIcon}>
              <MaterialCommunityIcons name="crop-free" size={20} color="#ffffff" />
            </View>
          </View>

          {/* Imaging Meta */}
          <View style={styles.imagingInfoWrap}>
            <Text style={styles.imagingTitle}>{data.imaging.title}</Text>
            <Text style={styles.imagingDesc}>{data.imaging.description}</Text>
          </View>

          {/* View Report Button */}
          <TouchableOpacity
            style={styles.viewReportBtn}
            onPress={() => setIsReportModalOpen(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.viewReportBtnText}>View Report</Text>
          </TouchableOpacity>
        </View>

        {/* ========================================================= */}
        {/* 7. RECENT VISITS & HISTORY                                */}
        {/* ========================================================= */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>RECENT VISITS & HISTORY</Text>
          <TouchableOpacity onPress={() => setIsAllHistoryModalOpen(true)}>
            <Text style={styles.sectionSubLink}>All {data.recentVisits.length} Records</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.visitsListCard}>
          {visibleVisits.map((visit, index) => {
            const isFirst = index === 0;
            return (
              <View
                key={visit.id}
                style={[
                  styles.visitItemRow,
                  index > 0 && styles.visitItemBorderTop,
                ]}
              >
                {/* Round Icon */}
                <View style={styles.visitIconBox}>
                  <MaterialCommunityIcons
                    name={(visit.icon || (isFirst ? 'doctor' : 'shield-plus-outline')) as any}
                    size={20}
                    color="#0d6371"
                  />
                </View>

                {/* Visit Information */}
                <View style={styles.visitInfoCol}>
                  <View style={styles.visitTitleRow}>
                    <Text style={styles.visitTitleText}>{visit.title}</Text>
                    <Text style={styles.visitDateText}>{visit.date}</Text>
                  </View>

                  <View style={styles.visitDetailsRow}>
                    <Text style={styles.visitDetailsText}>{visit.details}</Text>
                    {visit.statusBadge && (
                      <View style={styles.statusBadge}>
                        <Text style={styles.statusBadgeText}>{visit.statusBadge}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* ========================================================= */}
        {/* 8. START CONSULTATION ACTION BUTTON                       */}
        {/* ========================================================= */}
        <TouchableOpacity
          style={styles.startConsultationBtn}
          onPress={handleStartConsultation}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons
            name="stethoscope"
            size={22}
            color="#ffffff"
            style={{ marginRight: 10 }}
          />
          <Text style={styles.startConsultationBtnText}>
            Start Consultation with {data.shortName || data.name}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ========================================================= */}
      {/* 9. BOTTOM NAVIGATION BAR (5 TABS)                         */}
      {/* ========================================================= */}
      <View style={styles.bottomTabBar}>
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

      {/* ========================================================= */}
      {/* MODAL 1: VIEW RADIOLOGY REPORT                           */}
      {/* ========================================================= */}
      <Modal visible={isReportModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Radiology Report</Text>
              <TouchableOpacity onPress={() => setIsReportModalOpen(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Image source={{ uri: data.imaging.imageUrl }} style={styles.reportImageLarge} />

            <Text style={styles.reportImageTitle}>{data.imaging.title}</Text>
            <Text style={styles.reportRadiologist}>{data.imaging.description}</Text>

            <View style={styles.reportFindingsBox}>
              <Text style={styles.reportFindingsHeader}>Findings & Impression:</Text>
              <Text style={styles.reportFindingsText}>{data.imaging.reportSummary}</Text>
            </View>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setIsReportModalOpen(false)}
            >
              <Text style={styles.modalCloseBtnText}>Close Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 2: ALL MEDICAL RECORDS ARCHIVE                     */}
      {/* ========================================================= */}
      <Modal visible={isAllHistoryModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Medical History Archive</Text>
              <TouchableOpacity onPress={() => setIsAllHistoryModalOpen(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              All documented clinical episodes for {data.name} (Token {data.tokenFormatted}):
            </Text>

            <ScrollView style={{ maxHeight: 340 }}>
              {data.recentVisits.map((item) => (
                <View key={item.id} style={styles.archiveItem}>
                  <View style={styles.archiveHeaderRow}>
                    <Text style={styles.archiveTitle}>{item.title}</Text>
                    <Text style={styles.archiveDate}>{item.date}</Text>
                  </View>
                  <Text style={styles.archiveDetails}>{item.details}</Text>
                  {item.statusBadge && (
                    <View style={styles.archiveBadge}>
                      <Text style={styles.archiveBadgeText}>{item.statusBadge}</Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setIsAllHistoryModalOpen(false)}
            >
              <Text style={styles.modalCloseBtnText}>Close Archive</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#f4f9fc',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
  },

  // 1. TOP PROFILE BAR
  topProfileBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 8,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  doctorAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: '#e2e8f0',
  },
  onlineDotOnAvatar: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  profileTextWrap: {
    marginLeft: 10,
  },
  profileDoctorName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  onlineBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 5,
  },
  onlineBadgeText: {
    fontSize: 12,
    color: '#0d7685',
    fontWeight: '600',
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    position: 'relative',
    elevation: 2,
    shadowColor: 'rgba(0, 0, 0, 0.04)',
    shadowOpacity: 1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  redBadgeDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },

  // 2. SEARCH BAR
  searchBarWrap: {
    marginBottom: 14,
    position: 'relative',
    zIndex: 10,
  },
  searchInputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
    shadowColor: 'rgba(15, 23, 42, 0.04)',
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
  },
  clearSearchBtn: {
    padding: 4,
  },
  searchDropdown: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 6,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOpacity: 1,
    shadowRadius: 10,
    overflow: 'hidden',
    zIndex: 20,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  dropdownBadge: {
    backgroundColor: '#e0f7fa',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  dropdownBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0d6371',
  },

  // 3. PATIENT SUMMARY CARD
  patientCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9f1f5',
    elevation: 2,
    shadowColor: 'rgba(15, 23, 42, 0.05)',
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  patientCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  patientPhoto: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#e2e8f0',
    marginRight: 12,
  },
  patientInfoCol: {
    flex: 1,
  },
  patientNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  patientNameText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  verifiedBadge: {
    backgroundColor: '#cffafe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0891b2',
  },
  patientSubMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500',
  },
  tokenBox: {
    backgroundColor: '#f0f9fa',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0f7fa',
  },
  tokenLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0e7490',
    letterSpacing: 0.5,
  },
  tokenNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0d6371',
  },
  patientCardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  metaItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaItemText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },

  // 4. HIGH RISK ALLERGY ALERT CARD
  allergyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fee2e2',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  allergyIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  allergyTextWrap: {
    flex: 1,
  },
  allergyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#dc2626',
    marginBottom: 3,
  },
  allergyDesc: {
    fontSize: 11,
    color: '#991b1b',
    lineHeight: 16,
    fontWeight: '500',
  },

  // 5. CURRENT VITALS SECTION
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  sectionSubLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0d7685',
  },
  sectionSubMuted: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  vitalCard: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#edf3f6',
    elevation: 2,
    shadowColor: 'rgba(15, 23, 42, 0.04)',
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  vitalIconSquare: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  vitalTextCol: {
    flex: 1,
  },
  vitalCardLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 2,
  },
  vitalValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  vitalCardValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  vitalCardUnit: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  vitalNormalTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },

  // 6. DIAGNOSTIC IMAGING
  imagingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#edf3f6',
    elevation: 2,
    shadowColor: 'rgba(15, 23, 42, 0.04)',
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  xrayThumbnailWrap: {
    position: 'relative',
    width: 48,
    height: 48,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: '#0f172a',
  },
  xrayThumbnail: {
    width: '100%',
    height: '100%',
    opacity: 0.85,
  },
  xrayOverlayIcon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagingInfoWrap: {
    flex: 1,
  },
  imagingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  imagingDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  viewReportBtn: {
    backgroundColor: '#e0f7fa',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  viewReportBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0d6371',
  },

  // 7. RECENT VISITS & HISTORY
  visitsListCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#edf3f6',
    elevation: 2,
    shadowColor: 'rgba(15, 23, 42, 0.04)',
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  visitItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  visitItemBorderTop: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  visitIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f0f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  visitInfoCol: {
    flex: 1,
  },
  visitTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  visitTitleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    marginRight: 6,
  },
  visitDateText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  visitDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  visitDetailsText: {
    fontSize: 11,
    color: '#64748b',
    flex: 1,
    lineHeight: 16,
  },
  statusBadge: {
    backgroundColor: '#e0f7fa',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0d6371',
  },

  // 8. START CONSULTATION BUTTON
  startConsultationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#064e59',
    borderRadius: 26,
    paddingVertical: 14,
    elevation: 3,
    shadowColor: 'rgba(6, 78, 89, 0.25)',
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    marginBottom: 8,
  },
  startConsultationBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },

  // 9. BOTTOM NAVIGATION BAR
  bottomTabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5edf2',
    paddingVertical: 10,
    elevation: 8,
    shadowColor: 'rgba(0, 0, 0, 0.05)',
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

  // MODALS
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    elevation: 6,
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
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
  },
  reportImageLarge: {
    width: '100%',
    height: 180,
    borderRadius: 14,
    backgroundColor: '#0f172a',
    marginBottom: 12,
  },
  reportImageTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  reportRadiologist: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 10,
  },
  reportFindingsBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  reportFindingsHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  reportFindingsText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  modalCloseBtn: {
    backgroundColor: '#064e59',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  archiveItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#edf2f7',
  },
  archiveHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  archiveTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  archiveDate: {
    fontSize: 11,
    color: '#64748b',
  },
  archiveDetails: {
    fontSize: 11,
    color: '#475569',
    marginTop: 4,
  },
  archiveBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e0f7fa',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 6,
  },
  archiveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0d6371',
  },
});
