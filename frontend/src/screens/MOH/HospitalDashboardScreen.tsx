import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React, { useState, useEffect } from 'react';
import { View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator, RefreshControl, Modal } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { API_URL } from '../../config';
import { Ionicons } from '@expo/vector-icons';
import MOHBottomNav from '../../components/MOHBottomNav';

export default function HospitalDashboardScreen() {
  const { t } = useLanguage();

  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      );
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

  const params = useLocalSearchParams();
  const id = params?.id;
  const name = params?.name;
  const insets = useSafeAreaInsets();
  const [chartType, setChartType] = useState('Weekly');

  const [staffModalVisible, setStaffModalVisible] = useState(false);
  const [hospitalStaff, setHospitalStaff] = useState<any[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);

  const fetchStaffSummary = async () => {
    if (!id) return;
    try {
      setStaffLoading(true);
      const res = await fetch(`${API_URL}/staff/hospital/${id}/summary`);
      if (res.ok) {
        const data = await res.json();
        setHospitalStaff(data);
      }
    } catch (err) {
      console.log('Error fetching staff', err);
    } finally {
      setStaffLoading(false);
    }
  };

  const handleStaffClick = () => {
    setStaffModalVisible(true);
    fetchStaffSummary();
  };

  const hospitalName = name || 'General Hospital';

  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);

  useEffect(() => {
    if (id) {
      fetchDashboardStats();
    }
  }, [id]);

  async function fetchDashboardStats() {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/hospitals/${id}/dashboard`);
      const data = await res.json();
      setDashboardData(data);
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
    } finally {
      setLoading(false);
    }
  };

  const getChartData = () => {
    if (!dashboardData || !dashboardData.chartData) return [];
    if (chartType === 'Monthly') return dashboardData.chartData.monthly;
    if (chartType === '6 Months') return dashboardData.chartData.sixMonths;
    return dashboardData.chartData.weekly;
  };

  const chartData = getChartData();
  const maxValue = chartData.length > 0 ? Math.max(...chartData.map((d: any) => d.value)) : 1;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />
      
      {/* App Header (Dark Teal like image) */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.push('/(moh)/dashboard' as any); } }} style={styles.backButton} accessibilityLabel={t("Back to Home")}>
              <Ionicons name="home" size={18} color={Colors.white} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Text style={styles.headerTitle} numberOfLines={1}>{hospitalName}</Text>
              </View>
              <Text style={styles.headerSubtitle}>{t("Real-time hospital dashboard")}</Text>
            </View>
          </View>
          <View style={styles.userIconContainer}>
            <Text style={styles.userIconText}>M</Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        
        {/* Status indicator */}
        <View style={styles.syncStatusContainer}>
          <View style={styles.syncTopRow}>
            <View style={styles.syncLeft}>
              <View style={styles.syncDot} />
              <Text style={styles.syncText}>{t("Network Synced")}</Text>
            </View>
            <View style={styles.syncRight}>
              <Text style={styles.syncTime}>{`${t('Today')} ${currentTime} • ${t('Live Sync')}`}</Text>
            </View>
          </View>
          
          <Text style={styles.syncHospitalCount}>{t("All 26 District General Hospitals Online")}</Text>
          <Text style={styles.syncDesc}>{t("Real-time telemetric feed across national outpatient departments")}</Text>
        </View>

        {/* 4 Grid Cards */}
        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={{ marginTop: 10, color: '#666' }}>{t("Loading dashboard data...")}</Text>
          </View>
        ) : dashboardData && (
          <>
            <View style={styles.gridContainer}>
              <View style={styles.gridCard}>
                <Text style={styles.cardTitle}>{t("TODAY'S PATIENTS")}</Text>
                <Text style={styles.cardValue}>{dashboardData.todayPatients.total.toLocaleString()}</Text>
                <Text style={styles.cardHighlight}>{dashboardData.todayPatients.growth} {t("vs yesterday")}</Text>
                <Text style={styles.cardSubText}>{t("Walk-in")}{' '}{dashboardData.todayPatients.walkIn} {t("• Booked")}{' '}{dashboardData.todayPatients.booked}</Text>
              </View>

              <View style={styles.gridCard}>
                <Text style={styles.cardTitle}>{t("AVG WAIT TIME")}</Text>
                <Text style={styles.cardValue}>{dashboardData.avgWaitTime.minutes}<Text style={styles.cardValueSmall}>{t("mins")}</Text></Text>
                <View style={dashboardData.avgWaitTime.status === 'Optimal' ? styles.badgeOptimal : styles.badgeNormal}>
                  <Text style={styles.badgeOptimalText}>
                    {dashboardData.avgWaitTime.status === 'Optimal' ? t('Optimal (<30m)') : t('High (>30m)')}
                  </Text>
                </View>
                <Text style={styles.cardSubText}>
                  {dashboardData.avgWaitTime.status === 'Optimal' ? t('Target threshold met') : t('Above target threshold')}
                </Text>
              </View>

              <TouchableOpacity style={styles.gridCard} onPress={handleStaffClick}>
                <Text style={styles.cardTitle}>{t("STAFF ON DUTY")}</Text>
                <Text style={styles.cardValue}>{dashboardData.staffOnDuty.total}</Text>
                <Text style={styles.cardHighlight}>{t("Click to view details")}</Text>
                <Text style={styles.cardSubText}>{t("Doctors & Nurses")}</Text>
              </TouchableOpacity>

              <View style={styles.gridCard}>
                <Text style={styles.cardTitle}>{t("ACTIVE QUEUES")}</Text>
                <Text style={styles.cardValue}>{dashboardData.activeQueues.total}</Text>
                <View style={styles.badgeNormal}>
                  <Text style={styles.badgeNormalText}>{t(dashboardData.activeQueues.status ?? '')}</Text>
                </View>
                <Text style={styles.cardSubText}>{dashboardData.activeQueues.total} {t("departments active")}</Text>
              </View>
            </View>

            {/* Progress Bar Section */}
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>{t("Consultation Progress")}</Text>
                <Text style={styles.progressValue}>{dashboardData.consultationProgress.percentage}%</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${dashboardData.consultationProgress.percentage}%` }]} />
              </View>
              <View style={styles.progressFooter}>
                <Text style={styles.progressFooterText}>{dashboardData.consultationProgress.completed} {t("completed on schedule")}</Text>
                <Text style={styles.progressFooterHighlight}>{dashboardData.consultationProgress.inSession} {t("in session")}</Text>
              </View>
            </View>
          </>
        )}

        {/* Chart Section */}
        <View style={styles.chartSection}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartTitle}>{t("Patient Volume")}</Text>
              <Text style={styles.chartSubtitle}>{t("Trend analysis")}</Text>
            </View>
            <View style={styles.chartTabs}>
              {['Weekly', 'Monthly', '6 Months'].map(tab => (
                <TouchableOpacity 
                  key={tab}
                  onPress={() => setChartType(tab)}
                  style={[styles.chartTab, chartType === tab && styles.chartTabActive]}
                >
                  <Text style={[styles.chartTabText, chartType === tab && styles.chartTabTextActive]}>
                    {t(tab ?? '')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Dummy Bar Chart */}
          <View style={styles.chartArea}>
            <View style={styles.barsContainer}>
              {chartData.map((data: any, index: number) => {
                const heightPercent = (data.value / maxValue) * 100;
                // Highlight highest bar
                const isMax = data.value === maxValue;
                return (
                  <View key={index} style={styles.barWrapper}>
                    <View style={[
                      styles.bar, 
                      { height: `${heightPercent}%` },
                      isMax ? styles.barHighlight : null
                    ]} />
                    <Text style={styles.barLabel}>{t(data.label ?? '')}</Text>
                  </View>
                );
              })}
            </View>
          </View>
          
          <View style={styles.chartFooter}>
            <View>
              <Text style={styles.chartFooterTitle}>{t("Peak Patient Flow")}</Text>
              <Text style={styles.chartFooterSubtitle}>{t("Max throughput recorded")}</Text>
            </View>
            <Text style={styles.chartFooterValue}>{t("Highly Active")}</Text>
          </View>
        </View>

        <View style={{height: 30}} />
      
      {/* Staff Modal */}
      <Modal visible={staffModalVisible} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: Colors.white, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{t("Staff on Duty")}</Text>
              <TouchableOpacity onPress={() => setStaffModalVisible(false)} style={{ padding: 5 }}>
                <Ionicons name="close" size={24} color={Colors.textDark} />
              </TouchableOpacity>
            </View>
            
            {staffLoading ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 30 }} />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {hospitalStaff.length === 0 ? (
                  <Text style={{ textAlign: 'center', color: Colors.textMedium, marginVertical: 20 }}>{t("No staff assigned to this hospital.")}</Text>
                ) : (
                  hospitalStaff.map((staff, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.divider }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryFaded, justifyContent: 'center', alignItems: 'center', marginRight: 15 }}>
                        <Text style={{ fontSize: 18 }}>{staff.role?.toLowerCase() === 'doctor' ? '👨‍⚕️' : staff.role?.toLowerCase() === 'nurse' ? '👩‍⚕️' : '🧑‍💻'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: 'bold', color: Colors.textDark }}>{staff.fullName}</Text>
                        <Text style={{ fontSize: 13, color: Colors.textMedium }}>{staff.role} {staff.specialization ? `- ${staff.specialization}` : ''}</Text>
                      </View>
                      {staff.role?.toLowerCase() === 'doctor' && (
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: 16, fontWeight: 'bold', color: Colors.primaryDark }}>{staff.patientsToday}</Text>
                          <Text style={{ fontSize: 10, color: Colors.textMedium }}>{t("Patients Today")}</Text>
                        </View>
                      )}
                    </View>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
