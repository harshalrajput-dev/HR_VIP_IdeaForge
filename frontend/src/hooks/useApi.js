import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Minimal data-fetching hook: run a request, expose { data, meta, loading,
 * error, refetch } and always ignore responses from stale/unmounted calls.
 *
 * @param {(params?: object) => Promise<any>} fetcher
 * @param {Array} deps re-runs the request when these change
 * @param {{ skip?: boolean, initialData?: any }} [options]
 */
export function useApi(fetcher, deps = [], options = {}) {
  const { skip = false, initialData = null } = options;

  const [data, setData] = useState(initialData);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);

  const requestId = useRef(0);
  const mounted = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const execute = useCallback(async () => {
    if (skip) {
      setLoading(false);
      return null;
    }
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetcherRef.current();
      if (!mounted.current || id !== requestId.current) return null;
      setData(res?.data ?? res);
      setMeta(res?.meta ?? null);
      return res;
    } catch (err) {
      if (mounted.current && id === requestId.current) setError(err);
      return null;
    } finally {
      if (mounted.current && id === requestId.current) setLoading(false);
    }
  }, [skip]);

  useEffect(() => {
    execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, meta, loading, error, refetch: execute, setData };
}

/**
 * Wraps a one-shot mutation (submit form, upvote, ...) with pending/error state.
 * @param {(payload?: any) => Promise<any>} mutator
 */
export function useMutation(mutator) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const mounted = useRef(true);
  const mutatorRef = useRef(mutator);
  mutatorRef.current = mutator;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const mutate = useCallback(async (payload) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await mutatorRef.current(payload);
      if (mounted.current) setSuccess(res);
      return res;
    } catch (err) {
      if (mounted.current) setError(err);
      throw err;
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  return { mutate, loading, error, success, reset, setError };
}
