import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getDashboard, getErrorMessage } from '../services/api';
import { DashboardData } from '../types';

export interface UseDashboardReturn {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  refresh: (isPull?: boolean) => Promise<void>;
}

/**
 * Custom hook to fetch and auto-refresh the Receptionist Dashboard data.
 * - Auto-refreshes every 10 seconds via setInterval
 * - Cleans up timer on unmount
 * - Pauses polling when app is in the background (AppState !== 'active')
 * - Resumes polling and fetches latest data when app returns to active
 */
export const useDashboard = (date?: string): UseDashboardReturn => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isMounted = useRef<boolean>(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(
    async (isPull: boolean = false) => {
      try {
        if (isPull) {
          setRefreshing(true);
        } else if (!data) {
          setLoading(true);
        }
        setError(null);

        const result = await getDashboard(date);
        if (isMounted.current) {
          setData(result);
        }
      } catch (err: any) {
        if (isMounted.current) {
          const msg = getErrorMessage(err);
          setError(msg || 'Failed to fetch dashboard data');
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [date, data]
  );

  // Manual refresh handler
  const refresh = useCallback(
    async (isPull: boolean = true) => {
      await fetchData(isPull);
    },
    [fetchData]
  );

  // Initial fetch and lifecycle tracking
  useEffect(() => {
    isMounted.current = true;
    fetchData(false);

    return () => {
      isMounted.current = false;
    };
  }, [date]);

  // Manage polling interval and pause on AppState change
  useEffect(() => {
    const startTimer = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        if (AppState.currentState === 'active') {
          fetchData(false);
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
          fetchData(false);
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
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refreshing,
    refresh,
  };
};

export default useDashboard;
