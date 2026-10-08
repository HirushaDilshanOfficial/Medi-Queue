import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { DOCTOR_TOKENS as C } from './doctorTheme';
import { useLanguage } from '../../i18n/LanguageContext';

export type DoctorTabType = 'home' | 'queue' | 'records' | 'schedule' | 'rx';

interface DoctorBottomNavProps {
  activeTab: DoctorTabType;
  onTabPress?: (tab: DoctorTabType) => void;
}

export const DoctorBottomNav = ({ activeTab, onTabPress }: DoctorBottomNavProps) => {
  const { t } = useLanguage();

  const handlePress = (tab: DoctorTabType) => {
    if (onTabPress) {
      onTabPress(tab);
      return;
    }
    if (tab === 'home') {
      try { router.push('/(doctor)/dashboard' as any); } catch (e) { router.push('/' as any); }
    } else if (tab === 'queue') {
      try { router.push('/(doctor)/queue' as any); } catch (e) { router.push('/queue' as any); }
    } else if (tab === 'records') {
      try { router.push('/(doctor)/records' as any); } catch (e) { router.push('/records' as any); }
    } else if (tab === 'schedule') {
      try { router.push('/(doctor)/schedule' as any); } catch (e) { router.push('/schedule' as any); }
    } else if (tab === 'rx') {
      try { router.push('/(doctor)/prescription' as any); } catch (e) { router.push('/prescription' as any); }
    }
  };

  return (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => handlePress('home')}
        activeOpacity={0.7}
      >
        <Ionicons
          name={activeTab === 'home' ? 'home' : 'home-outline'}
          size={22}
          color={activeTab === 'home' ? C.teal : C.sub}
        />
        <Text style={[styles.tabLabel, activeTab === 'home' && styles.tabLabelActive]}>
          {t('Home')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => handlePress('queue')}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name="ticket-confirmation-outline"
          size={22}
          color={activeTab === 'queue' ? C.teal : C.sub}
        />
        <Text style={[styles.tabLabel, activeTab === 'queue' && styles.tabLabelActive]}>
          {t('Queue')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => handlePress('records')}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name="folder-account-outline"
          size={22}
          color={activeTab === 'records' ? C.teal : C.sub}
        />
        <Text style={[styles.tabLabel, activeTab === 'records' && styles.tabLabelActive]}>
          {t('Records')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => handlePress('schedule')}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name="calendar-month-outline"
          size={22}
          color={activeTab === 'schedule' ? C.teal : C.sub}
        />
        <Text style={[styles.tabLabel, activeTab === 'schedule' && styles.tabLabelActive]}>
          {t('Schedule')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => handlePress('rx')}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name="clipboard-edit-outline"
          size={22}
          color={activeTab === 'rx' ? C.teal : C.sub}
        />
        <Text style={[styles.tabLabel, activeTab === 'rx' && styles.tabLabelActive]}>
          {t('Prescription')}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    flex: 1,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.sub,
    marginTop: 2,
  },
  tabLabelActive: {
    color: C.teal,
    fontWeight: '800',
  },
});
