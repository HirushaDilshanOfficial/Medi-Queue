import { useState, useEffect, useCallback, useRef } from 'react';
import { DoctorSchedule } from '../types';
import { getSchedules, getErrorMessage } from '../services/api';

export interface UseSchedulesReturn {
  schedules: DoctorSchedule[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Custom hook to fetch and manage doctor schedules for reception.
 * - Accepts an optional date string parameter ("YYYY-MM-DD")
 * - Exposes { schedules, loading, error, refresh }
 */
export const useSchedules = (date?: string): UseSchedulesReturn => {
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isMounted = useRef<boolean>(true);

  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await getSchedules(date ? { date } : undefined);
      if (isMounted.current) {
        const list = Array.isArray(res) ? res : res?.data || [];
        setSchedules(list);
      }
    } catch (err: unknown) {
      if (isMounted.current) {
        const msg = getErrorMessage(err);
        setError(msg || 'Failed to fetch doctor schedules');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [date]);

  const refresh = useCallback(async () => {
    await fetchSchedules();
  }, [fetchSchedules]);

  useEffect(() => {
    isMounted.current = true;
    fetchSchedules();

    return () => {
      isMounted.current = false;
    };
  }, [fetchSchedules]);

  return {
    schedules,
    loading,
    error,
    refresh,
  };
};

export default useSchedules;
