import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bundleFunction, withRevision } from '../src/core/bundle';
import { gitOutFile, parseCli, UsageError } from '../src/cli';
import { changedFunctions, git, resolveRev } from '../src/core/git';
import { renderReport } from '../src/render';
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
  // A CommonJS package in node_modules, imported with a default import below.
  mkdirSync(join(repo, 'node_modules/tinycjs'), { recursive: true });
  write('node_modules/tinycjs/package.json', '{ "name": "tinycjs", "main": "index.js" }\n');
  write('node_modules/tinycjs/index.js', 'module.exports = function double(n) { return n * 2; };\n');
  write('.gitignore', 'node_modules\n');
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

describe('git mode hardening', () => {
  it('refuses revisions that git could read as options, on both sides', () => {
    expect(() => resolveRev(repo, '--output=/tmp/x')).toThrow(/cannot start with "-"/);
    expect(() => resolveRev(repo, 'no-such-rev')).toThrow(/unknown revision/);
    expect(resolveRev(repo, 'HEAD~1')).toMatch(/^[0-9a-f]{40}$/);
    expect(() => parseCli(['--git=--output=/tmp/x'])).toThrow(UsageError);
    expect(() => parseCli(['--git', 'HEAD..--output=/tmp/x'])).toThrow(UsageError);
    expect(() => parseCli(['--git', 'HEAD~1', '--out', 'x.ts'])).toThrow(/--out does not apply/);
  });

  it('bundles a default import of a CommonJS package', async () => {
    write('src/order.ts', `import double from 'tinycjs';\n${order('return double(prices.reduce((a, b) => a + b, 0));')}`);
    try {
      const { fns } = changedFunctions(repo, 'HEAD');
      const [[oldFn], [newFn]] = [await bundled('HEAD', fns, 'oldSource'), await bundled(undefined, fns, 'newSource')];
      const report = await witness({ old: oldFn, new: newFn, hypothesizer: fake, baselineRuns: 0 });
      expect(report.neverRan).toBeUndefined();
      expect(report.trials[0].pair.new).toEqual({ kind: 'return', value: 0 });
    } finally {
      git(repo, 'checkout', '--', 'src/order.ts');
    }
  });

  it('notes skipped default exports', () => {
    write('src/order.ts', `${order('return 1;')}export default function main() { return 2; }\n`);
    try {
      expect(changedFunctions(repo, 'HEAD').notes).toContain('src/order.ts: default export skipped; only named exports are checked');
    } finally {
      git(repo, 'checkout', '--', 'src/order.ts');
    }
  });

  it('names output files by path so same-named functions never collide', () => {
    expect(gitOutFile('src/a/m.ts', 'f')).toBe('diffwitness.src_a_m.f.test.ts');
    expect(gitOutFile('src/b/m.ts', 'f')).not.toBe(gitOutFile('src/a/m.ts', 'f'));
  });
});

describe('never ran', () => {
  it('flags a function that throws the same error on every input instead of claiming no divergence', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'diffwitness-nr-'));
    try {
      writeFileSync(join(dir, 'old.ts'), 'export function f(x: number) { return process.env.A ? x : x + 1; }\n');
      writeFileSync(join(dir, 'new.ts'), 'export function f(x: number) { return process.env.A ? x : x + 2; }\n');
      const h: Hypothesizer = { label: 'fake', async propose({ round }) { return [{ reason: 'r', args: [round], round }]; } };
      const report = await witness({ oldFile: join(dir, 'old.ts'), newFile: join(dir, 'new.ts'), hypothesizer: h, baselineRuns: 0 });
      expect(report.neverRan).toEqual({ name: 'ReferenceError', message: 'process is not defined' });
      const text = renderReport(report);
      expect(text).toContain('Both versions threw ReferenceError: process is not defined on every input');
      expect(text).not.toContain('No divergence found');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
