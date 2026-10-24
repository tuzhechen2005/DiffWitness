<!-- CHALLENGE LINK LINE: author pastes the template's first line here -->

<!-- Suggested title: I made a small model write the refactor tests I was too lazy to write -->
<!-- DEV tags: devchallenge, hf26challenge -->

## What I Built

A refactor turned order `"00128"` into `"128"`, and every test passed.

That is the scenario behind DiffWitness. A cleanup replaces string handling with numeric parsing. Ordinary IDs still work. Leading zeros quietly disappear. Nobody gets an exception; somebody gets the wrong order ID.

This is a deliberately constructed example, not a story about a production incident. I am a CS student at UW–Madison, and I built DiffWitness at the MadCloud x MLH Hacktoberfest Hack Day. For week 3 of DEV x Hacktoberfest 2026, “Slow and Steady,” I wanted laziness to produce a useful artifact: the edge-case test I had not thought to write.

DiffWitness compares two versions of a pure TypeScript function. A small, local Gemma model reads both and guesses inputs that might expose a difference. The tool executes both versions, shrinks confirmed differences, and exports regression tests after I label the behavior as a bug or an intended change.

**The model proposes; execution decides.** That is the boundary I wanted to keep throughout the project. A persuasive explanation is not a failing test.

## Demo

