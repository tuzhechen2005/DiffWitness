import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { loadFunction } from '../src/core/loader';
import { createRunner } from '../src/core/executor';
import { sameOutcome } from '../src/core/compare';
import type { Args } from '../src/core/types';

const root = 'bench/hard';
const cases = readdirSync(root).sort();
it('contains twelve hard refactor pairs', () => expect(cases).toHaveLength(12));
for (const name of cases) {
  it(`${name} has a planted silent divergence`, async () => {
    const dir = join(root, name);
    const { silent } = JSON.parse(readFileSync(join(dir, 'expect.json'), 'utf8')) as { silent: Args };
    const runner = await createRunner(await loadFunction(join(dir, 'old.ts')), await loadFunction(join(dir, 'new.ts')));
    try {
      const pair = await runner.run(silent);
      expect(pair.old.kind).toBe('return');
      expect(pair.new.kind).toBe('return');
      expect(sameOutcome(pair.old, pair.new)).toBe(false);
    } finally {
      await runner.close();
    }
  });
}
