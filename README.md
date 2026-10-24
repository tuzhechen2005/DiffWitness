# DiffWitness

**Your refactor passed every test. It also turned order `00123` into `123`.**

![DiffWitness finding the leading-zero bug, exporting failing regression tests, then checking a rounding refactor](demo/demo.gif)

<sub>Recorded with `--replay`: real Gemma 4 e4b replies captured from a live run, so the GIF is reproducible. Regenerate with `vhs demo/demo.tape`.</sub>

DiffWitness checks whether two versions of a pure TypeScript function still behave the same. A local open-weight model (Gemma 4 e4b, via Ollama) reads both versions and proposes inputs where they might differ. DiffWitness then runs both versions on every proposed input. Execution decides whether a difference is real; the model's opinion does not. Each real difference is shrunk to a minimal repro, you label it *bug* or *intended*, and DiffWitness writes a vitest regression file.

```text
  #2  normalizeOrderId("00")
      old → "00"
      new → "0"
      model args: ("00123")
      shrunk in 6 steps; why: SILENT DIVERGENCE: OLD preserves leading zeros, but NEW (via parseInt) strips them.

Random fuzzing: 477 of 2000 runs diverged, 32 silent (both returned); sample shrank to 18 distinct repros
Model:          7 of 8 hypotheses diverged, 2 silent, 5 distinct repros
Coverage:       old 2/2, new 2/2 branches reached by model inputs
  random repros: ("N") ("9/") ("-") ("6=") ("T") ("e") ("X") ("W") ("1T") ("5:") …
  model repros:  ("A") ("O") ("00") ("1A") ("1.")
```

<sub>Excerpt from `npm run diffwitness -- examples/order-id/old.ts examples/order-id/new.ts --replay` (recorded gemma4:e4b replies).</sub>