![DiffWitness compares order IDs, exports failing tests, and checks a rounding refactor](https://raw.githubusercontent.com/tuzhechen2005/DiffWitness/main/demo/demo.gif)

The GIF uses recorded real Gemma 4 e4b replies through `--replay`. It is reproducible without a running model. It is not a fresh inference run, and its earlier rendering differs from the current coverage-aware report.

From the repository root, after `npm ci`:

```sh
npm run diffwitness -- examples/order-id/old.ts examples/order-id/new.ts \
  --replay --label bug --out /tmp/x.test.ts
```

Here is an excerpt from the current recorded example:

```text
  #2  normalizeOrderId("00")
      old → "00"
      new → "0"
      model args: ("00123")

Model:          7 of 8 hypotheses diverged, 2 silent, 5 distinct repros
Coverage:       old 2/2, new 2/2 branches reached by model inputs

Wrote 5 regression test(s) to /tmp/x.test.ts
```

The shrinker turns the longer suggestion into `"00"`: enough input to expose the leading-zero problem. The exported file includes this assertion:

```ts
expect(normalizeOrderId("00")).toEqual("00");
```

It fails against the new implementation. That is the point. Labeling a difference `bug` pins the old outcome; labeling it `intended` pins the new one. I still decide which behavior is correct.

## Code

[DiffWitness on GitHub](https://github.com/tuzhechen2005/DiffWitness) is Apache-2.0 licensed. Adapted upstream benchmark snippets retain their MIT notices.

For live hypotheses, use Node.js 20 or newer, start Ollama, and pull Gemma:

```sh
ollama pull gemma4:e4b
npm run diffwitness -- old.ts new.ts
```

`--fn name` selects an exported function when a file contains several. Local helpers are allowed; imports are rejected. Inputs are JSON argument arrays, and functions must be synchronous and self-contained.

The repository includes the source, replay fixtures, tests, benchmark cases, and the VHS tape used for the demo. Those are the pieces needed to inspect a claim instead of trusting a screenshot.

## How I Built It

The pipeline is deliberately narrow: parse TypeScript, ask for hypotheses, execute both versions, compare outcomes, shrink differences, label, export.

Gemma proposes up to eight inputs per round. Each execution gets fresh arguments and a fresh VM context inside a Node worker. A timeout bounds execution. The comparator distinguishes return values, thrown errors, and timeouts; it also distinguishes `0` from `-0`.

Wrong model guesses cost a paired execution and are dropped from the divergence results. That makes a small model useful: it needs to suggest a promising input, not produce a trustworthy proof or solve the entire application. Its explanation can be wrong while its input is useful.

The current version instruments branch arms and sends uncovered source lines back in round two. That round runs if no silent divergence was found **or** some instrumented branch remains uncovered. Similar repros are grouped by outcome kinds and reached branches, but one branch path can contain different bugs. Coverage helps direct the next question; it does not prove correctness.

I compared two local Gemma sizes against naive random inputs. The committed live runs used an RTX 4060 laptop over LAN, three runs per case, on ten refactors with one planted silent bug each.

| Measurement | Gemma 4 e4b | Gemma 4 e2b |
| --- | --- | --- |
| Runs finding a silent divergence | 30/30 | 25/30 |
| Explicit-zero default case | 3/3 | 1/3 |
| Pagination case | 3/3 | 0/3 |
| Mean of the ten case-average pipeline times | 19.36 s | 9.05 s |

The [e4b results](https://github.com/tuzhechen2005/DiffWitness/blob/main/bench/results.md) and [e2b results](https://github.com/tuzhechen2005/DiffWitness/blob/main/bench/results-e2b.md) show a concrete tradeoff: the smaller model was faster, but missed cases.

Random testing was useful too. With 2,000 inputs per case, it found 1,119 silent divergences in the deduplication case. It found zero in free-shipping boundaries, explicit-zero defaults, and Unicode slugs. Both models found those first and third cases in all three runs; e2b struggled with explicit zero.

These are different units: a model hit rate counts successful runs, while the random count measures individual inputs. A hit means **a silent divergence**, not necessarily the exact planted input. The random baseline infers shapes from that planted input, which favors random. Three runs per case are a small sample, not a reliability guarantee.

These recorded benchmarks predate coverage feedback. At this draft's source revision, `bench/experiments/` has no committed results, so I cannot claim an ablation improvement. The script supports `DIFFWITNESS_NO_COVERAGE=1` to disable feedback for that comparison; instrumentation still runs.

There are also twelve hard cases, each with zero silent random hits in 2,000 seed-1 samples, and three verified query-string fixes. That does not establish model success on either corpus. The real cases document adaptations and identify affected parent revisions, not proven bug-introducing commits.

## Why Does Open Innovation Matter?

With Gemma running through Ollama on the same machine, proprietary source does not need to leave that machine. Pointing Ollama at a LAN host, as in the recorded benchmarks, sends it there instead. Local deployment gives me that choice without requiring a hosted inference service.

Open weights also let me compare model sizes rather than assume a larger endpoint is necessary. The e2b misses are useful evidence about where the cheaper option falls short.

Replay fixtures preserve actual proposals, keyed by source pairs. Anyone can rerun execution against them, inspect why an input diverges, or run the benchmark with their own model and hardware. Replay reproduces saved suggestions; it does not measure a live model's hit rate.

For me, open innovation means publishing the measurement apparatus alongside the result, including the cases where the result is less flattering.

## My Agent Session

I used agents to build the tool, with a similar division of responsibility: propose work, then check it.

The process began with a grilling session to narrow the spec. [AUTHOR: add one actual question from that session and the decision it changed.] The first scaffold committed typed contracts, the pipeline, module stubs, examples, and CI before the implementations landed.

Six issues divided ownership: loader, executor/comparator, shrinker/random baseline, hypothesizer, test exporter, and CLI. Claude Code subagents and Codex Cloud tasks worked on those slices in parallel. Independent reviewer agents inspected the PRs before integration. The [commit history](https://github.com/tuzhechen2005/DiffWitness/commits/main/) preserves that sequence.

The reviews found failures that passing happy-path tests would miss:

- In [PR #8](https://github.com/tuzhechen2005/DiffWitness/pull/8), a missing replay file silently yielded no hypotheses. That could report “no divergence found” without testing anything. The fix made missing or unreadable fixtures explicit errors.
- The [executor review](https://github.com/tuzhechen2005/DiffWitness/pull/10) noticed that different Promises could become the same uncloneable outcome. Async functions are now explicitly rejected.
- We removed an overstated “found only by the model” interpretation. Different minimal inputs do not prove different underlying bugs. [The baseline change](https://github.com/tuzhechen2005/DiffWitness/commit/41a6fe21026cb8b724acd6ff709ba332ab3957be) instead displays random and model repros side by side.

I did not get to outsource judgment. I got separate implementations and reviews with concrete evidence to inspect. [AUTHOR: add a shareable session link or screenshot, if available.]

## The Lazy Payoff

The recorded order-ID run writes five regression tests. I still review their expectations, but I do not have to manually turn each counterexample into test syntax.

Across the ten planted cases, e4b found a silent divergence in all thirty measured runs. Its mean pipeline time was about 0.32 minutes per run; that excludes the separate random baseline and human labeling. It is a runtime measurement, not a claim that I saved a measured number of engineering hours.

There are boundaries to this bargain. Node's `vm` is not a security sandbox: this is for local use with trusted code. Coverage omits constructs such as loops and optional chaining. “No divergence found” is evidence, not proof, and greedy shrinking does not promise a globally smallest input.

That is my version of Slow and Steady: spend a little compute looking for a reason to stop before accepting a cleanup. Keep the human decision, automate the repetitive test construction, and leave behind something the next refactor can run.

## Prize Categories

I am entering **Best Use of Gemma**, using Gemma 4 locally through Ollama to propose differential test inputs.

This is my DEV x Hacktoberfest 2026 week 3 “Slow and Steady” entry: open-weight inference that rewards laziness with executable regression tests.

Tags: `devchallenge`, `hf26challenge`.
