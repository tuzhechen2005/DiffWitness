import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { sameOutcome } from './compare';
import type { Hypothesis, Hypothesizer, LoadedFn, Outcome, ProposeInput } from './types';

/** Replay fixtures are keyed by the exact pair of sources. */
export function fixtureKey(oldFn: LoadedFn, newFn: LoadedFn): string {
  return createHash('sha256').update(`${oldFn.source}\0${newFn.source}`).digest('hex').slice(0, 16);
}

const SCHEMA = {
  type: 'object',
  properties: {
    hypotheses: {
      type: 'array',
      items: { type: 'object', properties: { reason: { type: 'string' }, args: { type: 'array' } }, required: ['reason', 'args'] },
    },
  },
  required: ['hypotheses'],
};

type Fixtures = Record<string, { source?: string; rounds?: Record<string, { reason: string; args: unknown[] }[]> }>;

const show = (v: unknown) => JSON.stringify(v) ?? String(v);
const showOutcome = (o: Outcome) =>
  o.kind === 'return' ? `returned ${show(o.value)}` : o.kind === 'throw' ? `threw ${o.name}: ${o.message}` : 'timed out';

const ARM: Record<string, string> = {
  'if-then': 'then-branch', 'if-else': 'else-branch', 'cond-true': 'true arm of ?:', 'cond-false': 'false arm of ?:',
  'logical-right': 'right side of &&/||/??', case: 'case', default: 'default case', catch: 'catch block',
};

/** Exported so the exact prompt can be inspected and tuned. */
export function buildPrompt({ old, new: next, round, previous, uncovered = [] }: ProposeInput): string {
  const lines = [
    `The function \`${next.name}\` was changed. Find inputs where the OLD and NEW versions behave differently.`,
    '',
    'OLD source:',
    old.source,
    '',
    'NEW source:',
    next.source,
    '',
    'Propose up to 8 inputs. Each input is a JSON array of positional arguments (JSON values only).',
    'Choose inputs where old and new would return different values, or where one throws and the other does not.',
    'Prefer realistic inputs that match the parameter types in the signature, and edge cases tied to the specific code change.',
    'Most valuable are SILENT divergences: inputs valid for both versions (neither throws) that return different values. Include several.',
    'Make each input test a different behavior; do not repeat one idea.',
    'For each input give a reason: one short sentence.',
  ];
  if (next.params?.length) lines.splice(1, 0, `Parameter types (from the TypeScript signature): ${next.params.map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.text}`).join(', ')}`);
  if (round === 2) {
    lines.push('', 'Already tried, with the real results of running both versions:');
    previous.forEach((t, i) =>
      lines.push(`${i + 1}. args ${show(t.hypothesis.args)}: old ${showOutcome(t.pair.old)}; new ${showOutcome(t.pair.new)}`));
    const silent = previous.some((t) => t.pair.old.kind === 'return' && t.pair.new.kind === 'return' && !sameOutcome(t.pair.old, t.pair.new));
    if (!silent) lines.push('None of these is a silent divergence. Propose NEW inputs where both versions return normally but the values differ.');
    if (uncovered.length) {
      lines.push('', 'These branches were never executed by any input so far:');
      // shortcut: capped at 20 lines to keep the prompt small; rank by diff proximity if big functions need it.
      for (const b of uncovered.slice(0, 20)) lines.push(`- ${b.side.toUpperCase()} line ${b.line} \`${b.text}\` (${ARM[b.kind] ?? b.kind})`);
      lines.push('Propose inputs that reach them and make old and new differ.');
    }
  }
  return lines.join('\n');
}

// Recording may start from a missing file; replay must not silently run on nothing.
function readFixtures(file: string, kind: 'replay' | 'record'): Fixtures {
  if (kind === 'record' && !existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`${kind} fixture ${file} is missing or unreadable: ${e instanceof Error ? e.message : e}`);
  }
}

