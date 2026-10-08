import { LocalizedText as Text } from '../i18n/LocalizedText';
import { useLanguage } from '../i18n/LanguageContext';
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../constants/Colors';
import { getAuthToken } from '../services/http';
import { BASE_URL } from '../config';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function NotificationsScreen() {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'All' | 'Today' | 'Past 7 Days'>('All');
  const [clearedAt, setClearedAt] = useState<Date | null>(null);
  const [userId, setUserId] = useState<string>('');

  const fetchNotifications = async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch(`${BASE_URL}/api/v1/notifications`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
        const userStr = await AsyncStorage.getItem('user');
        const uid = userStr ? JSON.parse(userStr)._id : '';
        setUserId(uid);
        
        const clearedTime = await AsyncStorage.getItem(`notifications_cleared_at_${uid}`);
        if (clearedTime) {
          setClearedAt(new Date(clearedTime));
        }

        if (data && data.length > 0) {
          // Save the latest notification's time to avoid client/server clock skew
          await AsyncStorage.setItem(`last_notification_read_time_${uid}`, data[0].createdAt);
        } else {
          await AsyncStorage.setItem(`last_notification_read_time_${uid}`, new Date().toISOString());
        }
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleClearAll = async () => {
    const now = new Date();
    setClearedAt(now);
    await AsyncStorage.setItem(`notifications_cleared_at_${userId}`, now.toISOString());
  };

  const filteredNotifications = notifications.filter((n) => {
    const nDate = new Date(n.createdAt);
    if (clearedAt && nDate < clearedAt) return false;
    
    if (filter === 'Today') {
      const today = new Date();
      return nDate.getDate() === today.getDate() && 
             nDate.getMonth() === today.getMonth() && 
             nDate.getFullYear() === today.getFullYear();
    }
    if (filter === 'Past 7 Days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return nDate >= sevenDaysAgo;
    }
    return true;
  });

  const renderItem = ({ item }: { item: any }) => {
    const date = new Date(item.createdAt).toLocaleDateString();
    const time = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={styles.notificationCard}>
        <View style={styles.iconContainer}>
          <Ionicons name="notifications" size={24} color={Colors.primaryDark} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.message}>{item.message}</Text>
          <Text style={styles.timestamp}>{date} • {time}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />
      <SafeAreaView style={{ flex: 0, backgroundColor: Colors.primaryDark }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("Notifications")}</Text>
        <TouchableOpacity onPress={handleClearAll}>
          <Text style={{ color: Colors.white, fontSize: 14 }}>{t("Clear All")}</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        {['All', 'Today', 'Past 7 Days'].map((f) => (
          <TouchableOpacity 
            key={f} 
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f as any)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {t(f)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : filteredNotifications.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="notifications-off-outline" size={64} color={Colors.textLight} />
          <Text style={styles.emptyText}>{t("No notifications yet")}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primaryDark,
    paddingTop: 10,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    marginRight: 10,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterText: {
    fontSize: 14,
    color: Colors.textMedium,
    fontWeight: '500',
  },
  filterTextActive: {
    color: Colors.white,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 3,
    shadowColor: Colors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: Colors.textMedium,
    lineHeight: 20,
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 12,
    color: Colors.textLight,
    fontWeight: '500',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textMedium,
    fontWeight: '500',
  },
});
