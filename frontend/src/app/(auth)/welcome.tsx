import { LanguageSwitcher } from '../../i18n/LanguageSwitcher';
import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { AppIcon } from '../../components/AppIcon';
import { BASE_URL } from '../../config';

// Welcome/Splash Screen
export default function WelcomeScreen() {
  const { t } = useLanguage();
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
<View style={{ position: 'absolute', top: 16, right: 16, zIndex: 2 }}><LanguageSwitcher tone="dark" /></View>
          <View style={styles.circleTopRight} />
          <View style={styles.circleBottomLeft} />

          <View style={styles.logoCard}>
            <Image 
              source={require('../../../assets/images/logo.png')} 
              style={{ width: 60, height: 60 }} 
              resizeMode="contain" 
            />
          </View>

          <View style={styles.queueBadge}>
            <Text style={styles.queueBadgeLabel}>{t("QUEUE")}</Text>
            <Text style={styles.queueBadgeNumber}>#024</Text>
          </View>

          <View style={styles.doctorsBadge}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><AppIcon name="profile" size={12} color={Colors.textMedium} /><Text style={styles.doctorsBadgeText}>{t("CONNECTED")}</Text></View>
            <Text style={styles.doctorsBadgeNumber}>{t("186 Doctors")}</Text>
          </View>
          <Text style={styles.appTitle}>{t("Government OPD Queue")}{'\n'}{t("Management System")}</Text>
          <Text style={styles.appSubtitle}>{t("Ministry of Health · Sri Lanka")}</Text>
        </View>

        {/* ---- STATS SECTION ---- */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.hospitals}</Text>
            <Text style={styles.statLabel}>{t("HOSPITALS")}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.doctors}</Text>
            <Text style={styles.statLabel}>{t("DOCTORS")}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.patients > 1000 ? `${(stats.patients/1000).toFixed(1)}k+` : stats.patients}</Text>
            <Text style={styles.statLabel}>{t("PATIENTS")}</Text>
          </View>
        </View>

        {/* ---- FEATURE CARDS ---- */}
        <View style={styles.featureCard}>
          <View style={styles.featureIconContainer}>
            <AppIcon name="clock" size={24} color={Colors.primaryDark} />
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>{t("Live Token Tracking")}</Text>
            <Text style={styles.featureDesc}>{t("Real-time queue notifications & estimated arrival time")}</Text>
          </View>
        </View>

        <View style={styles.featureCard}>
          <View style={styles.featureIconContainer}>
            <AppIcon name="clipboard" size={24} color={Colors.primaryDark} />
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>{t("Paperless Digital Pass")}</Text>
            <Text style={styles.featureDesc}>{t("Instant QR verification at outpatient consultation rooms")}</Text>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={styles.loginButtonText}>{t("Login")}</Text><AppIcon name="forward" size={20} color={Colors.white} /></View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={styles.registerButtonText}>{t("New patient? Create Account")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: {
    backgroundColor: Colors.primaryDark,
    paddingTop: 80, paddingBottom: 60, paddingHorizontal: 24,
    alignItems: 'center', overflow: 'hidden', position: 'relative',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
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
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
  },
  queueBadgeLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.5,
  },
  queueBadgeNumber: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.white,
  },
  doctorsBadge: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
  },
  doctorsBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.5,
  },
  doctorsBadgeNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
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
    backgroundColor: Colors.white, marginHorizontal: 20, marginTop: 16,
    borderRadius: 20, padding: 16, 
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 3,
  },
  featureIconContainer: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: Colors.tint,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 16,
  },
  featureIcon: { fontSize: 24 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 15, fontWeight: '700', color: Colors.textDark, marginBottom: 4 },
  featureDesc: { fontSize: 13, color: Colors.textMedium, lineHeight: 18 },
  formContainer: { paddingHorizontal: 20, paddingTop: 30, paddingBottom: 50 },
  input: {
    backgroundColor: Colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: Colors.textDark, marginBottom: 12,
  },
  loginButton: {
    backgroundColor: Colors.primaryDark, 
    borderRadius: 16,
    paddingVertical: 18, 
    alignItems: 'center', 
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 6,
  },
  loginButtonText: { color: Colors.white, fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  registerButton: {
    alignItems: 'center', marginTop: 20, paddingVertical: 16,
    borderRadius: 16, backgroundColor: Colors.tint,
  },
  registerButtonText: { color: Colors.primaryDark, fontSize: 15, fontWeight: '700' },
});
