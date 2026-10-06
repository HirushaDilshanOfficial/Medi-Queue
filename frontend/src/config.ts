import { Platform } from 'react-native';
import { API_BASE_URL } from './services/api';

const DEFAULT_IP =
  Platform.OS === 'web' ? 'http://localhost:5001' : 'http://192.168.1.2:5001';

// Configured using EXPO_PUBLIC_API_URL or local Wi-Fi IP address
export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || API_BASE_URL || DEFAULT_IP;

export const API_URL = `${BASE_URL}/api/v1`;

