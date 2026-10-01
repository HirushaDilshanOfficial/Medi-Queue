import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Platform,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/Colors';

// MOH Dashboard - Expo Router version matching the premium UI design
export default function MOHDashboardScreen() {
  const quickActions = [
    { id: 1, icon: '🏥', label: 'Hospitals', route: '/(moh)/manage-hospitals' as any },
    { id: 2, icon: '👨‍⚕️', label: 'Doctors', route: null },
    { id: 3, icon: '👩‍💼', label: 'Staff', route: '/(moh)/manage-staff' as any },
    { id: 4, icon: '📊', label: 'Reports', route: null },
    { id: 5, icon: '⚙️', label: 'Settings', route: null },
  ];

  const hospitalClinics = [
    { id: 1, icon: '🦴', name: 'Orthopedic' },
    { id: 2, icon: '🧠', name: 'Neuron' },
    { id: 3, icon: '👂', name: 'ENT' },
    { id: 4, icon: '❤️', name: 'Cardiology' },
    { id: 5, icon: '👶', name: 'Pediatric' },
    { id: 6, icon: '👁️', name: 'Eye Clinic' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: Colors.white }}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />
      {/* Top Safe Area for Notch */}
      <SafeAreaView style={{ flex: 0, backgroundColor: Colors.primaryDark }} />
      
      {/* Main Safe Area */}
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <View style={{ flex: 1, backgroundColor: Colors.background }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            {/* ---- TEAL CURVED HEADER SECTION ---- */}
        <View style={styles.headerBackground}>
          
          {/* Top Info Row */}
          <View style={styles.headerTop}>
            <View style={styles.profileSection}>
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>M</Text>
                <View style={styles.onlineDot} />
              </View>
              <View>
                <Text style={styles.greetingText}>Good Morning,</Text>
                <Text style={styles.userNameText}>Ministry of Health</Text>
              </View>
            </View>
            <View style={styles.headerIcons}>
              <TouchableOpacity style={styles.iconButton}>
                <Text style={styles.iconText}>🔔</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={() => router.replace('/(auth)/login')}>
                <Text style={styles.iconText}>🚪</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Status Text */}
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>National OPD Central Health Portal • Online</Text>
          </View>

          {/* Active Live Queue Card (Adapted for MOH) */}
          <View style={styles.activeQueueCard}>
            <View style={styles.queueCardHeader}>
              <View style={styles.queueIconContainer}>
                <Text style={styles.queueIcon}>🏥</Text>
              </View>
              <View style={styles.queueTitleContainer}>
                <Text style={styles.queueTitleLabel}>SYSTEM STATUS</Text>
                <Text style={styles.queueTitle}>National Health Grid</Text>
              </View>
              <TouchableOpacity style={styles.queueArrowBtn}>
                <Text style={styles.queueArrowText}>❯</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.queueCardBody}>
              <View>
                <Text style={styles.queueNumberLabel}>TOTAL QUEUES</Text>
                <Text style={styles.queueNumber}>2,456</Text>
                <View style={styles.queueTimeRow}>
                  <Text style={styles.queueTimeIcon}>🕒</Text>
                  <Text style={styles.queueTimeText}>Updated: Just now</Text>
                </View>
              </View>
              <View style={styles.servingBadge}>
                <Text style={styles.servingBadgeText}>All Systems Nominal</Text>
              </View>
            </View>
            
            {/* Progress Bar representation */}
            <View style={styles.progressBarBg}>
              <View style={styles.progressBarFill} />
            </View>
          </View>

        </View>

        {/* ---- CONTENT SECTION (White Background) ---- */}
        <View style={styles.contentSection}>
          
          {/* Main Action Banner (Add Staff / Register) */}
          <View style={styles.actionBanner}>
            <View style={styles.actionBannerTextContainer}>
              <Text style={styles.actionBannerTag}>STAFF MANAGEMENT</Text>
              <Text style={styles.actionBannerTitle}>Add Doctors &{'\n'}Hospital Staff</Text>
              <Text style={styles.actionBannerDesc}>Instant credential generation</Text>
            </View>
            <TouchableOpacity 
              style={styles.actionBannerButton}
              onPress={() => router.push('/(moh)/add-staff')}
            >
              <Text style={styles.actionBannerButtonText}>Add Staff  →</Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search hospitals, doctors or clinics..."
              placeholderTextColor={Colors.textLight}
            />
          </View>

          {/* Alert / Notice Banner */}
          <View style={styles.noticeBanner}>
            <View style={styles.noticeIconContainer}>
              <Text style={styles.noticeIcon}>📢</Text>
            </View>
            <Text style={styles.noticeText}>Next update: <Text style={styles.noticeTextBold}>System Maintenance</Text></Text>
            <Text style={styles.noticeTime}>Tonight</Text>
          </View>

          {/* Quick Actions Grid */}
          <View style={styles.quickActionsContainer}>
            {quickActions.map((action) => (
              <TouchableOpacity 
                key={action.id} 
                style={styles.quickActionItem}
                onPress={() => action.route ? router.push(action.route) : null}
              >
                <View style={styles.quickActionIconBg}>
                  <Text style={styles.quickActionIcon}>{action.icon}</Text>
                </View>
                <Text style={styles.quickActionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Hospital Clinics Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Hospital Clinics</Text>
            <TouchableOpacity>
              <Text style={styles.sectionLink}>See All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.clinicsGrid}>
            {hospitalClinics.map((clinic) => (
              <TouchableOpacity key={clinic.id} style={styles.clinicCard}>
                <View style={styles.clinicIconContainer}>
                  <Text style={styles.clinicIcon}>{clinic.icon}</Text>
                </View>
                <Text style={styles.clinicName}>{clinic.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

        </View>
      </ScrollView>

      {/* ---- BOTTOM NAVIGATION BAR ---- */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Text style={[styles.navIcon, styles.navIconActive]}>🏠</Text>
          <Text style={[styles.navLabel, styles.navLabelActive]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>🏥</Text>
          <Text style={styles.navLabel}>Hospitals</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>⚠️</Text>
          <Text style={styles.navLabel}>Alerts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>🛡️</Text>
          <Text style={styles.navLabel}>Policy</Text>
        </TouchableOpacity>
      </View>

        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // safeArea: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 100 }, // Space for bottom nav
  
  // HEADER
  headerBackground: {
    backgroundColor: Colors.primaryDark,
    paddingTop: Platform.OS === 'android' ? 20 : 10,
    paddingHorizontal: 20,
    paddingBottom: 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  profileSection: { flexDirection: 'row', alignItems: 'center' },
  avatarPlaceholder: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', marginRight: 12, position: 'relative'
  },
  avatarText: { fontSize: 20, color: Colors.white, fontWeight: '700' },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2, width: 10, height: 10,
    borderRadius: 5, backgroundColor: Colors.success, borderWidth: 2, borderColor: Colors.primaryDark
  },
  greetingText: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 2 },
  userNameText: { fontSize: 18, fontWeight: '700', color: Colors.white },
  headerIcons: { flexDirection: 'row', gap: 10 },
  iconButton: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center'
  },
  iconText: { fontSize: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success, marginRight: 8 },
  statusText: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },

  // ACTIVE QUEUE CARD (Glassmorphism look)
  activeQueueCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 24, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  queueCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  queueIconContainer: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', marginRight: 12
  },
  queueIcon: { fontSize: 20 },
  queueTitleContainer: { flex: 1 },
  queueTitleLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '700', letterSpacing: 0.5, marginBottom: 2 },
  queueTitle: { fontSize: 15, fontWeight: '700', color: Colors.white },
  queueArrowBtn: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center'
  },
  queueArrowText: { color: Colors.white, fontSize: 12, fontWeight: 'bold' },
  
  queueCardBody: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16
  },
  queueNumberLabel: { fontSize: 11, color: Colors.textLight, fontWeight: '700', marginBottom: 4 },
  queueNumber: { fontSize: 24, fontWeight: '800', color: Colors.primaryDark, marginBottom: 4 },
  queueTimeRow: { flexDirection: 'row', alignItems: 'center' },
  queueTimeIcon: { fontSize: 12, marginRight: 4 },
  queueTimeText: { fontSize: 11, color: Colors.textMedium, fontWeight: '500' },
  servingBadge: { backgroundColor: '#e2f5ec', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  servingBadgeText: { color: Colors.success, fontSize: 11, fontWeight: '700' },
  
  progressBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 3 },
  progressBarFill: { width: '70%', height: '100%', backgroundColor: Colors.white, borderRadius: 3 },

  // CONTENT SECTION
  contentSection: { paddingHorizontal: 20, paddingTop: 10 },

  // MAIN BANNER
  actionBanner: {
    backgroundColor: Colors.primary, borderRadius: 20, padding: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 15, elevation: 4, shadowColor: Colors.primary, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }
  },
  actionBannerTextContainer: { flex: 1, paddingRight: 15 },
  actionBannerTag: {
    backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    fontSize: 9, color: Colors.white, fontWeight: '700', marginBottom: 8, letterSpacing: 0.5
  },
  actionBannerTitle: { fontSize: 18, fontWeight: '700', color: Colors.white, lineHeight: 24, marginBottom: 6 },
  actionBannerDesc: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  actionBannerButton: { backgroundColor: '#f1c40f', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  actionBannerButtonText: { color: Colors.textDark, fontWeight: '700', fontSize: 13 },

  // SEARCH BAR
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, marginTop: 20,
    borderWidth: 1, borderColor: Colors.border, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5
  },
  searchIcon: { fontSize: 16, marginRight: 10 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textDark },

  // NOTICE BANNER
  noticeBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f9fa',
    borderRadius: 14, padding: 12, marginTop: 15, borderWidth: 1, borderColor: '#d3eff2'
  },
  noticeIconContainer: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primaryDark, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  noticeIcon: { fontSize: 14 },
  noticeText: { flex: 1, fontSize: 13, color: Colors.textMedium },
  noticeTextBold: { fontWeight: '700', color: Colors.primaryDark },
  noticeTime: { fontSize: 12, fontWeight: '700', color: Colors.primary, backgroundColor: 'rgba(14, 143, 163, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },

  // QUICK ACTIONS
  quickActionsContainer: {
    flexDirection: 'row', justifyContent: 'space-between', backgroundColor: Colors.white,
    borderRadius: 20, padding: 16, marginTop: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5
  },
  quickActionItem: { alignItems: 'center' },
  quickActionIconBg: {
    width: 48, height: 48, borderRadius: 16, backgroundColor: Colors.background,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8
  },
  quickActionIcon: { fontSize: 20 },
  quickActionLabel: { fontSize: 11, color: Colors.textMedium, fontWeight: '500' },

  // CLINICS GRID
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textDark },
  sectionLink: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  
  clinicsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
    backgroundColor: Colors.white, borderRadius: 20, padding: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5
  },
  clinicCard: { width: '30%', alignItems: 'center', marginBottom: 20 },
  clinicIconContainer: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: Colors.background,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: Colors.border
  },
  clinicIcon: { fontSize: 22 },
  clinicName: { fontSize: 11, color: Colors.textMedium, fontWeight: '500', textAlign: 'center' },

  // BOTTOM NAVIGATION
  bottomNav: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white, flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 12, paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1, borderTopColor: Colors.border, elevation: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10
  },
  navItem: { alignItems: 'center' },
  navIcon: { fontSize: 22, marginBottom: 4, color: Colors.textLight, opacity: 0.5 },
  navIconActive: { opacity: 1 },
  navLabel: { fontSize: 10, color: Colors.textLight, fontWeight: '500' },
  navLabelActive: { color: Colors.primaryDark, fontWeight: '700' },
});
