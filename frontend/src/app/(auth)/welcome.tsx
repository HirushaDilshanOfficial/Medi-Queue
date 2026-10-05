import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { BASE_URL } from '../../config';

// Welcome/Splash Screen
export default function WelcomeScreen() {
  const [stats, setStats] = useState({ hospitals: 0, doctors: 0, patients: 0 });

  useEffect(() => {
    fetch(`${BASE_URL}/api/v1/public/stats`)
      .then(res => res.json())
      .then(data => {
        if (data) {
          setStats({
            hospitals: data.hospitals || 0,
            doctors: data.doctors || 0,
            patients: data.patients || 0
          });
        }
      })
      .catch(err => console.error('Failed to fetch stats:', err));
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView 
        bounces={false} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View style={{ flex: 1 }}>
          {/* ---- TEAL HEADER SECTION ---- */}
        <View style={styles.header}>
          <View style={styles.circleTopRight} />
          <View style={styles.circleBottomLeft} />

          <View style={styles.logoCard}>
            <Text style={styles.logoIcon}>🏥</Text>
          </View>

          <Text style={styles.appTitle}>Government OPD Queue{'\n'}Management System</Text>
          <Text style={styles.appSubtitle}>Ministry of Health · Sri Lanka</Text>
        </View>

        {/* ---- STATS SECTION ---- */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.hospitals}</Text>
            <Text style={styles.statLabel}>HOSPITALS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.doctors}</Text>
            <Text style={styles.statLabel}>DOCTORS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.patients > 1000 ? `${(stats.patients/1000).toFixed(1)}k+` : stats.patients}</Text>
            <Text style={styles.statLabel}>PATIENTS</Text>
          </View>
        </View>

        {/* ---- FEATURE CARDS ---- */}
        <View style={styles.featureCard}>
          <Text style={styles.featureIcon}>🕐</Text>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Live Token Tracking</Text>
            <Text style={styles.featureDesc}>Real-time queue notifications & estimated arrival time</Text>
          </View>
        </View>

        <View style={styles.featureCard}>
          <Text style={styles.featureIcon}>📄</Text>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Paperless Digital Pass</Text>
            <Text style={styles.featureDesc}>Instant QR verification at outpatient consultation rooms</Text>
          </View>
        </View>

        </View>

        {/* ---- BUTTONS SECTION ---- */}
        <View style={styles.formContainer}>
          {/* Login button → Login form ලට යනවා */}
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.loginButtonText}>Login  →</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={styles.registerButtonText}>New patient? Create Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: 60, paddingBottom: 50, paddingHorizontal: 24,
    alignItems: 'center', overflow: 'hidden', position: 'relative',
  },
  circleTopRight: {
    position: 'absolute', top: -40, right: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: Colors.primaryLight, opacity: 0.3,
  },
  circleBottomLeft: {
    position: 'absolute', bottom: -30, left: -50,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: Colors.primaryLight, opacity: 0.2,
  },
  logoCard: {
    width: 80, height: 80, borderRadius: 20,
    backgroundColor: Colors.white,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 10, elevation: 6,
  },
  logoIcon: { fontSize: 36 },
  appTitle: {
    fontSize: 22, fontWeight: '700', color: Colors.white,
    textAlign: 'center', marginTop: 16, lineHeight: 30,
  },
  appSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: 6 },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    backgroundColor: Colors.white, marginHorizontal: 16, marginTop: -20,
    borderRadius: 16, paddingVertical: 18, elevation: 5,
  },
  statItem: { alignItems: 'center', flex: 1 },
  statNumber: { fontSize: 20, fontWeight: '800', color: Colors.primaryDark },
  statLabel: { fontSize: 10, color: Colors.textLight, fontWeight: '600', marginTop: 2, letterSpacing: 0.5 },
  statDivider: { width: 1, height: 30, backgroundColor: Colors.divider },
  featureCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, marginHorizontal: 16, marginTop: 12,
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border,
  },
  featureIcon: { fontSize: 24, marginRight: 14 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 14, fontWeight: '700', color: Colors.textDark },
  featureDesc: { fontSize: 12, color: Colors.textMedium, marginTop: 3, lineHeight: 17 },
  formContainer: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  input: {
    backgroundColor: Colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: Colors.textDark, marginBottom: 12,
  },
  loginButton: {
    backgroundColor: Colors.primaryDark, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 6, elevation: 5,
  },
  loginButtonText: { color: Colors.white, fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  registerButton: {
    alignItems: 'center', marginTop: 16, paddingVertical: 12,
    borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border,
  },
  registerButtonText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
});
