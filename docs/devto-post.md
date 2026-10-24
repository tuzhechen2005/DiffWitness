---
title: I let a small local model write the refactor tests I was too lazy to write
published: false
tags: devchallenge, hf26challenge, opensource, testing
cover_image: https://raw.githubusercontent.com/tuzhechen2005/DiffWitness/main/docs/cover.png
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 3: Slow and Steady](https://dev.to/challenges/hacktoberfest-week3-2026-10-19)*

## What I Built

Here is a refactor that passes every test and turns order `00123` into `123`.

The old code kept order IDs as strings. The new code is a cleanup: parse the ID as a number, give it back as a string. Every numeric ID still round-trips. `"00123"` doesn't throw; it just comes back as `"123"`. The only symptom would be a support ticket about an order nobody can find.

That one is the demo example in the repo. The real one happened to me while building this tool. I added type checking to DiffWitness, which is about as innocent as a change gets. One benchmark case quietly went from 3/3 to 0/3. No error, no failing test. It went to 0/3 because the new filter threw away every input the small model proposed for that case. My tool for catching silent behavior changes had just shipped one.

This is the kind of bug laziness creates. I don't write a test for `"00123"` because I don't think of it. I don't think of it because the refactor felt safe.

**DiffWitness** rewards the lazy move. I skip writing the edge-case test, and it writes one for me, but only after running both versions and seeing them disagree. You give it the old and new version of a function, or just say `--git HEAD~1`. A small open-weight model (Gemma 4, running locally through Ollama) reads both versions and guesses inputs where they might disagree. Then DiffWitness **runs both versions on every guess**. A difference counts only if execution shows it. Each real difference is shrunk to a minimal input, I label it *bug* or *intended*, and DiffWitness writes the vitest regression test for me.

**The model proposes; execution decides.** Because every guess is checked by running it, a small, fast, local model is enough.

## Demo

![DiffWitness finds the leading-zero bug, exports failing regression tests, then checks a rounding refactor](https://raw.githubusercontent.com/tuzhechen2005/DiffWitness/main/demo/demo.gif)

The model's guess was `"00123"`. DiffWitness shrank it to the smallest input that still shows the bug (excerpt from the replay run):

```text
  #2  normalizeOrderId("00")
      old → "00"
      new → "0"
      model args: ("00123")
      shrunk in 6 steps; why: SILENT DIVERGENCE: OLD preserves leading zeros, but NEW (via parseInt) strips them.
  …

Random fuzzing: 477 of 2000 runs diverged, 32 silent (both returned); sample shrank to 18 distinct repros
Model:          7 of 8 hypotheses diverged, 2 silent, 5 distinct repros
Coverage:       old 2/2, new 2/2 branches reached by model inputs
  random repros: ("N") ("9/") ("-") ("6=") ("T") ("e") ("X") ("W") ("1T") ("5:") …
  model repros:  ("A") ("O") ("00") ("1A") ("1.")
```

The bottom two lines are the honest comparison. Random fuzzing also finds *a lot* of differences here, but they're noise like `"9/"` and `"6="`. The model's repros each point at a behavior you can name: letters rejected, leading zeros dropped, trailing letters truncated.

I labeled them `bug`, and DiffWitness wrote this:

```ts
it("bug: normalizeOrderId(\"00\")", () => {
  expect(normalizeOrderId("00")).toEqual("00");
});
```

It fails against the new code, which is exactly what I want. Labeling a difference `intended` pins the new behavior instead. The tool never decides which version is right; I do.

## Code

{% github tuzhechen2005/DiffWitness %}

No GPU? Every example has recorded real Gemma replies, so this runs anywhere:

```sh
git clone https://github.com/tuzhechen2005/DiffWitness && cd DiffWitness && npm ci
npm run diffwitness -- examples/order-id/old.ts examples/order-id/new.ts --replay
```

With a model, from your own project:

```sh
ollama pull gemma4:e4b
node /path/to/DiffWitness/bin/diffwitness.mjs old.ts new.ts      # two files
node /path/to/DiffWitness/bin/diffwitness.mjs --git HEAD~1       # changed exported functions since HEAD~1, incl. uncommitted edits
node /path/to/DiffWitness/bin/diffwitness.mjs hook install       # check every commit from now on
```

That last line is the laziest version. The pre-commit hook checks each staged function against `HEAD` and prints what changed. If Ollama is down, it gets out of the way: it prints one line and lets the commit through.

## How I Built It

The pipeline:

1. **Load** each version with the TypeScript compiler API. In git mode, esbuild bundles the function with its local imports and pure npm dependencies.
2. **Instrument** every branch arm (`if`/`else`, `?:`, `&&`/`||`/`??`, `switch`, `catch`) with a counter.
3. **Ask Gemma** for up to eight inputs. The prompt includes both sources and the parameter types from the TypeScript checker.
4. **Check the guesses before running them.** Malformed JSON gets one retry. Inputs that violate the declared types are dropped.
5. **Run both versions** in a fresh `vm` context inside a worker thread, with a timeout. Compare outcomes: return value (with `Object.is` semantics, so `-0` ≠ `0`), thrown error type, or timeout.
6. **Round two**, if needed: send the model the real results *and the source lines no input has reached yet*, and ask again.
7. **Shrink** each difference to a minimal input, keeping the same kind of outcome on both sides. Then label, and export vitest tests.

A small model works here because a wrong guess is cheap: it costs one paired execution and then it's gone. The model doesn't have to be right. It only has to be a better guesser than random.

### Does it beat random?

I wrote 22 refactors with one planted *silent* bug each (both versions return normally, with different values) and adapted 3 real query-string bug fixes. Each case ran 3 times per model (the real fixes on e4b only), plus 2,000 seeded random inputs generated from the declared parameter types.

| corpus | Gemma 4 e4b | Gemma 4 e2b | random fuzzing |
| --- | --- | --- | --- |
| 10 everyday refactors | 30/30 | 29/30 | 0 hits in 3 of 10 cases |
| 12 rare-edge refactors | 34/36 | 29/36 | **0 hits in all 12 (24,000 inputs)** |
| 3 real query-string bug fixes | 9/9 | | 0 hits in 1 of 3 |

<sub>The e4b rows were recorded on earlier versions of the pipeline (before type filtering; the everyday row also before coverage feedback). The e2b rows use the final one. Details per run: [`bench/experiments/README.md`](https://github.com/tuzhechen2005/DiffWitness/blob/main/bench/experiments/README.md).</sub>

The rare-edge set is where it gets interesting. Examples: `>=` became `>` at exactly 10,000; a shared `/g` regex keeps `lastIndex` between calls; `slice` cuts an emoji in half; `|| 0` turns `-0` into `0`. Random inputs essentially never land on those values. A model reading the diff sees the `>` and tries `10000`.

### Does feeding coverage back actually help?

I ran the same pipeline with the uncovered-lines feedback switched off:

| gemma4:e2b | feedback on | feedback off |
| --- | --- | --- |
| rare-edge refactors | **29/36** | 22/36 |
| everyday refactors | 29/30 | 28/30 |

The gains came where I'd hoped: bugs hiding behind a branch the first round never reached. `premium-boundary` went from 0/3 to 2/3. With the larger e4b model the difference was within noise, because e4b was already near the ceiling. So coverage feedback mostly lets a *smaller, faster* model do the job.

### Real history

Planted bugs are a controlled test. I also wanted to see what happens on code I didn't write, so I pointed git mode at 27 real commits from [es-toolkit](https://github.com/toss/es-toolkit), [radash](https://github.com/sodiray/radash) and [date-fns](https://github.com/date-fns/date-fns), one `--git <sha>~1..<sha>` run each:

| commit kind | commits | found a behavior difference |
| --- | --- | --- |
| bug fix | 22 | 10 |
| feature | 2 | 1 |
| refactor / perf | 3 | 0 |

All 27 bundled and ran, with their real imports, in about 45 seconds each. For fixes, a difference is the point: a concrete input showing what the commit changed, which a reviewer would label `intended`. For the three commits that weren't supposed to change behavior, DiffWitness found nothing. That isn't a proof, and I haven't yet hand-checked every difference against the fix's intent.

## Why Does Open Innovation Matter?

A refactor-checking tool has to read your source code. With a closed API, every function you change gets sent to someone else's server. With an open-weight model on local hardware (in my case, a gaming laptop's RTX 4060 on my home network), there is no API key, no per-token bill, and no question about where proprietary code goes.

Open weights also let me *measure* instead of guess. I could run two Gemma sizes on the same benchmark and see the tradeoff: e2b took about half of e4b's runtime, and with coverage feedback it found 29 of 30 everyday bugs (e4b found 30 of 30, measured on an earlier pipeline version).

And because the evaluation is open, anyone can check my numbers. The benchmark cases, the raw result tables, the code version behind each run, and the recorded model replies are all in the repo. That includes the results that didn't flatter the tool.

## My Agent Session

I built this in one Hack Day with a team of AI agents, in four steps:

1. **A grilling session first.** An agent interviewed me until the spec had no open decisions: JSON-only inputs, worker+vm isolation, the shrinking rule, the label semantics. One plan didn't survive it: I was going to use fast-check for shrinking, but fast-check needs typed generators, and my inputs arrive from the model as plain JSON. So I wrote a 90-line JSON shrinker instead.
2. **Contracts before code.** I committed `types.ts` and stub signatures, so parallel work couldn't drift apart.
3. **One issue per module, one fresh agent per issue.** Claude Code subagents and Codex Cloud tasks each worked in their own context and git worktree. No agent had to hold the whole project in its head.
4. **An independent reviewer for every PR**, with a checklist aimed at the failure modes that matter for this tool.

The reviewers caught bugs that every happy-path test passed:

- A missing replay file returned zero hypotheses, so the report said "no divergence found" without testing anything.
- Two `async` functions both returned a Promise, which compared as "the same outcome" no matter what they resolved to.
- In git mode, a function that crashed on a missing global threw the same `ReferenceError` on both sides, which also looked like "no divergence". Now the report says *the function never ran*.
- The type filter dropped valid inputs for parameters typed `T | undefined`.
- A fallback in the pre-commit hook would have run `npx diffwitness`, an **unpublished** package name. Anyone who registered it could have run code on every commit.

Four of the five are the same bug in different clothes: the tool reported "no divergence" when the truth was "I didn't actually test anything." For a tool like this, staying silent is the most dangerous output.

## The Lazy Payoff

- **Tests I didn't write:** for the order-ID refactor, five regression tests, each pinned to a minimal input, generated by one command and then labeled by me.
- **Bugs a careful random fuzzer missed:** 12 out of 12 rare-edge cases at 2,000 inputs each, found by the model in 29–34 of 36 runs.
- **Setup I have to remember:** none. `hook install` once, and every commit gets checked.
- **Did I use it this week?** Yes. I pointed it at 27 real commits in three popular libraries (results above).

The fine print, in one place: Node's `vm` is not a security sandbox, so use this on code you trust. "No divergence found" is evidence, not proof. Three runs per case is a small sample. And DiffWitness only handles pure, synchronous functions with JSON-shaped inputs, which turns out to be a lot of the code I actually refactor.

Being lazy is fine. Being lazy *and* having a witness is better.

## Prize Categories

**Best Use of Gemma.** Gemma 4 (e4b and e2b) runs locally through Ollama and is the part that makes the project work: it generates the hypotheses that execution then confirms. The benchmark compares the two sizes directly. The smaller e2b, with coverage feedback, found 29 of 30 everyday bugs at about half e4b's runtime. Small open weights are enough when execution checks every guess.
