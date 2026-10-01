import React from 'react';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
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
          fontWeight: PatientTheme.weight.bold,
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
