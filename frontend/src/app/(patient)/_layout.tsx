import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PatientTheme } from '../../constants/PatientTheme';
import { DesignImage, type DesignImageName } from '../../components/patient/DesignImage';

type IconProps = { color: ColorValue; size: number };

function tabIcon(name: DesignImageName) {
  return function TabBarIcon({ color, size }: IconProps) {
    return <DesignImage name={name} size={size} color={color} />;
  };
}

const HomeIcon = tabIcon('home');
const DoctorsIcon = tabIcon('stethoscope');
const QueueIcon = tabIcon('ticket');
const ProfileIcon = tabIcon('profile');

export default function PatientTabsLayout() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#004c5b',
        tabBarInactiveTintColor: '#6f797c',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e0f0f9',
          height: 62 + insets.bottom,
          paddingBottom: Math.max(6, insets.bottom),
          paddingTop: 6,
          boxShadow: '0 -2px 12px rgba(0,76,91,0.06)',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('Home'),
          tabBarIcon: HomeIcon,
        }}
      />
      <Tabs.Screen
        name="doctors"
        options={{
          title: t('Doctors'),
          tabBarIcon: DoctorsIcon,
        }}
      />
      <Tabs.Screen
        name="queue"
        options={{
          title: t('Queue'),
          tabBarIcon: QueueIcon,
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: t('Profile'),
          tabBarIcon: ProfileIcon,
          tabBarStyle: {
            backgroundColor: '#ffffff',
            borderTopWidth: 1,
            borderTopColor: '#e0f0f9',
            height: 62 + insets.bottom,
            paddingBottom: Math.max(6, insets.bottom),
            paddingTop: 6,
            boxShadow: '0 -2px 12px rgba(0,76,91,0.06)',
          },
        }}
      />

      {/*
        Booking and rescheduling both land here. It is a tab-navigator screen with
        no tab entry so the four-tab bar is unchanged, and it draws its own header
        to match the flat dashboard styling.
      */}
      {/*
        Booking and rescheduling both land here. It is a tab-navigator screen with
        no tab entry so the four-tab bar is unchanged, and it draws its own header
        to match the flat dashboard styling.
      */}
      <Tabs.Screen
        name="doctor/[id]"
        options={{
          title: t('Book'),
          href: null,
          tabBarStyle: { display: 'none' },
        }}
      />

      {/*
        Part 4 detail screens. Same reasoning: pushed on top of the profile tab
        with their own headers, so none of them appear in the tab bar.
      */}
      <Tabs.Screen
        name="profile/edit"
        options={{
          title: t('Edit profile'),
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile/history"
        options={{
          title: t('Visit history'),
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile/reports"
        options={{
          title: t('Medical reports'),
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile/report/new"
        options={{
          title: t('Lodge a report'),
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile/report/[id]"
        options={{
          title: t('Edit report'),
          href: null,
          tabBarStyle: { display: 'none' },
        }}
      />
    </Tabs>
  );
}
