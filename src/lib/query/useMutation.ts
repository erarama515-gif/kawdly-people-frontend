import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, toApiError } from '@/lib/api/errors';

/**
 * Mutation binding with optional optimistic updates.
 *
 * `onMutate` runs before the request and returns a rollback function. If the
 * request then fails, the rollback runs automatically — the same pattern as the
 * optimistic resolve already documented in the dashboard queue. Cancellation is
 * explicit per call site, so a double submit cannot race the first response.
 */

export interface MutationContext {
  signal: AbortSignal;
}

export interface UseMutationOptions<TInput, TData> {
  mutationFn: (input: TInput, context: MutationContext) => Promise<TData>;
  onSuccess?: (data: TData, input: TInput) => void;
  onError?: (error: ApiError, input: TInput) => void;
  /** Runs before the request; return a rollback to run if it fails. */
  onMutate?: (input: TInput) => void | (() => void);
}

export interface UseMutationResult<TInput, TData> {
  /** Resolves to `undefined` on failure (the error is exposed in `error`). */
  mutate: (input: TInput) => Promise<TData | undefined>;
  /**
   * Same work as `mutate`, but rejects with the `ApiError` so a caller can
   * branch on the failure. Handlers that need to show a toast or keep a form
   * open must use this: `mutate` resolves `undefined`, which is
   * indistinguishable from a legitimately empty payload.
   */
  mutateAsync: (input: TInput) => Promise<TData>;
  isPending: boolean;
  error: ApiError | undefined;
  reset: () => void;
}

export function useMutation<TInput, TData>(
  options: UseMutationOptions<TInput, TData>,
): UseMutationResult<TInput, TData> {
  const { mutationFn, onSuccess, onError, onMutate } = options;
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<ApiError | undefined>(undefined);

  // Keeps `mutate` referentially stable across renders while still calling the
  // latest callbacks, so it can be passed directly to onClick.
  const latest = useRef({ mutationFn, onSuccess, onError, onMutate });
  latest.current = { mutationFn, onSuccess, onError, onMutate };

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const mutateAsync = useCallback(async (input: TInput): Promise<TData> => {
    const current = latest.current;
    const rollback = current.onMutate?.(input);
    const controller = new AbortController();

    setIsPending(true);
    setError(undefined);
    try {
      const data = await current.mutationFn(input, { signal: controller.signal });
      current.onSuccess?.(data, input);
      return data;
    } catch (rawError) {
      const apiError = toApiError(rawError);
      rollback?.();
      if (mounted.current) setError(apiError);
      current.onError?.(apiError, input);
      throw apiError;
    } finally {
      if (mounted.current) setIsPending(false);
    }
  }, []);

  const mutate = useCallback(
    async (input: TInput): Promise<TData | undefined> => {
      try {
        return await mutateAsync(input);
      } catch {
        return undefined;
      }
    },
    [mutateAsync],
  );

  const reset = useCallback(() => setError(undefined), []);

  return { mutate, mutateAsync, isPending, error, reset };
}