/**
 * Asks Gemma via Ollama POST {url}/api/chat with `format` = JSON schema and stream: false. Issue #4.
 * Round 2 prompt includes every previous trial with its real outcomes ("these did NOT diverge").
 * Validates model output: drops items whose args are not a JSON array; caps at 8.
 * If `recordTo` is set, appends each round's validated hypotheses to that fixture file.
 */
export function ollamaHypothesizer(opts: { url: string; model: string; recordTo?: string; timeoutMs?: number }): Hypothesizer {
  return {
    label: `${opts.model} @ ${opts.url}`,
    async propose(input) {
      const hyps: Hypothesis[] = [];
      for (let attempt = 0; attempt < 2; attempt++) {
        let content: unknown;
        try {
          const res = await fetch(`${opts.url}/api/chat`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              model: opts.model,
              stream: false,
              format: SCHEMA,
              messages: [{ role: 'user', content: buildPrompt(input) }],
              options: { temperature: 0.2 },
            }),
            signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
          });
          if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
          content = ((await res.json()) as { message?: { content?: unknown } }).message?.content;
        } catch (e) {
          const why = e instanceof Error ? e.message : String(e);
          throw new Error(`Ollama request to ${opts.url} (model ${opts.model}) failed: ${why}. Is Ollama running? Use --replay to run from fixtures.`);
        }

        try {
          const items = (JSON.parse(String(content)) as { hypotheses?: unknown }).hypotheses;
          if (!Array.isArray(items)) throw new Error('no hypotheses array');
          for (const it of items) {
            if (hyps.length === 8) break;
            if (it && typeof it.reason === 'string' && Array.isArray(it.args)) hyps.push({ reason: it.reason, args: it.args, round: input.round });
          }
        } catch (e) {
          if (attempt === 0) continue;
          process.stderr.write(`diffwitness: unparsable model output (${e instanceof Error ? e.message : e}); using no hypotheses\n`);
          return [];
        }

        break;
      }

      if (opts.recordTo) {
        const fixtures = readFixtures(opts.recordTo, 'record');
        const entry = (fixtures[fixtureKey(input.old, input.new)] ??= {});
        entry.source = 'model';
        (entry.rounds ??= {})[String(input.round)] = hyps.map(({ reason, args }) => ({ reason, args }));
        writeFileSync(opts.recordTo, JSON.stringify(fixtures, null, 2) + '\n');
      }
      return hyps;
    },
  };
}

/** Reads fixtures/replay.json-style file; unknown key or round -> []. Issue #4. */
export function replayHypothesizer(fixtureFile: string): Hypothesizer {
  const fixtures = readFixtures(fixtureFile, 'replay');
  return {
    label: `replay (${fixtureFile})`,
    async propose({ old, new: next, round }) {
      const items = fixtures[fixtureKey(old, next)]?.rounds?.[String(round)] ?? [];
      return items.map((h) => ({ reason: h.reason, args: h.args as Hypothesis['args'], round }));
    },
  };
}

/**
 * replay if opts.replay or DIFFWITNESS_REPLAY=1 (file: DIFFWITNESS_FIXTURES ?? the package's fixtures/gemma-recorded.json, real recorded Gemma output);
 * else Ollama with OLLAMA_URL ?? http://localhost:11434, DIFFWITNESS_MODEL ?? gemma4:e4b,
 * recording to DIFFWITNESS_RECORD if set. Issue #4.
 */
export function hypothesizerFromEnv(env: NodeJS.ProcessEnv = process.env, opts: { replay?: boolean; timeoutMs?: number } = {}): Hypothesizer {
  if (opts.replay || env.DIFFWITNESS_REPLAY === '1') return replayHypothesizer(env.DIFFWITNESS_FIXTURES ?? fileURLToPath(new URL('../../fixtures/gemma-recorded.json', import.meta.url)));
  return ollamaHypothesizer({
    url: env.OLLAMA_URL ?? 'http://localhost:11434',
    model: env.DIFFWITNESS_MODEL ?? 'gemma4:e4b',
    recordTo: env.DIFFWITNESS_RECORD,
    timeoutMs: opts.timeoutMs,
  });
}
