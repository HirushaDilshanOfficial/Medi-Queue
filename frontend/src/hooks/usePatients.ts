import { useState, useEffect, useCallback, useRef } from 'react';
import { Patient } from '../types';
import {
  getPatients,
  searchPatients,
  getPatient,
  getErrorMessage,
} from '../services/api';

export type PatientListFilter = 'all' | 'pre_booked' | 'walk_in' | 'visited_today' | 'recent';

export interface UsePatientsReturn {
  list: Patient[];
  selected: Patient | null;
  loading: boolean;
  error: string | null;
  selectedLoading: boolean;
  selectedError: string | null;
  refresh: () => Promise<void>;
  selectPatient: (id: string | null) => Promise<Patient | null>;
}

/**
 * Custom hook to manage patient list search, filtering, and single patient selection.
 * - Takes a query string and filter ("all" | "visited_today" | "recent")
 * - If query.length >= 3, debounces for 400ms and calls searchPatients(query)
 * - Otherwise calls getPatients(filter)
 * - Exposes selectPatient(id) to fetch full profile and visit history into selected
 * - Tracks separate loading and error states for list and selected patient
 */
export const usePatients = (
  query: string = '',
  filter: PatientListFilter = 'all'
): UsePatientsReturn => {
  const [list, setList] = useState<Patient[]>([]);
  const [selected, setSelected] = useState<Patient | null>(null);

  // List loading & error states
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selected patient loading & error states
  const [selectedLoading, setSelectedLoading] = useState<boolean>(false);
  const [selectedError, setSelectedError] = useState<string | null>(null);

  const isMounted = useRef<boolean>(true);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch list data according to query and filter
  const fetchList = useCallback(
    async (searchQuery: string, currentFilter: PatientListFilter) => {
      try {
        setLoading(true);
        setError(null);

        const trimmed = (searchQuery || '').trim();

        if (trimmed.length >= 3) {
          const res = await searchPatients(trimmed);
          if (isMounted.current) {
            setList(res.patients || []);
          }
        } else {
          const patients = await getPatients(currentFilter);
          if (isMounted.current) {
            setList(patients || []);
          }
        }
      } catch (err: any) {
        if (isMounted.current) {
          const msg = getErrorMessage(err);
          setError(msg || 'Failed to fetch patients list');
          setList([]);
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  // Refresh current query / filter
  const refresh = useCallback(async () => {
    await fetchList(query, filter);
  }, [fetchList, query, filter]);

  // Load single patient details into selected
  const selectPatient = useCallback(
    async (id: string | null): Promise<Patient | null> => {
      if (!id) {
        if (isMounted.current) {
          setSelected(null);
          setSelectedLoading(false);
          setSelectedError(null);
        }
        return null;
      }

      try {
        if (isMounted.current) {
          setSelectedLoading(true);
          setSelectedError(null);
        }

        const patientData = await getPatient(id);
        if (isMounted.current) {
          setSelected(patientData);
        }
        return patientData;
      } catch (err: any) {
        if (isMounted.current) {
          const msg = getErrorMessage(err);
          setSelectedError(msg || 'Failed to load patient profile');
        }
        return null;
      } finally {
        if (isMounted.current) {
          setSelectedLoading(false);
        }
      }
    },
    []
  );

  // Manage debounce for query and filter changes
  useEffect(() => {
    isMounted.current = true;

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    const trimmed = (query || '').trim();

    if (trimmed.length >= 3) {
      // 400ms debounce when querying
      debounceTimer.current = setTimeout(() => {
        fetchList(query, filter);
      }, 400);
    } else {
      // Direct fetch or short transition when filtering
      fetchList(query, filter);
    }

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query, filter, fetchList]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return {
    list,
    selected,
    loading,
    error,
    selectedLoading,
    selectedError,
    refresh,
    selectPatient,
  };
};

export default usePatients;
