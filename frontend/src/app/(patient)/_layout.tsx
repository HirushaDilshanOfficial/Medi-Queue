import React from 'react';
import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { PatientTheme } from '../../constants/PatientTheme';

type IconProps = { color: ColorValue; size: number };

function TabIcon({ glyph, color, size }: IconProps & { glyph: string }) {
  return <Text style={{ color, fontSize: size }}>{glyph}</Text>;
}

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
          fontSize: PatientTheme.fontSizeMicro,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <TabIcon glyph="🏠" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="doctors"
        options={{
          title: 'Doctors',
          tabBarIcon: ({ color, size }) => (
            <TabIcon glyph="🔍" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="queue"
        options={{
          title: 'Queue',
          tabBarIcon: ({ color, size }) => (
            <TabIcon glyph="🎫" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <TabIcon glyph="👤" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
