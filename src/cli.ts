import { writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import pc from 'picocolors';
import { bundleFunction, withRevision } from './core/bundle';
import { exportVitest } from './core/exportTests';
import { changedFunctions, git, resolveRev } from './core/git';
import { hypothesizerFromEnv } from './core/hypothesize';
import type { Divergence, Hypothesizer, Label, LabeledDivergence, WitnessReport } from './core/types';
import { witness } from './core/witness';
import { fmtArgs, jsonSafe, renderReport } from './render';

export const USAGE = 'usage: diffwitness <old.ts> <new.ts> [--label bug|intended] [--json] [--replay] [--out file] [--runs n] [--fn name]\n' +
  '       diffwitness --git <base>[..<head>] [--path file] [--fn name] [--label bug|intended] [--json] [--replay] [--runs n]';

/** Relative import specifier from the test file to the new source file, without `.ts`. */
export function importPathFor(out: string, newFile: string): string {
  const rel = relative(dirname(resolve(out)), resolve(newFile)).replace(/\\/g, '/').replace(/\.ts$/, '');
  return rel.startsWith('../') ? rel : `./${rel}`;
}

export class UsageError extends Error {}

export function parseCli(argv: string[]) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        label: { type: 'string' },
        json: { type: 'boolean' },
        replay: { type: 'boolean' },
        out: { type: 'string' },
        runs: { type: 'string' },
        fn: { type: 'string' },
        git: { type: 'string' },
        path: { type: 'string' },
      },
    });
  } catch (e) {
    throw new UsageError((e as Error).message);
  }
  const { values, positionals } = parsed;
  if (values.git === undefined && positionals.length !== 2) throw new UsageError('expected exactly two files: <old.ts> <new.ts>');
  if (values.git !== undefined && positionals.length) throw new UsageError('--git takes no file arguments; use --path to pick a file');
  if (values.path !== undefined && values.git === undefined) throw new UsageError('--path only works with --git');
  const [base, head] = values.git?.split('..') ?? [];
  if (values.git !== undefined && !base) throw new UsageError('--git needs a base revision, e.g. --git HEAD~1 or --git main..feature');
  if ([base, head].some((r) => r?.startsWith('-'))) throw new UsageError('--git revisions cannot start with "-"');
  if (values.git !== undefined && values.out !== undefined) throw new UsageError('--out does not apply to --git: each function gets diffwitness.<path>.<fn>.test.ts');
  if (values.label !== undefined && values.label !== 'bug' && values.label !== 'intended') throw new UsageError('--label must be bug or intended');
  const runs = values.runs === undefined ? undefined : Number(values.runs);
  if (runs !== undefined && !(Number.isInteger(runs) && runs > 0)) throw new UsageError('--runs must be a positive integer');
  return {
    oldFile: positionals[0], newFile: positionals[1], label: values.label as Label | undefined, json: !!values.json, replay: !!values.replay,
    out: values.out ?? 'diffwitness.test.ts', runs, fn: values.fn, git: values.git === undefined ? undefined : { base, head: head || undefined }, path: values.path,
  };
}

async function labelAll(ds: Divergence[], fixed: Label | undefined, fnName: string): Promise<LabeledDivergence[]> {
  if (fixed) return ds.map((divergence) => ({ divergence, label: fixed }));
  if (!process.stdin.isTTY) return [];
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const items: LabeledDivergence[] = [];
  try {
    for (const d of ds) {
      const a = (await rl.question(`${fnName}${fmtArgs(d.args)}  [b]ug / [i]ntended / [s]kip: `)).trim().toLowerCase();
      if (a === 'b' || a === 'bug') items.push({ divergence: d, label: 'bug' });
      else if (a === 'i' || a === 'intended') items.push({ divergence: d, label: 'intended' });
  }
  } finally {
    rl.close();
  }
  return items;
}

/** Labels the report's divergences and writes them as a vitest file importing from `sourceFile`. */
async function exportReport(report: WitnessReport, label: Label | undefined, outFile: string, sourceFile: string) {
  const items = await labelAll(report.divergences, label, report.fnName);
  if (!items.length) return;
  const out = resolve(outFile);
  writeFileSync(out, exportVitest({ fnName: report.fnName, importPath: importPathFor(out, sourceFile), items }));
  console.log(`\nWrote ${items.length} regression test(s) to ${outFile}`);
}

/** Test file name for one function in git mode; includes the path so same-named functions never collide. */
export const gitOutFile = (path: string, fn: string) => `diffwitness.${path.replace(/\.ts$/, '').replace(/[\\/]/g, '_')}.${fn}.test.ts`;

async function gitMain(o: ReturnType<typeof parseCli>, range: { base: string; head?: string }, hypothesizer: Hypothesizer) {
  const repo = git(process.cwd(), 'rev-parse', '--show-toplevel').trim();
  const path = o.path === undefined ? undefined : relative(repo, resolve(o.path)).replace(/\\/g, '/');
  const [base, head] = [resolveRev(repo, range.base), range.head === undefined ? undefined : resolveRev(repo, range.head)];
  const { fns, notes } = changedFunctions(repo, base, head, { path, fn: o.fn });
  for (const n of notes) console.error(pc.dim(`note: ${n}`));
  const bundleAll = (rev: string | undefined, side: 'oldSource' | 'newSource') =>
    withRevision(repo, rev, (dir) => Promise.allSettled(fns.map((f) => bundleFunction(dir, f.path, f.name, f[side], repo))));
  const olds = await bundleAll(base, 'oldSource');
  const news = await bundleAll(head, 'newSource');

  const results: { path: string; report: WitnessReport }[] = [];
  for (const [i, f] of fns.entries()) {
    const [a, b] = [olds[i], news[i]];
    if (a.status === 'rejected' || b.status === 'rejected') {
      const why = a.status === 'rejected' ? a.reason : (b as PromiseRejectedResult).reason;
      console.error(pc.yellow(`skipped ${f.path}:${f.name}: ${why instanceof Error ? why.message : why}`));
      continue;
    }
    const report = await witness({ old: a.value, new: b.value, hypothesizer, baselineRuns: o.runs });
    results.push({ path: f.path, report });
    if (o.json) continue;
    console.log(`${pc.bold(pc.cyan(`━━ ${f.path}:${f.name}`))}\n${renderReport(report)}\n`);
    await exportReport(report, o.label, gitOutFile(f.path, f.name), join(repo, f.path));
  }
  if (o.json) return console.log(JSON.stringify(jsonSafe(results), null, 2));
  const diverged = results.filter((r) => r.report.divergences.length).length;
  const never = results.filter((r) => r.report.neverRan).length;
  console.log(pc.bold(`${results.length} changed function(s) checked, ${diverged} with divergences${never ? `, ${never} never ran normally` : ''}`));
}

async function main(argv: string[]) {
  const o = parseCli(argv);
  const hypothesizer = hypothesizerFromEnv(process.env, { replay: o.replay });
  if (o.git) return gitMain(o, o.git, hypothesizer);
  const report = await witness({ oldFile: o.oldFile, newFile: o.newFile, hypothesizer, baselineRuns: o.runs, fn: o.fn });
  if (o.json) return console.log(JSON.stringify(jsonSafe(report), null, 2));

  console.log(renderReport(report));
  await exportReport(report, o.label, o.out, o.newFile);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main(process.argv.slice(2)).catch((e) => {
    if (e instanceof UsageError) {
      console.error(`${e.message}\n${USAGE}`);
      process.exit(2);
    }
    console.error(process.env.DEBUG ? e : `error: ${(e as Error).message}`);
    process.exit(1);
  });
}
