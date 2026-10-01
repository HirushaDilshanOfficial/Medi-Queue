import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';

// Auth Screens
import LoginScreen from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';

// MOH Dashboard Screen
// TODO: Patient, Doctor, Receptionist screens - later add කරමු
import MOHDashboardScreen from '../screens/MOH/MOHDashboardScreen';

// Define all route names and their params
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  MOHDashboard: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    // @ts-ignore - Expo router and React Navigation conflict workaround
    <NavigationContainer independent={true}>
      {/* headerShown: false - because each screen has its own custom header */}
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{ headerShown: false }}
      >
        {/* ---- AUTH SCREENS ---- */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />

        {/* ---- MOH DASHBOARD ---- */}
        <Stack.Screen name="MOHDashboard" component={MOHDashboardScreen} />

        {/* TODO: PatientDashboard, DoctorDashboard, ReceptionistDashboard - later */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}


