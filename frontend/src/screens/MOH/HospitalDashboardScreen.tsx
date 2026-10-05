import React, { useState, useEffect } from 'react';
import { View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { API_URL } from '../../config';

export default function HospitalDashboardScreen() {
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
  const hospitalName = name || 'General Hospital';

  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);

  useEffect(() => {
    if (id) {
      fetchDashboardStats();
    }
  }, [id]);

  const fetchDashboardStats = async () => {
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
  const maxValue = chartData.length > 0 ? Math.max(...chartData.map(d => d.value)) : 1;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />
      
      {/* App Header (Dark Teal like image) */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Text style={styles.headerTitle} numberOfLines={1}>{hospitalName}</Text>
              </View>
              <Text style={styles.headerSubtitle}>Real-time hospital dashboard</Text>
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
              <Text style={styles.syncText}>Network Synced</Text>
            </View>
            <View style={styles.syncRight}>
              <Text style={styles.syncTime}>Today 10:23 • Live Sync</Text>
            </View>
          </View>
          
          <Text style={styles.syncHospitalCount}>All 26 District General Hospitals Online</Text>
          <Text style={styles.syncDesc}>Real-time telemetric feed across national outpatient departments</Text>
        </View>

        {/* 4 Grid Cards */}
        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={{ marginTop: 10, color: '#666' }}>Loading dashboard data...</Text>
          </View>
        ) : dashboardData && (
          <>
            <View style={styles.gridContainer}>
              <View style={styles.gridCard}>
                <Text style={styles.cardTitle}>TODAY'S PATIENTS</Text>
                <Text style={styles.cardValue}>{dashboardData.todayPatients.total.toLocaleString()}</Text>
                <Text style={styles.cardHighlight}>{dashboardData.todayPatients.growth} vs yesterday</Text>
                <Text style={styles.cardSubText}>Walk-in {dashboardData.todayPatients.walkIn} • Booked {dashboardData.todayPatients.booked}</Text>
              </View>

              <View style={styles.gridCard}>
                <Text style={styles.cardTitle}>AVG WAIT TIME</Text>
                <Text style={styles.cardValue}>{dashboardData.avgWaitTime.minutes}<Text style={styles.cardValueSmall}>mins</Text></Text>
                <View style={dashboardData.avgWaitTime.status === 'Optimal' ? styles.badgeOptimal : styles.badgeNormal}>
                  <Text style={styles.badgeOptimalText}>
                    {dashboardData.avgWaitTime.status === 'Optimal' ? 'Optimal (<30m)' : 'High (>30m)'}
                  </Text>
                </View>
                <Text style={styles.cardSubText}>
                  {dashboardData.avgWaitTime.status === 'Optimal' ? 'Target threshold met' : 'Above target threshold'}
                </Text>
              </View>

              <View style={styles.gridCard}>
                <Text style={styles.cardTitle}>STAFF ON DUTY</Text>
                <Text style={styles.cardValue}>{dashboardData.staffOnDuty.total}</Text>
                <Text style={styles.cardHighlight}>{dashboardData.staffOnDuty.activePercent}% roster active</Text>
                <Text style={styles.cardSubText}>Doctors: {dashboardData.staffOnDuty.doctors} • Nurses: {dashboardData.staffOnDuty.nurses}</Text>
              </View>

              <View style={styles.gridCard}>
                <Text style={styles.cardTitle}>ACTIVE QUEUES</Text>
                <Text style={styles.cardValue}>{dashboardData.activeQueues.total}</Text>
                <View style={styles.badgeNormal}>
                  <Text style={styles.badgeNormalText}>{dashboardData.activeQueues.status}</Text>
                </View>
                <Text style={styles.cardSubText}>{dashboardData.activeQueues.total} departments active</Text>
              </View>
            </View>

            {/* Progress Bar Section */}
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>Consultation Progress</Text>
                <Text style={styles.progressValue}>{dashboardData.consultationProgress.percentage}%</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${dashboardData.consultationProgress.percentage}%` }]} />
              </View>
              <View style={styles.progressFooter}>
                <Text style={styles.progressFooterText}>{dashboardData.consultationProgress.completed} completed on schedule</Text>
                <Text style={styles.progressFooterHighlight}>{dashboardData.consultationProgress.inSession} in session</Text>
              </View>
            </View>
          </>
        )}

        {/* Chart Section */}
        <View style={styles.chartSection}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartTitle}>Patient Volume</Text>
              <Text style={styles.chartSubtitle}>Trend analysis</Text>
            </View>
            <View style={styles.chartTabs}>
              {['Weekly', 'Monthly', '6 Months'].map(tab => (
                <TouchableOpacity 
                  key={tab}
                  onPress={() => setChartType(tab)}
                  style={[styles.chartTab, chartType === tab && styles.chartTabActive]}
                >
                  <Text style={[styles.chartTabText, chartType === tab && styles.chartTabTextActive]}>
                    {tab}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Dummy Bar Chart */}
          <View style={styles.chartArea}>
            <View style={styles.barsContainer}>
              {chartData.map((data, index) => {
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
                    <Text style={styles.barLabel}>{data.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
          
          <View style={styles.chartFooter}>
            <View>
              <Text style={styles.chartFooterTitle}>Peak Patient Flow</Text>
              <Text style={styles.chartFooterSubtitle}>Max throughput recorded</Text>
            </View>
            <Text style={styles.chartFooterValue}>Highly Active</Text>
          </View>
        </View>

        <View style={{height: 30}} />
      </ScrollView>
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
