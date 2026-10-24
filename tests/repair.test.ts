import { describe, expect, it } from 'vitest';
import { witness } from '../src/core/witness';
import type { Hypothesizer } from '../src/core/types';

const fake = (args: unknown[][]): Hypothesizer => ({
  label: 'fake',
  propose: async ({ round }) => (round === 1 ? args.map((a) => ({ reason: 'r', args: a as never, round })) : []),
});

describe('type repair', () => {
  it('re-wraps a spread lone array argument, drops other type violations', async () => {
    const r = await witness({
      oldFile: 'bench/cases/dedupe-order/old.ts',
      newFile: 'bench/cases/dedupe-order/new.ts',
      hypothesizer: fake([['beta', 'alpha', 'beta'], [1, 2]]),
      baselineRuns: 0,
    });
    expect(r.repairedForType).toBe(1);
    expect(r.droppedForType).toBe(1);
    // Shrinks to e.g. [['b', '']]: old keeps first-occurrence order, new sorts.
    expect(r.divergences).toHaveLength(1);
    expect(r.divergences[0].pair.old.kind).toBe('return');
    expect(r.divergences[0].pair.new.kind).toBe('return');
  });
});
