import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bundleFunction, withRevision } from '../src/core/bundle';
import { changedFunctions, git } from '../src/core/git';
import type { Hypothesizer } from '../src/core/types';
import { witness } from '../src/core/witness';

let repo: string;
const write = (path: string, text: string) => writeFileSync(join(repo, path), text);
const commit = (msg: string) => {
  git(repo, 'add', '-A');
  git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', msg);
};
const order = (total: string) => `import { round2 } from './util';
export function total(prices: number[]): number {
  ${total}
}
export const count = (prices: number[]) => prices.length;
`;

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), 'diffwitness-repo-'));
  git(repo, 'init', '-q');
  mkdirSync(join(repo, 'src'));
  write('package.json', '{ "name": "demo", "type": "module" }\n');
  write('src/util.ts', 'export const round2 = (n: number) => Math.round(n * 100) / 100;\n');
  write('src/order.ts', order('return round2(prices.reduce((a, b) => a + b, 0));'));
  commit('one');
  write('src/order.ts', order('return round2(prices.filter((p) => p > 0).reduce((a, b) => a + b, 0));'));
  commit('two');
});
afterAll(() => rmSync(repo, { recursive: true, force: true }));

const fake: Hypothesizer = {
  label: 'fake',
  async propose({ round }) {
    return round === 1 ? [{ reason: 'negative price', args: [[1, -1]], round }] : [];
  },
};

async function bundled(rev: string | undefined, fns: ReturnType<typeof changedFunctions>['fns'], side: 'oldSource' | 'newSource') {
  return withRevision(repo, rev, (dir) => Promise.all(fns.map((f) => bundleFunction(dir, f.path, f.name, f[side], repo))));
}

describe('git mode', () => {
  it('detects only the changed function, bundles its import and finds the divergence', async () => {
    const { fns } = changedFunctions(repo, 'HEAD~1', 'HEAD');
    expect(fns.map((f) => `${f.path}:${f.name}`)).toEqual(['src/order.ts:total']);
    const [[oldFn], [newFn]] = [await bundled('HEAD~1', fns, 'oldSource'), await bundled('HEAD', fns, 'newSource')];
    expect(newFn.fn.source).toContain('filter');
    expect(newFn.fn.code).not.toMatch(/require\(/);
    expect(newFn.branches).toEqual([]);
    const report = await witness({ old: oldFn, new: newFn, hypothesizer: fake, baselineRuns: 0 });
    expect(report.divergences.map((d) => [d.args, d.pair.old, d.pair.new])).toEqual([
      [[[-1]], { kind: 'return', value: -1 }, { kind: 'return', value: 0 }],
    ]);
    expect(git(repo, 'worktree', 'list').trim().split('\n')).toHaveLength(1);
  });

  it('compares against an uncommitted working-tree edit, with coverage inside the function only', async () => {
    write('src/order.ts', order('if (prices.length > 3) return 0;\n  return round2(prices.reduce((a, b) => a + b, 0));'));
    try {
      const { fns } = changedFunctions(repo, 'HEAD~1', undefined, { fn: 'total' });
      expect(fns.map((f) => f.name)).toEqual(['total']);
      const [newFn] = await bundled(undefined, fns, 'newSource');
      expect(newFn.branches.map((b) => b.kind)).toEqual(['if-then', 'if-else']);
      expect(changedFunctions(repo, 'HEAD~1', undefined, { path: 'src/util.ts' }).fns).toEqual([]);
    } finally {
      git(repo, 'checkout', '--', 'src/order.ts');
    }
  });

  it('rejects Node builtins with a clear message', async () => {
    write('src/order.ts', `import { readFileSync } from 'node:fs';\n${order('return readFileSync("x").length + prices.length;')}`);
    try {
      const { fns } = changedFunctions(repo, 'HEAD');
      await expect(bundled(undefined, fns, 'newSource')).rejects.toThrow(/Node builtin "node:fs"/);
    } finally {
      git(repo, 'checkout', '--', 'src/order.ts');
    }
  });
});