- **The model proposes; execution decides.** Every reported difference comes from actually running both versions. A wrong guess from the model is dropped and never reported.
- **It targets silent bugs.** These are inputs where both versions return normally but with different values, which no exception or type check will catch. If round one finds none, or leaves branches unexecuted, round two sends the real outcomes and the unreached source lines back to the model.
- **It runs locally.** The model runs on your own machine or LAN, so your code is not uploaded anywhere.
- **It checks against a baseline.** On 10 refactors with a planted silent bug, a small local model (Gemma 4 e4b, "effective 4B") found the bug in 30 of 30 runs. Random fuzzing found it 0 times in 3 of those cases, even with 2000 typed inputs. On 12 harder cases random fuzzing found nothing in 24,000 inputs; the model found 34 of 36. See [Benchmark](#benchmark).

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

In two-file mode, each input file must be self-contained and have no imports. By default it must export exactly one named synchronous function (`export function` or an exported arrow/function expression). With `--fn name`, select that exported function in both files; other exports and local helper functions/constants are allowed and the whole file is retained. Supply positional arguments through model hypotheses or replay fixtures. To try a supplied example without Ollama:

```sh
npm run diffwitness -- examples/order-id/old.ts examples/order-id/new.ts --replay --label bug --out /tmp/x.test.ts
```

| Flag | Behavior |
| --- | --- |
| `--label bug` or `--label intended` | Apply one label to all confirmed divergences and export tests. Without this flag, a terminal prompts for bug, intended, or skip; noninteractive runs do not label or export. |
| `--json` | Print the report as JSON and return before labeling or export. Special numbers and undefined are represented as strings. |
| `--replay` | Read saved hypotheses instead of calling Ollama. |
| `--out file` | Two-file mode only (rejected with `--git`). Output test path; default `diffwitness.test.ts`. Its parent directory must exist. |
| `--fn name` | Select a named exported function in two-file mode, or filter changed functions by name in git mode. Local helpers/constants are allowed; two-file mode still rejects imports. |
| `--git <base>[..<head>]` | Compare modified exported functions against a commit; omitted head means the working tree. Takes no positional file arguments. |
| `--path file` | Git mode only: restrict selection to one file, resolved relative to the current directory. |
| `--runs n` | Positive integer random-baseline run count; default 2000. |

| Environment variable | Behavior / default |
| --- | --- |
| `OLLAMA_URL` | Ollama server URL; `http://localhost:11434`. |
| `DIFFWITNESS_MODEL` | Model name; `gemma4:e4b`. |
| `DIFFWITNESS_REPLAY` | Set to `1` to select replay, equivalent to `--replay`. |
| `DIFFWITNESS_FIXTURES` | Replay fixture override; defaults to the package's `fixtures/gemma-recorded.json`, resolved relative to the package so default replay works from any directory. A relative override is resolved from the working directory. |
| `DIFFWITNESS_RECORD` | File to write validated live hypotheses to, keyed by the exact old/new source pair and round. Ignored in replay mode. |

Default replay uses recorded Gemma 4 e4b replies from `fixtures/gemma-recorded.json`. The handwritten `fixtures/replay.json` is used only by tests. Replay requires a readable fixture file; a source pair or round absent from it produces no hypotheses. For development checks, run `npm run typecheck && npm test`; tests use fixtures rather than a real model.

## Use it on a real repo

Run `diffwitness --git <base>[..<head>]` inside the target Git repository. With only a base revision, the head is the current working tree (including tracked, uncommitted changes). With `base..head`, both sides are resolved to commits. For example, invoke a local DiffWitness checkout from your project:

```sh
node /path/to/DiffWitness/bin/diffwitness.mjs --git HEAD~1
node /path/to/DiffWitness/bin/diffwitness.mjs --git main..feature
node /path/to/DiffWitness/bin/diffwitness.mjs --git HEAD~1 --path src/order.ts --fn total --label bug
```

Both revisions are validated as commits; a revision starting with `-` is rejected. `--path` selects an exact file relative to the current directory, and `--fn` filters by exported function name.

Selection uses modified `.ts` files, excluding declaration, test and spec files and `node_modules`. It compares the own source text of top-level named exported function declarations and exported arrow/function expressions. A function must exist on both sides and have changed text. New or removed functions and default exports are skipped; selection does not follow changes through the call graph.

Each commit is read through a temporary detached worktree, cleaned up afterwards; the working-tree side is used as is. esbuild bundles local imports and pure npm packages, resolving dependencies from the target repository's installed `node_modules`. Install those dependencies first. Node builtins cause a skip with a diagnostic. Prompts use the selected function's own text; reported coverage and uncovered-branch feedback are restricted to its own source lines, rather than dependency branches.

Labeled results are written in the current directory as `diffwitness.<path>.<fn>.test.ts`. The `.ts` suffix is removed from the source path and directory separators become underscores: `src/order.ts:total` produces `diffwitness.src_order.total.test.ts`. `--out` is rejected in git mode. Exported tests import the current repository file, even when comparing two commits; run them with the intended new version checked out.

For a replay-only check of selection and bundling, this command was run on DiffWitness at `febfc6b`:

```sh
npm run diffwitness -- --git febfc6b~5..febfc6b --replay
```

Excerpt from its actual output:

```text
━━ src/core/baseline.ts:randomArgs
DiffWitness  randomArgs
```

```text
Model:          0 of 0 hypotheses diverged, 0 silent, 0 distinct repros
Coverage:       old 0/12, new 0/21 branches reached by model inputs
```

```text
1 changed function(s) checked, 0 with divergences
```

The run skipped functions pulling in Node builtins and had no replay hypotheses for `randomArgs`. No inputs were executed, so this demonstrates discovery and bundling, not behavioral equivalence. The functions selected by `HEAD~5` will change as history advances. See [the git-mode guide](demo/git-mode.md) for another revision-specific example; omit `--replay` with Ollama running to generate live hypotheses.

### Check every commit automatically

```sh
node /path/to/DiffWitness/bin/diffwitness.mjs hook install            # report only
node /path/to/DiffWitness/bin/diffwitness.mjs hook install --strict   # block commits with divergences
node /path/to/DiffWitness/bin/diffwitness.mjs hook uninstall
```

The pre-commit hook compares the staged version of each changed exported function against `HEAD`. It never writes files or labels anything. It fails open: if Ollama is unreachable, Node is missing, or bundling fails, it prints one line and lets the commit through. Model requests from the hook time out after 20 s. It refuses to overwrite a pre-commit hook it did not write (use `--force`), and `uninstall` removes only an unmodified DiffWitness hook. With `--amend`, `HEAD` is the commit being amended.

## Sample terminal output

The command above produced this output with colors disabled. These replay results use recorded Gemma 4 e4b replies, not a fresh live model run. The checkout path is normalized to `/path/to/DiffWitness`. Hypothesis explanations are model output and may be inaccurate; execution determines which differences are confirmed. The report's divergence counts include exceptions as well as differing return values.

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

Confirmed divergences: 5 in 3 branch paths

  #1  normalizeOrderId("A")
      old → "A"
      new → throws Error: invalid order id: A
      model args: ("A123") | ("ABC-XYZ")
      shrunk in 5 steps; why: OLD accepts IDs containing letters, while NEW fails because the string does not start with a digit. / OLD accepts IDs containing letters and hyphens, which NEW rejects as non-numeric.
      +1 more on the same branch path (may still be different bugs):
        ("O")  old → "O"  new → throws Error: invalid order id: O

  #2  normalizeOrderId("00")
      old → "00"
      new → "0"
      model args: ("00123")
      shrunk in 6 steps; why: SILENT DIVERGENCE: OLD preserves leading zeros, but NEW (via parseInt) strips them.
      +1 more on the same branch path (may still be different bugs):
        ("1A")  old → "1A"  new → "1"

  #3  normalizeOrderId("1.")
      old → throws Error: invalid order id: 1.
      new → "1"
      model args: ("123.45")
      shrunk in 15 steps; why: OLD accepts IDs containing punctuation (if it's a hyphen), but NEW fails if the punctuation is not a digit or sign.

Random fuzzing: 477 of 2000 runs diverged, 32 silent (both returned); sample shrank to 18 distinct repros
Model:          7 of 8 hypotheses diverged, 2 silent, 5 distinct repros
Coverage:       old 2/2, new 2/2 branches reached by model inputs
  random repros: ("N") ("9/") ("-") ("6=") ("T") ("e") ("X") ("W") ("1T") ("5:") …
  model repros:  ("A") ("O") ("00") ("1A") ("1.")

Wrote 5 regression test(s) to /tmp/x.test.ts
```

## How it works

```text
old.ts + new.ts -> loader + branch instrumentation -> model hypotheses
                                                          |
                                                   isolated execution
                                                          |
            round 2: real outcomes + uncovered lines <- comparison + coverage
                                                          |
                                                shrinking -> clustering
                                                          |
                                                labeling -> vitest export
```

The loader parses and transpiles TypeScript without executing it. `src/core/coverage.ts` adds branch marks to both arms of `if` (including an implicit `else`), both arms of `?:`, the right-hand side of `&&`, `||` and `??`, each switch `case`/`default`, and `catch` blocks. It does not add marks for optional chaining, logical assignments (`&&=`, `||=`, `??=`), default parameters or loops.

The hypothesizer receives both original sources and proposes up to eight JSON argument arrays per round. Invalid JSON or a missing hypotheses array causes one retry with the same prompt; a second parse failure logs a warning and yields no hypotheses. Network/HTTP errors throw without retry. Recording stores only successfully parsed responses.

The TypeScript checker extracts parameter types from the new function's source and includes them in the prompt. Before execution, hypotheses that violate a representable declared type are dropped; extra positional arguments are also rejected when a signature is available. `--json` exposes the count as `droppedForType` when nonzero (inside each report in git mode). One narrow repair runs first: when the function has a single array parameter and the model spread the array across the argument list (`["a", "b"]` instead of `[["a", "b"]]`), the arguments are re-wrapped only if that makes them type-correct; the count is `repairedForType`. Small models make this mistake often, and before type checking, those out-of-contract inputs produced divergences that were not real bugs. Primitives, literals, unions, arrays and supported object structures can be checked. Types including `undefined` are treated as optional: JSON represents their absence by omission, not an explicit undefined value.

This is partial type awareness, not full project type checking. Rest parameters disable signature extraction; unsupported types such as `any`, `unknown`, generics and external type declarations may have no checkable shape. Git-mode signature extraction sees the function's own source, not the complete imported type environment. The type filter applies to proposed hypotheses, not shrink candidates.

Each version runs with fresh arguments and branch marks in a fresh VM context inside a worker, with a default one-second execution timeout. The comparator checks return values structurally (`NaN` equals itself, `0` differs from `-0`), compares thrown error names while ignoring messages, and treats two timeouts as equal.

If at least one trial ran and every trial threw the same error name on both sides, the report warns that the function never ran normally instead of saying “No divergence found.” `--json` includes `neverRan` with the first error's name and message. This detects situations such as unavailable globals; it compares error names, not messages, and is not proof that the function body was never entered. Zero hypotheses do not trigger this warning.

A silent divergence means both versions return normally and their values differ. With coverage feedback enabled (the default), round two runs if round one found no silent divergence **or any instrumented branch remains uncovered**. Its prompt includes the real outcomes of previous trials and up to 20 uncovered branch entries, identifying old/new side, original source line, branch kind and source text. A silent divergence alone does not stop the search when branches remain uncovered. Replay uses stored replies rather than asking a model to react to this feedback.

Greedy shrinking preserves divergence and the old/new outcome kinds, with at most 200 predicate calls per original divergent hypothesis. Equal shrunk argument lists are merged. When either source has instrumented branches, distinct repros are clustered by outcome kinds plus each side's reached branch-ID set (called a branch path in the report). The simplest serialized arguments appear first in each cluster; all repros remain available for labeling and export. **One branch path can contain different bugs.** Shrinking does not preserve the original path, and clustering does not establish bug identity.

The `Coverage:` line reports old/new branch marks reached by model-proposed inputs out of all instrumented marks. It excludes additional hits from shrinking and random sampling, and is omitted when neither source has marks. The random baseline counts all divergent runs and silent runs separately, then shrinks its first 20 divergent runs to report distinct repros.

You label each result: `bug` means the new function should match the old outcome; `intended` pins the new outcome. Exported tests import the new function. Return outcomes use `toEqual`, throws use `toThrow` with the error name in a comment, and timeouts produce skipped tests.

## Generated test file example

The recorded Gemma replay run generated these tests in `/tmp/x.test.ts`. The checkout portion of the relative import is normalized to `/path/to/DiffWitness`; the actual CLI computes the import relative to the output file. These bug-labeled tests fail against the current new implementation until its behavior is corrected.

```ts
// Generated by DiffWitness. Labels: bug = new must match old; intended = new behavior pinned.
import { describe, it, expect } from 'vitest';
import { normalizeOrderId } from '../path/to/DiffWitness/examples/order-id/new';

describe('normalizeOrderId (DiffWitness)', () => {
  it("bug: normalizeOrderId(\"A\")", () => {
    expect(normalizeOrderId("A")).toEqual("A");
  });

  it("bug: normalizeOrderId(\"O\")", () => {
    expect(normalizeOrderId("O")).toEqual("O");
  });

  it("bug: normalizeOrderId(\"00\")", () => {
    expect(normalizeOrderId("00")).toEqual("00");
  });

  it("bug: normalizeOrderId(\"1A\")", () => {
    expect(normalizeOrderId("1A")).toEqual("1A");
  });

  it("bug: normalizeOrderId(\"1.\")", () => {
    expect(() => normalizeOrderId("1.")).toThrow(); // "Error"
  });
});
```

## Design decisions

- Execution judges a proposed input. A model's explanation is a lead; a confirmed divergence requires observed outcomes from both versions.
- JSON-only inputs keep hypotheses serializable, replayable, and easy to shrink. They also allow each execution to receive its own copy without sharing host objects.
- A seeded naive random baseline gives a simple comparison with uninformed sampling. It uses type-derived shapes when the new signature has parameters and every parameter is representable; otherwise it infers shapes from the first executed hypothesis. `baseline.shapeFrom` in JSON reports `types` or `example`. Sampling still uses printable ASCII strings, small integers and floats, short arrays, and supported object/literal/union shapes. The baseline is absent when no hypotheses executed and is not a domain-aware fuzzer.

## Limitations

- Use pure, synchronous functions; two-file mode additionally requires self-contained files without imports. Promises are rejected; the tool does not model external services, I/O, or shared application state.
- Git mode does not select callers when only a helper changes; added, deleted and renamed files are ignored, as are functions present on only one side. Only modified `.ts` files are scanned.
- Bundling supports pure dependencies, not a Node application runtime: Node builtins and globals such as `process`, `Buffer` and `fetch` are unsupported. Module top-level code re-runs for every call, so initialization failures can prevent the selected function from returning normally. Both revisions use dependencies installed in the current target repository, not separate historical dependency installations.
- Arguments are JSON-only. Return values must cross the worker boundary via structured cloning. The comparator has no cycle detection; RegExp and Error return values are compared by enumerable properties.
- Coverage tracks only the constructs listed above, not full language, statement or path coverage. Logical operators mark only right-hand evaluation; branch sets omit execution order and repetition. Unreachable marks can still trigger round two; the prompt lists at most 20 uncovered entries. Timeouts provide no branch hits. Full reported coverage does not prove equivalence or that all bugs were found.
- VM isolation is not a security sandbox. Use this locally with code you trust, not as a service for running hostile submissions.
- Live model hit rates vary between runs. Replay reproduces saved hypotheses and does not measure a live model.
- “No divergence found” is evidence, not proof of equivalence. Candidate generation, two hypothesis rounds, bounded shrinking, and the baseline explore only part of the input space; shrinking does not guarantee a globally smallest counterexample.
- Exported throw tests check that an error is thrown; the error name is only a comment. Unsupported return literals become `/* unsupported */ undefined`, and timeout tests are skipped. Review exported tests before committing them.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/cli.ts`, `src/render.ts` | Arguments, terminal/JSON reports, labeling, export path handling. |
| `src/core/types.ts` | Shared argument, outcome, hypothesis, and report contracts. |
| `src/core/coverage.ts` | TypeScript branch instrumentation and original source-line metadata. |
| `src/core/git.ts` | Revision validation and selection of changed exported functions. |
| `src/core/bundle.ts` | Temporary revision checkouts, esbuild bundling and function-line coverage metadata. |
| `src/core/signature.ts` | Checker-derived parameter types, representable shapes and hypothesis filtering. |
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
| `bench/cases/` | Ten planted-bug refactor pairs. |
| `bench/hard/` | Twelve rare-edge silent-bug cases. |
| `bench/real/` | Three adapted query-string fixes with source evidence and licenses. |
| `bench/experiments/` | Raw experiment tables and a log of the code version behind each run. |
| `bench/dogfood/` | 27 verified commits from es-toolkit, radash and date-fns that changed an exported function, for running git mode on real history. |
| `scripts/dogfood.ts` | Runs git mode over the dogfood commits. |
| `src/hook.ts` | `diffwitness hook install` pre-commit hook. |
| `demo/` | VHS tape, regeneration instructions and terminal GIF. |
| `demo/git-mode.md` | Git-mode usage and revision-specific replay demonstration. |
| `scripts/bench.ts` | Live hypothesis and seeded random-baseline benchmark runner. |
| `tests/` | Automated tests. |
| `scripts/cloud-setup.sh` | Noninteractive dependency installation. |

## Benchmark

`bench/cases/` contains 10 realistic refactors with one planted silent bug each: both versions return normally but return different values. Each case includes `old.ts`, `new.ts`, and an `expect.json` input proven by tests to trigger the bug.

With Ollama running and `gemma4:e4b` available, run from the repository root with `DIFFWITNESS_REPLAY` unset:

```sh
npx tsx scripts/bench.ts --runs-per-case 3 --random 2000
```

The script prints a Markdown table and writes `bench/results.md`. It reports the fraction of model runs finding a silent divergence, silent hits among 2000 random inputs per case, and average witness runtime. The random baseline uses seed 1 and now derives shapes from declared parameter types when all parameters are representable, falling back to the planted input otherwise. Generated benchmark reports state how many cases use declared types. The benchmark random-hit counts did not change versus example-derived shapes; the existing result tables are retained unchanged. Replay runs validate the script but do not measure live model performance.

Additional corpora:

- `bench/hard/`: 12 rare-edge cases covering Unicode, floating point, dates, precision, regex state and conditional boundaries. The seed-1 baseline measured **0/2000 silent hits for every case**, in the final runs using random inputs generated from the declared parameter types (example-derived shapes gave the same 0 hits). This is a result for that sampler and seed, not proof that random testing can never find them.
- `bench/real/`: three verified query-string fixes (separator encoding, inherited parser lookup, URL whitespace). Each `SOURCE.md` records upstream code, adaptations and MIT licensing. `old.ts` is the corrected reference and `new.ts` the affected version. `regression_commit` is the fix's parent, **not an established introducing commit**.

Select a corpus with `--cases <dir>` (default `bench/cases`) and an output file with `--out <file>` (default `bench/results.md`). Create the output directory first. For live experiments with Ollama running and `DIFFWITNESS_REPLAY` unset:

```sh
npx tsx scripts/bench.ts --cases bench/hard --out bench/experiments/hard-coverage.md --runs-per-case 3 --random 2000
DIFFWITNESS_NO_COVERAGE=1 npx tsx scripts/bench.ts --cases bench/hard --out bench/experiments/hard-no-feedback.md --runs-per-case 3 --random 2000
npx tsx scripts/bench.ts --cases bench/real --out bench/experiments/real.md --runs-per-case 3 --random 2000
```

`DIFFWITNESS_NO_COVERAGE=1` is read by the benchmark script for the feedback ablation: it omits uncovered branches from the prompt and triggers round two only when no silent divergence has been found. Instrumentation, coverage collection and clustering still run. The CLI does not read this variable.

### Experiments

All rows: 3 runs per case, 2000 seeded random inputs per case, Gemma 4 on an RTX 4060 laptop over LAN. Raw tables and the code version behind each run are in [`bench/experiments/`](bench/experiments/).

| corpus | gemma4:e4b | gemma4:e2b | random fuzzing |
| --- | --- | --- | --- |
| `bench/cases` (10 planted silent bugs) | 30/30 ¹ | 29/30 | 0 hits in 3 of 10 cases |
| `bench/hard` (12 rare-edge bugs) | 34/36 ² | 29/36 | 0 hits in all 12 cases (24,000 inputs) |
| `bench/real` (3 real query-string fixes) | 9/9 | not run | 0 hits in 1 of 3 cases |

¹ From `bench/results.md`, recorded before coverage feedback and type filtering existed. ² Recorded before type-aware filtering (#39). The e2b columns use the final pipeline (commit `b9afa5d`; the benchmark script's retry was added in `f9142da` without touching the pipeline).

**Coverage feedback ablation** (gemma4:e2b, same code for both columns, commit `b9afa5d`):

| corpus | feedback on | feedback off |
| --- | --- | --- |
| `bench/hard` | **29/36** | 22/36 |
| `bench/cases` | 29/30 | 28/30 |

Feeding uncovered branch lines back to the model helped most where a bug sits behind a rarely taken branch: `premium-boundary` went from 0/3 to 2/3 and `half-cent-rounding` from 0/3 to 2/3. `unicode-casefold` stayed at 0/3 either way. With gemma4:e4b on `bench/hard` the difference was within noise (34/36 on vs 35/36 off, measured before type-aware filtering), so the feedback mainly helps the smaller model. Three runs per case is a small sample; treat these as directional.

Two lessons from running the benchmark:
- Type filtering exposed inflated numbers. Before parameter types were checked, gemma4:e2b "found" the `dedupe-order` bug by passing a bare string where `string[]` was declared. That was a real difference, but outside the function's contract. Those hypotheses are now dropped, or re-wrapped when the model just spread a lone array argument.
- The model server returned occasional HTTP 500s. The benchmark retries a failed run once and reports any remaining failures in a separate errors column (they still count in the run total; every errors column in these results is 0).

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
- The original random baseline got the planted input's shape, which helped it. Type-derived shapes now remove that advantage for representable signatures; the benchmark random-hit counts did not change. Unsupported signatures still fall back to the planted input, as recorded in new reports.
- Timing covers the whole pipeline: model call, execution and shrinking.
- In one of the 30 runs the model returned malformed JSON. DiffWitness dropped that reply and found the bug in the next round, which is why model output is validated before use.
- 3 runs per case is a small sample. On the order-id example, the model found the leading-zero case in 3 of 5 live runs; it found other silent divergences in all 5.

## Tech and models used

TypeScript supplies the implementation, checker and transpiler; esbuild bundles git-mode imports. Node.js `worker_threads` and `vm` run comparisons. Gemma 4 e4b (`gemma4:e4b`) is the default live model, served through Ollama's chat API with a JSON response schema. Vitest runs the tests and is the format of exported regressions; `tsx` runs the CLI, and `picocolors` formats terminal output.

## Built at MadCloud x MLH Hacktoberfest Hack Day 2026

Built for MadCloud x MLH Hacktoberfest Hack Day 2026.

## License

[Apache-2.0](LICENSE).
