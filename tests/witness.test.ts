import { describe, expect, it } from 'vitest';
import { replayHypothesizer } from '../src/core/hypothesize';
import type { Divergence, Hypothesizer, ProposeInput } from '../src/core/types';
import { cluster, witness } from '../src/core/witness';

describe('witness with replay fixtures', () => {
  for (const example of ['order-id', 'rounding', 'equivalent']) {
    it(`compares ${example} end to end`, async () => {
      const report = await witness({
        oldFile: `examples/${example}/old.ts`,
        newFile: `examples/${example}/new.ts`,
        hypothesizer: replayHypothesizer('fixtures/replay.json'),
        baselineRuns: 200,
      });

      expect(report.trials.length).toBeGreaterThan(0);
      expect(report.baseline?.runs).toBe(200);
      if (example === 'order-id') {
        expect(report.divergences).toEqual(expect.arrayContaining([
          expect.objectContaining({
            args: ['00'],
            pair: expect.objectContaining({
              old: { kind: 'return', value: '00' },
              new: { kind: 'return', value: '0' },
            }),
          }),
        ]));
      } else if (example === 'rounding') {
        expect(report.divergences.map(({ args }) => args)).toEqual(
          expect.arrayContaining([[-0.125], [2.675]]),
        );
      } else {
        expect(report.divergences).toEqual([]);
      }
    });
  }
});

describe('coverage-guided round 2', () => {
  it('asks again for uncovered branches even after a silent divergence', async () => {
    const calls: ProposeInput[] = [];
    const h: Hypothesizer = {
      label: 'test',
      async propose(input) {
        calls.push(input);
        return input.round === 1 ? [{ reason: 'leading zeros', args: ['00'], round: 1 }] : [{ reason: 'punctuation', args: ['!'], round: 2 }];
      },
    };
    const report = await witness({ oldFile: 'examples/order-id/old.ts', newFile: 'examples/order-id/new.ts', hypothesizer: h, baselineRuns: 0 });
    expect(report.rounds).toBe(2);
    expect(calls[1].uncovered).toEqual([
      { side: 'old', line: 3, kind: 'if-then', text: 'if (!/^[A-Z0-9-]+$/.test(id)) throw new Error(`invalid order id: ${raw}`);' },
      { side: 'new', line: 4, kind: 'if-then', text: 'if (Number.isNaN(n)) throw new Error(`invalid order id: ${raw}`);' },
    ]);
    expect(report.coverage).toEqual({ old: { covered: 2, total: 2 }, new: { covered: 2, total: 2 } });
  });
});

describe('cluster', () => {
  const d = (args: string[], oldCov: number[]): Divergence => ({
    args, reasons: [], originalArgs: [], shrinkSteps: 0,
    pair: { old: { kind: 'return', value: 1 }, new: { kind: 'return', value: 2 }, coverage: { old: oldCov, new: [0] } },
  });

  it('groups by outcome kinds and branch paths, simplest repro first', () => {
    const out = cluster([d(['bb'], [1, 0]), d(['c'], [2]), d(['a'], [0, 1])]);
    expect(out.map((x) => [x.args[0], x.cluster])).toEqual([['a', 0], ['bb', 0], ['c', 1]]);
  });
});
