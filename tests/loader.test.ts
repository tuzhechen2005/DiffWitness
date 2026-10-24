import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
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
