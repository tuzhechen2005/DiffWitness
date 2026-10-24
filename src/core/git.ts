import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

export const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 });

/** One exported function whose own text differs between base and head. */
export interface ChangedFn {
  /** Repo-relative path, forward slashes. */
  path: string;
  name: string;
  oldSource: string;
  newSource: string;
}

/** Text of each top-level exported function (declarations and `export const f = () => ...` / function expressions). */
export function exportedFunctions(source: string, file = 'x.ts'): { fns: Map<string, string>; hasDefault: boolean } {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const out = new Map<string, string>();
  let hasDefault = false;
  for (const stmt of sf.statements) {
    const mods = ts.canHaveModifiers(stmt) ? (ts.getModifiers(stmt) ?? []) : [];
    if (ts.isExportAssignment(stmt) || mods.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) hasDefault = true;
    if (!mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) || mods.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) continue;
    if (ts.isFunctionDeclaration(stmt) && stmt.name && stmt.body) out.set(stmt.name.text, stmt.getText(sf));
    if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        const init = d.initializer;
        if (ts.isIdentifier(d.name) && init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) out.set(d.name.text, stmt.getText(sf));
      }
    }
  }
  return { fns: out, hasDefault };
}

/** Resolves `rev` to a commit hash; refuses anything git could read as an option. */
export function resolveRev(repo: string, rev: string): string {
  if (rev.startsWith('-')) throw new Error(`invalid revision "${rev}": revisions cannot start with "-"`);
  try {
    return git(repo, 'rev-parse', '--verify', '--quiet', '--end-of-options', `${rev}^{commit}`).trim();
  } catch {
    throw new Error(`unknown revision "${rev}" in ${repo}`);
  }
}

/** Pass as `head` to compare against the staged index instead of a commit or the working tree. */
export const STAGED = ':staged';

/**
 * Exported functions whose own text changed between `base` and `head` (undefined = working tree, STAGED = index).
 * `base` and `head` must be resolved with resolveRev. Functions only on one side, and default exports, are skipped and reported in `notes`.
 */
export function changedFunctions(repo: string, base: string, head?: string, filter: { path?: string; fn?: string } = {}) {
  const notes: string[] = [];
  const files = git(repo, 'diff', '--name-only', '--diff-filter=M', ...(head === STAGED ? ['--cached'] : []), base, ...(head && head !== STAGED ? [head] : []), '--', '*.ts')
    .split('\n')
    .filter((p) => p && !/\.(d|test|spec)\.ts$/.test(p) && !p.split('/').includes('node_modules'))
    .filter((p) => filter.path === undefined || p === filter.path);
  const fns: ChangedFn[] = [];
  for (const path of files) {
    const oldText = git(repo, 'show', `${base}:${path}`);
    const newText = head === STAGED ? git(repo, 'show', `:${path}`) : head ? git(repo, 'show', `${head}:${path}`) : readFileSync(join(repo, path), 'utf8');
    const [o, n] = [exportedFunctions(oldText, path), exportedFunctions(newText, path)];
    const [olds, news] = [o.fns, n.fns];
    if (n.hasDefault) notes.push(`${path}: default export skipped; only named exports are checked`);
    for (const [name, oldSource] of olds) {
      if (filter.fn !== undefined && name !== filter.fn) continue;
      const newSource = news.get(name);
      if (newSource === undefined) notes.push(`${path}:${name} removed, skipped`);
      else if (newSource !== oldSource) fns.push({ path, name, oldSource, newSource });
    }
    for (const name of news.keys()) {
      if (!olds.has(name) && (filter.fn === undefined || name === filter.fn)) notes.push(`${path}:${name} is new, skipped`);
    }
  }
  return { fns, notes };
}
