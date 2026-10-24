import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { WitnessReport } from '../src/core/types';

interface Candidate {
  repo: string;
  url: string;
  sha: string;
  path: string;
  fn: string;
  message: string;
  kind: 'refactor' | 'perf' | 'fix' | 'feature' | 'other';
}
interface Result {
  candidate: Candidate;
  status: 'checked' | 'skipped';
  reason: string;
  divergences: number | null;
  silent: number | null;
  neverRan: WitnessReport['neverRan'] | null;
  seconds: number;
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const corpus = join(root, 'bench/dogfood');
const cache = join(tmpdir(), 'diffwitness-dogfood');

function command(cwd: string, executable: string, args: string[]) {
  const result = spawnSync(executable, args, {
    cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: '1', TZ: 'UTC', GIT_TERMINAL_PROMPT: '0' },
    // shortcut: bound stalled external commands to 20 minutes; expose a timeout if larger models need it.
    timeout: 20 * 60 * 1000,
  });
  const stderr = result.stderr ?? '';
  return { stdout: result.stdout ?? '', stderr, ok: result.status === 0,
    error: result.error?.message ?? (result.status === 0 ? '' : `${executable} exited ${result.status ?? result.signal}: ${stderr}`) };
}
function requireCommand(cwd: string, executable: string, args: string[]) {
  const result = command(cwd, executable, args);
  if (!result.ok) throw new Error(result.error);
  return result.stdout;
}

function check(candidate: Candidate): Result {
  const started = performance.now();
  const result: Result = { candidate, status: 'skipped', reason: '', divergences: null, silent: null, neverRan: null, seconds: 0 };
  try {
    const dir = join(cache, candidate.repo.replace('/', '--'));
    const remote = `https://github.com/${candidate.repo}.git`;
    if (!existsSync(dir)) requireCommand(cache, 'git', ['clone', '--depth', '1', remote, dir]);
    if (requireCommand(dir, 'git', ['remote', 'get-url', 'origin']).trim() !== remote) throw new Error('cache origin does not match candidate');
    if (requireCommand(dir, 'git', ['status', '--porcelain', '--untracked-files=no']).trim()) throw new Error('cache has tracked changes; refusing checkout');
    requireCommand(dir, 'git', ['fetch', '--depth', '2', 'origin', candidate.sha]);
    requireCommand(dir, 'git', ['checkout', '--detach', candidate.sha]);
    const run = () => command(dir, process.execPath, [join(root, 'bin/diffwitness.mjs'),
      '--git', `${candidate.sha}~1..${candidate.sha}`, '--path', candidate.path, '--fn', candidate.fn, '--json']);
    let cli = run();
    // Install only when esbuild reports a missing external package, never for missing relative source files.
    const missing = [...cli.stderr.matchAll(/Could not resolve "([^"]+)"/g)].some((m) => !m[1].startsWith('.') && !m[1].startsWith('/') && !m[1].startsWith('node:'));
    if (missing) {
      if (!existsSync(join(dir, 'package-lock.json'))) throw new Error(`bundling needs dependencies but this revision has no package-lock.json: ${cli.stderr}`);
      requireCommand(dir, 'npm', ['ci', '--ignore-scripts']);
      cli = run();
    }
    if (!cli.ok) throw new Error(cli.error);
    Object.assign(result, summarize(cli.stdout, cli.stderr, candidate.path, candidate.fn));
  } catch (error) {
    result.reason = (error instanceof Error ? error.message : String(error)).slice(0, 4000);
  }
  result.seconds = Math.round((performance.now() - started) / 10) / 100;
  return result;
}

export function summarize(stdout: string, stderr: string, path: string, fn: string) {
  const reports = JSON.parse(stdout) as { path: string; report: WitnessReport }[];
  const report = reports.find((r) => r.path === path && r.report.fnName === fn)?.report;
  if (!report) throw new Error(stderr.trim() || 'no matching changed exported function reported');
  return {
    status: 'checked' as const,
    divergences: report.divergences.length,
    silent: report.divergences.filter((d) => d.pair.old.kind === 'return' && d.pair.new.kind === 'return').length,
    neverRan: report.neverRan ?? null,
  };
}

function main() {
  const { values } = parseArgs({ options: { limit: { type: 'string' }, only: { type: 'string' } } });
  const limit = values.limit === undefined ? Infinity : Number(values.limit);
  if (!(limit > 0 && (Number.isSafeInteger(limit) || values.limit === undefined))) throw new Error('--limit must be a positive integer');
  const all: Candidate[] = JSON.parse(readFileSync(join(corpus, 'candidates.json'), 'utf8'));
  const selected = all.filter((c) => values.only === undefined || c.repo === values.only).slice(0, limit);
  if (!selected.length) throw new Error('no candidates selected; --only must be an exact owner/repo');
  mkdirSync(cache, { recursive: true });
  const results = selected.map((candidate, i) => {
    console.error(`[${i + 1}/${selected.length}] ${candidate.repo} ${candidate.sha.slice(0, 7)} ${candidate.fn}`);
    return check(candidate);
  });
  const cell = (value: unknown) => String(value).replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
  const checked = results.filter((r) => r.status === 'checked').length;
  const replay = process.env.DIFFWITNESS_REPLAY === '1';
  const lines = ['# Dogfood results', '',
    `Mode: ${replay ? 'replay' : 'live'}; ${new Date().toISOString()}; Node ${process.version}; TZ=UTC.`,
    `DiffWitness revision: ${requireCommand(root, 'git', ['rev-parse', 'HEAD']).trim()}.`,
    `Selection: --only ${values.only ?? '(all)'}; --limit ${values.limit ?? '(all)'}.`, '',
    `${checked} checked, ${results.length - checked} skipped.`, '',
    replay ? 'The default replay fixtures have no entries for these functions. Checked means change detection and bundling succeeded, not behavioral validation. Zero divergences are not evidence of equivalence.' : 'Live results depend on the configured Ollama model and sampling. A silent divergence means both versions returned different values; it does not establish a bug.',
    'Divergences and silent count refer to distinct shrunk model repros. A dash means no report. neverRan is only reported when all actual trials threw the same error; a dash in replay does not prove normal execution.', '',
    '| Repo / commit | Function | Kind | Status | Divergences | Silent | neverRan | Seconds | Reason |',
    '|---|---|---|---|---:|---:|---|---:|---|',
    ...results.map((r) => `| ${r.candidate.repo} [${r.candidate.sha.slice(0, 7)}](${r.candidate.url}) | ${cell(r.candidate.fn)} | ${r.candidate.kind} | ${r.status} | ${r.divergences ?? '—'} | ${r.silent ?? '—'} | ${cell(r.neverRan ? `${r.neverRan.name}: ${r.neverRan.message}` : '—')} | ${r.seconds} | ${cell(r.reason)} |`), ''];
  const markdown = lines.join('\n');
  writeFileSync(join(corpus, 'results.md'), markdown);
  console.log(markdown);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
