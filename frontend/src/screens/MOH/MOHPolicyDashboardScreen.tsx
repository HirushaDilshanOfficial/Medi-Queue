import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';

import { getPolicies, updatePolicy } from '../../services/policyService';

export default function MOHPolicyDashboardScreen() {
  const [priorityQueue, setPriorityQueue] = useState(true);
  const [autoExpiry, setAutoExpiry] = useState(true);
  const [dataMasking, setDataMasking] = useState(true);
  const [targetWaitTime, setTargetWaitTime] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const data = await getPolicies();
      setPriorityQueue(data.priorityQueue ?? true);
      setAutoExpiry(data.tokenAutoExpiry ?? true);
      setDataMasking(data.dataMasking ?? true);
      setTargetWaitTime(data.targetWaitTime ?? 30);
    } catch (error) {
      console.error('Error fetching policies', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key: string, value: boolean) => {
    // Optimistic UI update
    if (key === 'priorityQueue') setPriorityQueue(value);
    if (key === 'tokenAutoExpiry') setAutoExpiry(value);
    if (key === 'dataMasking') setDataMasking(value);

    try {
      await updatePolicy({ [key]: value });
    } catch (error) {
      // Revert if failed
      if (key === 'priorityQueue') setPriorityQueue(!value);
      if (key === 'tokenAutoExpiry') setAutoExpiry(!value);
      if (key === 'dataMasking') setDataMasking(!value);
    }
  };

  const adjustWaitTime = async (increment: number) => {
    const newValue = Math.max(5, targetWaitTime + increment);
    setTargetWaitTime(newValue);
    try {
      await updatePolicy({ targetWaitTime: newValue });
    } catch (error) {
      setTargetWaitTime(targetWaitTime); // Revert
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />
      <SafeAreaView style={{ flex: 0, backgroundColor: Colors.primaryDark }} />

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
        {/* Header Section */}
        <View style={styles.headerBackground}>
          <View style={styles.headerTop}>
            <View style={styles.headerUser}>
              <View style={styles.avatar}>
                <Ionicons name="shield-checkmark" size={24} color={Colors.primaryDark} />
              </View>
              <View>
                <Text style={styles.headerRole}>MOH Executive</Text>
                <Text style={styles.headerSub}>National OPD Network • Policy</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.notificationBtn}>
              <Ionicons name="notifications-outline" size={24} color={Colors.white} />
            </TouchableOpacity>
          </View>

          <View style={styles.headerTitleContainer}>
            <View style={styles.tag}>
              <MaterialIcons name="verified-user" size={14} color={Colors.white} />
              <Text style={styles.tagText}>Regulatory Compliance Active</Text>
            </View>
            <Text style={styles.headerTitle}>National Policy, Governance & Settings</Text>
            <Text style={styles.headerSubtitle}>Ministry of Health OPD Standards & Privacy Regulation</Text>
          </View>

          {/* Key Metrics */}
          <View style={styles.metricsContainer}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Target Wait</Text>
              <Text style={styles.metricValue}>{targetWaitTime} min</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>PII Masking</Text>
              <Text style={styles.metricValue}>{dataMasking ? '100%' : 'Off'}</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Audit Engine</Text>
              <Text style={styles.metricValue}>Active</Text>
            </View>
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.content}>
          
          {/* 1. Live Hospital Traffic */}
          <Text style={styles.sectionTitle}>Live Regional Status</Text>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconBox}>
                <MaterialIcons name="map" size={20} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>High Traffic Hospitals</Text>
                <Text style={styles.cardSubtitle}>Real-time patient load alerts</Text>
              </View>
            </View>
            <View style={styles.alertItem}>
              <View style={[styles.statusDot, { backgroundColor: Colors.error }]} />
              <Text style={styles.alertText}>Colombo General - Wait > 45 mins</Text>
            </View>
            <View style={styles.alertItem}>
              <View style={[styles.statusDot, { backgroundColor: Colors.warning }]} />
              <Text style={styles.alertText}>Gampaha Base - Wait 35 mins</Text>
            </View>
          </View>

          {/* 2. Smart Alerts (Outbreak) */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconBox}>
                <Ionicons name="warning" size={20} color={Colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Epidemic Early Warning</Text>
                <Text style={styles.cardSubtitle}>AI driven symptom spike detection</Text>
              </View>
            </View>
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>⚠️ 15% increase in fever cases in Kandy region over the last 24 hours.</Text>
            </View>
          </View>

          {/* 3. OPD Queue Policies */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>OPD Queue Policies</Text>
            <View style={styles.badge}><Text style={styles.badgeText}>Req 9</Text></View>
          </View>
          
          <View style={styles.policyCard}>
            <View style={styles.policyRow}>
              <View style={styles.policyTextContent}>
                <Text style={styles.policyTitle}>National Target Max Wait Time</Text>
                <Text style={styles.policySubtitle}>Triggers hospital executive surge alert</Text>
              </View>
              <View style={styles.stepperControl}>
                <TouchableOpacity onPress={() => adjustWaitTime(-5)} style={styles.stepperBtn}><Text style={styles.stepperText}>-</Text></TouchableOpacity>
                <Text style={styles.stepperValue}>{targetWaitTime} min</Text>
                <TouchableOpacity onPress={() => adjustWaitTime(5)} style={styles.stepperBtn}><Text style={styles.stepperText}>+</Text></TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.policyRow}>
              <View style={styles.policyTextContent}>
                <Text style={styles.policyTitle}>Senior & Child Priority Queue</Text>
                <Text style={styles.policySubtitle}>Active (Enabled nationally across all tiers)</Text>
              </View>
              <Switch
                trackColor={{ false: '#d1d1d1', true: Colors.primaryDark }}
                thumbColor={Colors.white}
                onValueChange={(val) => handleToggle('priorityQueue', val)}
                value={priorityQueue}
                disabled={loading}
              />
            </View>

            <View style={styles.divider} />
            
            <View style={styles.policyRow}>
              <View style={styles.policyTextContent}>
                <Text style={styles.policyTitle}>Digital Token Auto-Expiry</Text>
                <Text style={styles.policySubtitle}>60 mins after missed triage chime</Text>
              </View>
              <Switch
                trackColor={{ false: '#d1d1d1', true: Colors.primaryDark }}
                thumbColor={Colors.white}
                onValueChange={(val) => handleToggle('tokenAutoExpiry', val)}
                value={autoExpiry}
                disabled={loading}
              />
            </View>
          </View>

          {/* 4. Data Privacy & Access Security */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Data Privacy & Access Security</Text>
            <View style={styles.badge}><Text style={styles.badgeText}>Req 11</Text></View>
          </View>

          <View style={styles.policyCard}>
            <View style={styles.policyRow}>
              <View style={styles.policyTextContent}>
                <Text style={styles.policyTitle}>Patient NIC & PII Data Masking <Ionicons name="lock-closed" size={12} color={Colors.primary} /></Text>
                <Text style={styles.policySubtitle}>End-to-end encrypted. Views full unmasked NIC upon active consultation verification.</Text>
              </View>
              <Switch
                trackColor={{ false: '#d1d1d1', true: Colors.primaryDark }}
                thumbColor={Colors.white}
                onValueChange={(val) => handleToggle('dataMasking', val)}
                value={dataMasking}
                disabled={loading}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.rbacContainer}>
              <Text style={styles.policyTitle}>Role-Based Access Control (RBAC)</Text>
              <Text style={styles.policySubtitle}>Strict capability bounds mapped per digital credential.</Text>
              <View style={styles.roleTagsRow}>
                <View style={styles.roleTag}><Text style={styles.roleTagText}>Receptionist</Text></View>
                <View style={styles.roleTag}><Text style={styles.roleTagText}>Doctor</Text></View>
                <View style={styles.roleTag}><Text style={styles.roleTagText}>Medical Supt.</Text></View>
                <View style={[styles.roleTag, styles.roleTagActive]}><Text style={styles.roleTagTextActive}>MOH Executive</Text></View>
              </View>
            </View>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.btnPrimary}>
              <Ionicons name="shield-checkmark" size={18} color={Colors.white} />
              <Text style={styles.btnPrimaryText}>View Security Audit Log</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollView: { flex: 1 },
  headerBackground: {
    backgroundColor: Colors.primaryDark,
    paddingTop: 15,
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  headerUser: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 25,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerRole: { color: Colors.white, fontSize: 14, fontWeight: '700' },
  headerSub: { color: Colors.white, fontSize: 10, opacity: 0.8 },
  notificationBtn: { padding: 8 },
  headerTitleContainer: { marginBottom: 25 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  tagText: { color: Colors.white, fontSize: 10, marginLeft: 5, fontWeight: '600' },
  headerTitle: { color: Colors.white, fontSize: 24, fontWeight: '800', marginBottom: 5 },
  headerSubtitle: { color: Colors.white, fontSize: 12, opacity: 0.8, lineHeight: 18 },
  metricsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 15,
    padding: 15,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricBox: { flex: 1, alignItems: 'center' },
  metricLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginBottom: 4 },
  metricValue: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  metricDivider: { width: 1, height: '70%', backgroundColor: 'rgba(255,255,255,0.2)' },
  content: { padding: 20, marginTop: -15 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textDark, marginBottom: 15, marginTop: 10 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, marginBottom: 10 },
  badge: { backgroundColor: '#e2e8f0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: 'bold', color: Colors.textMedium },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 15,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  cardIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primaryFaded, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: Colors.textDark },
  cardSubtitle: { fontSize: 11, color: Colors.textMedium, marginTop: 2 },
  alertItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  alertText: { fontSize: 13, color: Colors.textMedium },
  warningBox: { backgroundColor: '#fff8e6', padding: 12, borderRadius: 10, borderLeftWidth: 4, borderLeftColor: Colors.warning },
  warningText: { fontSize: 13, color: '#8a6d3b', lineHeight: 20 },
  policyCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  policyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  policyTextContent: { flex: 1, paddingRight: 15 },
  policyTitle: { fontSize: 14, fontWeight: '700', color: Colors.textDark, marginBottom: 4 },
  policySubtitle: { fontSize: 11, color: Colors.textMedium, lineHeight: 16 },
  stepperControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: 20, paddingHorizontal: 5, paddingVertical: 2 },
  stepperBtn: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  stepperText: { fontSize: 18, color: Colors.primary, fontWeight: '600' },
  stepperValue: { marginHorizontal: 10, fontSize: 14, fontWeight: '700', color: Colors.primaryDark },
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: 15 },
  rbacContainer: { paddingVertical: 5 },
  roleTagsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 8 },
  roleTag: { backgroundColor: Colors.background, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, borderWidth: 1, borderColor: Colors.border },
  roleTagActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
  roleTagText: { fontSize: 11, color: Colors.textMedium, fontWeight: '500' },
  roleTagTextActive: { fontSize: 11, color: Colors.white, fontWeight: '600' },
  btnPrimary: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 5,
  },
  btnPrimaryText: { color: Colors.white, fontSize: 14, fontWeight: '700', marginLeft: 8 },
});
