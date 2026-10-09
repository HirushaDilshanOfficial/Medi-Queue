import { LocalizedText as Text } from '../i18n/LocalizedText';
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthToken } from '../services/http';
import { BASE_URL } from '../config';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../i18n/LanguageContext';

export default function EmergencyBanner() {
  const { t } = useLanguage();
  const [banner, setBanner] = useState<any>(null);

  useEffect(() => {
    fetchEmergencyAlerts();
  }, []);

  const fetchEmergencyAlerts = async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;
      const res = await fetch(`${BASE_URL}/api/v1/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const emergencyBanners = data.filter((n: any) => n.isEmergency);
        if (emergencyBanners.length > 0) {
          const latestEmergency = emergencyBanners[0];
          const isWithin24Hours = (new Date().getTime() - new Date(latestEmergency.createdAt).getTime()) < 24 * 60 * 60 * 1000;
          const isDismissed = await AsyncStorage.getItem(`dismissed_emergency_${latestEmergency._id}`);
          if (isWithin24Hours && !isDismissed) {
            setBanner(latestEmergency);
          } else {
            setBanner(null);
          }
        }
      }
    } catch (e) {
      console.log('Failed to fetch emergency alerts', e);
    }
  };

  const handleDismiss = async () => {
    if (banner) {
      await AsyncStorage.setItem(`dismissed_emergency_${banner._id}`, 'true');
      setBanner(null);
    }
  };

  if (!banner) return null;

  return (
    <View style={styles.bannerContainer}>
      <View style={styles.content}>
        <Ionicons name="warning" size={24} color="#FFF" style={styles.icon} />
        <View style={styles.textContainer}>
          <Text style={styles.title}>{banner.title}</Text>
          <Text style={styles.message}>{banner.message}</Text>
        </View>
        <TouchableOpacity onPress={handleDismiss} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    backgroundColor: '#E53935',
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 100,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },
  message: {
    color: '#FFF',
    fontSize: 13,
    opacity: 0.9,
  },
  closeBtn: {
    padding: 8,
  },
});
