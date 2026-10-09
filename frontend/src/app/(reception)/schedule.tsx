import React from 'react';
import { useRouter } from 'expo-router';
import { DoctorScheduleScreen } from '../../screens/Receptionist/DoctorScheduleScreen';

export default function ReceptionScheduleRoute() {
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
      default:
        if (router.canGoBack()) {
          router.back();
        } else {
          router.push('/(reception)/home');
        }
    }
  };

  return (
    <DoctorScheduleScreen
      onBack={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.push('/(reception)/home');
        }
      }}
      onNavigate={handleNavigate}
    />
  );
}
