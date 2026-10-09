import { LocalizedText as Text } from '../i18n/LocalizedText';
import { useLanguage } from '../i18n/LanguageContext';
import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '../constants/Colors';

interface Props {
  activeTab: 'home' | 'hospitals' | 'staff' | 'patients' | 'profile';
}

export default function MOHBottomNav({ activeTab }: Props) {
  const { t } = useLanguage();
  return (
    <View style={styles.bottomNav}>
      <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/(moh)/dashboard')}>
        <Ionicons name={activeTab === 'home' ? 'home' : 'home-outline'} size={24} color={activeTab === 'home' ? Colors.primaryDark : Colors.textLight} />
        <Text style={[styles.navLabel, activeTab === 'home' && styles.navLabelActive]}>{t("Home")}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/(moh)/manage-hospitals')}>
        <Ionicons name={activeTab === 'hospitals' ? 'business' : 'business-outline'} size={24} color={activeTab === 'hospitals' ? Colors.primaryDark : Colors.textLight} />
        <Text style={[styles.navLabel, activeTab === 'hospitals' && styles.navLabelActive]}>{t("Hospitals")}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/(moh)/manage-staff')}>
        <Ionicons name={activeTab === 'staff' ? 'id-card' : 'id-card-outline'} size={24} color={activeTab === 'staff' ? Colors.primaryDark : Colors.textLight} />
        <Text style={[styles.navLabel, activeTab === 'staff' && styles.navLabelActive]}>{t("Staff")}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/(moh)/manage-patients')}>
        <Ionicons name={activeTab === 'patients' ? 'people' : 'people-outline'} size={24} color={activeTab === 'patients' ? Colors.primaryDark : Colors.textLight} />
        <Text style={[styles.navLabel, activeTab === 'patients' && styles.navLabelActive]}>{t("Patients")}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/(moh)/profile')}>
        <Ionicons name={activeTab === 'profile' ? 'person' : 'person-outline'} size={24} color={activeTab === 'profile' ? Colors.primaryDark : Colors.textLight} />
        <Text style={[styles.navLabel, activeTab === 'profile' && styles.navLabelActive]}>{t("Profile")}</Text>
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
  navLabel: { fontSize: 10, color: Colors.textLight, fontWeight: '500', marginTop: 2 },
  navLabelActive: { color: Colors.primaryDark, fontWeight: '700' },
});
