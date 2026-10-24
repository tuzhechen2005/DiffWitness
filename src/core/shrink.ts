import type { Args, Json } from './types';

/**
 * Greedy shrink: repeatedly try smaller candidates of `args` and keep the first one for which
 * `stillFails` resolves true, until no candidate passes or `maxSteps` (default 200) predicate
 * calls are spent. Deterministic. Returns the smallest passing args and the predicate calls used.
 * Issue #3.
 */
export async function shrink(
  args: Args,
  stillFails: (args: Args) => Promise<boolean>,
  opts: { maxSteps?: number } = {},
): Promise<{ args: Args; steps: number }> {
  let current = args.slice();
  let steps = 0;
  const maxSteps = opts.maxSteps ?? 200;
  restart: while (steps < maxSteps) {
    for (let i = 0; i < current.length; i++) {
      for (const value of candidates(current[i])) {
        if (steps >= maxSteps) return { args: current, steps };
        const next = current.slice();
        next[i] = value;
        steps++;
        if (await stillFails(next)) {
          current = next;
          continue restart;
        }
      }
    }
    break;
  }
  return { args: current, steps };
}

/**
 * Strictly smaller variants of one value, most aggressive first. Issue #3.
 * string: delete chunks / single chars (no char substitution). number: 0, Math.trunc, halve toward 0.
 * boolean: true -> false. array: remove elements, then shrink each element. object: remove keys,
 * then shrink each value. null: none.
 */
export function candidates(value: Json): Json[] {
  if (value === null || value === false) return [];
  if (value === true) return [false];
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return [0];
    if (value === 0) return [];
    const result = [0, Math.trunc(value)];
    for (let n = Math.trunc(value / 2); n !== 0; n = Math.trunc(n / 2)) result.push(n);
    return [...new Set(result)].filter((n) => n !== value);
  }
  if (typeof value === 'string' || Array.isArray(value)) {
    const result: Json[] = [];
    for (let size = value.length; size > 0; size = Math.floor(size / 2)) {
      for (let start = value.length - size; start >= 0; start--) {
        result.push(typeof value === 'string'
          ? value.slice(0, start) + value.slice(start + size)
          : [...value.slice(0, start), ...value.slice(start + size)]);
      }
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        for (const smaller of candidates(item)) {
          const next = value.slice();
          next[i] = smaller;
          result.push(next);
        }
      });
    }
    return result;
  }
  const entries = Object.entries(value);
  return [
    ...entries.map((_, i) => Object.fromEntries(entries.filter((_, j) => i !== j))),
    ...entries.flatMap(([key, item]) => candidates(item).map((smaller) => ({ ...value, [key]: smaller }))),
  ];
}
