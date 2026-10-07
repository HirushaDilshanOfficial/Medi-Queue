import { BASE_URL } from '../config';
import { getAuthToken } from './http';

export const fetchMohDashboard = async () => {
  const token = await getAuthToken();
  if (!token) throw new Error('No auth token found');

  const res = await fetch(`${BASE_URL}/api/v1/moh/dashboard`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    throw new Error('Failed to fetch MOH dashboard data');
  }

  return res.json();
};