</ScrollView>
      <MOHBottomNav activeRoute="hospitals" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primaryDark,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 20,
    color: Colors.white,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
    marginRight: 8,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  userIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  userIconText: {
    fontSize: 18,
  },
  scrollContent: {
    padding: 16,
  },
  syncStatusContainer: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  syncTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  syncHospitalCount: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textDark,
    marginBottom: 4,
  },
  syncDesc: {
    fontSize: 11,
    color: Colors.textMedium,
    lineHeight: 16,
  },
  syncLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primaryDark,
    marginRight: 8,
  },
  syncText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  syncRight: {
    backgroundColor: Colors.primaryFaded,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  syncTime: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  gridCard: {
    backgroundColor: Colors.white,
    width: '48%',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMedium,
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.primaryDark,
    marginBottom: 4,
  },
  cardValueSmall: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardHighlight: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 8,
  },
  cardSubText: {
    fontSize: 11,
    color: Colors.textMedium,
  },
  badgeOptimal: {
    backgroundColor: '#e0f5f8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  badgeOptimalText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  badgeNormal: {
    backgroundColor: '#e6f7ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  badgeNormalText: {
    color: '#0070f3',
    fontSize: 10,
    fontWeight: '700',
  },
  progressSection: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textDark,
  },
  progressValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#eef6f7',
    borderRadius: 4,
    marginBottom: 12,
  },
  progressBarFill: {
    width: '84.2%',
    height: '100%',
    backgroundColor: Colors.primaryDark,
    borderRadius: 4,
  },
  progressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressFooterText: {
    fontSize: 12,
    color: Colors.textMedium,
  },
  progressFooterHighlight: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  chartSection: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textDark,
  },
  chartSubtitle: {
    fontSize: 12,
    color: Colors.textMedium,
  },
  chartTabs: {
    flexDirection: 'row',
    backgroundColor: '#f0f5f6',
    borderRadius: 20,
    padding: 4,
  },
  chartTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chartTabActive: {
    backgroundColor: Colors.primaryDark,
  },
  chartTabText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMedium,
  },
  chartTabTextActive: {
    color: Colors.white,
  },
  chartArea: {
    height: 180,
    marginBottom: 20,
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 20, // space above tallest bar
  },
  barWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  bar: {
    width: 24,
    backgroundColor: '#d6eff1',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barHighlight: {
    backgroundColor: Colors.primaryDark,
  },
  barLabel: {
    fontSize: 10,
    color: Colors.textMedium,
    marginTop: 8,
  },
  chartFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fbfb',
    padding: 12,
    borderRadius: 12,
  },
  chartFooterTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textDark,
  },
  chartFooterSubtitle: {
    fontSize: 11,
    color: Colors.textMedium,
  },
  chartFooterValue: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
  }
});
