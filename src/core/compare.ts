import type { Outcome } from './types';

/**
 * return/return: deepEqual(values). throw/throw: same error name (message ignored).
 * timeout/timeout: same. Different kinds: different. Issue #2.
 */
export function sameOutcome(a: Outcome, b: Outcome): boolean {
  throw new Error(`not implemented (#2): ${a.kind} ${b.kind}`);
}

/**
 * Structural equality with Object.is at the leaves (NaN equals NaN, 0 differs from -0).
 * Handles arrays, plain objects, Date, Map, Set; compares own enumerable keys. Issue #2.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  throw new Error(`not implemented (#2): ${typeof a} ${typeof b}`);
}
