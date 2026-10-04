import React from 'react';
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
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#004c5b',
        tabBarInactiveTintColor: '#3f484b',
        tabBarStyle: {
          backgroundColor: '#f3faff',
          borderTopWidth: 0,
          height: 64 + insets.bottom,
          paddingBottom: Math.max(8, insets.bottom),
          paddingTop: 8,
          boxShadow: '0 -2px 12px rgba(0,0,0,0.05)',
        },
        tabBarLabelStyle: {
          fontSize: PatientTheme.designType.caption,
          fontWeight: '500',
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
        name="profile/index"
        options={{
          title: 'Profile',
          tabBarIcon: ProfileIcon,
          tabBarStyle: {
            backgroundColor: '#ffffff',
            borderTopWidth: 0,
            height: 64 + insets.bottom,
            paddingBottom: Math.max(8, insets.bottom),
            paddingTop: 8,
            boxShadow: '0 -4px 20px -2px rgba(19,34,40,0.06)',
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
          title: 'Book',
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
          title: 'Edit profile',
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile/history"
        options={{
          title: 'Visit history',
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile/reports"
        options={{
          title: 'Medical reports',
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile/report/new"
        options={{
          title: 'Lodge a report',
          href: null,
        }}
      />
    </Tabs>
  );
}
