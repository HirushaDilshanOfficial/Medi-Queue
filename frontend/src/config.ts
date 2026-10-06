import { API_BASE_URL } from './services/api';

// Configured using EXPO_PUBLIC_API_URL or local Wi-Fi IP address (never localhost)
export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || API_BASE_URL || 'http://10.240.7.66:5001';

export const API_URL = `${BASE_URL}/api/v1`;
