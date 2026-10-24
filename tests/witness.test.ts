import { describe, expect, it } from 'vitest';
import { replayHypothesizer } from '../src/core/hypothesize';
import { witness } from '../src/core/witness';

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
            pair: {
              old: { kind: 'return', value: '00' },
              new: { kind: 'return', value: '0' },
            },
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
