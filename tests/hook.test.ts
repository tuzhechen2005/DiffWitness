import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { git } from '../src/core/git';
import { installHook, runHook, uninstallHook } from '../src/hook';
import type { Hypothesizer } from '../src/core/types';

let repo: string;
const sum = (body: string) => `export function total(xs: number[]): number {\n  ${body}\n}\n`;
const commit = (msg: string) => git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', msg);
const hookFile = () => join(repo, '.git/hooks/pre-commit');

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'diffwitness-hook-'));
  git(repo, 'init', '-q');
  writeFileSync(join(repo, 'a.ts'), sum('return xs.reduce((a, b) => a + b, 0);'));
  git(repo, 'add', '-A');
  commit('one');
});
afterEach(() => rmSync(repo, { recursive: true, force: true }));

const fake: Hypothesizer = { label: 'fake', async propose({ round }) { return round === 1 ? [{ reason: 'negative', args: [[1, -1]], round }] : []; } };
const stageChange = () => {
  writeFileSync(join(repo, 'a.ts'), sum('return xs.filter((x) => x > 0).reduce((a, b) => a + b, 0);'));
  git(repo, 'add', 'a.ts');
};

describe('hook install', () => {
  it('installs, refuses to clobber a foreign hook, forces, and uninstalls', () => {
    installHook(repo, {});
    expect(readFileSync(hookFile(), 'utf8')).toContain('hook run');
    installHook(repo, { strict: true }); // ours: overwritten freely
    expect(readFileSync(hookFile(), 'utf8')).toContain('--strict');
    uninstallHook(repo);
    expect(existsSync(hookFile())).toBe(false);

    writeFileSync(hookFile(), '#!/bin/sh\necho mine\n');
    expect(() => installHook(repo, {})).toThrow(/--force/);
    expect(() => uninstallHook(repo)).toThrow(/nothing removed/);
    installHook(repo, { force: true });
    expect(readFileSync(hookFile(), 'utf8')).toContain('diffwitness-hook');
  });

  it('refuses to uninstall an edited hook; script has no npx and skips when the bin is missing', () => {
    installHook(repo, {});
    const text = readFileSync(hookFile(), 'utf8');
    expect(text).not.toContain('npx');
    writeFileSync(hookFile(), text + 'echo extra\n');
    expect(() => uninstallHook(repo)).toThrow(/nothing removed/);
    const gone = text.replace(/\[ -f '[^']*'/, "[ -f '/nonexistent/bin'");
    writeFileSync(hookFile(), gone);
    const r = spawnSync('sh', [hookFile()], { encoding: 'utf8' });
    expect([r.status, r.stdout]).toEqual([0, expect.stringContaining('is missing')]);
  });
});

describe('hook run', () => {
  it('compares the staged content, not the working tree', async () => {
    stageChange();
    writeFileSync(join(repo, 'a.ts'), sum('return 0;')); // unstaged edit must be ignored
    const out: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((m) => void out.push(String(m)));
    try {
      expect(await runHook(repo, { hypothesizer: fake })).toBe(0);
      expect(await runHook(repo, { hypothesizer: fake, strict: true })).toBe(1);
    } finally {
      spy.mockRestore();
    }
    expect(out.join('\n')).toContain('a.ts:total behaves differently');
    expect(git(repo, 'status', '--porcelain')).toBe('MM a.ts\n'); // nothing written
  }, 20_000);

  it('exits 0 with one line when the model is unreachable, even through git commit', () => {
    installHook(repo, { strict: true });
    stageChange();
    const { DIFFWITNESS_REPLAY: _r, DIFFWITNESS_FIXTURES: _f, ...clean } = process.env;
    const env = { ...clean, OLLAMA_URL: 'http://127.0.0.1:1' };
    const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'two'], { cwd: repo, env, encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stdout + r.stderr).toContain('diffwitness: model unreachable, check skipped');
    expect(git(repo, 'log', '--format=%s', '-1').trim()).toBe('two');
  }, 20_000);
});
