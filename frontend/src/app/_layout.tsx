import { Stack, useSegments } from 'expo-router';
import { LanguageProvider } from '../i18n/LanguageContext';
import { ThemeProvider } from '../theme/ThemeContext';
import { View, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Toast from '../components/GlobalToast';
import { Ionicons } from '@expo/vector-icons';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

const toastConfig = {
  success: ({ text1, text2 }: any) => (
    <View style={{
      width: '92%', minHeight: 70, backgroundColor: 'rgba(255, 255, 255, 0.98)', 
      borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', 
      alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, 
      shadowOpacity: 0.15, shadowRadius: 15, elevation: 10,
    }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#E4F8EA', alignItems: 'center', justifyContent: 'center', marginRight: 15 }}>
        <Ionicons name="checkmark" size={24} color="#34C759" />
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={{ color: '#1C1C1E', fontSize: 15, fontWeight: '600', marginBottom: 2 }}>{text1}</Text>
        <Text style={{ color: '#8E8E93', fontSize: 13, lineHeight: 18 }} numberOfLines={2}>{text2}</Text>
      </View>
    </View>
  ),
  error: ({ text1, text2 }: any) => (
    <View style={{
      width: '92%', minHeight: 70, backgroundColor: 'rgba(255, 255, 255, 0.98)', 
      borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', 
      alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, 
      shadowOpacity: 0.15, shadowRadius: 15, elevation: 10,
    }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFEBEB', alignItems: 'center', justifyContent: 'center', marginRight: 15 }}>
        <Ionicons name="close" size={24} color="#FF3B30" />
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={{ color: '#1C1C1E', fontSize: 15, fontWeight: '600', marginBottom: 2 }}>{text1}</Text>
        <Text style={{ color: '#8E8E93', fontSize: 13, lineHeight: 18 }} numberOfLines={2}>{text2}</Text>
      </View>
    </View>
  ),
  info: ({ text1, text2 }: any) => (
    <View style={{
      width: '92%', minHeight: 70, backgroundColor: 'rgba(255, 255, 255, 0.98)', 
      borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', 
      alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, 
      shadowOpacity: 0.15, shadowRadius: 15, elevation: 10,
    }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#E3F2FD', alignItems: 'center', justifyContent: 'center', marginRight: 15 }}>
        <Ionicons name="information" size={24} color="#007AFF" />
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={{ color: '#1C1C1E', fontSize: 15, fontWeight: '600', marginBottom: 2 }}>{text1}</Text>
        <Text style={{ color: '#8E8E93', fontSize: 13, lineHeight: 18 }} numberOfLines={2}>{text2}</Text>
      </View>
    </View>
  )
};

function GlobalSafeArea() {

  const segments = useSegments();
  const firstSeg = (segments as any)?.[0] as string | undefined;
  
  if (firstSeg === '(auth)' || firstSeg === 'index' || !(segments as any)?.length || firstSeg === '(doctor)') {
    return null;
  }
  
  const isDark = ['(moh)', '(reception)', 'notifications', '(patient)'].includes(firstSeg || '');
  const bgColor = isDark ? '#0a6e7e' : '#f3faff';

  return <SafeAreaView edges={['top']} style={{ flex: 0, backgroundColor: bgColor }} />;
}

// Root layout - Expo Router
// Prevent auto hide
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  const segments = useSegments();
  const firstSeg = (segments as any)?.[0] as string | undefined;
  const isDark = ['(moh)', '(reception)', 'notifications', '(patient)'].includes(firstSeg || '');
  const rootBgColor = isDark ? '#0a6e7e' : '#f3faff';

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <View style={{ flex: 1, backgroundColor: rootBgColor }}>
            <GlobalSafeArea />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)/welcome" />
              <Stack.Screen name="(auth)/login" />
              <Stack.Screen name="(auth)/register" />
              <Stack.Screen name="(auth)/onboarding" />
              <Stack.Screen name="(moh)/dashboard" />
              <Stack.Screen name="(patient)" />
              <Stack.Screen name="(reception)" />
              <Stack.Screen name="(doctor)" />
              <Stack.Screen name="(doctor)/dashboard" />
              <Stack.Screen name="(doctor)/queue" />
              <Stack.Screen name="(doctor)/schedule" />
              <Stack.Screen name="(doctor)/prescription" />
              <Stack.Screen name="(doctor)/records" />
              <Stack.Screen name="(doctor)/ehr" />
              <Stack.Screen name="schedule" />
            </Stack>
            <Toast config={toastConfig} />
          </View>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
