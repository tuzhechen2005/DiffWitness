import { mulberry32, inferShape, randomArgs } from './baseline';
import { sameOutcome } from './compare';
import { instrument } from './coverage';
import { createRunner } from './executor';
import { loadFunction } from './loader';
import { shrink } from './shrink';
import type { Args, BaselineResult, Divergence, Hypothesizer, Pair, ProposeInput, Runner, Trial, WitnessReport } from './types';

export interface WitnessOptions {
  oldFile: string;
  newFile: string;
  fn?: string;
  hypothesizer: Hypothesizer;
  timeoutMs?: number;
  baselineRuns?: number;
  seed?: number;
  /** Feed uncovered branches to round 2 (default true); off reproduces the pre-coverage pipeline for ablations. */
  coverage?: boolean;
}

const diverges = (p: Pair) => !sameOutcome(p.old, p.new);
const kinds = (p: Pair) => `${p.old.kind}/${p.new.kind}`;

export async function witness(o: WitnessOptions): Promise<WitnessReport> {
  const [oldFn, newFn] = await Promise.all([loadFunction(o.oldFile, o.fn), loadFunction(o.newFile, o.fn)]);
  const [oldCov, newCov] = [instrument(oldFn), instrument(newFn)];
  const runner = await createRunner(oldCov.fn, newCov.fn, { timeoutMs: o.timeoutMs ?? 1000 });
  try {
    const trials: Trial[] = [];
    const hit = { old: new Set<number>(), new: new Set<number>() };
    const uncovered = () => (['old', 'new'] as const).flatMap((side) =>
      (side === 'old' ? oldCov : newCov).branches.filter((b) => !hit[side].has(b.id)).map(({ line, kind, text }) => ({ side, line, kind, text })));
    let rounds: 1 | 2 = 1;
    for (const round of [1, 2] as const) {
      rounds = round;
      const input: ProposeInput = { old: oldFn, new: newFn, round, previous: [...trials] };
      const useCov = o.coverage ?? true;
      if (round === 2 && useCov) input.uncovered = uncovered();
      const hyps = await o.hypothesizer.propose(input);
      for (const h of hyps.slice(0, 8)) {
        const pair = await runner.run(h.args);
        if ([pair.old, pair.new].some((x) => x.kind === 'throw' && x.name === 'DiffWitnessAsync'))
          throw new Error('async functions are not supported: DiffWitness compares synchronous pure functions');
        pair.coverage?.old.forEach((id) => hit.old.add(id));
        pair.coverage?.new.forEach((id) => hit.new.add(id));
        trials.push({ hypothesis: h, pair });
      }
      // Round 2 hunts for silent divergences (both return, values differ) and for code no input reached yet.
      if (trials.some((t) => diverges(t.pair) && kinds(t.pair) === 'return/return') && (!useCov || uncovered().length === 0)) break;
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
    const found = [...byArgs.values()];
    // Without branches every divergence shares the empty path, so grouping would say nothing.
    const divergences = oldCov.branches.length + newCov.branches.length ? cluster(found) : found;
    const coverage = {
      old: { covered: hit.old.size, total: oldCov.branches.length },
      new: { covered: hit.new.size, total: newCov.branches.length },
    };
    return { fnName: newFn.name, hypothesizer: o.hypothesizer.label, rounds, trials, divergences, baseline, coverage };
  } finally {
    await runner.close();
  }
}

/** Groups by outcome kinds plus the branch path of each side; clusters keep first-seen order, simplest repro first inside. */
export function cluster(ds: Divergence[]): Divergence[] {
  const path = (ids: number[] = []) => [...ids].sort((a, b) => a - b).join(',');
  const groups = new Map<string, Divergence[]>();
  for (const d of ds) {
    const key = `${kinds(d.pair)}|${path(d.pair.coverage?.old)}|${path(d.pair.coverage?.new)}`;
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  const simpler = (a: Divergence, b: Divergence) => {
    const [x, y] = [JSON.stringify(a.args), JSON.stringify(b.args)];
    return x.length - y.length || (x < y ? -1 : x > y ? 1 : 0);
  };
  return [...groups.values()].flatMap((g, i) => g.sort(simpler).map((d) => ({ ...d, cluster: i })));
}

async function runBaseline(runner: Runner, example: Args, runs: number, seed: number): Promise<BaselineResult> {
  const shapes = inferShape(example);
  const rng = mulberry32(seed);
  const result: BaselineResult = { runs, divergent: 0, silent: 0, repros: [] };
  const seen = new Set<string>();
  for (let i = 0; i < runs; i++) {
    const args = randomArgs(shapes, rng);
    const pair = await runner.run(args);
    if (!diverges(pair)) continue;
    result.divergent++;
    if (kinds(pair) === 'return/return') result.silent++;
    result.firstDivergentArgs ??= args;
    // Shrink a sample the same way as model hits so the two sets of repros are comparable.
    if (result.divergent > 20) continue;
    const want = kinds(pair);
    const s = await shrink(args, async (a) => {
      const p = await runner.run(a);
      return diverges(p) && kinds(p) === want;
    }, { maxSteps: 200 });
    const key = JSON.stringify(s.args);
    if (!seen.has(key)) seen.add(key), result.repros.push(s.args);
  }
  return result;
}
