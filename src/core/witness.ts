import { mulberry32, inferShape, randomArgs } from './baseline';
import { sameOutcome } from './compare';
import { createRunner } from './executor';
import { loadFunction } from './loader';
import { shrink } from './shrink';
import type { Args, BaselineResult, Divergence, Hypothesizer, Pair, Runner, Trial, WitnessReport } from './types';

export interface WitnessOptions {
  oldFile: string;
  newFile: string;
  hypothesizer: Hypothesizer;
  timeoutMs?: number;
  baselineRuns?: number;
  seed?: number;
}

const diverges = (p: Pair) => !sameOutcome(p.old, p.new);
const kinds = (p: Pair) => `${p.old.kind}/${p.new.kind}`;

export async function witness(o: WitnessOptions): Promise<WitnessReport> {
  const [oldFn, newFn] = await Promise.all([loadFunction(o.oldFile), loadFunction(o.newFile)]);
  const runner = await createRunner(oldFn, newFn, { timeoutMs: o.timeoutMs ?? 1000 });
  try {
    const trials: Trial[] = [];
    let rounds: 1 | 2 = 1;
    for (const round of [1, 2] as const) {
      rounds = round;
      const hyps = await o.hypothesizer.propose({ old: oldFn, new: newFn, round, previous: [...trials] });
      for (const h of hyps.slice(0, 8)) {
        const pair = await runner.run(h.args);
        if ([pair.old, pair.new].some((x) => x.kind === 'throw' && x.name === 'DiffWitnessAsync'))
          throw new Error('async functions are not supported: DiffWitness compares synchronous pure functions');
        trials.push({ hypothesis: h, pair });
      }
      // Round 2 hunts for silent divergences (both return, values differ), the ones nobody notices.
      if (trials.some((t) => diverges(t.pair) && kinds(t.pair) === 'return/return')) break;
    }

    const byArgs = new Map<string, Divergence>();
    for (const t of trials) {
      if (!diverges(t.pair)) continue;
      // Keep the same outcome kinds while shrinking so we don't slide into a different bug.
      const want = kinds(t.pair);
      const s = await shrink(t.hypothesis.args, async (a) => {
        const p = await runner.run(a);
        return diverges(p) && kinds(p) === want;
      }, { maxSteps: 200 });
      const key = JSON.stringify(s.args);
      const seen = byArgs.get(key);
      if (seen) {
        seen.reasons.push(t.hypothesis.reason);
        seen.originalArgs.push(t.hypothesis.args);
        continue;
      }
      byArgs.set(key, {
        args: s.args,
        pair: await runner.run(s.args),
        reasons: [t.hypothesis.reason],
        originalArgs: [t.hypothesis.args],
        shrinkSteps: s.steps,
      });
    }

    const first = trials[0]?.hypothesis.args;
    const baseline = first && (await runBaseline(runner, first, o.baselineRuns ?? 2000, o.seed ?? 1));
    return { fnName: newFn.name, hypothesizer: o.hypothesizer.label, rounds, trials, divergences: [...byArgs.values()], baseline };
  } finally {
    await runner.close();
  }
}

async function runBaseline(runner: Runner, example: Args, runs: number, seed: number): Promise<BaselineResult> {
  const shapes = inferShape(example);
  const rng = mulberry32(seed);
  const result: BaselineResult = { runs, divergent: 0 };
  for (let i = 0; i < runs; i++) {
    const args = randomArgs(shapes, rng);
    if (!diverges(await runner.run(args))) continue;
    result.divergent++;
    result.firstDivergentArgs ??= args;
  }
  return result;
}
