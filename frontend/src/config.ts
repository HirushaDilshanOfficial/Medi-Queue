import { Platform } from 'react-native';

// Use localhost for iOS simulator, 10.0.2.2 for Android emulator
// If you are testing on a real device, change this to your computer's local IP address (e.g., http://192.168.1.5:5001)
export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:5001' : 'http://localhost:5001');

export const API_URL = `${BASE_URL}/api/v1`;
