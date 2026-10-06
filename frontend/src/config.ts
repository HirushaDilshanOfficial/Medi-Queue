import { Platform } from 'react-native';
import { API_BASE_URL } from './services/api';

export const getBaseUrl = (): string => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    const hostname = window.location.hostname;
    return `http://${hostname === 'localhost' || hostname === '127.0.0.1' ? 'localhost' : hostname}:5001`;
  }
  return process.env.EXPO_PUBLIC_API_URL || API_BASE_URL || 'http://10.240.7.66:5001';
};

export const BASE_URL = getBaseUrl();
export const API_URL = `${BASE_URL}/api/v1`;
