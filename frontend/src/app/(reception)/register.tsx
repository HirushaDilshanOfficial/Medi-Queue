import React from 'react';
import { useRouter } from 'expo-router';
import { RegisterPatientScreen } from '../../screens/Receptionist/RegisterPatientScreen';

export default function RegisterScreen() {
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
      case 'Patients':
      case 'patients':
        router.push('/(reception)/patients');
        break;
      default:
        router.push('/(reception)/home');
    }
  };

  return <RegisterPatientScreen onNavigate={handleNavigate} />;
}
