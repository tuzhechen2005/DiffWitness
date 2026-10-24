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
export function exportedFunctions(source: string, file = 'x.ts'): Map<string, string> {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const out = new Map<string, string>();
  for (const stmt of sf.statements) {
    const mods = ts.canHaveModifiers(stmt) ? (ts.getModifiers(stmt) ?? []) : [];
    if (!mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) || mods.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) continue;
    if (ts.isFunctionDeclaration(stmt) && stmt.name && stmt.body) out.set(stmt.name.text, stmt.getText(sf));
    if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        const init = d.initializer;
        if (ts.isIdentifier(d.name) && init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) out.set(d.name.text, stmt.getText(sf));
      }
    }
  }
  return out;
}

/**
 * Exported functions whose own text changed between `base` and `head` (undefined = working tree).
 * Functions only on one side are skipped and reported in `notes`.
 */
export function changedFunctions(repo: string, base: string, head?: string, filter: { path?: string; fn?: string } = {}) {
  const notes: string[] = [];
  const files = git(repo, 'diff', '--name-only', '--diff-filter=M', base, ...(head ? [head] : []), '--', '*.ts')
    .split('\n')
    .filter((p) => p && !/\.(d|test|spec)\.ts$/.test(p) && !p.split('/').includes('node_modules'))
    .filter((p) => filter.path === undefined || p === filter.path);
  const fns: ChangedFn[] = [];
  for (const path of files) {
    const oldText = git(repo, 'show', `${base}:${path}`);
    const newText = head ? git(repo, 'show', `${head}:${path}`) : readFileSync(join(repo, path), 'utf8');
    const [olds, news] = [exportedFunctions(oldText, path), exportedFunctions(newText, path)];
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
