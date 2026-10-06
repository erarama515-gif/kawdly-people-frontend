import { ApiError } from './errors';

/**
 * A minimal runtime decoder combinator library.
 *
 * The app treats the network as untrusted: every response is decoded before it
 * reaches component state, so swapping the mock transport for the real Laravel
 * endpoints cannot silently change a field's type or break a component.
 * Decoders are the single place where a wire shape is validated, and they carry
 * a human-readable `expected` label so contract drift reports a useful path.
 */

export interface Decoder<T> {
  /** Marks the field as omittable inside `object()`. */
  readonly optional?: boolean;
  /** Human-readable description of the accepted shape, used in error messages. */
  readonly expected: string;
  /** Throws `ApiError('decode')` when `input` does not match. */
  decode(input: unknown, path?: string): T;
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `array(${value.length})`;
  return typeof value;
}

function fail(path: string, expected: string, actual: unknown): never {
  const where = path ? `"${path}"` : '"$"';
  throw new ApiError('decode', `Invalid response at ${where}: expected ${expected}, got ${describe(actual)}`);
}

function decoder<T>(expected: string, run: (input: unknown, path: string) => T): Decoder<T> {
  return { expected, decode: (input, path = '') => run(input, path) };
}

export const str = (): Decoder<string> =>
  decoder('string', (input, path) => (typeof input === 'string' ? input : fail(path, 'string', input)));

export const num = (): Decoder<number> =>
  decoder('finite number', (input, path) =>
    typeof input === 'number' && Number.isFinite(input) ? input : fail(path, 'finite number', input),
  );

export const bool = (): Decoder<boolean> =>
  decoder('boolean', (input, path) => (typeof input === 'boolean' ? input : fail(path, 'boolean', input)));

export const isoDate = (): Decoder<string> =>
  decoder('ISO-8601 date string', (input, path) => {
    const value = str().decode(input, path);
    if (Number.isNaN(Date.parse(value))) return fail(path, 'ISO-8601 date string', input);
    return value;
  });

/** Passes the value through unchanged — for `unknown`/free-form payloads. */
export function passthrough<T>(expected = 'any value'): Decoder<T> {
  return decoder(expected, (input) => input as T);
}

export function literalUnion<const T extends readonly string[]>(values: T): Decoder<T[number]> {
  const set = new Set<string>(values);
  const expected = values.join(' | ');
  return decoder(expected, (input, path) => {
    const value = str().decode(input, path);
    return set.has(value) ? (value as T[number]) : fail(path, expected, input);
  });
}

export function array<T>(item: Decoder<T>): Decoder<T[]> {
  return decoder(`${item.expected}[]`, (input, path) => {
    if (!Array.isArray(input)) return fail(path, 'array', input);
    return input.map((entry, index) => item.decode(entry, `${path}[${index}]`));
  });
}

/** First branch that decodes wins. Order matters: put the most specific first. */
export function union<T>(...branches: Decoder<T>[]): Decoder<T> {
  const expected = branches.map((branch) => branch.expected).join(' | ');
  return decoder(expected, (input, path) => {
    for (const branch of branches) {
      try {
        return branch.decode(input, path);
      } catch {
        // try the next branch
      }
    }
    return fail(path, expected, input);
  });
}

export function nullable<T>(inner: Decoder<T>): Decoder<T | null> {
  return decoder(`null | ${inner.expected}`, (input, path) => (input === null ? null : inner.decode(input, path)));
}

/** Object with arbitrary keys, every value decoded by `value`. */
export function record<T>(value: Decoder<T>): Decoder<Record<string, T>> {
  return decoder(`record<${value.expected}>`, (input, path) => {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return fail(path, 'object', input);
    }
    const source = input as Record<string, unknown>;
    const result: Record<string, T> = {};
    for (const key of Object.keys(source)) {
      result[key] = value.decode(source[key], path ? `${path}.${key}` : key);
    }
    return result;
  });
}

type InferShape<S extends Record<string, Decoder<unknown>>> = {
  [K in keyof S]: S[K] extends Decoder<infer T> ? T : never;
};

/**
 * `exactOptionalPropertyTypes` is on, so an optional field must be typed
 * `field?: T` — not `field?: T | undefined` (the latter forbids the value
 * `undefined` from being present). Splitting the keys into required/optional
 * (and stripping `undefined`) keeps decoded objects assignable to the
 * hand-written domain interfaces.
 */
type RequiredKeys<S extends Record<string, Decoder<unknown>>> = {
  [K in keyof S]: undefined extends InferShape<S>[K] ? never : K;
}[keyof S];

type OptionalKeys<S extends Record<string, Decoder<unknown>>> = {
  [K in keyof S]: undefined extends InferShape<S>[K] ? K : never;
}[keyof S];

type Decoded<S extends Record<string, Decoder<unknown>>> = {
  [K in RequiredKeys<S>]: Exclude<InferShape<S>[K], undefined>;
} & {
  [K in OptionalKeys<S>]?: Exclude<InferShape<S>[K], undefined>;
};

/**
 * Object decoder. Keys are required unless wrapped in `optional()`. Unknown keys
 * on the payload are ignored, which keeps the client forward compatible with
 * additive backend changes.
 */
export function object<S extends Record<string, Decoder<unknown>>>(
  shape: S,
): Decoder<Decoded<S>> & { expected: string } {
  const expected = `{ ${Object.keys(shape)
    .map((key) => `${key}${shape[key].optional ? '?' : ''}: ${shape[key].expected}`)
    .join(', ')} }`;
  return decoder(expected, (input, path) => {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return fail(path, 'object', input);
    }
    const source = input as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(shape)) {
      const child = shape[key];
      const childPath = path ? `${path}.${key}` : key;
      const value = source[key];
      if (value === undefined || value === null) {
        if (child.optional) continue;
        return fail(childPath, child.expected, value);
      }
      result[key] = child.decode(value, childPath);
    }
    return result as Decoded<S>;
  });
}

/** Marks a shape entry as omittable; `null` on the wire also reads as absent. */
export function optional<T>(inner: Decoder<T>): Decoder<T | undefined> {
  const wrapped: Decoder<T | undefined> = {
    optional: true,
    expected: `${inner.expected} | null`,
    decode: (input, path) => (input === undefined || input === null ? undefined : inner.decode(input, path)),
  };
  return wrapped;
}

/** Supplies `fallback()` when the wire value is absent or `null`. */
export function withDefault<T>(inner: Decoder<T>, fallback: () => T): Decoder<T> {
  return decoder(`${inner.expected} | null`, (input, path) =>
    input === undefined || input === null ? fallback() : inner.decode(input, path),
  );
}

/** Picks the branch whose tag matches `input[tagKey]`. */
export function tagged<T extends string, V>(tagKey: string, tags: Record<T, Decoder<V>>): Decoder<V> {
  const expected = `{ ${tagKey}: ${Object.keys(tags).join(' | ')} }`;
  return decoder(expected, (input, path) => {
    if (typeof input !== 'object' || input === null) return fail(path, 'object', input);
    const tag = (input as Record<string, unknown>)[tagKey];
    const branch = typeof tag === 'string' ? tags[tag as T] : undefined;
    if (!branch) return fail(`${path}.${tagKey}`, expected, tag);
    return branch.decode(input, path);
  });
}
