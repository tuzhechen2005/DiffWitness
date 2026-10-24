import type { Args, Json } from './types';

/** JSON shape of a value, inferred from one example. Issue #3. */
export type Shape =
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | { array: Shape }
  | { object: Record<string, Shape>; optional?: string[] }
  | { literal: string | number | boolean }
  | { union: Shape[] };

/** Shape of each positional arg. Arrays take the shape of their first element ('null' if empty). Issue #3. */
export function inferShape(args: Args): Shape[] {
  const shape = (value: Json): Shape => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return { array: shape(value[0] ?? null) };
    if (typeof value === 'object') {
      return { object: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shape(item)])) };
    }
    return typeof value as 'string' | 'number' | 'boolean';
  };
  return args.map(shape);
}

/**
 * Naive random args for the given shapes. Deliberately dumb (this is the baseline we beat):
 * strings 0-10 chars of printable ASCII, numbers mixing small ints and floats in [-1000, 1000],
 * arrays 0-5 elements. Uses only `rng` so results are reproducible. Issue #3.
 */
export function randomArgs(shapes: Shape[], rng: () => number): Args {
  const generate = (shape: Shape): Json => {
    if (shape === 'null') return null;
    if (typeof shape === 'object' && 'literal' in shape) return shape.literal;
    if (typeof shape === 'object' && 'union' in shape) return generate(shape.union[Math.floor(rng() * shape.union.length)]);
    if (shape === 'boolean') return rng() < 0.5;
    if (shape === 'number') {
      const integer = rng() < 0.5;
      const value = rng() * 2000 - 1000;
      return integer ? Math.trunc(value) : value;
    }
    if (shape === 'string') {
      return Array.from({ length: Math.floor(rng() * 11) }, () => String.fromCharCode(32 + Math.floor(rng() * 95))).join('');
    }
    if ('array' in shape) return Array.from({ length: Math.floor(rng() * 6) }, () => generate(shape.array));
    const entries = Object.entries(shape.object).flatMap(([key, item]): [string, Json][] =>
      shape.optional?.includes(key) && rng() < 0.3 ? [] : [[key, generate(item)]]);
    return Object.fromEntries(entries);
  };
  return shapes.map(generate);
}

/** Seeded PRNG returning floats in [0, 1). Issue #3. */
export function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), seed | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
