import { Stack } from 'expo-router';

// Root layout - Expo Router ලේ Stack use කරනවා (SDK 57+)
export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)/welcome" />
      <Stack.Screen name="(auth)/login" />
      <Stack.Screen name="(auth)/register" />
      <Stack.Screen name="(moh)/dashboard" />
      <Stack.Screen name="(patient)" />
      <Stack.Screen name="(reception)" />
      <Stack.Screen name="(doctor)" />
      <Stack.Screen name="(doctor)/dashboard" />
      <Stack.Screen name="(doctor)/queue" />
      <Stack.Screen name="(doctor)/schedule" />
      <Stack.Screen name="(doctor)/prescription" />
      <Stack.Screen name="(doctor)/records" />
      <Stack.Screen name="schedule" />
    </Stack>
  );
}
