import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildPrompt, fixtureKey, hypothesizerFromEnv, ollamaHypothesizer, replayHypothesizer } from '../src/core/hypothesize';
import type { LoadedFn, ProposeInput } from '../src/core/types';

const load = (f: string): LoadedFn => ({ name: 'normalizeOrderId', source: readFileSync(f, 'utf8'), code: '' });
const old = load('examples/order-id/old.ts');
const next = load('examples/order-id/new.ts');
const input: ProposeInput = { old, new: next, round: 1, previous: [] };

const reply = (content: string, status = 200) =>
  vi.fn(async (..._a: unknown[]) => new Response(JSON.stringify({ message: { content } }), { status }));
const bodyOf = (f: ReturnType<typeof reply>) => JSON.parse((f.mock.calls[0][1] as RequestInit).body as string);
const tmp = () => join(mkdtempSync(join(tmpdir(), 'dw-')), 'rec.json');

afterEach(() => vi.unstubAllGlobals());

describe('replay', () => {
  it('returns the handwritten order-id round 1, and [] for unknown round or key', async () => {
    const h = replayHypothesizer('fixtures/replay.json');
    const r1 = await h.propose(input);
    expect(r1).toHaveLength(5);
    expect(r1[0]).toEqual({ reason: expect.any(String), args: ['00128'], round: 1 });
    expect(await h.propose({ ...input, round: 2 })).toEqual([]);
    expect(await h.propose({ ...input, old: { ...old, source: 'x' } })).toEqual([]);
  });

  it('throws naming the path when the fixture file is missing', () => {
    expect(() => replayHypothesizer('/nonexistent.json')).toThrow(/replay fixture \/nonexistent\.json is missing or unreadable/);
  });
});

