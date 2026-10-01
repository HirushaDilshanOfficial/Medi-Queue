import React from 'react';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { PatientTheme } from '../../constants/PatientTheme';
import { DesignImage, type DesignImageName } from '../../components/patient/DesignImage';

type IconProps = { color: ColorValue; size: number };

function tabIcon(name: DesignImageName) {
  return function TabBarIcon({ size }: IconProps) {
    return <DesignImage name={name} size={size} />;
  };
}

const HomeIcon = tabIcon('home');
const DoctorsIcon = tabIcon('stethoscope');
const QueueIcon = tabIcon('ticket');
const ProfileIcon = tabIcon('profile');

export default function PatientTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: PatientTheme.brand,
        tabBarInactiveTintColor: PatientTheme.textMuted,
        tabBarStyle: {
          backgroundColor: PatientTheme.surface,
          borderTopColor: PatientTheme.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: PatientTheme.designType.caption,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: HomeIcon,
        }}
      />
      <Tabs.Screen
        name="doctors"
        options={{
          title: 'Doctors',
          tabBarIcon: DoctorsIcon,
        }}
      />
      <Tabs.Screen
        name="queue"
        options={{
          title: 'Queue',
          tabBarIcon: QueueIcon,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ProfileIcon,
        }}
      />
    </Tabs>
  );
}
