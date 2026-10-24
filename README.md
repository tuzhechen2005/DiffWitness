# DiffWitness

<!-- PITCH: integrator writes this -->

## Quick start

Use Node.js 20 or newer. From the repository root:

```sh
npm ci
```

For live hypotheses, install [Ollama](https://ollama.com/), start its server, and pull the default model:

```sh
ollama serve
# In another terminal:
ollama pull gemma4:e4b
npm run diffwitness -- old.ts new.ts
```

Each input file must be self-contained, have no imports, and export exactly one named synchronous function (`export function` or an exported arrow/function expression). Supply positional arguments through model hypotheses or replay fixtures. To try a supplied example without Ollama:

```sh
npm run diffwitness -- examples/order-id/old.ts examples/order-id/new.ts --replay --label bug --out /tmp/x.test.ts
```

| Flag | Behavior |
| --- | --- |
| `--label bug` or `--label intended` | Apply one label to all confirmed divergences and export tests. Without this flag, a terminal prompts for bug, intended, or skip; noninteractive runs do not label or export. |
| `--json` | Print the report as JSON and return before labeling or export. Special numbers and undefined are represented as strings. |
| `--replay` | Read saved hypotheses instead of calling Ollama. |
| `--out file` | Output test path; default `diffwitness.test.ts`. Its parent directory must exist. |
| `--runs n` | Positive integer random-baseline run count; default 2000. |

| Environment variable | Behavior / default |
| --- | --- |
| `OLLAMA_URL` | Ollama server URL; `http://localhost:11434`. |
| `DIFFWITNESS_MODEL` | Model name; `gemma4:e4b`. |
| `DIFFWITNESS_REPLAY` | Set to `1` to select replay, equivalent to `--replay`. |
| `DIFFWITNESS_FIXTURES` | Replay fixture path; `fixtures/replay.json`, relative to the working directory. |
| `DIFFWITNESS_RECORD` | File to write validated live hypotheses to, keyed by the exact old/new source pair and round. Ignored in replay mode. |

Replay requires a readable fixture file. A source pair or round absent from that file produces no hypotheses. For development checks, run `npm run typecheck && npm test`; tests use fixtures rather than a real model.

## Sample terminal output

The command above produced this output with colors disabled. These are replay results from supplied hypotheses, not a measurement of live model performance. The report's divergence counts include exceptions as well as differing return values.

```text
> diffwitness@0.1.0 diffwitness
> tsx src/cli.ts examples/order-id/old.ts examples/order-id/new.ts --replay --label bug --out /tmp/x.test.ts

DiffWitness  normalizeOrderId
  hypothesizer:  REPLAY  replay (fixtures/replay.json)
  rounds used:  1

Hypotheses
  ✔ confirmed  ("00128")  Leading zeros are significant in the old version but parseInt drops them
  ✔ confirmed  ("A-12")  Alphanumeric ids pass the old regex but parseInt stops at the first letter
  ✔ confirmed  ("12abc")  Trailing letters are kept by old, discarded by parseInt
  · same       ("  42 ")  Surrounding whitespace is trimmed by both
  · same       ("-5")  Negative-looking ids

Confirmed divergences: 3

  #1  normalizeOrderId("00")
      old → "00"
      new → "0"
      model args: ("00128")
      shrunk in 7 steps; why: Leading zeros are significant in the old version but parseInt drops them

  #2  normalizeOrderId("A")
      old → "A"
      new → throws Error: invalid order id: A
      model args: ("A-12")
      shrunk in 5 steps; why: Alphanumeric ids pass the old regex but parseInt stops at the first letter

  #3  normalizeOrderId("1a")
      old → "1A"
      new → "1"
      model args: ("12abc")
      shrunk in 8 steps; why: Trailing letters are kept by old, discarded by parseInt

Random fuzzing: 477 of 2000 runs diverged
Model:          3 of 5 hypotheses diverged

Wrote 3 regression test(s) to /tmp/x.test.ts
```

<!-- RESULTS: integrator fills benchmark numbers -->

## How it works

```text
old.ts + new.ts -> loader -> model hypotheses -> isolated execution
                                ^                     |
                                |               outcome comparison
                                |                     |
                     round 2: actual outcomes         v
                     if no silent divergence      shrinking
                                                      |
                                                   labeling
                                                      |
                                                 vitest export
```

The loader parses and transpiles TypeScript without executing it. The hypothesizer receives both sources and proposes up to eight JSON argument arrays per round. Each version runs with fresh arguments in a fresh VM context inside a worker, with a default one-second execution timeout. The comparator checks return values structurally (`NaN` equals itself, `0` differs from `-0`), compares thrown error names while ignoring messages, and treats two timeouts as equal.

A silent divergence means both versions return normally and their values differ. If round one finds none, round two receives the actual outcomes of every previous trial and asks for new inputs targeting silent divergences—even if round one already found a return/throw difference. All confirmed differences are retained. Greedy shrinking tries smaller arguments while preserving divergence and the old/new outcome kinds, with at most 200 predicate calls per original divergent hypothesis. Equal shrunk argument lists are merged.

You label each result: `bug` means the new function should match the old outcome; `intended` pins the new outcome. Exported tests import the new function. Return outcomes use `toEqual`, throws use `toThrow` with the error name in a comment, and timeouts produce skipped tests.

## Generated test file example

The sample run generated the following tests. Only the import path below is adjusted for a file saved at the repository root; the actual CLI computes it relative to `--out`. These bug-labeled tests fail against the current new implementation until its behavior is corrected.

```ts
// Generated by DiffWitness. Labels: bug = new must match old; intended = new behavior pinned.
import { describe, it, expect } from 'vitest';
import { normalizeOrderId } from './examples/order-id/new';

describe('normalizeOrderId (DiffWitness)', () => {
  it('bug: normalizeOrderId(\"00\")', () => {
    expect(normalizeOrderId("00")).toEqual("00");
  });

  it('bug: normalizeOrderId(\"A\")', () => {
    expect(normalizeOrderId("A")).toEqual("A");
  });

  it('bug: normalizeOrderId(\"1a\")', () => {
    expect(normalizeOrderId("1a")).toEqual("1A");
  });
});

```

## Design decisions

- Execution judges a proposed input. A model's explanation is a lead; a confirmed divergence requires observed outcomes from both versions.
- JSON-only inputs keep hypotheses serializable, replayable, and easy to shrink. They also allow each execution to receive its own copy without sharing host objects.
- A seeded naive random baseline gives a simple comparison with uninformed sampling. It infers shapes from the first hypothesis: printable ASCII strings, small integers and floats, short arrays, and objects with the same keys. It is absent when there are no hypotheses and is not a domain-aware fuzzer.

## Limitations

- Use pure, synchronous, self-contained functions. Promises are rejected; the tool does not model external services, I/O, or shared application state.
- Arguments are JSON-only. Return values must cross the worker boundary via structured cloning. The comparator has no cycle detection; RegExp and Error return values are compared by enumerable properties.
- VM isolation is not a security sandbox. Use this locally with code you trust, not as a service for running hostile submissions.
- Live model hit rates vary between runs. Replay reproduces saved hypotheses and does not measure a live model.
- “No divergence found” is evidence, not proof of equivalence. Candidate generation, two hypothesis rounds, bounded shrinking, and the baseline explore only part of the input space; shrinking does not guarantee a globally smallest counterexample.
- Exported throw tests check that an error is thrown; the error name is only a comment. Unsupported return literals become `/* unsupported */ undefined`, and timeout tests are skipped. Review exported tests before committing them.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/cli.ts`, `src/render.ts` | Arguments, terminal/JSON reports, labeling, export path handling. |
| `src/core/types.ts` | Shared argument, outcome, hypothesis, and report contracts. |
| `src/core/loader.ts` | TypeScript parsing, import checks, and transpilation. |
| `src/core/hypothesize.ts` | Ollama prompts, two-round feedback, recording, and replay. |
| `src/core/executor.ts`, `src/core/compare.ts` | Worker/VM execution and outcome comparison. |
| `src/core/shrink.ts`, `src/core/baseline.ts` | Greedy shrinking and seeded random sampling. |
| `src/core/witness.ts` | Pipeline orchestration. |
| `src/core/exportTests.ts` | Vitest source generation. |
| `examples/` | Order IDs, rounding, and equivalent email-normalization pairs. |
| `fixtures/replay.json` | Saved example hypotheses keyed by exact sources. |
| `tests/` | Automated tests. |
| `scripts/cloud-setup.sh` | Noninteractive dependency installation. |

## Tech and models used

TypeScript supplies the implementation and transpiler. Node.js `worker_threads` and `vm` run comparisons. Gemma 4 e4b (`gemma4:e4b`) is the default live model, served through Ollama's chat API with a JSON response schema. Vitest runs the tests and is the format of exported regressions; `tsx` runs the CLI, and `picocolors` formats terminal output.

## Built at MadCloud x MLH Hacktoberfest Hack Day 2026

Built for MadCloud x MLH Hacktoberfest Hack Day 2026.

## License

[Apache-2.0](LICENSE).
