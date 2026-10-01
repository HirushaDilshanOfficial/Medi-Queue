import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Colors } from '../../constants/Colors';

// MOHDashboardScreen - Ministry of Health admin main screen
// Features: system stats, hospital overview, reports
export default function MOHDashboardScreen({ navigation }: any) {
  const hospitals = [
    { name: 'Colombo National Hospital', activeQueue: 145, doctors: 12, status: 'high' },
    { name: 'Kandy General Hospital', activeQueue: 87, doctors: 8, status: 'medium' },
    { name: 'Galle Teaching Hospital', activeQueue: 34, doctors: 6, status: 'low' },
  ];

  const getStatusColor = (status: string) => {
    if (status === 'high') return Colors.error;
    if (status === 'medium') return Colors.warning;
    return Colors.success;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ---- HEADER ---- */}
        <View style={styles.header}>
          <View style={styles.circleDecor} />
          <View>
            <Text style={styles.greeting}>MOH Admin Portal 🏛️</Text>
            <Text style={styles.userName}>Ministry of Health</Text>
            <Text style={styles.subText}>System Overview · Sri Lanka</Text>
          </View>
        </View>

        {/* ---- NATIONAL STATS ---- */}
        <View style={styles.nationalStats}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>24</Text>
            <Text style={styles.statLbl}>Hospitals</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>186</Text>
            <Text style={styles.statLbl}>Doctors</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>2.6M</Text>
            <Text style={styles.statLbl}>Patients</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>266</Text>
            <Text style={styles.statLbl}>Active Now</Text>
          </View>
        </View>

        {/* ---- QUICK ACTIONS ---- */}
        <Text style={styles.sectionTitle}>Management</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionCard}>
            <Text style={styles.actionIcon}>🏥</Text>
            <Text style={styles.actionLabel}>Manage{'\n'}Hospitals</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard}>
            <Text style={styles.actionIcon}>👨‍⚕️</Text>
            <Text style={styles.actionLabel}>Manage{'\n'}Doctors</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard}>
            <Text style={styles.actionIcon}>📊</Text>
            <Text style={styles.actionLabel}>View{'\n'}Reports</Text>
          </TouchableOpacity>
        </View>

        {/* ---- HOSPITAL STATUS LIST ---- */}
        <Text style={styles.sectionTitle}>Hospital Queue Status</Text>
        {hospitals.map((hospital, index) => (
          <View key={index} style={styles.hospitalCard}>
            <View style={styles.hospitalInfo}>
              <Text style={styles.hospitalName}>{hospital.name}</Text>
              <Text style={styles.hospitalDetails}>
                {hospital.doctors} Doctors Active
              </Text>
            </View>
            <View style={styles.hospitalRight}>
              <Text style={[styles.queueCount, { color: getStatusColor(hospital.status) }]}>
                {hospital.activeQueue}
              </Text>
              <Text style={styles.queueCountLabel}>In Queue</Text>
            </View>
          </View>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    overflow: 'hidden',
    position: 'relative',
  },
  circleDecor: {
    position: 'absolute', top: -30, right: -30,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: Colors.primaryLight, opacity: 0.25,
  },
  greeting: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  userName: { fontSize: 20, fontWeight: '800', color: Colors.white, marginTop: 2 },
  subText: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 3 },
  nationalStats: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: -16,
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: Colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: '900', color: Colors.primaryDark },
  statLbl: { fontSize: 10, color: Colors.textLight, marginTop: 3 },
  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: Colors.textDark,
    marginHorizontal: 16, marginTop: 24, marginBottom: 12,
  },
  actionsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10 },
  actionCard: {
    flex: 1, backgroundColor: Colors.white, borderRadius: 16,
    padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  actionIcon: { fontSize: 28, marginBottom: 8 },
  actionLabel: { fontSize: 12, fontWeight: '600', color: Colors.textDark, textAlign: 'center', lineHeight: 17 },
  hospitalCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hospitalInfo: { flex: 1 },
  hospitalName: { fontSize: 14, fontWeight: '700', color: Colors.textDark },
  hospitalDetails: { fontSize: 12, color: Colors.textMedium, marginTop: 3 },
  hospitalRight: { alignItems: 'center' },
  queueCount: { fontSize: 24, fontWeight: '900' },
  queueCountLabel: { fontSize: 10, color: Colors.textLight, marginTop: 2 },
});
