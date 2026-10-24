import type { Outcome } from './types';

/**
 * return/return: deepEqual(values). throw/throw: same error name (message ignored).
 * timeout/timeout: same. Different kinds: different. Issue #2.
 */
export function sameOutcome(a: Outcome, b: Outcome): boolean {
  if (a.kind === 'return' && b.kind === 'return') return deepEqual(a.value, b.value);
  if (a.kind === 'throw' && b.kind === 'throw') return a.name === b.name;
  return a.kind === b.kind;
}

/**
 * Structural equality with Object.is at the leaves (NaN equals NaN, 0 differs from -0).
 * Handles arrays, plain objects, Date, Map, Set; compares own enumerable keys. Issue #2.
 */
// shortcut: no cycle detection, and RegExp/Error compare by own enumerable keys only; add if a real function returns them.
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  if (a instanceof Date) return Object.is(a.getTime(), (b as Date).getTime());
  if (a instanceof Map) return sameBag([...a], [...(b as Map<unknown, unknown>)]);
  if (a instanceof Set) return sameBag([...a], [...(b as Set<unknown>)]);
  if (Array.isArray(a) && a.length !== (b as unknown[]).length) return false;
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  const keys = Object.keys(x);
  return keys.length === Object.keys(y).length && keys.every((k) => Object.hasOwn(y, k) && deepEqual(x[k], y[k]));
}

// Map/Set members are matched structurally, not by identity, since cloned object keys never share identity.
function sameBag(x: unknown[], y: unknown[]): boolean {
  const left = [...y];
  return (
    x.length === y.length &&
    x.every((v) => {
      const i = left.findIndex((w) => deepEqual(v, w));
      return i >= 0 && left.splice(i, 1).length === 1;
    })
  );
}
