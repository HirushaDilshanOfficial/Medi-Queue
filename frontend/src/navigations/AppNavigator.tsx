import { LocalizedText as Text } from '../i18n/LocalizedText';
import { useLanguage } from '../i18n/LanguageContext';
import React from 'react';
import { View, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

// Auth & MOH Screens
import LoginScreen from '../app/(auth)/login';
import RegisterScreen from '../app/(auth)/register';
import MOHDashboardScreen from '../screens/MOH/MOHDashboardScreen';
import DoctorDashboardScreen from '../screens/Doctor/DoctorDashboardScreen';
import {
  ReceptionistHomeScreen,
  RegisterPatientScreen,
  LiveQueueScreen,
  PatientsScreen,
  ReportsScreen,
} from '../screens/Receptionist';
import { ShiftProvider } from '../context/ShiftContext';

// ─────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────

export type ReceptionistHomeStackParamList = {
  Home: undefined;
  Queue: undefined;
};

export type ReceptionistTabParamList = {
  HomeTab: undefined;
  RegisterTab: undefined;
  PatientsTab: undefined;
  ReportsTab: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  MOHDashboard: undefined;
  ReceptionistTabs: undefined;
  Queue: undefined;
  DoctorDashboard: undefined;
};

// ─────────────────────────────────────────────────────────
// Placeholder Screens (Title Text Only)
// ─────────────────────────────────────────────────────────

export function HomePlaceholderScreen({ navigation }: any) {
  const { t } = useLanguage();
  return (
    <SafeAreaView style={styles.placeholderContainer}>
      <View style={styles.contentWrap}>
        <Text style={styles.placeholderTitle}>{t("Home")}</Text>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('Queue')}
          activeOpacity={0.7}
        >
          <Ionicons name="list" size={20} color={Colors.white} style={styles.buttonIcon} />
          <Text style={styles.actionButtonText}>{t("Open Queue")}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export function QueuePlaceholderScreen({ navigation }: any) {
  const { t } = useLanguage();
  return (
    <SafeAreaView style={styles.placeholderContainer}>
      <View style={styles.contentWrap}>
        <Text style={styles.placeholderTitle}>{t("Queue")}</Text>
        {navigation?.canGoBack?.() ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={18} color={Colors.primary} style={styles.backIcon} />
            <Text style={styles.backButtonText}>{t("Back")}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

export function RegisterPlaceholderScreen() {
  const { t } = useLanguage();
  return (
    <SafeAreaView style={styles.placeholderContainer}>
      <View style={styles.contentWrap}>
        <Text style={styles.placeholderTitle}>{t("Register")}</Text>
      </View>
    </SafeAreaView>
  );
}

export function PatientsPlaceholderScreen() {
  const { t } = useLanguage();
  return (
    <SafeAreaView style={styles.placeholderContainer}>
      <View style={styles.contentWrap}>
        <Text style={styles.placeholderTitle}>{t("Patients")}</Text>
      </View>
    </SafeAreaView>
  );
}

export function ReportsPlaceholderScreen() {
  const { t } = useLanguage();
  return (
    <SafeAreaView style={styles.placeholderContainer}>
      <View style={styles.contentWrap}>
        <Text style={styles.placeholderTitle}>{t("Reports")}</Text>
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────
// Receptionist Home Stack (Home + Queue)
// ─────────────────────────────────────────────────────────

const HomeStack = createNativeStackNavigator<ReceptionistHomeStackParamList>();

export function ReceptionistHomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Home" component={ReceptionistHomeScreen} />
      <HomeStack.Screen name="Queue" component={LiveQueueScreen} />
    </HomeStack.Navigator>
  );
}

import { ReceptionistRoleGuard } from '../components/ReceptionistRoleGuard';

// ─────────────────────────────────────────────────────────
// Receptionist Bottom Tab Navigator (Guarded)
// ─────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator<ReceptionistTabParamList>();

export function ReceptionistTabNavigator() {
  const { t } = useLanguage();
  return (
    <ReceptionistRoleGuard>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.textLight,
          tabBarStyle: {
            backgroundColor: Colors.white,
            borderTopColor: Colors.border,
            borderTopWidth: 1,
            height: 64,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap = 'home';

            if (route.name === 'HomeTab') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'RegisterTab') {
              iconName = focused ? 'person-add' : 'person-add-outline';
            } else if (route.name === 'PatientsTab') {
              iconName = focused ? 'people' : 'people-outline';
            } else if (route.name === 'ReportsTab') {
              iconName = focused ? 'document-text' : 'document-text-outline';
            }

            return <Ionicons name={iconName} size={size || 22} color={color} />;
          },
        })}
      >
        <Tab.Screen
          name="HomeTab"
          component={ReceptionistHomeStackNavigator}
          options={{ tabBarLabel: t('Home') }}
        />
        <Tab.Screen
          name="RegisterTab"
          component={RegisterPatientScreen}
          options={{ tabBarLabel: t('Register') }}
        />
        <Tab.Screen
          name="PatientsTab"
          component={PatientsScreen}
          options={{ tabBarLabel: t('Patients') }}
        />
        <Tab.Screen
          name="ReportsTab"
          component={ReportsScreen}
          options={{ tabBarLabel: t('Reports') }}
        />
      </Tab.Navigator>
    </ReceptionistRoleGuard>
  );
}

function GuardedQueueScreen(props: any) {
  return (
    <ReceptionistRoleGuard>
      <LiveQueueScreen {...props} />
    </ReceptionistRoleGuard>
  );
}

// ─────────────────────────────────────────────────────────
// Main Root Stack Navigator
// ─────────────────────────────────────────────────────────

const Stack = createNativeStackNavigator<RootStackParamList>();

export interface AppNavigatorProps {
  role?: 'MOH' | 'receptionist' | 'doctor' | 'patient' | string;
  initialRouteName?: keyof RootStackParamList;
}

export default function AppNavigator({
  role,
  initialRouteName,
}: AppNavigatorProps) {
  const isReceptionist =
    (role || '').toLowerCase() === 'receptionist';

  const defaultInitialRoute: keyof RootStackParamList = isReceptionist
    ? 'ReceptionistTabs'
    : role === 'MOH'
    ? 'MOHDashboard'
    : (role || '').toLowerCase() === 'doctor'
    ? 'DoctorDashboard'
    : 'Login';

  const resolvedInitialRoute = initialRouteName || defaultInitialRoute;

  return (
    // @ts-ignore - Expo router and React Navigation conflict workaround
    <NavigationContainer independent={true}>
      <ShiftProvider>
        <Stack.Navigator
          initialRouteName={resolvedInitialRoute}
          screenOptions={{ headerShown: false }}
        >
          {/* ---- AUTH SCREENS ---- */}
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />

          {/* ---- MOH DASHBOARD ---- */}
          <Stack.Screen name="MOHDashboard" component={MOHDashboardScreen} />

          {/* ---- RECEPTIONIST NAVIGATION ---- */}
          <Stack.Screen name="ReceptionistTabs" component={ReceptionistTabNavigator} />
          <Stack.Screen name="Queue" component={GuardedQueueScreen} />

          {/* ---- DOCTOR DASHBOARD ---- */}
          <Stack.Screen name="DoctorDashboard" component={DoctorDashboardScreen} />
        </Stack.Navigator>
      </ShiftProvider>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  placeholderContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textDark,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    minHeight: 44,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonIcon: {
    marginRight: 8,
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    minHeight: 44,
  },
  backIcon: {
    marginRight: 6,
  },
  backButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
