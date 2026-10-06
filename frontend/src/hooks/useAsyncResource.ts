import { useCallback, useEffect, useRef, useState } from 'react';
import { HttpError } from '../services/http';

type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  setData: (updater: T | ((current: T | null) => T | null)) => void;
};

/**
 * Runs an async loader and keeps the screen in sync with it.
 *
 * A request id guards against a slow first request overwriting the result of a
 * later one, which otherwise shows stale data after the user changes a filter
 * quickly.
 */
export function useAsyncResource<T>(loader: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(0);
  const mounted = useRef(true);
  const loaderRef = useRef(loader);

  // Declared before the fetching effect so it has already run when that effect
  // reads it, and kept out of render to satisfy the compiler's ref rules.
  useEffect(() => {
    loaderRef.current = loader;
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // `announceLoading` is false for the first load because the hook starts in the
  // loading state already; setting it again would be a redundant render. The
  // error is cleared on success rather than before the request, so nothing in the
  // synchronous part of this function touches state.
  const run = useCallback(async (announceLoading = true) => {
    const id = requestId.current + 1;
    requestId.current = id;

    if (announceLoading) setLoading(true);

    try {
      const result = await loaderRef.current();
      if (!mounted.current || requestId.current !== id) return;
      setData(result);
      setError(null);
    } catch (caught) {
      if (!mounted.current || requestId.current !== id) return;
      setError(caught instanceof HttpError ? caught.message : 'Something went wrong. Please try again.');
    } finally {
      if (mounted.current && requestId.current === id) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Started on a microtask rather than inline. An effect body must not schedule
    // a state update synchronously, and awaiting immediately would still run the
    // first statements of `run` during this effect.
    let cancelled = false;

    void Promise.resolve().then(() => {
      if (!cancelled) void run(false);
    });

    return () => {
      cancelled = true;
    };
    // Callers pass the values that should trigger a refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const reload = useCallback(() => {
    void run(true);
  }, [run]);

  const update = useCallback((updater: T | ((current: T | null) => T | null)) => {
    setData((current) =>
      typeof updater === 'function' ? (updater as (c: T | null) => T | null)(current) : updater,
    );
  }, []);

  return { data, loading, error, reload, setData: update };
}
