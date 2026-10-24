import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { build, type BuildFailure, type Plugin } from 'esbuild';
import { instrument, type Branch } from './coverage';
import { git } from './git';
import type { LoadedFn } from './types';

/** Runs `use` with a directory holding `rev` checked out (a temporary detached worktree), or the repo itself for the working tree. */
export async function withRevision<T>(repo: string, rev: string | undefined, use: (dir: string) => Promise<T>): Promise<T> {
  if (rev === undefined) return use(repo);
  const tmp = mkdtempSync(join(tmpdir(), 'diffwitness-'));
  const dir = join(tmp, 'wt');
  git(repo, 'worktree', 'add', '--detach', dir, rev);
  try {
    return await use(dir);
  } finally {
    try {
      git(repo, 'worktree', 'remove', '--force', dir);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
}

/**
 * Bundles `path` (relative to `dir`) with its imports into one CommonJS script exporting `name`.
 * The target file is coverage-instrumented; branches outside the function itself are dropped.
 * Packages resolve from `repo`'s node_modules. `source` is the function's own text, used for prompts and replay keys.
 */
export async function bundleFunction(dir: string, path: string, name: string, source: string, repo: string): Promise<{ fn: LoadedFn; branches: Branch[] }> {
  const entry = realpathSync(join(dir, path));
  const fileText = readFileSync(entry, 'utf8');
  const cov = instrument({ name, source: fileText, code: '' });
  const plugin: Plugin = {
    name: 'diffwitness',
    setup(b) {
      b.onResolve({ filter: /.*/ }, (a) => {
        if (!isBuiltin(a.path)) return undefined;
        const by = a.importer.includes('node_modules/') ? a.importer.split('node_modules/').pop() : relative(dir, a.importer);
        return { errors: [{ text: `${path} pulls in the Node builtin "${a.path}" (imported by ${by}); DiffWitness runs functions without require, so only pure code can be compared` }] };
      });
      // instrument() emits CommonJS with require() calls, which esbuild still bundles.
      b.onLoad({ filter: /\.ts$/ }, (a) => (a.path === entry ? { contents: cov.fn.code, loader: 'js' } : undefined));
    },
  };
  const out = await build({
    entryPoints: [entry],
    absWorkingDir: dir,
    bundle: true,
    format: 'cjs',
    platform: 'neutral',
    mainFields: ['module', 'main'],
    nodePaths: [join(repo, 'node_modules')],
    write: false,
    logLevel: 'silent',
    plugins: [plugin],
  }).catch((e: BuildFailure) => {
    const [first, ...rest] = e.errors ?? [];
    throw first ? new Error(`${first.text}${rest.length ? ` (+${rest.length} more)` : ''}`) : e;
  });
  const start = fileText.indexOf(source);
  const [from, to] = [start, start + source.length].map((i) => fileText.slice(0, i).split('\n').length);
  const branches = start < 0 ? [] : cov.branches.filter((b) => b.line >= from && b.line <= to);
  return { fn: { name, source, code: out.outputFiles[0].text }, branches };
}
