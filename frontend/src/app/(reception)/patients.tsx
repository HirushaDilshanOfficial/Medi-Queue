import React from 'react';
import { useRouter } from 'expo-router';
import { PatientsScreen } from '../../screens/Receptionist/PatientsScreen';

export default function ReceptionPatientsScreen() {
  const router = useRouter();

  const handleNavigate = (route: string) => {
    switch (route) {
      case 'Home':
      case 'home':
        router.push('/(reception)/home');
        break;
      case 'Queue':
      case 'queue':
        router.push('/(reception)/queue');
        break;
      case 'RegisterTab':
      case 'register':
        router.push('/(reception)/register');
        break;
      case 'ReportsTab':
      case 'reports':
        router.push('/(reception)/reports');
        break;
      default:
        router.push('/(reception)/home');
    }
  };

  return <PatientsScreen onNavigate={handleNavigate} />;
}
