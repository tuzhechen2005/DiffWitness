import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarize } from '../../scripts/dogfood';

test('counts only the selected function and separates silent from throwing divergences', () => {
  const stdout = JSON.stringify([
    { path: 'other.ts', report: { fnName: 'f', divergences: [] } },
    { path: 'src/f.ts', report: { fnName: 'f', divergences: [
      { pair: { old: { kind: 'return', value: 1 }, new: { kind: 'return', value: 2 } } },
      { pair: { old: { kind: 'throw', name: 'Error' }, new: { kind: 'return', value: 2 } } },
    ] } },
  ]);
  assert.deepEqual(summarize(stdout, '', 'src/f.ts', 'f'), {
    status: 'checked', divergences: 2, silent: 1, neverRan: null,
  });
});

test('a missing report preserves the skip reason instead of claiming zero divergences', () => {
  assert.throws(() => summarize('[]', 'skipped: unsupported Node builtin', 'f.ts', 'f'), /unsupported Node builtin/);
  assert.throws(() => summarize('[]', '', 'f.ts', 'f'), /no matching changed exported function/);
  assert.throws(() => summarize('not JSON', '', 'f.ts', 'f'), SyntaxError);
});

test('neverRan diagnostics survive; empty replay is checked but does not claim execution', () => {
  const neverRan = { name: 'ReferenceError', message: 'process is not defined' };
  const json = (extra: object) => JSON.stringify([{ path: 'f.ts', report: { fnName: 'f', divergences: [], ...extra } }]);
  assert.deepEqual(summarize(json({ neverRan }), '', 'f.ts', 'f').neverRan, neverRan);
  assert.deepEqual(summarize(json({}), '', 'f.ts', 'f'), {
    status: 'checked', divergences: 0, silent: 0, neverRan: null,
  });
});
