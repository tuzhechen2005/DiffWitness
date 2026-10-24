import type { LoadedFn, Runner } from './types';

/**
 * Starts an isolated runner for the two functions. Issue #2.
 * - worker_threads + node:vm, fresh vm context per call, no require/process/import in the context
 * - per-call timeout (default 1000 ms); a timed-out call yields { kind: 'timeout' } and the worker is replaced
 * - must work under both tsx and vitest (hint: `new Worker(src, { eval: true })` with an inline JS string)
 */
export async function createRunner(
  oldFn: LoadedFn,
  newFn: LoadedFn,
  opts: { timeoutMs?: number } = {},
): Promise<Runner> {
  throw new Error(`not implemented (#2): ${oldFn.name} ${newFn.name} ${opts.timeoutMs}`);
}
