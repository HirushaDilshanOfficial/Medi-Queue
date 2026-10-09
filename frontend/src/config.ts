import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { API_BASE_URL } from './services/api';

export const getBaseUrl = (): string => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    const hostname = window.location.hostname;
    return `http://${hostname === 'localhost' || hostname === '127.0.0.1' ? 'localhost' : hostname}:5001`;
  }
  
  // Prefer an explicit backend URL over the Expo development-server address.
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && !envUrl.includes('192.168.56.') && !envUrl.includes('192.168.1.2')) {
    return envUrl.includes(':5001') ? envUrl : `${envUrl.replace(/\/+$/, '')}:5001`;
  }

  // Fall back to the Expo host address for local development.
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1' && !ip.startsWith('192.168.56.')) {
      return `http://${ip}:5001`;
    }
  }

  return 'http://10.240.7.66:5001';
};

export const BASE_URL = getBaseUrl();
export const API_URL = `${getBaseUrl()}/api/v1`;
