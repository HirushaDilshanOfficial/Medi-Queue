import { Stack } from 'expo-router';
import { LanguageProvider } from '../i18n/LanguageContext';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Root layout - Expo Router (SDK 57+)
export default function RootLayout() {
  return (
    <LanguageProvider><View style={{ flex: 1 }}>
      <LanguageSwitcher />
      <SafeAreaProvider style={{ flex: 1 }}><Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)/welcome" />
      <Stack.Screen name="(auth)/login" />
      <Stack.Screen name="(auth)/register" />
      <Stack.Screen name="(moh)/dashboard" />
      <Stack.Screen name="(patient)" />
      <Stack.Screen name="(reception)" />
      <Stack.Screen name="(doctor)/dashboard" />
      <Stack.Screen name="(doctor)/queue" />
      <Stack.Screen name="(doctor)/schedule" />
      <Stack.Screen name="(doctor)/prescription" />
      <Stack.Screen name="(doctor)/records" />
      <Stack.Screen name="schedule" />
    </Stack></SafeAreaProvider></View></LanguageProvider>
  );
}
