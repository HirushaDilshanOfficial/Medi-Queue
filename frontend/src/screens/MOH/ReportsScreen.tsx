import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React, { useState, useEffect } from 'react';
import { View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { API_URL } from '../../config';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { fetchMohDashboard } from '../../services/mohService';

export default function ReportsScreen() {
  const { t } = useLanguage();
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);

  useEffect(() => {
    fetchAnalytics();
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const data = await fetchMohDashboard();
      setDashboardData(data);
    } catch (error) {
      console.log('Error fetching dashboard data:', error);
    }
  };

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

  let insightText = "Not enough data to generate AI insights at the moment.";
  if (stats && stats.hospitalStats && stats.categoryStats && stats.hospitalStats.length > 0 && stats.categoryStats.length > 0) {
    const topHospital = stats.hospitalStats[0]._id;
    const topCategory = stats.categoryStats[0]._id;
    insightText = t('Data suggests a consistent spike in "{category}" bottlenecks at {hospital}. Recommend reviewing resource allocation and transferring support staff to {hospital} to balance the load over the next period.', { category: t(topCategory), hospital: topHospital });
  }

  const generatePDF = async () => {
    try {
      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #333; }
              .header-container { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #004D40; padding-bottom: 20px; margin-bottom: 30px; }
              .logo h1 { color: #004D40; margin: 0; font-size: 28px; }
              .logo span { color: #666; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
              .address { text-align: right; color: #555; font-size: 12px; line-height: 1.5; }
              h2 { color: #00695C; margin-top: 30px; font-size: 18px; border-bottom: 1px solid #eee; padding-bottom: 8px; }
              .summary-row { display: flex; gap: 15px; margin-bottom: 30px; }
              .summary-box { flex: 1; background-color: #E0F2F1; padding: 20px; border-radius: 8px; text-align: center; border: 1px solid #B2DFDB; }
              .summary-box h3 { margin: 0; color: #004D40; font-size: 32px; }
              .summary-box p { margin: 5px 0 0 0; color: #00695C; font-size: 13px; font-weight: bold; text-transform: uppercase; }
              .card { background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e0e0e0; }
              .stat-row { display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding: 12px 0; }
              .insight { background-color: #E0F7FA; border-left: 4px solid #00ACC1; padding: 20px; margin-top: 30px; }
              table { width: 100%; border-collapse: collapse; margin-top: 15px; }
              th, td { text-align: left; padding: 12px; border-bottom: 1px solid #ddd; }
              th { background-color: #f2f2f2; color: #555; }
              .footer { text-align: center; margin-top: 50px; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
            </style>
          </head>
          <body>
            
            <div class="header-container">
              <div class="logo">
                <h1>Medi-Queue</h1>
                <span>National Health Analytics</span>
              </div>
              <div class="address">
                Ministry of Health<br/>
                Colombo 10, Sri Lanka<br/>
                Date: ${new Date().toLocaleDateString()}
              </div>
            </div>
            
            <div class="summary-row">
              <div class="summary-box">
                <h3>${dashboardData?.totalHospitals || 0}</h3>
                <p>Hospitals</p>
              </div>
              <div class="summary-box">
                <h3>${dashboardData?.totalStaff || 0}</h3>
                <p>Medical Staff</p>
              </div>
              <div class="summary-box">
                <h3>${dashboardData?.totalPatients || 0}</h3>
                <p>Reg. Patients</p>
              </div>
            </div>
            
            <div class="card">
              <h2 style="margin-top:0; border:none; padding:0;">Alerts & Operations (This Month)</h2>
              <div class="stat-row"><span>Total System Alerts</span><strong>${totalAlerts}</strong></div>
              <div class="stat-row"><span>Resolved Issues</span><strong>${resolvedAlerts}</strong></div>
              <div class="stat-row"><span>Currently Active Queues</span><strong>${dashboardData?.totalQueues || 0}</strong></div>
            </div>
            
            <h2>Alert Breakdown by Category</h2>
            <table>
              <tr><th>Category</th><th>Count</th></tr>
              ${stats?.categoryStats?.map((c: any) => `<tr><td>${c._id}</td><td>${c.count}</td></tr>`).join('') || '<tr><td colspan="2">No data</td></tr>'}
            </table>

            <h2>Hospitals Needing Resources</h2>
            <table>
              <tr><th>Hospital</th><th>Alerts</th></tr>
              ${stats?.hospitalStats?.map((h: any) => `<tr><td>${h._id}</td><td>${h.count}</td></tr>`).join('') || '<tr><td colspan="2">No data</td></tr>'}
            </table>

            <div class="insight">
              <h3 style="color: #00796B; margin-top: 0;">AI System Insight</h3>
              <p>${insightText}</p>
            </div>
            
            <div class="footer">
              This is a system-generated report from the Medi-Queue National Health Portal.<br/>
              Confidential & Proprietary to the Ministry of Health, Sri Lanka.
            </div>
          </body>
        </html>
      `;
      
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, { dialogTitle: 'Download Analytics Report' });
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

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
          <Text style={styles.headerTitle}>{t("Monthly Analytics")}</Text>
          <Text style={styles.headerSubtitle}>{t("System-wide Bottleneck Report")}</Text>
        </View>
        <TouchableOpacity onPress={generatePDF} style={{ padding: 8, backgroundColor: '#E0F7FA', borderRadius: 8 }}>
          <Ionicons name="download-outline" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        
        {/* KPI Cards */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { backgroundColor: Colors.primary }]}>
            <Text style={styles.kpiValue}>{totalAlerts}</Text>
            <Text style={styles.kpiLabel}>{t("Total Alerts (Month)")}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: '#34C759' }]}>
            <Text style={styles.kpiValue}>{resolvedAlerts}</Text>
            <Text style={styles.kpiLabel}>{t("Issues Resolved")}</Text>
          </View>
        </View>

        {/* Bottleneck Types */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("Alert Breakdown by Category")}</Text>
          <View style={styles.card}>
            {stats?.categoryStats?.map((cat: any, index: number) => {
              const colors = ['#FF3B30', '#FF9500', '#5AC8FA'];
              return (
                <View key={cat._id} style={styles.statRow}>
                  <View style={styles.statLabelRow}>
                    <Text style={styles.statLabel}>{cat._id}</Text>
                    <Text style={styles.statCount}>{cat.count} {t("Incidents")}</Text>
                  </View>
                  {renderProgressBar(cat.count, totalAlerts, colors[index % colors.length])}
                </View>
              );
            })}
            {(!stats?.categoryStats || stats.categoryStats.length === 0) && (
              <Text style={styles.emptyText}>{t("No data available yet.")}</Text>
            )}
          </View>
        </View>

        {/* Top Hospitals Heatmap (Bar list) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("Top Overcrowded Hospitals (Heatmap)")}</Text>
          <Text style={styles.sectionDesc}>{t("Hospitals needing immediate resource redistribution")}</Text>
          
          <View style={styles.card}>
            {stats?.hospitalStats?.map((hosp: any, index: number) => {
              // The highest count sets the max for the progress bar
              const maxCount = stats.hospitalStats[0].count;
              return (
                <View key={hosp._id} style={styles.statRow}>
                  <View style={styles.statLabelRow}>
                    <Text style={styles.statLabel}>{index + 1}. {hosp._id}</Text>
                    <Text style={[styles.statCount, { color: '#FF3B30', fontWeight: 'bold' }]}>{hosp.count} {t("Alerts")}</Text>
                  </View>
                  {renderProgressBar(hosp.count, maxCount, '#FF3B30')}
                </View>
              );
            })}
            {(!stats?.hospitalStats || stats.hospitalStats.length === 0) && (
              <Text style={styles.emptyText}>{t("No hospital data available yet.")}</Text>
            )}
          </View>
        </View>

        {/* AI Actionable Insights */}
        <View style={[styles.section, { marginBottom: 40 }]}>
          <Text style={styles.sectionTitle}>{t("AI System Insights")}</Text>
          <View style={[styles.card, { backgroundColor: '#E0F7FA', borderColor: Colors.primary, borderWidth: 1 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Ionicons name="bulb" size={24} color={Colors.primary} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.insightTitle}>{t("Resource Allocation Strategy")}</Text>
                <Text style={styles.insightText}>
                  {t(insightText)}
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
