import type { LabeledDivergence } from './types';

/**
 * Renders a vitest file for the labeled divergences. Issue #5.
 * - imports `{ fnName }` from `importPath`
 * - one `it(...)` per item; title includes the label and the args
 * - bug: expect the NEW function to reproduce the OLD outcome (red until fixed)
 * - intended: pin the NEW outcome (green, guards against regressions back to old)
 * - outcome 'throw' -> expect(() => fn(...)).toThrow(); 'timeout' -> it.skip with a comment
 * - values are emitted as JS literals: handles undefined, NaN, Infinity, -0 and nested arrays/objects
 */
export function exportVitest(opts: { fnName: string; importPath: string; items: LabeledDivergence[] }): string {
  throw new Error(`not implemented (#5): ${opts.fnName} ${opts.items.length}`);
}
