import { describe, expect, it, vi } from 'vitest';
import { importPathFor, parseCli, UsageError } from '../src/cli';
import type { WitnessReport } from '../src/core/types';
import { fmtOutcome, fmtValue, jsonSafe, renderReport } from '../src/render';

// compare.ts is a stub until #2 lands; a minimal stand-in keeps these tests independent of it.
vi.mock('../src/core/compare', () => ({ sameOutcome: (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b) }));

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');
const ret = (value: unknown) => ({ kind: 'return' as const, value });
const report = (over: Partial<WitnessReport> = {}): WitnessReport => ({
  fnName: 'normalizeOrderId',
  hypothesizer: 'replay (handwritten)',
  rounds: 1,
  trials: [
    { hypothesis: { reason: 'lowercase id', args: ['ab-1'], round: 1 }, pair: { old: ret('AB-1'), new: ret('AB-1') } },
    { hypothesis: { reason: 'padded id', args: ['  ab-1  '], round: 1 }, pair: { old: ret('AB-1'), new: { kind: 'throw', name: 'TypeError', message: 'bad' } } },
  ],
  divergences: [
    {
      args: [' a'],
      pair: { old: ret('A'), new: { kind: 'throw', name: 'TypeError', message: 'bad' } },
      reasons: ['padded id'],
      originalArgs: [['  ab-1  ']],
      shrinkSteps: 7,
    },
  ],
  baseline: { runs: 2000, divergent: 0, silent: 0, repros: [] },
  ...over,
});

describe('render', () => {
  it('shows divergence, comparison, replay badge and shrink info', () => {
    const s = strip(renderReport(report()));
    expect(s).toContain('REPLAY');
    expect(s).toContain('✔ confirmed');
    expect(s).toContain('· same');
    expect(s).toContain('old → "A"');
    expect(s).toContain('new → throws TypeError: bad');
    expect(s).toContain('model args: ("  ab-1  ")');
    expect(s).toContain('shrunk in 7 steps');
    expect(s).toContain('Random fuzzing: 0 of 2000 runs diverged');
    expect(s).toContain('Model:          1 of 2 hypotheses diverged');
  });

  it('groups clustered divergences and shows the coverage line', () => {
    const d = report().divergences[0];
    const s = strip(renderReport(report({
      divergences: [{ ...d, cluster: 0 }, { ...d, args: [' b'], cluster: 0 }, { ...d, args: ['x'], cluster: 1 }],
      coverage: { old: { covered: 3, total: 4 }, new: { covered: 2, total: 2 } },
    })));
    expect(s).toContain('Confirmed divergences: 3 in 2 branch paths');
    expect(s).toContain('+1 more on the same branch path (may still be different bugs):');
    expect(s).toContain('(" b")  old → "A"  new → throws TypeError: bad');
    expect(s).toContain('#2  normalizeOrderId("x")');
    expect(s).not.toContain('#3');
    expect(strip(renderReport(report()))).toContain('Confirmed divergences: 1\n');
    expect(s).toContain('Coverage:       old 3/4, new 2/2 branches reached by model inputs');
  });

  it('says no divergence is evidence, not proof', () => {
    const s = strip(renderReport(report({ divergences: [], hypothesizer: 'gemma4:e4b @ http://x' })));
    expect(s).toContain('No divergence found (this is evidence, not proof of equivalence).');
    expect(s).not.toContain('REPLAY');
  });

  it('formats -0, timeout and values', () => {
    expect(fmtOutcome(ret(-0))).toBe('-0');
    expect(fmtOutcome({ kind: 'timeout' })).toBe('timeout');
    expect(fmtValue({ a: [1, 'x'], b: undefined })).toBe("{ a: [ 1, 'x' ], b: undefined }");
    expect(fmtValue('hi')).toBe('"hi"');
  });

  it('jsonSafe yields valid JSON for -0, NaN, Infinity, undefined', () => {
    const s = JSON.stringify(jsonSafe([-0, NaN, Infinity, undefined, { x: -0 }]));
    expect(JSON.parse(s)).toEqual(['-0', 'NaN', 'Infinity', 'undefined', { x: '-0' }]);
  });
});

describe('parseCli', () => {
  it('parses an optional named function', () => {
    expect(parseCli(['a.ts', 'b.ts', '--fn', 'selected']).fn).toBe('selected');
    expect(parseCli(['a.ts', 'b.ts']).fn).toBeUndefined();
  });

  it('parses flags and applies defaults', () => {
    expect(parseCli(['a.ts', 'b.ts', '--label', 'bug', '--runs', '50', '--replay'])).toMatchObject({
      oldFile: 'a.ts', newFile: 'b.ts', label: 'bug', runs: 50, replay: true, json: false, out: 'diffwitness.test.ts',
    });
  });

  it.each([
    [['a.ts']],
    [['a.ts', 'b.ts', 'c.ts']],
    [['a.ts', 'b.ts', '--label', 'nope']],
    [['a.ts', 'b.ts', '--runs', '0']],
    [['a.ts', 'b.ts', '--wat']],
  ])('rejects bad args %j', (argv) => {
    expect(() => parseCli(argv)).toThrow(UsageError);
  });
});

describe('importPathFor', () => {
  it('prefixes ./ for same-dir and subdir, keeps ../', () => {
    expect(importPathFor('/p/t.test.ts', '/p/new.ts')).toBe('./new');
    expect(importPathFor('/p/t.test.ts', '/p/src/new.ts')).toBe('./src/new');
    expect(importPathFor('/p/tests/t.test.ts', '/p/src/new.ts')).toBe('../src/new');
  });
});
