import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createRunner } from '../src/core/executor';
import { loadFunction, loadFunctionFromSource } from '../src/core/loader';

describe('loadFunction on examples', () => {
  const cases = [
    ['order-id', 'normalizeOrderId'],
    ['rounding', 'roundCents'],
    ['equivalent', 'normalizeEmail'],
  ] as const;

  for (const [dir, name] of cases) {
    it(`loads ${dir}/old.ts and ${dir}/new.ts as ${name}`, async () => {
      for (const side of ['old', 'new']) {
        const file = `examples/${dir}/${side}.ts`;
        const fn = await loadFunction(file);
        expect(fn.name).toBe(name);
        expect(fn.source).toBe(await readFile(file, 'utf8'));
        expect(fn.code).toContain(`exports.${name}`);
      }
    });
  }
});

describe('loadFunctionFromSource', () => {
  it('accepts an exported arrow const', () => {
    const fn = loadFunctionFromSource('export const add = (a: number, b: number): number => a + b;', 'add.ts');
    expect(fn.name).toBe('add');
    expect(fn.code).toContain('exports.add');
    expect(fn.code).not.toContain(': number');
  });

  it('accepts an exported function expression const', () => {
    expect(loadFunctionFromSource('export const f = function (x: string) { return x; };').name).toBe('f');
  });

  it('throws when nothing is exported', () => {
    expect(() => loadFunctionFromSource('const x = 1;', 'none.ts')).toThrow(/none\.ts: no exported function/);
  });

  it('throws when two functions are exported', () => {
    expect(() => loadFunctionFromSource('export function a() {}\nexport function b() {}', 'two.ts')).toThrow(
      /two\.ts: more than one exported function \(a, b\)/,
    );
  });

  it.each([
    ['import', "import fs from 'node:fs';\nexport function f() { return fs; }"],
    ['require', "const fs = require('node:fs');\nexport function f() { return fs; }"],
    ['export from', "export { x } from './other';\nexport function f() {}"],
  ])('throws on %s', (_, source) => {
    expect(() => loadFunctionFromSource(source, 'dep.ts')).toThrow(/dep\.ts: imports are not allowed/);
  });

  it('throws a syntax error with a location', () => {
    expect(() => loadFunctionFromSource('export function f( {', 'bad.ts')).toThrow(/bad\.ts:1:\d+: syntax error/);
  });
});


describe('named function selection', () => {
  const source = `
    const offset = 3;
    function helper(x: number) { return x + offset; }
    export const description = 'example';
    export function first(x: number) { return x; }
    export const selected = (x: number) => helper(x) * 2;
  `;

  it('selects an export and retains working helpers and constants', async () => {
    const fn = loadFunctionFromSource(source, 'multi.ts', 'selected');
    expect(fn.name).toBe('selected');
    expect(fn.source).toBe(source);
    const runner = await createRunner(fn, fn);
    try {
      expect(await runner.run([4])).toEqual({
        old: { kind: 'return', value: 14 }, new: { kind: 'return', value: 14 },
      });
    } finally {
      await runner.close();
    }
    expect(loadFunctionFromSource(source, 'multi.ts', 'first').name).toBe('first');
    expect(() => loadFunctionFromSource(source, 'multi.ts')).toThrow(/more than one exported function/);
  });

  it.each(['missing', 'helper', 'description'])('rejects %s as a function selection', (name) => {
    expect(() => loadFunctionFromSource(source, 'multi.ts', name)).toThrow(`multi.ts: no exported function named "${name}"`);
  });

  it('still rejects imports when selecting a function', () => {
    expect(() => loadFunctionFromSource("import x from './x'; export function selected() { return x; }", 'dep.ts', 'selected')).toThrow(/imports are not allowed/);
  });

  it('passes the requested name through file loading', async () => {
    expect((await loadFunction('examples/order-id/old.ts', 'normalizeOrderId')).name).toBe('normalizeOrderId');
    await expect(loadFunction('examples/order-id/old.ts', 'missing')).rejects.toThrow(/no exported function named "missing"/);
  });
});
