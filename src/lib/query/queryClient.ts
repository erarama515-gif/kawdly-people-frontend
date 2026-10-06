import { ApiError, isAbortError, toApiError } from '@/lib/api/errors';
import { hashKey, type QueryKey } from './queryKey';

/**
 * A framework-agnostic query cache.
 *
 * Responsibilities:
 *  - one in-flight request per key, shared by every subscriber (dedupe)
 *  - stale-while-revalidate: a cached entry is served immediately and refreshed
 *    in the background once it is older than `staleTime`
 *  - cancellation: each key owns an `AbortController`, so the last subscriber
 *    leaving aborts the real `fetch` instead of leaking it
 *  - explicit invalidation for mutations, and optimistic writes with rollback
 *
 * React binding lives in `useQuery.ts`; nothing here imports React.
 */

export type QueryStatus = 'pending' | 'success' | 'error';

export interface QueryState<T> {
  status: QueryStatus;
  data: T | undefined;
  error: ApiError | undefined;
  /** Epoch ms of the last successful resolution; drives "updated 2m ago". */
  updatedAt: number | undefined;
  /** True whenever a request for this key is in flight, including a background one. */
  isFetching: boolean;
}

export interface FetchContext {
  /** Aborted when the last subscriber for the key unsubscribes. */
  signal: AbortSignal;
}

export type Fetcher<T> = (context: FetchContext) => Promise<T>;

export interface FetchOptions {
  /** Overrides the client default for how long a cached value counts as fresh. */
  staleTime?: number;
  /** Refetch even when the cached value is still fresh. */
  force?: boolean;
}

export interface QueryDefaults {
  /** How long a cached value counts as fresh. */
  staleTime: number;
}

interface CacheEntry<T> {
  key: QueryKey;
  hash: string;
  state: QueryState<T>;
  listeners: Set<() => void>;
  fetcher: Fetcher<T> | undefined;
  defaults: QueryDefaults | undefined;
  controller: AbortController | undefined;
  inFlight: Promise<unknown> | undefined;
  /** Number of live subscribers; the cache entry is evicted when it hits zero. */
  refCount: number;
}

const INITIAL_STATE: QueryState<never> = {
  status: 'pending',
  data: undefined,
  error: undefined,
  updatedAt: undefined,
  isFetching: false,
};

export interface QueryClientOptions {
  defaults?: QueryDefaults;
  /** Called when the last subscriber for a key disappears. */
  gcMs?: number;
}

export class QueryClient {
  readonly #entries = new Map<string, CacheEntry<unknown>>();
  readonly #defaults: QueryDefaults;
  readonly #gcMs: number;
  readonly #gcTimers = new Map<string, number>();

  constructor(options: QueryClientOptions = {}) {
    this.#defaults = options.defaults ?? { staleTime: 30_000 };
    this.#gcMs = options.gcMs ?? 5 * 60_000;
  }

  /** Referentially stable between mutations, as `useSyncExternalStore` requires. */
  getState<T>(key: QueryKey): QueryState<T> {
    const entry = this.#entries.get(hashKey(key)) as CacheEntry<T> | undefined;
    return (entry?.state ?? INITIAL_STATE) as QueryState<T>;
  }

  subscribe<T>(key: QueryKey, listener: () => void): () => void {
    const entry = this.#resolve<T>(key);
    entry.listeners.add(listener);
    entry.refCount += 1;
    this.#cancelGc(entry.hash);

    return () => {
      entry.listeners.delete(listener);
      entry.refCount -= 1;
      if (entry.refCount <= 0) {
        entry.controller?.abort();
        entry.controller = undefined;
        entry.inFlight = undefined;
        this.#scheduleGc(entry.hash);
      }
    };
  }

  /**
   * Resolves a key's value, reusing a fresh cache entry, joining an in-flight
   * request, or starting a new one.
   */
  fetch<T>(
    key: QueryKey,
    fetcher: Fetcher<T>,
    options: FetchOptions = {},
  ): Promise<QueryState<T>> {
    const entry = this.#resolve<T>(key);
    entry.fetcher = fetcher;

    const staleTime = options.staleTime ?? entry.defaults?.staleTime ?? this.#defaults.staleTime;
    const isFresh =
      entry.state.status === 'success' &&
      entry.state.updatedAt !== undefined &&
      Date.now() - entry.state.updatedAt < staleTime;

    if (!options.force && isFresh) return Promise.resolve(entry.state);
    if (entry.inFlight) return entry.inFlight.then(() => entry.state);

    return this.#run(entry);
  }

