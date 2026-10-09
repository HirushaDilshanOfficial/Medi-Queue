import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, StatusBar, Platform, Switch } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../constants/Colors';
import { useTheme } from '../../theme/ThemeContext';
import { BASE_URL } from '../../config';

import { getAuthToken, clearAuthToken } from '../../services/http';
import { MOHBottomNav } from '../../components/moh/MOHBottomNav';
import Toast from 'react-native-toast-message';

export default function ProfileScreen() {
  const { t } = useLanguage();
  const { isDarkMode, toggleTheme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      
      const token = await getAuthToken();
      const userStr = await AsyncStorage.getItem('user');

      if (!token) {
        setUserData({ fullName: 'NO TOKEN FOUND' });
        setLoading(false);
        return;
      }

      if (userStr) {
        const user = JSON.parse(userStr);
        setUserData(user);
      } else {
        // Try fetching if user data is missing in storage
        const response = await fetch(`${BASE_URL}/api/users/profile`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setUserData(data);
          await AsyncStorage.setItem('user', JSON.stringify(data));
        } else {
          setUserData({ fullName: 'FETCH FAILED: ' + response.status });
        }
      }
    } catch (error: any) {
      console.error('Failed to fetch profile', error);
      setUserData({
        fullName: 'ERROR: ' + error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProfile().finally(() => setRefreshing(false));
  }, []);

  const handleLogout = async () => {
    await clearAuthToken();
    await AsyncStorage.removeItem('user');
    Toast.show({
      type: 'info',
      text1: t('Logged Out'),
      text2: t('You have been successfully logged out.'),
      position: 'top',
      topOffset: 60,
    });
    router.replace('/(auth)/login');
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.primaryDark }}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <ScrollView 
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <View style={styles.headerBackground}>
            <View style={styles.headerTop}>
              <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
                <Text style={styles.iconText}>←</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{t("My Profile")}</Text>
              <View style={{ width: 36 }} />
            </View>

            <View style={styles.profileSection}>
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>{userData?.fullName ? userData.fullName.charAt(0).toUpperCase() : 'U'}</Text>
              </View>
              <Text style={styles.userNameText}>{userData?.fullName || t('Loading...')}</Text>
              <Text style={styles.userRoleText}>{t(userData?.role ?? '') || t('Role N/A')}</Text>
            </View>
          </View>

          {/* Content */}
          <View style={styles.contentSection}>
            <View style={styles.infoCard}>
              <Text style={styles.sectionTitle}>{t("Personal Information")}</Text>
              
              <View style={styles.infoRow}>
                <View style={styles.infoIconBg}>
                  <Text style={styles.infoIcon}>👤</Text>
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>{t("Full Name")}</Text>
                  <Text style={styles.infoValue}>{userData?.fullName || t('N/A')}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <View style={styles.infoIconBg}>
                  <Text style={styles.infoIcon}>✉️</Text>
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>{t("Email")}</Text>
                  <Text style={styles.infoValue}>{userData?.email || t('N/A')}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <View style={styles.infoIconBg}>
                  <Text style={styles.infoIcon}>📞</Text>
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>{t("Contact Number")}</Text>
                  <Text style={styles.infoValue}>{userData?.phone || t('N/A')}</Text>
                </View>
              </View>
            </View>

            <View style={styles.settingsCard}>
              <Text style={styles.sectionTitle}>{t("Settings")}</Text>
              
              <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/(moh)/edit-profile')}>
                <View style={styles.settingItemLeft}>
                  <Text style={styles.settingIcon}>✏️</Text>
                  <Text style={styles.settingText}>{t("Edit Profile")}</Text>
                </View>
                <Text style={styles.settingArrow}>❯</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingItem}>
                <View style={styles.settingItemLeft}>
                  <Text style={styles.settingIcon}>🔐</Text>
                  <Text style={styles.settingText}>{t("Change Password")}</Text>
                </View>
                <Text style={styles.settingArrow}>❯</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingItem}>
                <View style={styles.settingItemLeft}>
                  <Text style={styles.settingIcon}>🔔</Text>
                  <Text style={styles.settingText}>{t("Notifications")}</Text>
                </View>
                <Text style={styles.settingArrow}>❯</Text>
              </TouchableOpacity>

              <View style={styles.settingItem}>
                <View style={styles.settingItemLeft}>
                  <Text style={styles.settingIcon}>{isDarkMode ? '🌙' : '☀️'}</Text>
                  <Text style={styles.settingText}>{t("Dark Mode")}</Text>
                </View>
                <Switch 
                  value={isDarkMode} 
                  onValueChange={toggleTheme} 
                  trackColor={{ false: '#e0e0e0', true: Colors.primaryDark }}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutIcon}>🚪</Text>
              <Text style={styles.logoutText}>{t("Log Out")}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
      <MOHBottomNav activeRoute="profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 100 },
  headerBackground: {
    backgroundColor: Colors.primaryDark,
    paddingTop: Platform.OS === 'android' ? 20 : 10,
    paddingHorizontal: 20,
    paddingBottom: 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: { color: Colors.white, fontSize: 18, fontWeight: 'bold' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.white },
  
  profileSection: {
    alignItems: 'center',
    marginTop: 10,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarText: { fontSize: 32, color: Colors.white, fontWeight: '700' },
  userNameText: { fontSize: 22, fontWeight: '700', color: Colors.white, marginBottom: 4 },
  userRoleText: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },

  contentSection: {
    paddingHorizontal: 20,
    marginTop: -20,
  },
  
  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    elevation: 4,
    shadowColor: Colors.primary,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  infoIcon: { fontSize: 18 },
  infoTextContainer: { flex: 1 },
  infoLabel: { fontSize: 11, color: Colors.textLight, fontWeight: '600', marginBottom: 2 },
  infoValue: { fontSize: 14, color: Colors.textDark, fontWeight: '600' },
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: 12 },

  settingsCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    elevation: 4,
    shadowColor: Colors.primary,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: { fontSize: 16, marginRight: 12 },
  settingText: { fontSize: 14, color: Colors.textDark, fontWeight: '500' },
  settingArrow: { fontSize: 12, color: Colors.textLight, fontWeight: 'bold' },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ffebee',
    borderRadius: 16,
    paddingVertical: 15,
    elevation: 2,
    shadowColor: '#e74c3c',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  logoutIcon: { fontSize: 16, marginRight: 8 },
  logoutText: { fontSize: 15, color: Colors.error, fontWeight: '700' },
});
