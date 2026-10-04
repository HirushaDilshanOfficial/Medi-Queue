import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StatusBar,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import {
  fetchDoctorDashboard,
  updateDoctorStatusApi,
  callNextPatientApi,
  DoctorDashboardData,
} from '../../services/doctorService';

interface DoctorDashboardScreenProps {
  navigation?: any;
}

export default function DoctorDashboardScreen({ navigation }: DoctorDashboardScreenProps) {
  const [data, setData] = useState<DoctorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'queue' | 'records' | 'schedule' | 'rx'>('home');

  const loadData = useCallback(async () => {
    try {
      const res = await fetchDoctorDashboard();
      setData(res);
    } catch (err) {
      console.log('Error loading dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleToggleShift = async () => {
    if (!data) return;
    const newStatus = data.doctor.status === 'active' ? 'on_break' : 'active';
    setData({
      ...data,
      doctor: { ...data.doctor, status: newStatus },
    });
    await updateDoctorStatusApi(newStatus, data.doctor._id);
  };

  const handleCompleteAndNext = async () => {
    setIsProcessing(true);
    try {
      const res = await callNextPatientApi();
      Alert.alert('Consultation Completed', res.message || 'Advanced to next patient.');
      loadData();
    } catch (err: any) {
      Alert.alert('Notice', err.message || 'Failed to complete consultation');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCallNext = async () => {
    setIsProcessing(true);
    try {
      const res = await callNextPatientApi();
      Alert.alert('Queue Called', res.message || 'Next token called!');
      loadData();
    } catch (err: any) {
      Alert.alert('Notice', err.message || 'Failed to call next token');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTabPress = (tab: 'home' | 'queue' | 'records' | 'schedule' | 'rx') => {
    setActiveTab(tab);
    if (tab === 'queue') {
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
      try {
        router.push('/(doctor)/records' as any);
      } catch (e) {
        router.push('/records' as any);
      }
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          if (!window.location.pathname.includes('records')) {
            window.location.href = '/(doctor)/records';
          }
        }, 120);
      }
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

  if (loading && !data) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#0d6371" />
        <Text style={styles.loadingText}>Loading Doctor Dashboard...</Text>
      </SafeAreaView>
    );
  }

  const doctor = data?.doctor;
  const metrics = data?.metrics;
  const currentPatient = data?.currentPatient;
  const upcomingQueue = data?.upcomingQueue || [];
  const completedCount = metrics?.completedCount || 18;
  const totalCapacity = doctor?.dailyCapacity || 32;
  const progressRatio = Math.min(1, completedCount / totalCapacity);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Main Content Area */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0d6371']} />}
      >
        {/* ---- 1. TOP PROFILE APP BAR ---- */}
        <View style={styles.topProfileBar}>
          <View style={styles.profileLeft}>
            <Image
              source={{
                uri: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=200',
              }}
              style={styles.avatarImg}
            />
            <View style={styles.profileTextWrap}>
              <Text style={styles.profileName}>{doctor?.name || 'Dr. Emilia Emelson'}</Text>
              <View style={styles.onlineBadgeRow}>
                <View style={styles.onlineGreenDot} />
                <Text style={styles.onlineBadgeText}>{doctor?.room || 'Room 3B'} Online</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => Alert.alert('Notifications', 'No new critical alerts at this time.')}
          >
            <Ionicons name="notifications-outline" size={22} color="#334155" />
            <View style={styles.redBadgeDot} />
          </TouchableOpacity>
        </View>

        {/* ---- 2. GREETING & SHIFT STATUS ROW ---- */}
        <View style={styles.greetingRow}>
          <View style={styles.greetingLeft}>
            <Text style={styles.greetingTitle}>
              Good morning, Dr.{'\n'}
              {doctor?.name ? doctor.name.replace(/^Dr\.\s*/i, '').split(' ')[0] : 'Emilia'}
            </Text>
            <View style={styles.departmentBadge}>
              <Ionicons name="business-outline" size={14} color="#0d6371" style={{ marginRight: 5 }} />
              <Text style={styles.departmentText}>
                {doctor?.department || 'Orthopedics OPD'} • {doctor?.room || 'Room 3B'}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.shiftBadgeBtn} onPress={handleToggleShift}>
            <View style={styles.shiftDot} />
            <Text style={styles.shiftBadgeText}>
              {doctor?.status === 'active' ? 'Active Shift' : 'On Break'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ---- 3. METRICS ROW (2 Side-by-Side Cards) ---- */}
        <View style={styles.metricsRow}>
          {/* Patients Waiting */}
          <View style={styles.metricCard}>
            <View style={styles.metricCardTop}>
              <Text style={styles.metricLabel}>Patients Waiting</Text>
              <View style={styles.metricIconWrap}>
                <Ionicons name="people-outline" size={18} color="#0d6371" />
              </View>
            </View>
            <View style={styles.metricNumberRow}>
              <Text style={styles.metricBigNumber}>{metrics?.waitingCount ?? 14}</Text>
              <Text style={styles.metricDeltaText}>+3 since 10am</Text>
            </View>
            <View style={styles.metricFooter}>
              <Ionicons name="time-outline" size={13} color="#64748b" style={{ marginRight: 4 }} />
              <Text style={styles.metricFooterText}>Avg wait {metrics?.avgWaitMinutes ?? 15} min</Text>
            </View>
          </View>

          {/* Completed Today */}
          <View style={styles.metricCard}>
            <View style={styles.metricCardTop}>
              <Text style={styles.metricLabel}>Completed Today</Text>
              <View style={styles.metricIconWrap}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#0d6371" />
              </View>
            </View>
            <View style={styles.metricNumberRow}>
              <Text style={styles.metricBigNumber}>{completedCount}</Text>
              <Text style={styles.metricTotalText}> / {totalCapacity}</Text>
            </View>
            {/* Progress Bar */}
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${progressRatio * 100}%` }]} />
            </View>
          </View>
        </View>

        {/* ---- 4. IN CONSULTATION HERO CARD ---- */}
        <View style={styles.consultationCard}>
          {/* Card Top Pill & Timer */}
          <View style={styles.consultationHeader}>
            <View style={styles.inConsultationPill}>
              <View style={styles.tealPulseDot} />
              <Text style={styles.inConsultationText}>IN CONSULTATION</Text>
            </View>
            <View style={styles.timerWrap}>
              <Ionicons name="time-outline" size={14} color="#0d6371" style={{ marginRight: 4 }} />
              <Text style={styles.timerText}>{currentPatient?.calledAtTime || '08:47'}</Text>
            </View>
          </View>

          {/* Patient Details & Token Shield */}
          <View style={styles.patientInfoRow}>
            <View style={styles.patientDetailsCol}>
              <View style={styles.patientNameRow}>
                <Text style={styles.patientNameText}>{currentPatient?.patientName || 'Kamal Gunaratne'}</Text>
                <View style={styles.genderPill}>
                  <Text style={styles.genderText}>{currentPatient?.gender || 'Male'}</Text>
                </View>
              </View>
              <Text style={styles.complaintText}>
                {currentPatient?.reason || 'Spine checkup'} • {currentPatient?.age || 46} yrs
              </Text>

              {/* Vitals Tags */}
              <View style={styles.vitalsRow}>
                <View style={styles.vitalTag}>
                  <Text style={styles.vitalTagText}>BP: 124/82 mmHg</Text>
                </View>
                <View style={styles.vitalTag}>
                  <Text style={styles.vitalTagText}>Previous: MRI 2024</Text>
                </View>
              </View>
            </View>

            {/* Token Badge */}
            <View style={styles.tokenShield}>
              <Text style={styles.tokenShieldLabel}>TOKEN</Text>
              <Text style={styles.tokenShieldNumber}>
                #{currentPatient?.tokenNumber ? String(currentPatient.tokenNumber).padStart(3, '0') : '#028'}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.consultationActions}>
            <TouchableOpacity
              style={styles.rxButton}
              onPress={() => handleTabPress('rx')}
            >
              <Ionicons name="document-text-outline" size={17} color="#0d6371" style={{ marginRight: 6 }} />
              <Text style={styles.rxButtonText}>Rx Prescribe</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.completeNextButton}
              onPress={handleCompleteAndNext}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.completeNextText}>Complete & Next</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ---- 5. QUICK ACTIONS SECTION ---- */}
        <Text style={styles.sectionHeaderTitle}>QUICK ACTIONS</Text>
        <View style={styles.quickActionsGrid}>
          {/* Call Next */}
          <TouchableOpacity style={styles.quickActionCard} onPress={handleCallNext} disabled={isProcessing}>
            <View style={styles.quickActionIconCircle}>
              <Ionicons name="volume-medium-outline" size={22} color="#0d6371" />
            </View>
            <Text style={styles.quickActionLabel}>Call Next</Text>
          </TouchableOpacity>

          {/* Add Walk-in */}
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => Alert.alert('Walk-in Patient', 'Quick walk-in registration modal will appear.')}
          >
            <View style={styles.quickActionIconCircle}>
              <Ionicons name="person-add-outline" size={20} color="#0d6371" />
            </View>
            <Text style={styles.quickActionLabel}>Add Walk-in</Text>
          </TouchableOpacity>

          {/* 15m Break */}
          <TouchableOpacity style={styles.quickActionCard} onPress={handleToggleShift}>
            <View style={styles.quickActionIconCircle}>
              <Ionicons name="cafe-outline" size={20} color="#0d6371" />
            </View>
            <Text style={styles.quickActionLabel}>15m Break</Text>
          </TouchableOpacity>

          {/* My Schedule */}
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => router.push('/(doctor)/schedule')}
          >
            <View style={[styles.quickActionIconCircle, { backgroundColor: '#e0f6f8' }]}>
              <MaterialCommunityIcons name="calendar-month-outline" size={20} color="#0d6371" />
            </View>
            <Text style={[styles.quickActionLabel, { fontWeight: '700', color: '#0d6371' }]}>Schedule</Text>
          </TouchableOpacity>
        </View>

        {/* ---- 6. UP NEXT IN QUEUE SECTION ---- */}
        <View style={styles.queueHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>UP NEXT IN QUEUE</Text>
          <TouchableOpacity onPress={() => router.push('/(doctor)/queue')}>
            <Text style={styles.fullQueueLink}>Full Queue &gt;</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.queueList}>
          {upcomingQueue.map((item, index) => (
            <View key={index} style={styles.queueItemCard}>
              {/* TKN Box */}
              <View style={styles.tknBox}>
                <Text style={styles.tknLabel}>TKN</Text>
                <Text style={styles.tknNumber}>{String(item.tokenNumber).padStart(3, '0')}</Text>
              </View>

              {/* Patient Info */}
              <View style={styles.queueItemInfo}>
                <Text style={styles.queueItemName}>{item.patientName}</Text>
                <Text style={styles.queueItemSub}>
                  {index === 0 ? 'Post-op Check' : 'Hypertension Follow-up'} • {item.age} yrs
                </Text>
              </View>

              {/* Time Pill & Options */}
              <View style={styles.queueItemRight}>
                <View style={styles.timePill}>
                  <Text style={styles.timePillText}>{item.slotTime || (index === 0 ? '11:15 AM' : '11:30 AM')}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => Alert.alert('Patient Options', `Manage queue entry for ${item.patientName}`)}
                >
                  <Ionicons name="ellipsis-vertical" size={17} color="#94a3b8" style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ---- 7. BOTTOM NAVIGATION BAR (5 TABS) ---- */}
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

        {/* Records */}
        <TouchableOpacity style={styles.tabItem} onPress={() => handleTabPress('records')}>
          <MaterialCommunityIcons
            name="folder-account-outline"
            size={22}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fbfd',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },

  // 1. TOP PROFILE BAR
  topProfileBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: '#e2e8f0',
  },
  profileTextWrap: {
    marginLeft: 10,
  },
  profileName: {
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
    width: 7,
    height: 7,
    borderRadius: 3.5,
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
    borderColor: '#f1f5f9',
    position: 'relative',
  },
  redBadgeDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },

  // 2. GREETING & SHIFT ROW
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 14,
    marginBottom: 16,
  },
  greetingLeft: {
    flex: 1,
  },
  greetingTitle: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  departmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  departmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0d6371',
  },
  shiftBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7cebf5',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginTop: 4,
  },
  shiftDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#047857',
    marginRight: 6,
  },
  shiftBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#064e59',
  },

  // 3. METRICS ROW
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#edf2f7',
    elevation: 2,
    shadowColor: 'rgba(15, 23, 42, 0.05)',
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  metricCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  metricIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e0f7fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 8,
  },
  metricBigNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  metricDeltaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0d9488',
    marginLeft: 6,
  },
  metricTotalText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#94a3b8',
  },
  metricFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  metricFooterText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e2e8f0',
    marginTop: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0d6371',
    borderRadius: 3,
  },

  // 4. IN CONSULTATION HERO CARD
  consultationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eef3f6',
    elevation: 3,
    shadowColor: 'rgba(15, 23, 42, 0.06)',
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    marginBottom: 20,
  },
  consultationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  inConsultationPill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tealPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2dd4bf',
    marginRight: 6,
  },
  inConsultationText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0d6371',
    letterSpacing: 0.6,
  },
  timerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0d6371',
  },
  patientInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  patientDetailsCol: {
    flex: 1,
    paddingRight: 10,
  },
  patientNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  patientNameText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  genderPill: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  genderText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0369a1',
  },
  complaintText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 3,
    fontWeight: '500',
  },
  vitalsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  vitalTag: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  vitalTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  tokenShield: {
    backgroundColor: '#0f5b66',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 68,
  },
  tokenShieldLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#99f6e4',
    letterSpacing: 0.5,
  },
  tokenShieldNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    marginTop: 1,
  },
  consultationActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  rxButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f7fa',
    borderRadius: 12,
    paddingVertical: 12,
  },
  rxButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0d6371',
  },
  completeNextButton: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d6371',
    borderRadius: 12,
    paddingVertical: 12,
    elevation: 2,
  },
  completeNextText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },

  // 5. QUICK ACTIONS
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#edf2f7',
    elevation: 1,
  },
  quickActionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#cff3f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 8,
  },

  // 6. UP NEXT IN QUEUE
  queueHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fullQueueLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0d6371',
  },
  queueList: {
    gap: 8,
    marginBottom: 10,
  },
  queueItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#edf2f7',
  },
  tknBox: {
    backgroundColor: '#f0f9fa',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginRight: 12,
  },
  tknLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
  },
  tknNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0d6371',
  },
  queueItemInfo: {
    flex: 1,
  },
  queueItemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  queueItemSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  queueItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timePill: {
    backgroundColor: '#e0f7fa',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0d6371',
  },

  // 7. BOTTOM NAVIGATION BAR
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
});
