import { inspect } from 'node:util';
import pc from 'picocolors';
import { sameOutcome } from './core/compare';
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
  const hit = (t: WitnessReport['trials'][number]) => !sameOutcome(t.pair.old, t.pair.new);
  const hits = r.trials.filter(hit).length;
  const replay = /replay/i.test(r.hypothesizer);

  const out: string[] = [
    pc.bold(`DiffWitness  ${r.fnName}`),
    `  hypothesizer: ${replay ? pc.bgYellow(pc.black(' REPLAY ')) + ' ' : ''}${r.hypothesizer}`,
    `  rounds used:  ${r.rounds}`,
    '',
    pc.bold('Hypotheses'),
  ];
  for (const t of r.trials) {
    const mark = hit(t) ? pc.bold(pc.red('✔ confirmed')) : pc.dim('· same     ');
    out.push(`  ${mark}  ${fmtArgs(t.hypothesis.args)}  ${pc.dim(t.hypothesis.reason)}`);
  }
  out.push('');

  if (r.divergences.length === 0) {
    out.push(pc.green('No divergence found (this is evidence, not proof of equivalence).'));
  } else {
    // witness() orders each cluster's simplest repro first; a divergence without a cluster stands alone.
    const groups: (typeof r.divergences)[] = [];
    for (const d of r.divergences) {
      const last = groups.at(-1);
      if (last && d.cluster !== undefined && last[0].cluster === d.cluster) last.push(d);
      else groups.push([d]);
    }
    out.push(pc.bold(pc.red(`Confirmed divergences: ${r.divergences.length} in ${groups.length} behavior${groups.length === 1 ? '' : 's'}`)));
    groups.forEach(([d, ...similar], i) => {
      out.push('', pc.bold(pc.red(`  #${i + 1}  ${r.fnName}${fmtArgs(d.args)}`)));
      out.push(`      old → ${fmtOutcome(d.pair.old)}`, `      new → ${fmtOutcome(d.pair.new)}`);
      const orig = d.originalArgs.map(fmtArgs).filter((a) => a !== fmtArgs(d.args));
      if (orig.length) out.push(pc.dim(`      model args: ${orig.join(' | ')}`));
      out.push(pc.dim(`      shrunk in ${d.shrinkSteps} steps; why: ${d.reasons.join(' / ')}`));
      if (similar.length) out.push(pc.dim(`      +${similar.length} similar (same branches): ${similar.map((x) => fmtArgs(x.args)).join(' ')}`));
    });
  }

  out.push('');
  const silent = r.divergences.filter((d) => d.pair.old.kind === 'return' && d.pair.new.kind === 'return').length;
  if (r.baseline) {
    const b = r.baseline;
    out.push(`Random fuzzing: ${pc.bold(`${b.divergent} of ${b.runs}`)} runs diverged, ${pc.bold(String(b.silent))} silent (both returned); sample shrank to ${b.repros.length} distinct repros`);
  }
  out.push(`Model:          ${pc.bold(pc.green(`${hits} of ${r.trials.length}`))} hypotheses diverged, ${pc.bold(pc.green(String(silent)))} silent, ${r.divergences.length} distinct repros`);
  if (r.coverage && r.coverage.old.total + r.coverage.new.total > 0) {
    const c = r.coverage;
    out.push(`Coverage:       old ${c.old.covered}/${c.old.total}, new ${c.new.covered}/${c.new.total} branches reached by model inputs`);
  }
  // Show both sets side by side instead of claiming exclusivity: exact-match comparison would overstate it.
  if (r.baseline?.repros.length) out.push(pc.dim(`  random repros: ${r.baseline.repros.slice(0, 10).map(fmtArgs).join(' ')}${r.baseline.repros.length > 10 ? ' …' : ''}`));
  if (r.divergences.length) out.push(`  model repros:  ${r.divergences.map((d) => fmtArgs(d.args)).join(' ')}`);
  return out.join('\n');
}
