import { describe, expect, it } from 'vitest';
import { inferShape, mulberry32, randomArgs, type Shape } from '../src/core/baseline';
import type { Json } from '../src/core/types';

describe('random baseline', () => {
  it('infers primitive and nested shapes, using the first array element', () => {
    expect(inferShape(['x', 1, true, null, [], [1, 'x'], { child: ['x'], empty: [] }])).toEqual([
      'string', 'number', 'boolean', 'null', { array: 'null' }, { array: 'number' },
      { object: { child: { array: 'string' }, empty: { array: 'null' } } },
    ]);
  });
  it('reproduces sequences from the same seed', () => {
    const shapes = inferShape(['x', 1, true, [1], { x: 'y' }]);
    const a = mulberry32(123);
    const b = mulberry32(123);
    for (let i = 0; i < 100; i++) expect(randomArgs(shapes, a)).toEqual(randomArgs(shapes, b));
    expect(mulberry32(1)()).toBe(0.6270739405881613);
  });
  it('generates values within their shapes and documented bounds', () => {
    const shapes = inferShape(['', 0, false, null, [{ text: '', values: [0] }], []]);
    const check = (value: Json, shape: Shape): void => {
      if (shape === 'null') expect(value).toBeNull();
      else if (shape === 'string') {
        expect(typeof value).toBe('string');
        expect(value).toMatch(/^[ -~]{0,10}$/);
      } else if (shape === 'number') {
        expect(typeof value).toBe('number');
        expect(Number(value)).toBeGreaterThanOrEqual(-1000);
        expect(Number(value)).toBeLessThanOrEqual(1000);
      } else if (shape === 'boolean') expect(typeof value).toBe('boolean');
      else if ('array' in shape) {
        expect(Array.isArray(value)).toBe(true);
        expect((value as Json[]).length).toBeLessThanOrEqual(5);
        (value as Json[]).forEach((item) => check(item, shape.array));
      } else {
        expect(Object.keys(value as object)).toEqual(Object.keys(shape.object));
        for (const [key, child] of Object.entries(shape.object)) check((value as Record<string, Json>)[key], child);
      }
    };
    const rng = mulberry32(42);
    const numbers: number[] = [];
    for (let i = 0; i < 100; i++) {
      const args = randomArgs(shapes, rng);
      args.forEach((value, index) => check(value, shapes[index]));
      numbers.push(args[1] as number);
    }
    expect(numbers.some(Number.isInteger)).toBe(true);
    expect(numbers.some((n) => !Number.isInteger(n))).toBe(true);
  });
});
