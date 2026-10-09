import React from 'react';
import { useRouter } from 'expo-router';
import { LiveQueueScreen } from '../../screens/Receptionist/LiveQueueScreen';

export default function QueueScreen() {
  const router = useRouter();

  const handleNavigate = (route: string) => {
    switch (route) {
      case 'Home':
      case 'home':
        if (router.canGoBack()) {
          router.back();
        } else {
          router.push('/(reception)/home');
        }
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
      default:
        if (router.canGoBack()) {
          router.back();
        } else {
          router.push('/(reception)/home');
        }
    }
  };

  return <LiveQueueScreen onNavigate={handleNavigate} />;
}
