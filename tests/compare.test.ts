import { describe, expect, it } from 'vitest';
import { deepEqual, sameOutcome } from '../src/core/compare';

describe('deepEqual', () => {
  it('uses Object.is at the leaves', () => {
    expect(deepEqual(NaN, NaN)).toBe(true);
    expect(deepEqual(0, -0)).toBe(false);
    expect(deepEqual([-0], [0])).toBe(false);
    expect(deepEqual('1', 1)).toBe(false);
    expect(deepEqual(null, undefined)).toBe(false);
  });

  it('compares nested objects regardless of key order', () => {
    expect(deepEqual({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 })).toBe(true);
    expect(deepEqual({ a: 1, b: { c: [1, 2] } }, { a: 1, b: { c: [2, 1] } })).toBe(false);
    expect(deepEqual({ a: undefined }, {})).toBe(false);
    expect(deepEqual([1, 2], { 0: 1, 1: 2 })).toBe(false);
    expect(deepEqual([1], [1, 2])).toBe(false);
  });

  it('handles Date, Map and Set', () => {
    expect(deepEqual(new Date(5), new Date(5))).toBe(true);
    expect(deepEqual(new Date(5), new Date(6))).toBe(false);
    expect(deepEqual(new Map([['a', [1]]]), new Map([['a', [1]]]))).toBe(true);
    expect(deepEqual(new Map([['a', 1]]), new Map([['a', 2]]))).toBe(false);
    expect(deepEqual(new Set([1, 2]), new Set([2, 1]))).toBe(true);
    expect(deepEqual(new Set([[1]]), new Set([[1]]))).toBe(true);
    expect(deepEqual(new Set([[1], [1], [2]]), new Set([[1], [2], [2]]))).toBe(false);
    expect(deepEqual(new Set([1]), [1])).toBe(false);
  });
});

describe('sameOutcome', () => {
  it('compares throws by name only', () => {
    expect(sameOutcome({ kind: 'throw', name: 'Error', message: 'a' }, { kind: 'throw', name: 'Error', message: 'b' })).toBe(true);
    expect(sameOutcome({ kind: 'throw', name: 'Error', message: 'a' }, { kind: 'throw', name: 'TypeError', message: 'a' })).toBe(false);
  });

  it('compares returns deeply and kinds strictly', () => {
    expect(sameOutcome({ kind: 'return', value: [NaN] }, { kind: 'return', value: [NaN] })).toBe(true);
    expect(sameOutcome({ kind: 'return', value: '00128' }, { kind: 'return', value: '128' })).toBe(false);
    expect(sameOutcome({ kind: 'timeout' }, { kind: 'timeout' })).toBe(true);
    expect(sameOutcome({ kind: 'timeout' }, { kind: 'return', value: undefined })).toBe(false);
  });
});
