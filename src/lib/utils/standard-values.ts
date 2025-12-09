/**
 * Utility functions for handling standard values (costs and parameters)
 */

/**
 * Converts string number fields to actual numbers in an object
 */
export function toNumberFields<
  T extends Record<string, unknown>,
  K extends keyof T,
>(obj: T, keys: readonly K[]): T {
  type Mutable<U> = { -readonly [P in keyof U]: U[P] };
  const out = { ...obj } as Mutable<T>;
  for (const key of keys) {
    const v = out[key];
    if (v === null || v === undefined) continue;
    if (typeof v === 'string') {
      const n = Number(v);
      (out as unknown as Record<string, unknown>)[key as string] =
        Number.isFinite(n) ? (n as unknown) : v;
    }
  }
  return out as T;
}
