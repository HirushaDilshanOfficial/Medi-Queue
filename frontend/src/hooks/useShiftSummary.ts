import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getShiftSummary, getErrorMessage } from '../services/api';
import { ShiftSummary } from '../types';

export interface UseShiftSummaryReturn {
  data: ShiftSummary | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  refresh: (isPull?: boolean) => Promise<void>;
}

/**
 * Custom hook to fetch and auto-refresh the Receptionist Shift Summary data.
 * - Calls getShiftSummary()
 * - Auto-refreshes every 30 seconds via setInterval
 * - Clears the timer on unmount
 * - Pauses polling when the app is in the background (AppState !== 'active')
 * - Resumes polling and fetches latest data when the app returns to active
 * - Returns { data, loading, error, refreshing, refresh }
 */
export const useShiftSummary = (date?: string): UseShiftSummaryReturn => {
  const [data, setData] = useState<ShiftSummary | null>(null);
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

        const result = await getShiftSummary(date);
        if (isMounted.current) {
          setData(result);
        }
      } catch (err: any) {
        if (isMounted.current) {
          const msg = getErrorMessage(err);
          setError(msg || 'Failed to fetch shift summary');
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

  // Initial fetch on mount or date change
  useEffect(() => {
    isMounted.current = true;
    fetchData(false);

    return () => {
      isMounted.current = false;
    };
  }, [date]);

  // 30-second interval polling with background pause
  useEffect(() => {
    const startTimer = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        if (AppState.currentState === 'active') {
          fetchData(false);
        }
      }, 30000);
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

export default useShiftSummary;
