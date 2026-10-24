import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { inferShape, mulberry32, randomArgs } from '../src/core/baseline';
import { sameOutcome } from '../src/core/compare';
import { createRunner } from '../src/core/executor';
import { hypothesizerFromEnv } from '../src/core/hypothesize';
import { loadFunction } from '../src/core/loader';
import { paramsOf } from '../src/core/signature';
import type { Args, Pair } from '../src/core/types';
import { witness } from '../src/core/witness';

const { values } = parseArgs({ options: {
  'runs-per-case': { type: 'string', default: '3' },
  random: { type: 'string', default: '2000' },
  cases: { type: 'string', default: 'bench/cases' },
  out: { type: 'string', default: 'bench/results.md' },
} });
const runs = Number(values['runs-per-case']);
const random = Number(values.random);
if (![runs, random].every(n => Number.isSafeInteger(n) && n > 0)) {
  throw new Error('--runs-per-case and --random must be positive safe integers');
}
const silent = (pair: Pair) => pair.old.kind === 'return' && pair.new.kind === 'return' && !sameOutcome(pair.old, pair.new);
const hypothesizer = hypothesizerFromEnv();
const lines = [
  '# Refactor benchmark',
  '',
  `Hypothesizer: ${hypothesizer.label}. Runs per case: ${runs}. Random seed: 1 (reset per case). Cases: ${values.cases}. Coverage feedback: ${process.env.DIFFWITNESS_NO_COVERAGE === "1" ? "off" : "on"}.`,
  ...(process.env.DIFFWITNESS_REPLAY === '1' ? ['', 'Replay validation only; these are not live model measurements. Missing fixture keys yield no hypotheses.'] : []),
  '',
  '| case | model silent hit rate | random silent hits / R | model avg seconds |',
  '| --- | --- | --- | --- |',
];
let fromTypes = 0;
for (const name of readdirSync(values.cases!).sort()) {
  const dir = join(values.cases!, name);
  const oldFile = join(dir, 'old.ts');
  const newFile = join(dir, 'new.ts');
  const expected = JSON.parse(readFileSync(join(dir, 'expect.json'), 'utf8')) as { silent: Args };
  let hits = 0;
  const start = performance.now();
  for (let i = 0; i < runs; i++) {
    const report = await witness({ oldFile, newFile, hypothesizer, baselineRuns: 0, coverage: process.env.DIFFWITNESS_NO_COVERAGE !== '1' });
    if (report.divergences.some(d => silent(d.pair))) hits++;
  }
  const seconds = (performance.now() - start) / 1000 / runs;
  const newFn = await loadFunction(newFile);
  const params = paramsOf(newFn);
  const typed = !!params?.length && params.every(p => p.shape);
  if (typed) fromTypes++;
  const runner = await createRunner(await loadFunction(oldFile), newFn);
  let randomHits = 0;
  try {
    const shapes = typed ? params!.map(p => p.shape!) : inferShape(expected.silent);
    const rng = mulberry32(1);
    for (let i = 0; i < random; i++) {
      if (silent(await runner.run(randomArgs(shapes, rng)))) randomHits++;
    }
  } finally {
    await runner.close();
  }
  lines.push(`| ${name} | ${hits}/${runs} (${(hits / runs * 100).toFixed(1)}%) | ${randomHits} / ${random} | ${seconds.toFixed(3)} |`);
}
lines.splice(lines.findIndex(l => l.startsWith('| case')), 0, `Random baseline shapes: declared parameter types for ${fromTypes} of ${readdirSync(values.cases!).length} cases, the expected silent args otherwise.`, '');
lines.push('', 'Model timing includes the complete witness pipeline (loading, hypotheses, execution, and shrinking); the separate random baseline is excluded.', '');
const markdown = lines.join('\n');
console.log(markdown);
writeFileSync(values.out!, markdown);
