/**
 * A discriminated union for representing success/failure without exceptions.
 * Follows the Result pattern (Railway-oriented programming).
 */
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

/**
 * Create a success Result.
 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * Create a failure Result.
 */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
