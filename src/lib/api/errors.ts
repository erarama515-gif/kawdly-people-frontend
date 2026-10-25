/**
 * Normalised transport errors. Every failure that leaves `http.ts` is an
 * `ApiError`, so the UI layer can branch on `kind` / `isRetryable` instead of
 * sniffing status codes or message strings.
 */

import i18n from '@/i18n';

export type ApiErrorKind =
  /** The request never produced a response (offline, DNS, CORS, connection reset). */
  | 'network'
  /** The request exceeded the configured timeout budget. */
  | 'timeout'
  /** The caller aborted (navigation, key change, unmount) — never surfaced. */
  | 'aborted'
  /** A response arrived with a non-2xx status. */
  | 'http'
  /** A response arrived but did not match the expected schema. */
  | 'decode';

export interface ApiErrorOptions {
  status?: number;
  /** Parsed response body, when the server sent JSON. */
  body?: unknown;
  cause?: unknown;
  /** Overrides the default retry policy for this failure. */
  retryable?: boolean;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | undefined;
  readonly body: unknown;
  readonly retryable: boolean;

  constructor(kind: ApiErrorKind, message: string, options: ApiErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = 'ApiError';
    this.kind = kind;
    this.status = options.status;
    this.body = options.body;
    this.retryable = options.retryable ?? defaultRetryable(kind, options.status);
  }
}

function defaultRetryable(kind: ApiErrorKind, status: number | undefined): boolean {
  if (kind === 'network' || kind === 'timeout') return true;
  if (kind !== 'http' || status === undefined) return false;
  // 408 request timeout, 429 rate limited, and all 5xx are transient.
  return status === 408 || status === 429 || status >= 500;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isAbortError(error: unknown): boolean {
  if (isApiError(error)) return error.kind === 'aborted';
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * Translates an `errors.*` key, falling back to the English string when the
 * catalogue is missing it. Keeping the fallback means a developer who adds a
 * new kind without a translation still gets a readable message instead of a
 * raw key in the middle of a form.
 */
function message(key: string, fallback: string): string {
  if (!i18n.isInitialized) return fallback;

  const translated = i18n.t(key);
  return typeof translated === 'string' && translated.length > 0 && translated !== key
    ? translated
    : fallback;
}

/**
 * Message safe to render in the UI: never leaks a raw stack or status line.
 *
 * Sprint A / A1.5 - the copy now comes from the active i18n catalogue, so an
 * Arabic user stops seeing "You do not have access to this data." in the
 * middle of an otherwise Arabic screen. The function stays pure and
 * synchronous (it reads the singleton, it does not subscribe), so every
 * existing call site keeps working unchanged.
 */
export function userFacingMessage(error: unknown): string {
  if (!isApiError(error)) return message('errors.unknown', 'Something went wrong.');
  switch (error.kind) {
    case 'network':
      return message('errors.network', 'You appear to be offline.');
    case 'timeout':
      return message('errors.timeout', 'The request took too long to respond.');
    case 'decode':
      return message('errors.decode', 'The server sent data in an unexpected format.');
    case 'http':
      if (error.status === 401) return message('errors.sessionExpired', 'Your session has expired.');
      if (error.status === 403) return message('errors.forbidden', 'You do not have access to this data.');
      if (error.status === 404) return message('errors.notFound', 'This data is no longer available.');
      if (error.status === 422) return message('errors.validation', 'Please check the data you entered.');
      if (error.status === 429) {
        return message('errors.rateLimited', 'Too many attempts. Please wait a moment and try again.');
      }
      return message('errors.server', 'The server could not complete the request.');
    default:
      return message('errors.unknown', 'Something went wrong.');
  }
}

/** Wraps anything thrown by `fetch`/decoders so callers only see `ApiError`. */
export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) return error;
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new ApiError('aborted', 'Request aborted', { cause: error });
  }
  return new ApiError('network', error instanceof Error ? error.message : 'Network request failed', {
    cause: error,
  });
}
