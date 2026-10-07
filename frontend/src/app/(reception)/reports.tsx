import React from 'react';
import { useRouter } from 'expo-router';
import { ReportsScreen } from '../../screens/Receptionist/ReportsScreen';

export default function ReceptionReportsScreen() {
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
      case 'PatientsTab':
      case 'patients':
        router.push('/(reception)/patients');
        break;
      default:
        router.push('/(reception)/home');
    }
  };

  return <ReportsScreen onNavigate={handleNavigate} />;
}