  /** Marks a key (and every key matching `predicate`) stale and refetches it. */
  invalidate(key: QueryKey | { predicate: (key: QueryKey) => boolean }): Promise<void> {
    const matches = typeof key === 'object' && 'predicate' in key
      ? [...this.#entries.values()].filter((entry) => key.predicate(entry.key))
      : [this.#entries.get(hashKey(key))].filter((entry): entry is CacheEntry<unknown> => entry !== undefined);

    return Promise.all(
      matches.map((entry) => {
        entry.state = { ...entry.state, updatedAt: undefined };
        this.#emit(entry);
        if (!entry.fetcher || entry.refCount <= 0) return Promise.resolve();
        return this.#run(entry).then(() => undefined);
      }),
    ).then(() => undefined);
  }

  /** Optimistic write. Returns the previous state so a mutation can roll back. */
  setData<T>(key: QueryKey, updater: (current: T | undefined) => T | undefined): QueryState<T> | undefined {
    const entry = this.#entries.get(hashKey(key)) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    const previous = entry.state;
    const next = updater(previous.data);
    entry.state = {
      ...previous,
      data: next,
      // A failed optimistic write must not be mistaken for server truth.
      status: 'success',
      error: undefined,
      updatedAt: previous.updatedAt ?? Date.now(),
    };
    this.#emit(entry);
    return previous;
  }

  /** Drops cached entries; used on sign-out and by dev tooling. */
  clear(): void {
    for (const entry of this.#entries.values()) entry.controller?.abort();
    this.#entries.clear();
    for (const timer of this.#gcTimers.values()) clearTimeout(timer);
    this.#gcTimers.clear();
  }

  #resolve<T>(key: QueryKey): CacheEntry<T> {
    const hash = hashKey(key);
    const existing = this.#entries.get(hash) as CacheEntry<T> | undefined;
    if (existing) {
      existing.key = key;
      return existing;
    }
    const entry: CacheEntry<T> = {
      key,
      hash,
      state: INITIAL_STATE as QueryState<T>,
      listeners: new Set(),
      fetcher: undefined,
      defaults: undefined,
      controller: undefined,
      inFlight: undefined,
      refCount: 0,
    };
    this.#entries.set(hash, entry as CacheEntry<unknown>);
    return entry;
  }

  #run<T>(entry: CacheEntry<T>): Promise<QueryState<T>> {
    const fetcher = entry.fetcher;
    /* c8 ignore next */
    if (!fetcher) return Promise.resolve(entry.state);

    entry.controller?.abort();
    const controller = new AbortController();
    entry.controller = controller;
    entry.state = { ...entry.state, isFetching: true };
    this.#emit(entry);

    const run = (async (): Promise<QueryState<T>> => {
      try {
        const data = await fetcher({ signal: controller.signal });
        // A newer request superseded this one, or the caller navigated away.
        if (controller.signal.aborted || entry.controller !== controller) return entry.state;
        entry.state = { status: 'success', data, error: undefined, updatedAt: Date.now(), isFetching: false };
      } catch (rawError) {
        const error = toApiError(rawError);
        if (isAbortError(error) || entry.controller !== controller) return entry.state;
        // Keep the last good data on screen so a transient failure does not blank
        // the ledger; the UI shows the error alongside the stale values.
        entry.state = {
          status: 'error',
          data: entry.state.data,
          error,
          updatedAt: entry.state.updatedAt,
          isFetching: false,
        };
      } finally {
        if (entry.controller === controller) {
          entry.controller = undefined;
          entry.inFlight = undefined;
        }
      }
      this.#emit(entry);
      return entry.state;
    })();

    entry.inFlight = run;
    return run;
  }

  #emit(entry: CacheEntry<unknown>): void {
    for (const listener of entry.listeners) listener();
  }

  #scheduleGc(hash: string): void {
    if (this.#gcTimers.has(hash)) return;
    const timer = window.setTimeout(() => {
      this.#gcTimers.delete(hash);
      const entry = this.#entries.get(hash);
      if (entry && entry.refCount <= 0 && !entry.inFlight) this.#entries.delete(hash);
    }, this.#gcMs);
    this.#gcTimers.set(hash, timer);
  }

  #cancelGc(hash: string): void {
    const timer = this.#gcTimers.get(hash);
    if (timer === undefined) return;
    clearTimeout(timer);
    this.#gcTimers.delete(hash);
  }
}
