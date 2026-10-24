import { inspect } from 'node:util';
import pc from 'picocolors';
import type { Args, Outcome, WitnessReport } from './core/types';

/** Strings quoted, -0 / NaN / undefined visible, objects on one line. */
export function fmtValue(v: unknown): string {
  return typeof v === 'string' ? JSON.stringify(v) : inspect(v, { breakLength: Infinity, depth: null });
}

export const fmtArgs = (args: Args): string => `(${args.map(fmtValue).join(', ')})`;

export function fmtOutcome(o: Outcome): string {
  if (o.kind === 'return') return fmtValue(o.value);
  return o.kind === 'throw' ? `throws ${o.name}: ${o.message}` : 'timeout';
}

/** Makes -0, NaN, Infinity and undefined JSON-safe by turning them into strings. */
export function jsonSafe(v: unknown): unknown {
  if (v === undefined) return 'undefined';
  if (typeof v === 'number' && (!Number.isFinite(v) || Object.is(v, -0))) return fmtValue(v);
  if (Array.isArray(v)) return v.map(jsonSafe);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, jsonSafe(x)]));
  return v;
}

export function renderReport(r: WitnessReport): string {
  // A trial diverged iff the divergence list absorbed its args (witness() merges every diverging hypothesis).
  const key = (a: Args) => JSON.stringify(jsonSafe(a));
  const diverged = new Set(r.divergences.flatMap((d) => d.originalArgs.map(key)));
  const hits = r.trials.filter((t) => diverged.has(key(t.hypothesis.args))).length;
  const replay = /replay/i.test(r.hypothesizer);

  const out: string[] = [
    pc.bold(`DiffWitness  ${r.fnName}`),
    `  hypothesizer: ${replay ? pc.bgYellow(pc.black(' REPLAY ')) + ' ' : ''}${r.hypothesizer}`,
    `  rounds used:  ${r.rounds}`,
    '',
    pc.bold('Hypotheses'),
  ];
  for (const t of r.trials) {
    const mark = diverged.has(key(t.hypothesis.args)) ? pc.bold(pc.red('✔ confirmed')) : pc.dim('· same     ');
    out.push(`  ${mark}  ${fmtArgs(t.hypothesis.args)}  ${pc.dim(t.hypothesis.reason)}`);
  }
  out.push('');

  if (r.divergences.length === 0) {
    out.push(pc.green('No divergence found (this is evidence, not proof of equivalence).'));
  } else {
    out.push(pc.bold(pc.red(`Confirmed divergences: ${r.divergences.length}`)));
    r.divergences.forEach((d, i) => {
      out.push('', pc.bold(pc.red(`  #${i + 1}  ${r.fnName}${fmtArgs(d.args)}`)));
      out.push(`      old → ${fmtOutcome(d.pair.old)}`, `      new → ${fmtOutcome(d.pair.new)}`);
      const orig = d.originalArgs.map(fmtArgs).filter((a) => a !== fmtArgs(d.args));
      if (orig.length) out.push(pc.dim(`      model args: ${orig.join(' | ')}`));
      out.push(pc.dim(`      shrunk in ${d.shrinkSteps} steps; why: ${d.reasons.join(' / ')}`));
    });
  }

  out.push('');
  if (r.baseline) out.push(`Random fuzzing: ${pc.bold(`${r.baseline.divergent} of ${r.baseline.runs}`)} runs diverged`);
  out.push(`Model:          ${pc.bold(pc.green(`${hits} of ${r.trials.length}`))} hypotheses diverged`);
  return out.join('\n');
}
