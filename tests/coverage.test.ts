import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { inferShape, mulberry32, randomArgs } from '../src/core/baseline';
import { instrument } from '../src/core/coverage';
import { createRunner } from '../src/core/executor';
import { fixtureKey } from '../src/core/hypothesize';
import { loadFunction, loadFunctionFromSource } from '../src/core/loader';
import type { Args, Runner } from '../src/core/types';

let runner: Runner | undefined;
afterEach(async () => {
  await runner?.close();
  runner = undefined;
});

const fixtures = ['fixtures/replay.json', 'fixtures/gemma-recorded.json'].map(
  (f) => JSON.parse(readFileSync(f, 'utf8')) as Record<string, { rounds?: Record<string, { args: Args }[]> }>,
);

describe('instrumented code behaves like the original', () => {
  const dirs = [...readdirSync('examples').map((d) => join('examples', d)), ...readdirSync('bench/cases').map((d) => join('bench/cases', d))];
  for (const dir of dirs) {
    it(dir, async () => {
      const [oldFn, newFn] = await Promise.all([loadFunction(join(dir, 'old.ts')), loadFunction(join(dir, 'new.ts'))]);
      const inputs: Args[] = fixtures.flatMap((f) => Object.values(f[fixtureKey(oldFn, newFn)]?.rounds ?? {}).flat().map((h) => h.args));
      const expectFile = join(dir, 'expect.json');
      if (existsSync(expectFile)) inputs.push((JSON.parse(readFileSync(expectFile, 'utf8')) as { silent: Args }).silent);
      expect(inputs.length).toBeGreaterThan(0);
      const rng = mulberry32(7);
      const shapes = inferShape(inputs[0]);
      for (let i = 0; i < 30; i++) inputs.push(randomArgs(shapes, rng));

      for (const fn of [oldFn, newFn]) {
        // Runner sides: old = original, new = instrumented copy of the same function.
        runner = await createRunner(fn, instrument(fn).fn);
        for (const args of inputs) {
          const p = await runner.run(args);
          expect(p.new, `${fn.name}${JSON.stringify(args)}`).toEqual(p.old);
          expect(p.coverage?.old ?? []).toEqual([]);
        }
        await runner.close();
        runner = undefined;
      }
    });
  }
});

describe('branch ids', () => {
  const src = `export function f(a: number, b: string | null): string {
  let s = '';
  if (a > 10) s += 'big';
  else if (a < 0) { s += 'neg'; }
  s += a % 2 ? 'odd' : 'even';
  const name = b ?? 'anon';
  const ok = a > 0 && b !== null;
  const any = a === 0 || b === 'x';
  switch (a) {
    case 1: s += 'one'; break;
    case 2: s += 'two'; break;
    default: s += 'other';
  }
  try {
    if (b === 'boom') throw new Error('x');
  } catch {
    s += 'caught';
  }
  return [s, name, ok, any].join('|');
}`;
  const { fn: inst, branches } = instrument(loadFunctionFromSource(src));
  const hits = async (args: Args) => (await runner!.run(args)).coverage!.new.map((id) => `${branches[id].kind}@${branches[id].line}`).sort();

  it('records line, kind and text for every arm', () => {
    expect(branches.map((b) => `${b.kind}@${b.line}`).sort()).toEqual([
      'case@10', 'case@11', 'catch@16', 'cond-false@5', 'cond-true@5', 'default@12',
      'if-else@15', 'if-else@4', 'if-else@4', 'if-then@15', 'if-then@3', 'if-then@4',
      'logical-right@6', 'logical-right@7', 'logical-right@8',
    ].sort());
    expect(branches.find((b) => b.kind === 'catch')!.text).toBe('} catch {');
  });

  it('reports exactly the arms each input takes', async () => {
    runner = await createRunner(inst, inst);
    expect(await hits([11, null])).toEqual(['cond-true@5', 'default@12', 'if-else@15', 'if-then@3', 'logical-right@6', 'logical-right@7', 'logical-right@8'].sort());
    expect(await hits([-2, 'x'])).toEqual(['cond-false@5', 'default@12', 'if-else@15', 'if-else@4', 'if-then@4', 'logical-right@8'].sort());
    expect(await hits([2, 'boom'])).toEqual(['case@11', 'catch@16', 'cond-false@5', 'if-else@4', 'if-else@4', 'if-then@15', 'logical-right@7', 'logical-right@8'].sort());
    expect(await hits([1, 'y'])).toEqual(['case@10', 'cond-true@5', 'if-else@15', 'if-else@4', 'if-else@4', 'logical-right@7', 'logical-right@8'].sort());
  });

  it('keeps coverage of the arms reached before a throw', async () => {
    const t = instrument(loadFunctionFromSource('export function g(a: number) { if (a) throw new Error("no"); return 1; }'));
    runner = await createRunner(t.fn, t.fn);
    const p = await runner.run([1]);
    expect(p.old).toMatchObject({ kind: 'throw', message: 'no' });
    expect(p.coverage!.old.map((id) => t.branches[id].kind)).toEqual(['if-then']);
  });
});
