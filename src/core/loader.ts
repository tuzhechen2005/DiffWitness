import type { LoadedFn } from './types';

/** Reads a .ts file and delegates to loadFunctionFromSource. Issue #1. */
export async function loadFunction(file: string): Promise<LoadedFn> {
  throw new Error(`not implemented (#1): ${file}`);
}

/**
 * Parses TS source that exports exactly one function (`export function f` or
 * `export const f = (...) => ...` / function expression) and has no imports.
 * Throws a clear Error otherwise. Never executes the code. Issue #1.
 */
export function loadFunctionFromSource(source: string, file = '<source>'): LoadedFn {
  throw new Error(`not implemented (#1): ${file} ${source.length}`);
}
