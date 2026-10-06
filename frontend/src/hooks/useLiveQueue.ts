import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getQueue, getErrorMessage, QueueResponse } from '../services/api';

export type LiveQueueFilter = 'all' | 'walk_in' | 'pre_booked';

export interface UseLiveQueueReturn {
  data: QueueResponse | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  refresh: (isPull?: boolean) => Promise<void>;
}

/**
 * Custom hook to fetch and auto-refresh the Receptionist Live Queue.
 * - Takes a filter ("all" | "walk_in" | "pre_booked")
 * - Calls getQueue(filter) from services/api.ts
 * - Returns { data, loading, error, refreshing, refresh }
 * - Auto-refreshes every 10 seconds via setInterval
 * - Cleans up the timer on unmount
 * - Pauses polling when the app is in the background (AppState !== 'active')
 * - Resumes polling and fetches latest data when returning to active
 */
export const useLiveQueue = (
  filter: LiveQueueFilter = 'all',
  date?: string
): UseLiveQueueReturn => {
  const [data, setData] = useState<QueueResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isMounted = useRef<boolean>(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchQueueData = useCallback(
    async (isPull: boolean = false) => {
      try {
        if (isPull) {
          setRefreshing(true);
        } else if (!data) {
          setLoading(true);
        }
        setError(null);

        const params = {
          type: filter,
          ...(date ? { date } : {}),
        };

        const result = await getQueue(params);
        if (isMounted.current) {
          setData(result);
        }
      } catch (err: any) {
        if (isMounted.current) {
          const msg = getErrorMessage(err);
          setError(msg || 'Failed to fetch live queue data');
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [filter, date, data]
  );

  // Manual refresh handler
  const refresh = useCallback(
    async (isPull: boolean = true) => {
      await fetchQueueData(isPull);
    },
    [fetchQueueData]
  );

  // Initial fetch and refetch when filter or date changes
  useEffect(() => {
    isMounted.current = true;
    fetchQueueData(false);

    return () => {
      isMounted.current = false;
    };
  }, [filter, date]);

  // Manage 10-second polling interval and pause when AppState is inactive/background
  useEffect(() => {
    const startTimer = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        if (AppState.currentState === 'active') {
          fetchQueueData(false);
        }
      }, 10000);
    };

    const stopTimer = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    if (AppState.currentState === 'active') {
      startTimer();
    }

    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
          fetchQueueData(false);
          startTimer();
        } else {
          stopTimer();
        }
      }
    );

    return () => {
      stopTimer();
      subscription.remove();
    };
  }, [fetchQueueData]);

  return {
    data,
    loading,
    error,
    refreshing,
    refresh,
  };
};

export default useLiveQueue;
