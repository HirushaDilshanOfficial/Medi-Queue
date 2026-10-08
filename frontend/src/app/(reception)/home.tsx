import React from 'react';
import { useRouter } from 'expo-router';
import { ReceptionistHomeScreen } from '../../screens/Receptionist/ReceptionistHomeScreen';

export default function HomeScreen() {
  const router = useRouter();

  const handleNavigate = (route: string) => {
    switch (route) {
      case 'Queue':
      case 'queue':
        router.push('/(reception)/queue');
        break;
      case 'RegisterTab':
      case 'register':
        router.push('/(reception)/register');
        break;
      case 'PatientsTab':
      case 'patients':
        router.push('/(reception)/patients');
        break;
      case 'ReportsTab':
      case 'reports':
        router.push('/(reception)/reports');
        break;
      case 'Notifications':
      case 'notifications':
        router.push('/notifications');
        break;
      case 'Login':
      case 'login':
        router.replace('/(auth)/login');
        break;
      default:
        router.push('/(reception)/queue');
    }
  };

  return <ReceptionistHomeScreen onNavigate={handleNavigate} />;
}

