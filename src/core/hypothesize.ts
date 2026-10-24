import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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

/** Exported so the exact prompt can be inspected and tuned. */
export function buildPrompt({ old, new: next, round, previous }: ProposeInput): string {
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
    'Prefer realistic, type-respecting inputs and edge cases tied to the specific code change.',
    'For each input give a reason: one short sentence.',
  ];
  if (round === 2) {
    lines.push('', 'These inputs were already tried, and old and new behaved the SAME on every one:');
    previous.forEach((t, i) =>
      lines.push(`${i + 1}. args ${show(t.hypothesis.args)}: old ${showOutcome(t.pair.old)}; new ${showOutcome(t.pair.new)}`));
    lines.push('Propose inputs in different directions from these.');
  }
  return lines.join('\n');
}

const readFixtures = (file: string): Fixtures => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {});

/**
 * Asks Gemma via Ollama POST {url}/api/chat with `format` = JSON schema and stream: false. Issue #4.
 * Round 2 prompt includes every previous trial with its real outcomes ("these did NOT diverge").
 * Validates model output: drops items whose args are not a JSON array; caps at 8.
 * If `recordTo` is set, appends each round's validated hypotheses to that fixture file.
 */
export function ollamaHypothesizer(opts: { url: string; model: string; recordTo?: string }): Hypothesizer {
  return {
    label: `${opts.model} @ ${opts.url}`,
    async propose(input) {
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
          signal: AbortSignal.timeout(120_000),
        });
        if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
        content = ((await res.json()) as { message?: { content?: unknown } }).message?.content;
      } catch (e) {
        const why = e instanceof Error ? e.message : String(e);
        throw new Error(`Ollama request to ${opts.url} (model ${opts.model}) failed: ${why}. Is Ollama running? Use --replay to run from fixtures.`);
      }

      const hyps: Hypothesis[] = [];
      try {
        const items = (JSON.parse(String(content)) as { hypotheses?: unknown }).hypotheses;
        if (!Array.isArray(items)) throw new Error('no hypotheses array');
        for (const it of items) {
          if (hyps.length === 8) break;
          if (it && typeof it.reason === 'string' && Array.isArray(it.args)) hyps.push({ reason: it.reason, args: it.args, round: input.round });
        }
      } catch (e) {
        process.stderr.write(`diffwitness: unparsable model output (${e instanceof Error ? e.message : e}); using no hypotheses\n`);
        return [];
      }

      if (opts.recordTo) {
        const fixtures = readFixtures(opts.recordTo);
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
  const fixtures = readFixtures(fixtureFile);
  return {
    label: `replay (${fixtureFile})`,
    async propose({ old, new: next, round }) {
      const items = fixtures[fixtureKey(old, next)]?.rounds?.[String(round)] ?? [];
      return items.map((h) => ({ reason: h.reason, args: h.args as Hypothesis['args'], round }));
    },
  };
}

/**
 * replay if opts.replay or DIFFWITNESS_REPLAY=1 (file: DIFFWITNESS_FIXTURES ?? fixtures/replay.json);
 * else Ollama with OLLAMA_URL ?? http://localhost:11434, DIFFWITNESS_MODEL ?? gemma4:e4b,
 * recording to DIFFWITNESS_RECORD if set. Issue #4.
 */
export function hypothesizerFromEnv(env: NodeJS.ProcessEnv = process.env, opts: { replay?: boolean } = {}): Hypothesizer {
  if (opts.replay || env.DIFFWITNESS_REPLAY === '1') return replayHypothesizer(env.DIFFWITNESS_FIXTURES ?? 'fixtures/replay.json');
  return ollamaHypothesizer({
    url: env.OLLAMA_URL ?? 'http://localhost:11434',
    model: env.DIFFWITNESS_MODEL ?? 'gemma4:e4b',
    recordTo: env.DIFFWITNESS_RECORD,
  });
}
