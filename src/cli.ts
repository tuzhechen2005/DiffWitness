import { writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { exportVitest } from './core/exportTests';
import { hypothesizerFromEnv } from './core/hypothesize';
import type { Divergence, Label, LabeledDivergence } from './core/types';
import { witness } from './core/witness';
import { fmtArgs, jsonSafe, renderReport } from './render';

export const USAGE = 'usage: diffwitness <old.ts> <new.ts> [--label bug|intended] [--json] [--replay] [--out file] [--runs n]';

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
        out: { type: 'string', default: 'diffwitness.test.ts' },
        runs: { type: 'string' },
      },
    });
  } catch (e) {
    throw new UsageError((e as Error).message);
  }
  const { values, positionals } = parsed;
  if (positionals.length !== 2) throw new UsageError('expected exactly two files: <old.ts> <new.ts>');
  if (values.label !== undefined && values.label !== 'bug' && values.label !== 'intended') throw new UsageError('--label must be bug or intended');
  const runs = values.runs === undefined ? undefined : Number(values.runs);
  if (runs !== undefined && !(Number.isInteger(runs) && runs > 0)) throw new UsageError('--runs must be a positive integer');
  return { oldFile: positionals[0], newFile: positionals[1], label: values.label as Label | undefined, json: !!values.json, replay: !!values.replay, out: values.out as string, runs };
}

async function labelAll(ds: Divergence[], fixed: Label | undefined, fnName: string): Promise<LabeledDivergence[]> {
  if (fixed) return ds.map((divergence) => ({ divergence, label: fixed }));
  if (!process.stdin.isTTY) return [];
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const items: LabeledDivergence[] = [];
  for (const d of ds) {
    const a = (await rl.question(`${fnName}${fmtArgs(d.args)}  [b]ug / [i]ntended / [s]kip: `)).trim().toLowerCase();
    if (a === 'b' || a === 'bug') items.push({ divergence: d, label: 'bug' });
    else if (a === 'i' || a === 'intended') items.push({ divergence: d, label: 'intended' });
  }
  rl.close();
  return items;
}

async function main(argv: string[]) {
  const o = parseCli(argv);
  const hypothesizer = hypothesizerFromEnv(process.env, { replay: o.replay });
  const report = await witness({ oldFile: o.oldFile, newFile: o.newFile, hypothesizer, baselineRuns: o.runs });
  if (o.json) return console.log(JSON.stringify(jsonSafe(report), null, 2));

  console.log(renderReport(report));
  const items = await labelAll(report.divergences, o.label, report.fnName);
  if (!items.length) return;
  const out = resolve(o.out);
  const rel = relative(dirname(out), resolve(o.newFile)).replace(/\\/g, '/').replace(/\.ts$/, '');
  const importPath = rel.startsWith('.') ? rel : `./${rel}`;
  writeFileSync(out, exportVitest({ fnName: report.fnName, importPath, items }));
  console.log(`\nWrote ${items.length} regression test(s) to ${o.out}`);
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
