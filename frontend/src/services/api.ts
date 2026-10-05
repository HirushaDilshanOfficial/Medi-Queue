/**
 * API service configuration
 * Reads backend API URL from EXPO_PUBLIC_API_URL. Never uses localhost.
 */

const FALLBACK_IP_URL = 'http://10.240.7.66:5001';

export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL || FALLBACK_IP_URL;

// Helper to normalize path and prepend API_BASE_URL
const resolveUrl = (path: string): string => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const base = API_BASE_URL.replace(/\/+$/, '');
  const endpoint = path.startsWith('/') ? path : `/${path}`;
  return `${base}${endpoint}`;
};

export const api = {
  baseUrl: API_BASE_URL,
  get: async (url: string, options?: RequestInit) => {
    const targetUrl = resolveUrl(url);
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
      ...options,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `GET ${targetUrl} failed with status ${response.status}`
      );
    }
    return response.json();
  },
  post: async (url: string, data?: any, options?: RequestInit) => {
    const targetUrl = resolveUrl(url);
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
      body: data !== undefined ? JSON.stringify(data) : undefined,
      ...options,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `POST ${targetUrl} failed with status ${response.status}`
      );
    }
    return response.json();
  },
};

export default api;

