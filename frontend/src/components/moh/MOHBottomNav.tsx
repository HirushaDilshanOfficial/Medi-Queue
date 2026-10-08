import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useLanguage } from '../../i18n/LanguageContext';
import { LocalizedText as Text } from '../../i18n/LocalizedText';

export function MOHBottomNav({ activeRoute }: { activeRoute: 'dashboard' | 'hospitals' | 'staff' | 'profile' }) {
  const { t } = useLanguage();

  return (
    <View style={styles.bottomNav}>
      <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/(moh)/dashboard')}>
        <Ionicons name="home" size={24} color={activeRoute === 'dashboard' ? Colors.primaryDark : Colors.textLight} />
        <Text style={[styles.navLabel, activeRoute === 'dashboard' && styles.navLabelActive]}>{t("Home")}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/(moh)/manage-hospitals')}>
        <Ionicons name="business-outline" size={24} color={activeRoute === 'hospitals' ? Colors.primaryDark : Colors.textLight} />
        <Text style={[styles.navLabel, activeRoute === 'hospitals' && styles.navLabelActive]}>{t("Hospitals")}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/(moh)/manage-staff')}>
        <Ionicons name="id-card-outline" size={24} color={activeRoute === 'staff' ? Colors.primaryDark : Colors.textLight} />
        <Text style={[styles.navLabel, activeRoute === 'staff' && styles.navLabelActive]}>{t("Staff")}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/(moh)/profile')}>
        <Ionicons name="person-outline" size={24} color={activeRoute === 'profile' ? Colors.primaryDark : Colors.textLight} />
        <Text style={[styles.navLabel, activeRoute === 'profile' && styles.navLabelActive]}>{t("Profile")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white, flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 12, paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1, borderTopColor: Colors.border, elevation: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10
  },
  navItem: { alignItems: 'center' },
  navLabel: { fontSize: 10, color: Colors.textLight, fontWeight: '500', marginTop: 4 },
  navLabelActive: { color: Colors.primaryDark, fontWeight: '700' },
});
