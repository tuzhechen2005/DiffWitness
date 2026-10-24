import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { createRunner } from '../src/core/executor';

const load = (source: string) => ({ name: 'f', source, code: ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText });

describe('async functions', () => {
  it('are reported as DiffWitnessAsync instead of passing as equal', async () => {
    const r = await createRunner(load('export async function f() { return 1 }'), load('export async function f() { return 2 }'));
    try {
      expect((await r.run([])).new).toMatchObject({ kind: 'throw', name: 'DiffWitnessAsync' });
    } finally {
      await r.close();
    }
  });
});
