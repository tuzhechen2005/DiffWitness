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
  throw new Error(`not implemented (#3): ${args.length} ${typeof stillFails} ${opts.maxSteps}`);
}

/**
 * Strictly smaller variants of one value, most aggressive first. Issue #3.
 * string: delete chunks / single chars (no char substitution). number: 0, Math.trunc, halve toward 0.
 * boolean: true -> false. array: remove elements, then shrink each element. object: remove keys,
 * then shrink each value. null: none.
 */
export function candidates(value: Json): Json[] {
  throw new Error(`not implemented (#3): ${typeof value}`);
}
