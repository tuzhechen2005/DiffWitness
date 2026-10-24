import { createHash } from 'node:crypto';
import type { Hypothesizer, LoadedFn } from './types';

/** Replay fixtures are keyed by the exact pair of sources. */
export function fixtureKey(oldFn: LoadedFn, newFn: LoadedFn): string {
  return createHash('sha256').update(`${oldFn.source}\0${newFn.source}`).digest('hex').slice(0, 16);
}

/**
 * Asks Gemma via Ollama POST {url}/api/chat with `format` = JSON schema and stream: false. Issue #4.
 * Round 2 prompt includes every previous trial with its real outcomes ("these did NOT diverge").
 * Validates model output: drops items whose args are not a JSON array; caps at 8.
 * If `recordTo` is set, appends each round's validated hypotheses to that fixture file.
 */
export function ollamaHypothesizer(opts: { url: string; model: string; recordTo?: string }): Hypothesizer {
  throw new Error(`not implemented (#4): ${opts.url} ${opts.model}`);
}

/** Reads fixtures/replay.json-style file; unknown key or round -> []. Issue #4. */
export function replayHypothesizer(fixtureFile: string): Hypothesizer {
  throw new Error(`not implemented (#4): ${fixtureFile}`);
}

/**
 * replay if opts.replay or DIFFWITNESS_REPLAY=1 (file: DIFFWITNESS_FIXTURES ?? fixtures/replay.json);
 * else Ollama with OLLAMA_URL ?? http://localhost:11434, DIFFWITNESS_MODEL ?? gemma4:e4b,
 * recording to DIFFWITNESS_RECORD if set. Issue #4.
 */
export function hypothesizerFromEnv(env: NodeJS.ProcessEnv = process.env, opts: { replay?: boolean } = {}): Hypothesizer {
  throw new Error(`not implemented (#4): ${Object.keys(env).length} ${opts.replay}`);
}
