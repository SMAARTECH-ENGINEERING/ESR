import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs an async fetcher and tracks loading / refreshing / error / data state.
 * `fetcher` should be a stable useCallback from the caller (deps drive refetch).
 */
export function useApi(fetcher, deps = [], { auto = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(auto);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const result = await fetcher();
        if (mounted.current) setData(result);
        return result;
      } catch (err) {
        if (mounted.current) setError(err?.message || 'Something went wrong');
        throw err;
      } finally {
        if (mounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps
  );

  useEffect(() => {
    if (auto) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refresh = useCallback(() => run({ silent: true }), [run]);

  return { data, setData, loading, refreshing, error, refetch: run, refresh };
}
