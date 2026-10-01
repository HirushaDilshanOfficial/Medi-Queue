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
      <Stack.Screen name="(doctor)/dashboard" />
    </Stack>
  );
}

