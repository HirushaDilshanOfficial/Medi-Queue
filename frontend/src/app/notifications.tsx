import { LanguageSwitcher } from '../i18n/LanguageSwitcher';
import { LocalizedText as Text } from '../i18n/LocalizedText';
import { useLanguage } from '../i18n/LanguageContext';
import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Alert,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '../constants/Colors';
import { HttpError } from '../services/http';
import { notificationApi, type NotificationItem } from '../services/notificationApi';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function NotificationsScreen() {
  const { t, locale } = useLanguage();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const requestId = useRef(0);
  const [filter, setFilter] = useState<'All' | 'Today' | 'Past 7 Days'>('All');
  const [clearedAt, setClearedAt] = useState<Date | null>(null);
  const [userId, setUserId] = useState<string>('');

  const fetchNotifications = useCallback(async () => {
    const id = ++requestId.current;
    setNotifications([]);
    setUserId('');
    setClearedAt(null);
    setError(false);
    setLoading(true);
    try {
      const inbox = await notificationApi.list();
      if (requestId.current !== id) return;
      const clearedTime = await AsyncStorage.getItem(`notifications_cleared_at_${inbox.userId}`).catch(() => null);
      if (requestId.current !== id) return;
      setUserId(inbox.userId);
      setClearedAt(clearedTime ? new Date(clearedTime) : null);
      setNotifications(inbox.items);
      // Storage failure must not hide an otherwise valid personal inbox.
      void notificationApi.markRead(inbox).catch(() => {});
    } catch (error) {
      if (requestId.current !== id) return;
      setNotifications([]);
      if (error instanceof HttpError && error.status === 401) router.replace('/(auth)/login');
      else setError(true);
    } finally {
      if (requestId.current === id) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchNotifications();
      return () => {
        requestId.current++;
        setNotifications([]);
      };
    }, [fetchNotifications])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const performClearAll = async () => {
    if (!userId) return;
    const now = new Date();
    setClearedAt(now);
    await AsyncStorage.setItem(`notifications_cleared_at_${userId}`, now.toISOString()).catch(() => {});
  };

  const handleClearAll = () => {
    if (filteredNotifications.length === 0) return;
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined'
        ? window.confirm(t('Are you sure you want to clear all notifications?'))
        : true;
      if (confirmed) {
        performClearAll();
      }
    } else {
      Alert.alert(
        t('Clear Notifications'),
        t('Are you sure you want to clear all notifications?'),
        [
          { text: t('Cancel'), style: 'cancel' },
          {
            text: t('Clear All'),
            style: 'destructive',
            onPress: performClearAll,
          },
        ]
      );
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    const nDate = new Date(n.createdAt);
    if (clearedAt && nDate < clearedAt) return false;

    if (filter === 'Today') {
      const today = new Date();
      return (
        nDate.getDate() === today.getDate() &&
        nDate.getMonth() === today.getMonth() &&
        nDate.getFullYear() === today.getFullYear()
      );
    }
    if (filter === 'Past 7 Days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return nDate >= sevenDaysAgo;
    }
    return true;
  });

  const getCategoryLabel = (item: NotificationItem) => {
    if (item.isEmergency) return t('🚨 Emergency Alert');
    if (item.kind === 'personal' || item.recipient) return t('Personal notification');
    if (item.targetRole === 'Doctor') return t('Doctor notice');
    if (item.targetRole === 'Receptionist') return t('Counter notice');
    if (item.targetRole === 'MOH') return t('MOH notice');
    if (item.targetRole === 'Patient') return t('Patient notice');
    return t('Hospital message');
  };

  const formatTimestamp = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const timeStr = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return `${t('Today')} • ${timeStr}`;
    }
    const dateFormatted = d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    return `${dateFormatted} • ${timeStr}`;
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/' as any);
    }
  };

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const isEmergency = item.isEmergency;

    return (
      <View style={[styles.notificationCard, isEmergency && styles.emergencyCard]}>
        <View style={[styles.iconContainer, isEmergency && styles.emergencyIconContainer]}>
          <Ionicons
            name={isEmergency ? 'warning' : 'notifications'}
            size={22}
            color="#FFFFFF"
          />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.categoryTag, isEmergency && styles.emergencyTag]}>
            {getCategoryLabel(item)}
          </Text>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.message}>{item.message}</Text>
          <View style={styles.timestampRow}>
            <Ionicons name="time-outline" size={13} color="#94A3B8" style={{ marginRight: 4 }} />
            <Text style={styles.timestamp}>{formatTimestamp(item.createdAt)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#005963" />
      <SafeAreaView style={{ flex: 0, backgroundColor: '#005963' }} />

      {/* Header matching exact user screenshot */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
          accessibilityLabel={t("Back")}
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>{t('Notifications')}</Text>

        <TouchableOpacity
          onPress={handleClearAll}
          activeOpacity={0.7}
          style={styles.clearAllBtn}
          accessibilityLabel={t("Clear All")}
          accessibilityRole="button"
        >
          <Text style={styles.clearAllText}>{t('Clear All')}</Text>
        </TouchableOpacity>
        <LanguageSwitcher tone="dark" />
      </View>

      {/* Filter Tabs matching exact user screenshot */}
      <View style={styles.filterContainer}>
        {(['All', 'Today', 'Past 7 Days'] as const).map((f) => {
          const isActive = filter === f;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setFilter(f)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                {t(f)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content Body */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#005963" />
        </View>
      ) : filteredNotifications.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="notifications-off-outline" size={48} color="#94A3B8" />
          </View>
          <Text style={styles.emptyTitle}>
            {t(error ? 'Could not load notifications' : 'No notifications yet')}
          </Text>
          <Text style={styles.emptySub}>
            {t(
              error
                ? 'Please check your connection and tap retry.'
                : 'Broadcasts and important medical alerts will appear here.'
            )}
          </Text>
          <TouchableOpacity
            style={styles.refreshButton}
            accessibilityRole="button"
            onPress={onRefresh}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh-outline" size={16} color="#005963" style={{ marginRight: 6 }} />
            <Text style={styles.refreshBtnText}>{t('Refresh')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#005963"
              colors={['#005963']}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F8FA',
  },
  header: {
    backgroundColor: '#005963',
    paddingTop: Platform.OS === 'android' ? 14 : 10,
    paddingBottom: 22,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: '#002C32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { flexShrink: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  clearAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  clearAllText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    opacity: 0.95,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  filterChip: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 22,
    backgroundColor: '#EFF3F4',
    marginRight: 10,
  },
  filterChipActive: {
    backgroundColor: '#005963',
  },
  filterText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContainer: {
    paddingTop: 8,
    paddingBottom: 36,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8F1F3',
    shadowColor: '#005963',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  emergencyCard: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFF8F8',
  },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#00838F',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  emergencyIconContainer: {
    backgroundColor: '#EF4444',
  },
  textContainer: {
    flex: 1,
  },
  categoryTag: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5A7184',
    marginBottom: 3,
  },
  emergencyTag: {
    color: '#DC2626',
    fontWeight: '700',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
    lineHeight: 22,
  },
  message: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 8,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#E0F2F1',
  },
  refreshBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#005963',
  },
});
