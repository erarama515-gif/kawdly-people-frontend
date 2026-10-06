/** Stable serialisation of a query key, used as the cache map key. */
export type QueryKey = readonly unknown[];

export function hashKey(key: QueryKey): string {
  return JSON.stringify(key, (_field, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Sort object keys so `{a,b}` and `{b,a}` share a cache entry.
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([x], [y]) => (x < y ? -1 : 1)));
    }
    return value;
  });
}
