import { Platform } from 'react-native';

// Use localhost for iOS simulator, 10.0.2.2 for Android emulator.
// If you are testing on a real device, change this to your computer's local IP address.
// Set EXPO_PUBLIC_API_URL to override both (e.g. http://192.168.1.5:5000).
const EMULATOR_HOST = Platform.OS === 'android' ? 'http://10.0.2.2' : 'http://localhost';
const DEFAULT_PORT = 5000;

const override = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');

export const BASE_URL = override || `${EMULATOR_HOST}:${DEFAULT_PORT}`;

export const API_URL = `${BASE_URL}/api/v1`;
