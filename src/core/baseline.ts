import type { Args } from './types';

/** JSON shape of a value, inferred from one example. Issue #3. */
export type Shape =
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | { array: Shape }
  | { object: Record<string, Shape> };

/** Shape of each positional arg. Arrays take the shape of their first element ('null' if empty). Issue #3. */
export function inferShape(args: Args): Shape[] {
  throw new Error(`not implemented (#3): ${args.length}`);
}

/**
 * Naive random args for the given shapes. Deliberately dumb (this is the baseline we beat):
 * strings 0-10 chars of printable ASCII, numbers mixing small ints and floats in [-1000, 1000],
 * arrays 0-5 elements. Uses only `rng` so results are reproducible. Issue #3.
 */
export function randomArgs(shapes: Shape[], rng: () => number): Args {
  throw new Error(`not implemented (#3): ${shapes.length} ${typeof rng}`);
}

/** Seeded PRNG returning floats in [0, 1). Issue #3. */
export function mulberry32(seed: number): () => number {
  throw new Error(`not implemented (#3): ${seed}`);
}
