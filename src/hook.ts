import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleFunction, withRevision } from './core/bundle';
import { changedFunctions, git, STAGED } from './core/git';
import { hypothesizerFromEnv } from './core/hypothesize';
import type { Hypothesizer } from './core/types';
import { witness } from './core/witness';
import { renderReport } from './render';

const MARK = '# diffwitness-hook';
const BIN = fileURLToPath(new URL('../bin/diffwitness.mjs', import.meta.url));
const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

const hookPath = (cwd: string) => join(git(cwd, 'rev-parse', '--path-format=absolute', '--git-path', 'hooks').trim(), 'pre-commit');

/** The hook calls this package by absolute path (resolved at install time), falling back to npx if it moved. */
export const hookScript = (strict: boolean) => `#!/bin/sh
${MARK}
if [ -f ${q(BIN)} ]; then
  exec node ${q(BIN)} hook run${strict ? ' --strict' : ''}
fi
exec npx diffwitness hook run${strict ? ' --strict' : ''}
`;

export function installHook(cwd: string, o: { force?: boolean; strict?: boolean }): string {
  const file = hookPath(cwd);
  if (existsSync(file) && !o.force && !readFileSync(file, 'utf8').includes(MARK))
    throw new Error(`${file} already exists and is not DiffWitness's; use --force to overwrite it`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, hookScript(!!o.strict));
  chmodSync(file, 0o755);
  return file;
}

export function uninstallHook(cwd: string): string {
  const file = hookPath(cwd);
  if (!existsSync(file) || !readFileSync(file, 'utf8').includes(MARK)) throw new Error(`no DiffWitness hook at ${file}; nothing removed`);
  unlinkSync(file);
  return file;
}

/** Checks staged vs HEAD without writing into the repo. Returns the exit code: 1 only when `strict` and a divergence was found. */
export async function runHook(cwd: string, o: { strict?: boolean; hypothesizer?: Hypothesizer } = {}): Promise<number> {
  const log = (m: string) => console.log(`diffwitness: ${m}`);
  try {
    const repo = git(cwd, 'rev-parse', '--show-toplevel').trim();
    try {
      git(repo, 'rev-parse', '--verify', '--quiet', 'HEAD^{commit}');
    } catch {
      return 0; // first commit: nothing to compare against
    }
    // git hands hooks a possibly relative GIT_INDEX_FILE (a temp index for `commit -a`); it must be read, but must not reach `worktree add`.
    const savedIndex = process.env.GIT_INDEX_FILE;
    if (savedIndex) process.env.GIT_INDEX_FILE = resolve(cwd, savedIndex);
    const tmp = mkdtempSync(join(tmpdir(), 'diffwitness-index-'));
    let diverged = 0;
    try {
      let fns;
      try {
        fns = changedFunctions(repo, 'HEAD', STAGED).fns;
        if (!fns.length) return 0;
        // Export the index so the new side is exactly what will be committed, not the working tree.
        git(repo, 'checkout-index', '--all', `--prefix=${tmp}/`);
      } finally {
        delete process.env.GIT_INDEX_FILE; // shortcut: not restored, runHook is the hook process's whole life
      }
      const hypothesizer = o.hypothesizer ?? hypothesizerFromEnv(process.env);
      for (const f of fns) {
        try {
          const old = await withRevision(repo, 'HEAD', (dir) => bundleFunction(dir, f.path, f.name, f.oldSource, repo));
          const next = await bundleFunction(tmp, f.path, f.name, f.newSource, repo);
          const report = await witness({ old, new: next, hypothesizer });
          if (!report.divergences.length) continue;
          diverged++;
          log(`${f.path}:${f.name} behaves differently\n${renderReport(report)}`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.startsWith('Ollama request')) return log('model unreachable, check skipped'), 0;
          log(`skipped ${f.path}:${f.name}: ${msg}`);
        }
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
    if (diverged && o.strict) return log(`${diverged} changed function(s) diverge; commit blocked (--strict)`), 1;
    return 0;
  } catch (e) {
    log(`check skipped: ${e instanceof Error ? e.message : e}`);
    return 0;
  }
}

export async function hookCommand(args: string[]): Promise<void> {
  const [sub, ...flags] = args;
  const [force, strict] = [flags.includes('--force'), flags.includes('--strict')];
  if (sub === 'install') console.log(`Installed ${installHook(process.cwd(), { force, strict })}${strict ? ' (strict)' : ''}`);
  else if (sub === 'uninstall') console.log(`Removed ${uninstallHook(process.cwd())}`);
  else if (sub === 'run') process.exitCode = await runHook(process.cwd(), { strict });
  else throw new Error('usage: diffwitness hook install [--force] [--strict] | hook uninstall');
}
