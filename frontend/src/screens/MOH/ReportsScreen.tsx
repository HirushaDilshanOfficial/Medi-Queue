import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { API_URL } from '../../config';

export default function ReportsScreen() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/alerts/analytics`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderProgressBar = (value: number, total: number, color: string) => {
    const percentage = total === 0 ? 0 : (value / total) * 100;
    return (
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBarFill, { width: `${percentage}%`, backgroundColor: color }]} />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primaryDark} />
      </View>
    );
  }

  // Calculate totals
  const totalAlerts = stats?.statusStats?.reduce((acc: number, item: any) => acc + item.count, 0) || 0;
  const activeAlerts = stats?.statusStats?.find((s: any) => s._id === 'Active')?.count || 0;
  const resolvedAlerts = stats?.statusStats?.find((s: any) => s._id === 'Acknowledged' || s._id === 'Resolved')?.count || 0;

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ backgroundColor: Colors.white }} />
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Monthly Analytics</Text>
          <Text style={styles.headerSubtitle}>System-wide Bottleneck Report</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        
        {/* KPI Cards */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { backgroundColor: Colors.primary }]}>
            <Text style={styles.kpiValue}>{totalAlerts}</Text>
            <Text style={styles.kpiLabel}>Total Alerts (Month)</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: '#34C759' }]}>
            <Text style={styles.kpiValue}>{resolvedAlerts}</Text>
            <Text style={styles.kpiLabel}>Issues Resolved</Text>
          </View>
        </View>

        {/* Bottleneck Types */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alert Breakdown by Category</Text>
          <View style={styles.card}>
            {stats?.categoryStats?.map((cat: any, index: number) => {
              const colors = ['#FF3B30', '#FF9500', '#5AC8FA'];
              return (
                <View key={cat._id} style={styles.statRow}>
                  <View style={styles.statLabelRow}>
                    <Text style={styles.statLabel}>{cat._id}</Text>
                    <Text style={styles.statCount}>{cat.count} Incidents</Text>
                  </View>
                  {renderProgressBar(cat.count, totalAlerts, colors[index % colors.length])}
                </View>
              );
            })}
            {(!stats?.categoryStats || stats.categoryStats.length === 0) && (
              <Text style={styles.emptyText}>No data available yet.</Text>
            )}
          </View>
        </View>

        {/* Top Hospitals Heatmap (Bar list) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Overcrowded Hospitals (Heatmap)</Text>
          <Text style={styles.sectionDesc}>Hospitals needing immediate resource redistribution</Text>
          
          <View style={styles.card}>
            {stats?.hospitalStats?.map((hosp: any, index: number) => {
              // The highest count sets the max for the progress bar
              const maxCount = stats.hospitalStats[0].count;
              return (
                <View key={hosp._id} style={styles.statRow}>
                  <View style={styles.statLabelRow}>
                    <Text style={styles.statLabel}>{index + 1}. {hosp._id}</Text>
                    <Text style={[styles.statCount, { color: '#FF3B30', fontWeight: 'bold' }]}>{hosp.count} Alerts</Text>
                  </View>
                  {renderProgressBar(hosp.count, maxCount, '#FF3B30')}
                </View>
              );
            })}
            {(!stats?.hospitalStats || stats.hospitalStats.length === 0) && (
              <Text style={styles.emptyText}>No hospital data available yet.</Text>
            )}
          </View>
        </View>

        {/* AI Actionable Insights */}
        <View style={[styles.section, { marginBottom: 40 }]}>
          <Text style={styles.sectionTitle}>AI System Insights</Text>
          <View style={[styles.card, { backgroundColor: '#E0F7FA', borderColor: Colors.primary, borderWidth: 1 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Text style={{ marginRight: 10, fontSize: 18 }}>💡</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.insightTitle}>Resource Allocation Strategy</Text>
                <Text style={styles.insightText}>
                  Data suggests a consistent spike in Orthopedic OPD bottlenecks at Colombo National Hospital. Recommend transferring 2 Medical Officers from Gampaha District to Colombo to balance the patient-to-doctor ratio over the next 3 months.
                </Text>
              </View>
            </View>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: '#EAEAEA' },
  backButton: { paddingRight: 15 },
  backButtonText: { fontSize: 24, color: Colors.textDark },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.textDark },
  headerSubtitle: { fontSize: 12, color: Colors.textMedium, marginTop: 2 },
  scrollArea: { flex: 1, padding: 16 },
  kpiRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  kpiCard: { flex: 1, padding: 20, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  kpiValue: { fontSize: 32, fontWeight: 'bold', color: Colors.white },
  kpiLabel: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 4, fontWeight: '600' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.textDark, marginBottom: 4 },
  sectionDesc: { fontSize: 12, color: Colors.textMedium, marginBottom: 12 },
  card: { backgroundColor: Colors.white, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  statRow: { marginBottom: 16 },
  statLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  statLabel: { fontSize: 14, fontWeight: '600', color: Colors.textDark },
  statCount: { fontSize: 13, color: Colors.textMedium },
  progressBarContainer: { height: 8, backgroundColor: '#F0F0F0', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  emptyText: { textAlign: 'center', color: Colors.textMedium, padding: 20 },
  insightTitle: { fontSize: 14, fontWeight: 'bold', color: Colors.primaryDark, marginBottom: 6 },
  insightText: { fontSize: 13, color: Colors.primaryDark, lineHeight: 20 }
});
