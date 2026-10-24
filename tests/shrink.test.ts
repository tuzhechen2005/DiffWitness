import { describe, expect, it } from 'vitest';
import { candidates, shrink } from '../src/core/shrink';

describe('shrink', () => {
  it('shrinks a leading-zero string without substituting characters', async () => {
    const result = await shrink(['00128'], async ([s]) => typeof s === 'string' && s.length >= 2 && s.startsWith('0'));
    expect(result.args).toEqual(['00']);
  });
  it('shrinks numbers toward zero while retaining the failure', async () => {
    expect((await shrink([100], async ([n]) => typeof n === 'number' && n >= 10)).args).toEqual([12]);
    expect(candidates(3.5)).toEqual([0, 3, 1]);
    expect(candidates(-8)).toEqual([0, -4, -2, -1]);
    expect(candidates(NaN)).toEqual([0]);
    expect(candidates(Infinity)).toEqual([0]);
    expect(candidates(-Infinity)).toEqual([0]);
    expect(candidates(-0)).toEqual([]);
  });
  it('removes array elements before shrinking nested values', async () => {
    const input = [[8, 9]];
    const result = await shrink(input, async ([a]) => Array.isArray(a) && a.length >= 1 && a.some((n) => typeof n === 'number' && n >= 2));
    expect(result.args).toEqual([[2]]);
    expect(input).toEqual([[8, 9]]);
  });
  it('removes keys before shrinking their values', async () => {
    const result = await shrink([{ keep: 8, extra: true }], async ([o]) => o !== null && typeof o === 'object' && !Array.isArray(o) && typeof o.keep === 'number' && o.keep >= 2);
    expect(result.args).toEqual([{ keep: 2 }]);
    expect(candidates(null)).toEqual([]);
    expect(candidates(true)).toEqual([false]);
    expect(candidates(false)).toEqual([]);
  });
  it('counts predicate calls and respects the budget, including zero', async () => {
    let calls = 0;
    const predicate = async () => { calls++; return false; };
    expect(await shrink(['abc'], predicate, { maxSteps: 0 })).toEqual({ args: ['abc'], steps: 0 });
    expect(await shrink(['abc'], predicate, { maxSteps: 2 })).toEqual({ args: ['abc'], steps: 2 });
    expect(calls).toBe(2);
  });
  it('is deterministic and restarts at the first positional argument', async () => {
    const run = () => shrink([8, 8], async ([a, b]) => Number(a) + Number(b) >= 3);
    expect(await run()).toEqual(await run());
    expect((await run()).args).toEqual([0, 4]);
  });
});
