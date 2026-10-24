import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { loadFunction } from '../src/core/loader';
import { createRunner } from '../src/core/executor';
import { sameOutcome } from '../src/core/compare';
import type { Args } from '../src/core/types';

const root = 'bench/real';
const cases = readdirSync(root).sort();
const outcomes: Record<string, [string, string]> = {
  'query-scalar-separator': ['foo=a%2Db', 'foo=a-b'],
  'query-prototype-type': ['1', '[object Undefined]'],
  'query-url-whitespace': ['top', 'top\n'],
};
it('contains three verified upstream cases', () => expect(cases).toHaveLength(3));
for (const name of cases) {
  it(`${name} reproduces a verified upstream silent divergence`, async () => {
    const dir = join(root, name);
    const { silent } = JSON.parse(readFileSync(join(dir, 'expect.json'), 'utf8')) as { silent: Args };
    const runner = await createRunner(await loadFunction(join(dir, 'old.ts')), await loadFunction(join(dir, 'new.ts')));
    try {
      const pair = await runner.run(silent);
      expect(pair.old.kind).toBe('return');
      expect(pair.new.kind).toBe('return');
      expect(sameOutcome(pair.old, pair.new)).toBe(false);
      expect(pair.old).toEqual({ kind: 'return', value: outcomes[name][0] });
      expect(pair.new).toEqual({ kind: 'return', value: outcomes[name][1] });
    } finally {
      await runner.close();
    }
  });
}
