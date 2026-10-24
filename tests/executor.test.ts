import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { afterEach, describe, expect, it } from 'vitest';
import { createRunner } from '../src/core/executor';
import type { LoadedFn, Runner } from '../src/core/types';

const fn = (name: string, source: string): LoadedFn => ({
  name,
  source,
  code: ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
});
const f = (body: string) => fn('f', `export function f(...a: any[]): any { ${body} }`);

let runner: Runner | undefined;
const start = async (oldFn: LoadedFn, newFn: LoadedFn = oldFn) => (runner = await createRunner(oldFn, newFn, { timeoutMs: 100 }));
afterEach(async () => {
  await runner?.close();
  runner = undefined;
});

describe('createRunner', () => {
  it('returns values, including objects built inside the vm', async () => {
    const r = await start(f('return { sum: a[0] + a[1], list: [a[0]], when: new Date(0), m: new Map([[1, 2]]) };'));
    const { old } = await r.run([2, 3]);
    expect(old).toEqual({ kind: 'return', value: { sum: 5, list: [2], when: new Date(0), m: new Map([[1, 2]]) } });
  });

  it('passes a fresh copy of the args to each side, keeping -0', async () => {
    const r = await start(f('a[0].push(1); return [a[0].length, Object.is(a[1], -0), Array.isArray(a[0]) && a[0] instanceof Array];'));
    const p = await r.run([[], -0]);
    expect(p.old).toEqual({ kind: 'return', value: [1, true, true] });
    expect(p.new).toEqual(p.old);
  });

  it('reports throws by name and message', async () => {
    const r = await start(f('throw new TypeError("nope");'), f('throw "plain";'));
    expect(await r.run([])).toEqual({
      old: { kind: 'throw', name: 'TypeError', message: 'nope' },
      new: { kind: 'throw', name: 'string', message: 'plain' },
    });
  });

  it('times out an infinite loop and keeps working', async () => {
    const r = await start(f('while (a[0]) {} return 1;'));
    expect((await r.run([true])).old).toEqual({ kind: 'timeout' });
    expect((await r.run([false])).old).toEqual({ kind: 'return', value: 1 });
  });

  it('times out a hang vm cannot see and respawns the worker', async () => {
    const r = await start(f('return a[0] ? { get x() { while (true) {} } } : 2;'));
    expect((await r.run([true])).old).toEqual({ kind: 'timeout' });
    expect((await r.run([false])).old).toEqual({ kind: 'return', value: 2 });
  });

  it('does not expose process, require or dynamic import', async () => {
    const r = await start(
      f(`return [typeof process, typeof require, typeof globalThis.process,
        exports.constructor.constructor("return typeof process")()];`),
      f('import("node:fs"); return 1;'),
    );
    const p = await r.run([]);
    expect(p.old).toEqual({ kind: 'return', value: ['undefined', 'undefined', 'undefined', 'undefined'] });
    expect(p.new).toEqual({ kind: 'return', value: 1 });
  });

  it('does not leak module-level state between calls', async () => {
    const r = await start(fn('f', 'let n = 0; export function f() { globalThis.g = (globalThis.g ?? 0) + 1; return ++n + globalThis.g; }'));
    expect((await r.run([])).old).toEqual({ kind: 'return', value: 2 });
    expect((await r.run([])).old).toEqual({ kind: 'return', value: 2 });
  });

  it('turns an uncloneable return into a DiffWitnessUncloneable throw', async () => {
    const r = await start(f('return () => 1;'));
    expect((await r.run([])).old).toMatchObject({ kind: 'throw', name: 'DiffWitnessUncloneable' });
  });

  it('runs old and new independently: order-id example', async () => {
    const r = await start(
      fn('normalizeOrderId', readFileSync('examples/order-id/old.ts', 'utf8')),
      fn('normalizeOrderId', readFileSync('examples/order-id/new.ts', 'utf8')),
    );
    expect(await r.run(['00128'])).toEqual({ old: { kind: 'return', value: '00128' }, new: { kind: 'return', value: '128' } });
  });

  it('handles many sequential runs quickly', async () => {
    const r = await start(f('return a[0] * 2;'));
    for (let i = 0; i < 500; i++) expect((await r.run([i])).new).toEqual({ kind: 'return', value: i * 2 });
  });
});
