# DiffWitness

**Your refactor passed every test. It also turned order `00128` into `128`.**

DiffWitness checks whether two versions of a pure TypeScript function still behave the same. A local open-weight model (Gemma 4 e4b, via Ollama) reads both versions and proposes inputs where they might differ. DiffWitness then runs both versions on every proposed input. Execution decides whether a difference is real; the model's opinion does not. Each real difference is shrunk to a minimal repro, you label it *bug* or *intended*, and DiffWitness writes a vitest regression file.

```text
  #1  normalizeOrderId("00")
      old → "00"
      new → "0"
      model args: ("00128")

Random fuzzing: 477 of 2000 runs diverged, 32 silent (both returned); sample shrank to 18 distinct repros
Model:          7 of 8 hypotheses diverged, 2 silent, 5 distinct repros
  random repros: ("N") ("9/") ("-") ("6=") ("T") ("e") ("X") ("W") ("1T") ("5:") …
  model repros:  ("O") ("A") ("1A") ("00") ("1.")
```

- **The model proposes; execution decides.** Every reported difference comes from actually running both versions. A wrong guess from the model is dropped and never reported.
- **It targets silent bugs.** These are inputs where both versions return normally but with different values, which no exception or type check will catch. If round one finds none, round two sends the real outcomes back to the model and asks again.
- **It runs locally.** The model runs on your own machine or LAN, so your code is not uploaded anywhere.
- **It checks against a baseline.** On 10 refactors with a planted silent bug, a 4B-parameter model found the bug in 30 of 30 runs. Random fuzzing found it 0 times in 3 of those cases, even with 2000 tries and the exact input shape. See [Benchmark](#benchmark).

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
| `DIFFWITNESS_FIXTURES` | Replay fixture override; defaults to the package's `fixtures/gemma-recorded.json`, resolved relative to the package so default replay works from any directory. A relative override is resolved from the working directory. |
| `DIFFWITNESS_RECORD` | File to write validated live hypotheses to, keyed by the exact old/new source pair and round. Ignored in replay mode. |

Default replay uses recorded Gemma 4 e4b replies from `fixtures/gemma-recorded.json`. The handwritten `fixtures/replay.json` is used only by tests. Replay requires a readable fixture file; a source pair or round absent from it produces no hypotheses. For development checks, run `npm run typecheck && npm test`; tests use fixtures rather than a real model.

## Sample terminal output

The command above produced this output with colors disabled. These replay results use recorded Gemma 4 e4b replies, not a fresh live model run. The absolute fixture path reflects this checkout. Hypothesis explanations are model output and may be inaccurate; execution determines which differences are confirmed. The report's divergence counts include exceptions as well as differing return values.

```text
> diffwitness@0.1.0 diffwitness
> tsx src/cli.ts examples/order-id/old.ts examples/order-id/new.ts --replay --label bug --out /tmp/x.test.ts

DiffWitness  normalizeOrderId
  hypothesizer:  REPLAY  replay (/path/to/DiffWitness/fixtures/gemma-recorded.json)
  rounds used:  1

Hypotheses
  ✔ confirmed  ("ORD-123")  OLD accepts alphanumeric IDs, while NEW requires the input to be parsable as a pure integer.
  ✔ confirmed  ("A123")  OLD accepts IDs containing letters, while NEW fails because the string does not start with a digit.
  ✔ confirmed  ("ABC-XYZ")  OLD accepts IDs containing letters and hyphens, which NEW rejects as non-numeric.
  ✔ confirmed  ("123A45")  SILENT DIVERGENCE: OLD accepts the full string, but NEW truncates the string at the first non-digit character.
  ✔ confirmed  ("00123")  SILENT DIVERGENCE: OLD preserves leading zeros, but NEW (via parseInt) strips them.
  · same       ("-123")  OLD accepts IDs containing hyphens, but NEW fails because the hyphen is not a valid starting character for parseInt.
  ✔ confirmed  ("ORDER")  OLD accepts purely alphabetic IDs, but NEW fails because it cannot parse letters as a number.
  ✔ confirmed  ("123.45")  OLD accepts IDs containing punctuation (if it's a hyphen), but NEW fails if the punctuation is not a digit or sign.

Confirmed divergences: 5

  #1  normalizeOrderId("O")
      old → "O"
      new → throws Error: invalid order id: O
      model args: ("ORD-123") | ("ORDER")
      shrunk in 7 steps; why: OLD accepts alphanumeric IDs, while NEW requires the input to be parsable as a pure integer. / OLD accepts purely alphabetic IDs, but NEW fails because it cannot parse letters as a number.

  #2  normalizeOrderId("A")
      old → "A"
      new → throws Error: invalid order id: A
      model args: ("A123") | ("ABC-XYZ")
      shrunk in 5 steps; why: OLD accepts IDs containing letters, while NEW fails because the string does not start with a digit. / OLD accepts IDs containing letters and hyphens, which NEW rejects as non-numeric.

  #3  normalizeOrderId("1A")
      old → "1A"
      new → "1"
      model args: ("123A45")
      shrunk in 15 steps; why: SILENT DIVERGENCE: OLD accepts the full string, but NEW truncates the string at the first non-digit character.

  #4  normalizeOrderId("00")
      old → "00"
      new → "0"
      model args: ("00123")
      shrunk in 6 steps; why: SILENT DIVERGENCE: OLD preserves leading zeros, but NEW (via parseInt) strips them.

  #5  normalizeOrderId("1.")
      old → throws Error: invalid order id: 1.
      new → "1"
      model args: ("123.45")
      shrunk in 15 steps; why: OLD accepts IDs containing punctuation (if it's a hyphen), but NEW fails if the punctuation is not a digit or sign.

Random fuzzing: 477 of 2000 runs diverged, 32 silent (both returned); sample shrank to 18 distinct repros
Model:          7 of 8 hypotheses diverged, 2 silent, 5 distinct repros
  random repros: ("N") ("9/") ("-") ("6=") ("T") ("e") ("X") ("W") ("1T") ("5:") …
  model repros:  ("O") ("A") ("1A") ("00") ("1.")

Wrote 5 regression test(s) to /tmp/x.test.ts
```

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

The recorded Gemma replay run generated the exact contents below in `/tmp/x.test.ts`, including the import path relative to that file in this checkout. The bug-labeled tests fail against the current new implementation until its behavior is corrected.

```ts
// Generated by DiffWitness. Labels: bug = new must match old; intended = new behavior pinned.
import { describe, it, expect } from 'vitest';
import { normalizeOrderId } from '../workspace/DiffWitness-issue-20/examples/order-id/new';

describe('normalizeOrderId (DiffWitness)', () => {
  it("bug: normalizeOrderId(\"O\")", () => {
    expect(normalizeOrderId("O")).toEqual("O");
  });

  it("bug: normalizeOrderId(\"A\")", () => {
    expect(normalizeOrderId("A")).toEqual("A");
  });

  it("bug: normalizeOrderId(\"1A\")", () => {
    expect(normalizeOrderId("1A")).toEqual("1A");
  });

  it("bug: normalizeOrderId(\"00\")", () => {
    expect(normalizeOrderId("00")).toEqual("00");
  });

  it("bug: normalizeOrderId(\"1.\")", () => {
    expect(() => normalizeOrderId("1.")).toThrow(); // "Error"
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
| `fixtures/gemma-recorded.json` | Recorded Gemma 4 e4b replies; package-relative default replay fixture. |
| `fixtures/replay.json` | Handwritten hypotheses used only by tests. |
| `bin/diffwitness.mjs` | Executable entry point that registers tsx and runs the CLI. |
| `bench/` | Ten planted-bug refactor pairs and benchmark results. |
| `scripts/bench.ts` | Live hypothesis and seeded random-baseline benchmark runner. |
| `tests/` | Automated tests. |
| `scripts/cloud-setup.sh` | Noninteractive dependency installation. |

## Benchmark

`bench/cases/` contains 10 realistic refactors with one planted silent bug each: both versions return normally but return different values. Each case includes `old.ts`, `new.ts`, and an `expect.json` input proven by tests to trigger the bug.

With Ollama running and `gemma4:e4b` available, run from the repository root with `DIFFWITNESS_REPLAY` unset:

```sh
npx tsx scripts/bench.ts --runs-per-case 3 --random 2000
```

The script prints a Markdown table and writes `bench/results.md`. It reports the fraction of model runs finding a silent divergence, silent hits among 2000 random inputs per case, and average witness runtime. The random baseline uses seed 1 and infers input shapes from the planted failing input; this gives random sampling useful information and favors random. Replay runs validate the script but do not measure live model performance.

Live results, `gemma4:e4b` on an RTX 4060 laptop over LAN, 3 runs per case, 2000 random inputs per case (from [`bench/results.md`](bench/results.md)):

| case | planted bug | model silent hit rate | random silent hits / 2000 | model avg s |
| --- | --- | --- | --- | --- |
| access-rule | dropped parentheses in `a \|\| b && !c` | 3/3 | 479 | 19.4 |
| dedupe-order | added `.sort()` to unique tags | 3/3 | 1119 | 15.7 |
| discount-cents | rounds the total instead of the discount | 3/3 | 1009 | 40.3 |
| free-shipping | `>=` became `>` at the threshold | 3/3 | **0** | 10.6 |
| iso-date | UTC conversion shifts the calendar date | 3/3 | 71 | 22.5 |
| option-default | `??` became `\|\|`, so `retries: 0` becomes 3 | 3/3 | **0** | 14.8 |
| page-offset | `(page - 1) * size` became `page * size` | 3/3 | 1 | 19.7 |
| phone-prefix | `String(Number(digits))` drops a leading zero | 3/3 | 1224 | 15.9 |
| query-value | `split("=")[1]` truncates values containing `=` | 3/3 | 2 | 16.4 |
| unicode-slug | dropped diacritic folding, `café` → `caf-` | 3/3 | **0** | 18.4 |

Caveats:
- A hit means the model found *a* silent divergence. Each case changes only one behavior, so in practice this is the planted bug, but the script does not check that it is exactly the planted input.
- The random baseline gets the shape of the planted input, which helps it.
- Timing covers the whole pipeline: model call, execution and shrinking.
- In one of the 30 runs the model returned malformed JSON. DiffWitness dropped that reply and found the bug in the next round, which is why model output is validated before use.
- 3 runs per case is a small sample. On the order-id example, the model found the leading-zero case in 3 of 5 live runs; it found other silent divergences in all 5.

## Tech and models used

TypeScript supplies the implementation and transpiler. Node.js `worker_threads` and `vm` run comparisons. Gemma 4 e4b (`gemma4:e4b`) is the default live model, served through Ollama's chat API with a JSON response schema. Vitest runs the tests and is the format of exported regressions; `tsx` runs the CLI, and `picocolors` formats terminal output.

## Built at MadCloud x MLH Hacktoberfest Hack Day 2026

Built for MadCloud x MLH Hacktoberfest Hack Day 2026.

## License

[Apache-2.0](LICENSE).
