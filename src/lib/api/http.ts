import { ApiError, toApiError } from './errors';
import type { Decoder } from './decode';

/**
 * The single transport used by every remote resource.
 *
 * Responsibilities kept here so no resource reimplements them: base URL
 * resolution, auth header injection, JSON encode/decode, timeout budgeting,
 * bounded retry with exponential backoff + jitter, and cancellation.
 *
 * Requests are always cancelled through an internal `AbortSignal` that is the
 * composition of (a) the caller's signal and (b) the timeout — so a component
 * unmount genuinely aborts the in-flight `fetch` instead of leaking it.
 */

export interface HttpClientOptions {
  /** Prefixed to every path. Empty string means "same origin". */
  baseUrl: string;
  /** Milliseconds before a request is aborted. */
  timeoutMs: number;
  /** Extra attempts after the first, for retryable failures only. */
  retries: number;
  /** Base backoff delay; attempt *n* waits ~`backoffMs * 2**n` plus jitter. */
  backoffMs: number;
  /** Injected so auth can change without a reload; currently reads the session. */
  getAuthorization?: () => string | undefined;
  /** Decides whether a failure is worth another attempt. */
  shouldRetry?: (error: ApiError, attempt: number) => boolean;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

export interface RequestOptions<T> {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  signal?: AbortSignal | undefined;
  /** Validates and narrows the response body. Omit for 204/empty responses. */
  schema?: Decoder<T> | undefined;
  /** Overrides the client-level retry budget for this request. */
  retries?: number | undefined;
  /** Skips the response body entirely (used by fire-and-forget mutations). */
  ignoreBody?: boolean;
}

export interface HttpResponse<T> {
  data: T | undefined;
  status: number;
  /** Server-declared freshness, when present. */
  etag: string | undefined;
}

export type HttpClient = <T>(path: string, options?: RequestOptions<T>) => Promise<HttpResponse<T>>;

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const {
    baseUrl,
    timeoutMs,
    retries,
    backoffMs,
    getAuthorization,
    shouldRetry = defaultShouldRetry,
    fetchImpl = globalThis.fetch.bind(globalThis),
  } = options;

  return async function request<T>(path: string, requestOptions: RequestOptions<T> = {}) {
    const { method = 'GET', query, body, signal, schema, ignoreBody } = requestOptions;
    const budget = requestOptions.retries ?? retries;
    const url = buildUrl(baseUrl, path, query);

    let lastError: ApiError | undefined;
    for (let attempt = 0; attempt <= budget; attempt += 1) {
      // Cancellation is authoritative: never start an attempt on a dead signal,
      // and never spend a retry on one.
      if (signal?.aborted) throw new ApiError('aborted', 'Request aborted before dispatch');

      try {
        return await dispatch<T>({
          fetchImpl,
          url,
          method,
          body,
          signal,
          schema,
          ignoreBody,
          timeoutMs,
          getAuthorization,
        });
      } catch (error) {
        const apiError = toApiError(error);
        if (apiError.kind === 'aborted' || !shouldRetry(apiError, attempt) || attempt === budget) {
          throw apiError;
        }
        lastError = apiError;
        await delay(backoffDelay(backoffMs, attempt), signal);
      }
    }
    /* c8 ignore next */
    throw lastError ?? new ApiError('network', 'Request failed with no attempts made');
  };
}

function defaultShouldRetry(error: ApiError, attempt: number): boolean {
  // Cap attempts so a persistent outage surfaces quickly instead of hanging.
  return error.retryable && attempt < 3;
}

interface DispatchArgs<T> {
  fetchImpl: typeof fetch;
  url: string;
  method: NonNullable<RequestOptions<T>['method']>;
  body: unknown;
  signal: AbortSignal | undefined;
  schema: Decoder<T> | undefined;
  ignoreBody: boolean | undefined;
  timeoutMs: number;
  getAuthorization: (() => string | undefined) | undefined;
}

async function dispatch<T>(args: DispatchArgs<T>): Promise<HttpResponse<T>> {
  const { fetchImpl, url, method, body, signal, schema, ignoreBody, timeoutMs, getAuthorization } = args;
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort, { once: true });

  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const authorization = getAuthorization?.();
    if (authorization) headers.Authorization = authorization;

    const init: RequestInit = {
      method,
      headers,
      signal: controller.signal,
      credentials: 'same-origin',
    };
    if (body !== undefined) init.body = JSON.stringify(body);

    const response = await fetchImpl(url, init);

    if (!response.ok) throw await httpError(response);

    const etag = response.headers.get('etag') ?? undefined;
    if (ignoreBody || response.status === 204) {
      await response.text().catch(() => '');
      return { data: undefined, status: response.status, etag };
    }

    const payload = await response.json().catch(() => {
      throw new ApiError('decode', 'Response body was not valid JSON', { status: response.status });
    });

    // Unvalidated payloads stay `unknown` at the type level: a resource that
    // omits `schema` is opting out of type safety at the boundary.
    return {
      data: schema ? schema.decode(payload) : (payload as T),
      status: response.status,
      etag,
    };
  } catch (error) {
    if (timedOut) throw new ApiError('timeout', `Request exceeded ${timeoutMs}ms`, { cause: error });
    throw toApiError(error);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

/** Maps a non-2xx response onto the retry policy in `errors.ts`. */
async function httpError(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => undefined);
  const message =
    (typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string'
      ? body.message
      : null) ?? `Request failed with status ${response.status}`;
  return new ApiError('http', message, { status: response.status, body });
}

function buildUrl(
  baseUrl: string,
  path: string,
  query: Record<string, string | number | boolean | undefined> | undefined,
): string {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const suffix = path.startsWith('/') ? path : `/${path}`;
  if (!query) return `${base}${suffix}`;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${base}${suffix}?${search}` : `${base}${suffix}`;
}

/** Exponential backoff with full jitter, capped so retries stay responsive. */
function backoffDelay(baseMs: number, attempt: number): number {
  const exponential = Math.min(baseMs * 2 ** attempt, 4000);
  return Math.round(exponential * (0.5 + Math.random() * 0.5));
}

function delay(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ApiError('aborted', 'Request aborted during backoff'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new ApiError('aborted', 'Request aborted during backoff'));
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
