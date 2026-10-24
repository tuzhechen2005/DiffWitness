# Git mode demo

Check every exported function your change touched, in any TypeScript repo, without copying files:

```sh
cd your-repo
node /path/to/DiffWitness/bin/diffwitness.mjs --git HEAD~1          # HEAD~1 vs your working tree
node /path/to/DiffWitness/bin/diffwitness.mjs --git main..feature   # two commits
node /path/to/DiffWitness/bin/diffwitness.mjs --git HEAD~1 --path src/order.ts --fn total
```

What happens:

1. `git diff --name-only` lists modified `.ts` files (not `*.d.ts`, `*.test.ts`, `*.spec.ts`, `node_modules`).
2. In each file, exported functions (`export function f` / `export const f = () => ...`) whose own text
   changed are selected. New or removed functions are skipped with a note. A function whose helpers changed
   but whose own text did not is not selected.
3. Each commit is checked out in a temporary `git worktree` (removed afterwards; the working tree is used
   as is), and the file is bundled with esbuild so relative imports and `node_modules` packages resolve.
   Code that pulls in Node builtins (`fs`, `path`, ...) is skipped with a message: the VM context has no `require`.
4. Each function goes through the normal pipeline; labeled divergences are exported to
   `diffwitness.<path>.<fn>.test.ts` in the current directory.

Try it on DiffWitness itself. Replay has no fixtures for these functions, so there are no hypotheses; this
shows detection and bundling. Drop `--replay` with Ollama running to hunt for real:

```sh
npm run diffwitness -- --git e0ad778~1..e0ad778 --replay
```
