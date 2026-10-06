import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useQueryClient } from './queryClientProvider';
import { hashKey, type QueryKey } from './queryKey';
import type { FetchOptions, Fetcher, QueryState } from './queryClient';

/**
 * React binding for `QueryClient`.
 *
 * Owns the three things a cache cannot own on its own: triggering the first
 * fetch, subscribing to store updates, and the timers/external listeners that
 * must only exist while a component is mounted (polling, window focus).
 */

export interface UseQueryOptions<T> {
  queryKey: QueryKey;
  queryFn: Fetcher<T>;
  /** How long a cached value counts as fresh. */
  staleTime?: number;
  /** When false, no request is made and no polling/focus refetch runs. */
  enabled?: boolean;
  /** Poll interval in ms. Omit to disable polling. */
  refetchInterval?: number;
  /** Refetch when the tab regains focus. Defaults to true. */
  refetchOnWindowFocus?: boolean;
}

export interface UseQueryResult<T> {
  state: QueryState<T>;
  /** Forces a fresh request, bypassing `staleTime`. */
  refetch: () => Promise<void>;
}

export function useQuery<T>(options: UseQueryOptions<T>): UseQueryResult<T> {
  const { queryKey, queryFn, staleTime, enabled = true, refetchInterval, refetchOnWindowFocus = true } = options;
  const client = useQueryClient();
  const hash = hashKey(queryKey);

  const subscribe = useCallback(
    (listener: () => void) => client.subscribe<T>(queryKey, listener),
    // `hash` is the primitive identity of the key; `queryKey` is a fresh array each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, hash],
  );
  const getSnapshot = useCallback(() => client.getState<T>(queryKey), [client, hash]);

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Kept in a ref so changing an inline closure does not re-trigger fetches.
  const fetcherRef = useRef(queryFn);
  fetcherRef.current = queryFn;
  const staleTimeRef = useRef(staleTime);
  staleTimeRef.current = staleTime;

  const runFetch = useCallback(
    (force: boolean) => {
      if (!enabled) return Promise.resolve();
      const options: FetchOptions = { force };
      if (staleTimeRef.current !== undefined) options.staleTime = staleTimeRef.current;
      return client
        .fetch<T>(queryKey, (context) => fetcherRef.current(context), options)
        .then(() => undefined);
    },
    [client, hash, enabled],
  );

  // Initial load, and a refetch whenever the key identity changes.
  useEffect(() => {
    if (!enabled) return;
    void runFetch(false);
  }, [runFetch]);

  // Polling. Cleared on unmount so a backgrounded dashboard stops requesting.
  useEffect(() => {
    if (!enabled || refetchInterval === undefined || refetchInterval <= 0) return;
    const id = window.setInterval(() => {
      void runFetch(false);
    }, refetchInterval);
    return () => window.clearInterval(id);
  }, [enabled, refetchInterval, runFetch]);

  useEffect(() => {
    if (!enabled || !refetchOnWindowFocus) return;
    const onFocus = () => {
      void runFetch(false);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [enabled, refetchOnWindowFocus, runFetch]);

  const refetch = useCallback(() => runFetch(true), [runFetch]);

  return { state, refetch };
}
