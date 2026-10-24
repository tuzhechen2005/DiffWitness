# Working on DiffWitness

DiffWitness is a CLI: `diffwitness old.ts new.ts`. A local open-weight model (Gemma 4 via Ollama)
proposes inputs where two versions of a pure TypeScript function might behave differently; we run
both versions in isolation, shrink each real divergence to a minimal repro, let the user label it
bug / intended, and export a vitest regression file.

## Layout

| File | Owner issue |
|---|---|
| `src/core/types.ts` | integrator only — do not edit; ask in the PR if a contract is wrong |
| `src/core/witness.ts` | integrator (pipeline glue) |
| `src/core/loader.ts` | #1 |
| `src/core/executor.ts`, `src/core/compare.ts` | #2 |
| `src/core/shrink.ts`, `src/core/baseline.ts` | #3 |
| `src/core/hypothesize.ts` (+ optional `src/core/ollama.ts`) | #4 |
| `src/core/exportTests.ts` | #5 |
| `src/cli.ts`, `src/render.ts` | #6 |
| `src/core/coverage.ts` | #28 (branch instrumentation) |
| `src/core/git.ts`, `src/core/bundle.ts` | #37 (git mode, esbuild bundling) |
| `src/core/signature.ts` | #38 (parameter types) |
| `src/hook.ts` | #44 (pre-commit hook) |
| `bench/`, `scripts/bench.ts`, `scripts/dogfood.ts` | benchmarks |
| `tests/<module>.test.ts` | the issue that owns the module |

Touch only the files your issue owns plus its test file. Keep the exported signatures exactly as
stubbed. Do not add dependencies; the installed ones are `typescript` (5.9, for transpiling),
`picocolors`, `esbuild`, `vitest`, `tsx`, `@types/node`.

## Setup and commands

- `bash scripts/cloud-setup.sh` installs dependencies (`npm ci`); Codex Cloud uses it as the install
  command. Keep it noninteractive and Linux-compatible; no secrets, no running services needed.

- `npm test` (vitest; tests must never call a real model — use `DIFFWITNESS_REPLAY=1` / fixtures)
- `npm run typecheck`
- `npm run diffwitness -- examples/order-id/old.ts examples/order-id/new.ts --replay`

## Code style (ponytail, full)

- Smallest complete change: no options, wrappers, abstractions or "for later" code nobody asked for.
- Standard library first; never add a dependency for a few lines.
- Non-trivial logic ships with a small focused test. Trivial code needs none.
- Comment only the why the code cannot show, in one line. A known limit gets
  `// shortcut: <the limit>, <when to upgrade>`.
- Never cut: validation of model output (trust boundary), error messages a user needs, isolation of
  executed code.
- English everywhere. ESM, TypeScript strict, imports without file extensions.

## PRs and repository practices

- One branch and one PR per issue, body starts with `Closes #<n>`. CI (typecheck + tests) must be green.
- Codex branches use the `codex/` prefix; Claude branches use `claude/`.
- Preserve the Apache 2.0 license. Keep dependency dirs, credentials and `.env` files out of Git;
  commit `package-lock.json`.
