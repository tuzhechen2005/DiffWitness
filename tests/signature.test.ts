import { describe, expect, it } from 'vitest';
import { mulberry32, randomArgs, type Shape } from '../src/core/baseline';
import { buildPrompt } from '../src/core/hypothesize';
import { conforms, paramsOf } from '../src/core/signature';

const params = (src: string) => paramsOf({ name: 'f', source: src, code: '' });
const shapes = (src: string) => params(src)!.map((p) => p.shape);

describe('paramsOf', () => {
  it('maps primitives, literal unions, arrays and nested objects', () => {
    const src = `export function f(a: string, b: number, c: boolean, d: string | null, e: 'x' | 'y' | 3, g?: number[],
      h: { id: string; opts?: { strict?: boolean } } = { id: '' }) { return 0; }`;
    const ps = params(src)!;
    expect(ps.map((p) => [p.name, p.optional])).toEqual([['a', false], ['b', false], ['c', false], ['d', false], ['e', false], ['g', true], ['h', true]]);
    expect(ps.map((p) => p.shape)).toEqual([
      'string', 'number', 'boolean',
      { union: expect.arrayContaining(['string', 'null']) },
      { union: [{ literal: 'x' }, { literal: 'y' }, { literal: 3 }] },
      { array: 'number' },
      { object: { id: 'string', opts: { object: { strict: 'boolean' }, optional: ['strict'] } }, optional: ['opts'] },
    ]);
    expect(ps[1].text).toBe('number');
  });

  it('gives no shape to anything JSON cannot represent', () => {
    const src = `export const f = (a: any, b: unknown, c: Date, d: Map<string, number>, e: () => void, g: Record<string, number>, h: { when: Date }) => 0;`;
    expect(shapes(src)).toEqual(Array(7).fill(undefined));
    expect(shapes(`export function f<T>(x: T, y: number) { return x; }`)).toEqual([undefined, 'number']);
  });

  it('is undefined for rest params or a missing function', () => {
    expect(params(`export function f(...xs: number[]) {}`)).toBeUndefined();
    expect(paramsOf({ name: 'g', source: 'export function f() {}', code: '' })).toBeUndefined();
  });
});

describe('conforms', () => {
  const ps = params(`export function f(id: string, mode: 'a' | 'b', opts?: { strict?: boolean; tags: string[] }, x?: any) {}`)!;
  it('accepts valid args and omitted optionals', () => {
    expect(conforms(['1', 'a'], ps)).toBe(true);
    expect(conforms(['1', 'b', { tags: ['t'] }, { anything: 1 }], ps)).toBe(true);
    expect(conforms(['1', 'b', { strict: false, tags: [] }], ps)).toBe(true);
  });
  it('rejects clear violations', () => {
    expect(conforms([1, 'a'], ps)).toBe(false); // wrong primitive
    expect(conforms(['1'], ps)).toBe(false); // missing required
    expect(conforms(['1', 'c'], ps)).toBe(false); // literal outside the set
    expect(conforms(['1', 'a', { tags: [1] }], ps)).toBe(false); // wrong array element
    expect(conforms(['1', 'a', { strict: true }], ps)).toBe(false); // missing required prop
    expect(conforms(['1', 'a', []], ps)).toBe(false); // array where object expected
    expect(conforms(['1', 'a', null, 1, 2], ps)).toBe(false); // extra arg
  });
  it('lets unknown shapes through', () => {
    expect(conforms([1, 2], params(`export function f(a: any, b: Date) {}`)!)).toBe(true);
  });
});

describe('type-driven generation and prompt', () => {
  it('respects literals and sometimes omits optional props', () => {
    const [shape] = shapes(`export function f(o: { mode: 'a' | 'b'; n?: number }) {}`) as Shape[];
    const rng = mulberry32(7);
    const out = Array.from({ length: 200 }, () => randomArgs([shape], rng)[0] as { mode: string; n?: number });
    expect(out.every((o) => o.mode === 'a' || o.mode === 'b')).toBe(true);
    expect(out.some((o) => o.mode === 'a') && out.some((o) => o.mode === 'b')).toBe(true);
    expect(out.some((o) => 'n' in o) && out.some((o) => !('n' in o))).toBe(true);
  });
  it('lists parameter types in the prompt', () => {
    const source = 'export function f(id: string, opts?: { strict?: boolean }) {}';
    const fn = { name: 'f', source, code: '', params: params(source) };
    expect(buildPrompt({ old: fn, new: fn, round: 1, previous: [] })).toContain(
      'Parameter types (from the TypeScript signature): id: string, opts?: { strict?: boolean | undefined; }');
  });
});
