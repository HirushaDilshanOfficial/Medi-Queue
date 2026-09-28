import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';

// Import Screens
import DoctorHomeScreen from '../screens/Doctor/DoctorHomeScreen';
import PatientHomeScreen from '../screens/Patient/PatientHomeScreen';
import MOHHomeScreen from '../screens/MOH/MOHHomeScreen';
import ReceptionistHomeScreen from '../screens/Receptionist/ReceptionistHomeScreen';

// Define Route Types
export type RootStackParamList = {
  DoctorHome: undefined;
  PatientHome: undefined;
  MOHHome: undefined;
  ReceptionistHome: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    // @ts-ignore - Expo router and React Navigation conflict workaround
    <NavigationContainer independent={true}>
      <Stack.Navigator initialRouteName="PatientHome">
        <Stack.Screen 
          name="PatientHome" 
          component={PatientHomeScreen} 
          options={{ title: 'Patient Dashboard' }} 
        />
        <Stack.Screen 
          name="DoctorHome" 
          component={DoctorHomeScreen} 
          options={{ title: 'Doctor Dashboard' }} 
        />
        <Stack.Screen 
          name="ReceptionistHome" 
          component={ReceptionistHomeScreen} 
          options={{ title: 'Receptionist Dashboard' }} 
        />
        <Stack.Screen 
          name="MOHHome" 
          component={MOHHomeScreen} 
          options={{ title: 'MOH Dashboard' }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
