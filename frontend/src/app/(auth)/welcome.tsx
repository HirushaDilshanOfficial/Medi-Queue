import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { AppIcon } from '../../components/AppIcon';

// Welcome/Splash Screen
export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>

        {/* ---- TEAL HEADER SECTION ---- */}
        <View style={styles.header}>
          <View style={styles.circleTopRight} />
          <View style={styles.circleBottomLeft} />

          <View style={styles.logoCard}>
            <AppIcon name="medical" size={36} color={Colors.primaryDark} />
          </View>

          <View style={styles.queueBadge}>
            <Text style={styles.queueBadgeLabel}>QUEUE</Text>
            <Text style={styles.queueBadgeNumber}>#024</Text>
          </View>

          <View style={styles.doctorsBadge}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><AppIcon name="profile" size={12} color={Colors.textMedium} /><Text style={styles.doctorsBadgeText}>CONNECTED</Text></View>
            <Text style={styles.doctorsBadgeNumber}>186 Doctors</Text>
          </View>

          <Text style={styles.appTitle}>Government OPD Queue{'\n'}Management System</Text>
          <Text style={styles.appSubtitle}>Ministry of Health · Sri Lanka</Text>
        </View>

        {/* ---- STATS SECTION ---- */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>24</Text>
            <Text style={styles.statLabel}>HOSPITALS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>186</Text>
            <Text style={styles.statLabel}>DOCTORS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>2.6M+</Text>
            <Text style={styles.statLabel}>PATIENTS</Text>
          </View>
        </View>

        {/* ---- FEATURE CARDS ---- */}
        <View style={styles.featureCard}>
          <AppIcon name="clock" size={24} color={Colors.primaryDark} style={{ marginRight: 14 }} />
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Live Token Tracking</Text>
            <Text style={styles.featureDesc}>Real-time queue notifications & estimated arrival time</Text>
          </View>
        </View>

        <View style={styles.featureCard}>
          <AppIcon name="clipboard" size={24} color={Colors.primaryDark} style={{ marginRight: 14 }} />
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Paperless Digital Pass</Text>
            <Text style={styles.featureDesc}>Instant QR verification at outpatient consultation rooms</Text>
          </View>
        </View>


        {/* ---- BUTTONS SECTION ---- */}
        <View style={styles.formContainer}>
          {/* Login button → Login form ලට යනවා */}
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/(auth)/login')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={styles.loginButtonText}>Login</Text><AppIcon name="forward" size={20} color={Colors.white} /></View>
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
  queueBadge: {
    position: 'absolute', top: 70, right: 40,
    backgroundColor: Colors.white, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  queueBadgeLabel: { fontSize: 9, color: Colors.textMedium, fontWeight: '600' },
  queueBadgeNumber: { fontSize: 14, color: Colors.primaryDark, fontWeight: '700' },
  doctorsBadge: {
    position: 'absolute', bottom: 80, left: 30,
    backgroundColor: Colors.white, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  doctorsBadgeText: { fontSize: 9, color: Colors.textMedium, fontWeight: '600' },
  doctorsBadgeNumber: { fontSize: 13, color: Colors.primaryDark, fontWeight: '700' },
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