describe('ollama', () => {
  const h = ollamaHypothesizer({ url: 'http://x:1', model: 'm' });

  it('parses valid output and sends the schema request', async () => {
    const f = reply(JSON.stringify({ hypotheses: [{ reason: 'r', args: ['a'] }] }));
    vi.stubGlobal('fetch', f);
    expect(await h.propose(input)).toEqual([{ reason: 'r', args: ['a'], round: 1 }]);
    expect(f.mock.calls[0][0]).toBe('http://x:1/api/chat');
    expect(bodyOf(f)).toMatchObject({ model: 'm', stream: false, options: { temperature: 0.2 } });
    expect(bodyOf(f).messages[0].content).toContain(old.source);
  });

  it.each(['not json', '{}'])('retries %s with the same request and records only the valid reply', async (bad) => {
    const file = tmp();
    const rec = ollamaHypothesizer({ url: 'http://x:1', model: 'm', recordTo: file });
    const f = reply(JSON.stringify({ hypotheses: [{ reason: 'r', args: ['a'] }] }));
    f.mockImplementationOnce(async () => new Response(JSON.stringify({ message: { content: bad } })))
      .mockImplementationOnce(async () => {
        expect(existsSync(file)).toBe(false);
        return new Response(JSON.stringify({ message: { content: JSON.stringify({ hypotheses: [{ reason: 'r', args: ['a'] }] }) } }));
      });
    vi.stubGlobal('fetch', f);
    expect(await rec.propose(input)).toEqual([{ reason: 'r', args: ['a'], round: 1 }]);
    expect(f).toHaveBeenCalledTimes(2);
    expect(f.mock.calls[1][0]).toBe(f.mock.calls[0][0]);
    expect((f.mock.calls[1][1] as RequestInit).body).toBe((f.mock.calls[0][1] as RequestInit).body);
    expect(await replayHypothesizer(file).propose(input)).toEqual([{ reason: 'r', args: ['a'], round: 1 }]);
  });

  it.each(['not json', '{}'])('returns [] after two %s replies without recording', async (bad) => {
    const file = tmp();
    const rec = ollamaHypothesizer({ url: 'http://x:1', model: 'm', recordTo: file });
    const f = reply(bad);
    vi.stubGlobal('fetch', f);
    const w = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    try {
      expect(await rec.propose(input)).toEqual([]);
      expect(f).toHaveBeenCalledTimes(2);
      expect(w).toHaveBeenCalledOnce();
      expect(w).toHaveBeenCalledWith(expect.stringContaining('using no hypotheses'));
      expect(existsSync(file)).toBe(false);
    } finally {
      w.mockRestore();
    }
  });

  it('drops bad items and caps at 8', async () => {
    const good = Array.from({ length: 10 }, (_, i) => ({ reason: 'r', args: [i] }));
    vi.stubGlobal('fetch', reply(JSON.stringify({ hypotheses: [{ reason: 'r', args: 'no' }, { reason: 1, args: [] }, null, ...good] })));
    const out = await h.propose(input);
    expect(out).toHaveLength(8);
    expect(out[0].args).toEqual([0]);
  });

  it('round 2 prompt includes previous trials with real outcomes', async () => {
    const f = reply('{"hypotheses":[]}');
    vi.stubGlobal('fetch', f);
    const trial = {
      hypothesis: { reason: 'r', args: ['00128'], round: 1 as const },
      pair: { old: { kind: 'return' as const, value: 'A' }, new: { kind: 'throw' as const, name: 'TypeError', message: 'boom' } },
    };
    await h.propose({ ...input, round: 2, previous: [trial] });
    const prompt = bodyOf(f).messages[0].content;
    expect(prompt).toContain('["00128"]');
    expect(prompt).toContain('returned "A"');
    expect(prompt).toContain('threw TypeError: boom');
    expect(prompt).toContain('real results');
  });

  it('round 2 prompt lists uncovered branches and drops the no-silent line once one is found', () => {
    const silent = {
      hypothesis: { reason: 'r', args: ['00'], round: 1 as const },
      pair: { old: { kind: 'return' as const, value: '00' }, new: { kind: 'return' as const, value: '0' } },
    };
    const prompt = buildPrompt({
      ...input, round: 2, previous: [silent],
      uncovered: [{ side: 'new', line: 4, kind: 'if-then', text: 'if (Number.isNaN(n)) throw new Error(`invalid order id: ${raw}`);' }],
    });
    expect(prompt).toContain('These branches were never executed by any input so far:');
    expect(prompt).toContain('- NEW line 4 `if (Number.isNaN(n)) throw new Error(`invalid order id: ${raw}`);` (then-branch)');
    expect(prompt).toContain('Propose inputs that reach them and make old and new differ.');
    expect(prompt).toContain('returned "00"');
    expect(prompt).not.toContain('None of these is a silent divergence');
    expect(buildPrompt({ ...input, round: 1, uncovered: [{ side: 'old', line: 1, kind: 'case', text: 'x' }] })).not.toContain('never executed');
  });

  it('non-200 and network errors name the URL and model and suggest --replay', async () => {
    const http = reply('', 500);
    vi.stubGlobal('fetch', http);
    await expect(h.propose(input)).rejects.toThrow(/http:\/\/x:1.*model m.*--replay/s);
    expect(http).toHaveBeenCalledOnce();
    const network = vi.fn(async () => { throw new TypeError('fetch failed'); });
    vi.stubGlobal('fetch', network);
    await expect(h.propose(input)).rejects.toThrow(/http:\/\/x:1.*--replay/s);
    expect(network).toHaveBeenCalledOnce();
  });

  it('records the fixture shape, preserving other entries', async () => {
    const file = tmp();
    writeFileSync(file, JSON.stringify({ other: { source: 'handwritten', rounds: { '1': [] } } }));
    const rec = ollamaHypothesizer({ url: 'u', model: 'm', recordTo: file });
    vi.stubGlobal('fetch', reply(JSON.stringify({ hypotheses: [{ reason: 'r', args: [1] }] })));
    await rec.propose(input);
    await rec.propose({ ...input, round: 2 });
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    expect(saved.other.source).toBe('handwritten');
    expect(saved[fixtureKey(old, next)]).toEqual({
      source: 'model',
      rounds: { '1': [{ reason: 'r', args: [1] }], '2': [{ reason: 'r', args: [1] }] },
    });
    expect(await replayHypothesizer(file).propose(input)).toEqual([{ reason: 'r', args: [1], round: 1 }]);
  });
});

describe('hypothesizerFromEnv', () => {
  it('picks replay or ollama from env', () => {
    expect(hypothesizerFromEnv({}, { replay: true }).label).toMatch(/^replay/);
    expect(hypothesizerFromEnv({ DIFFWITNESS_REPLAY: '1' }).label).toMatch(/^replay/);
    expect(hypothesizerFromEnv({}).label).toBe('gemma4:e4b @ http://localhost:11434');
    expect(hypothesizerFromEnv({ OLLAMA_URL: 'http://h:1', DIFFWITNESS_MODEL: 'g' }).label).toBe('g @ http://h:1');
  });
});
