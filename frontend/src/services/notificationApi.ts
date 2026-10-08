import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { getAuthToken, HttpError } from './http';

export type NotificationItem = {
  _id: string;
  title: string;
  message: string;
  createdAt: string;
  recipient?: string | null;
  kind?: 'personal' | 'announcement';
  targetRole?: string;
  isEmergency?: boolean;
};

export type NotificationInbox = { userId: string; items: NotificationItem[]; token: string };
const readKey = (userId: string) => `notification_read_time:${userId}`;

export const notificationApi = {
  async list(): Promise<NotificationInbox> {
    const token = await getAuthToken();
    if (!token) throw new HttpError(401, 'Please sign in to view your notifications.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
      });
      if (!response.ok) throw new HttpError(response.status, 'Could not load notifications. Please try again.');
      const userId = response.headers.get('X-Notification-User');
      const items: NotificationItem[] = await response.json();
      // Fail closed when an old server supplies an unscoped feed or the session changes.
      if (!userId || !Array.isArray(items) || await getAuthToken() !== token) {
        throw new HttpError(401, 'Please sign in to view your notifications.');
      }
      return { userId, items, token };
    } finally { clearTimeout(timer); }
  },

  async markRead(inbox: NotificationInbox): Promise<void> {
    if (await getAuthToken() !== inbox.token) return;
    const latest = inbox.items[0]?.createdAt ?? new Date().toISOString();
    await AsyncStorage.setItem(readKey(inbox.userId), latest);
  },

  async unreadCount(): Promise<number> {
    const inbox = await notificationApi.list();
    const readTime = await AsyncStorage.getItem(readKey(inbox.userId));
    if (await getAuthToken() !== inbox.token) return 0;
    const lastRead = readTime ? new Date(readTime).getTime() : 0;
    return inbox.items.filter(item => new Date(item.createdAt).getTime() > lastRead).length;
  },
};
