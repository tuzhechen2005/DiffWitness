import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import type { LoadedFn } from './types';

const compilerOptions = { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 };

/** Reads a .ts file and delegates to loadFunctionFromSource. Issue #1. */
export async function loadFunction(file: string): Promise<LoadedFn> {
  return loadFunctionFromSource(await readFile(file, 'utf8'), file);
}

/**
 * Parses TS source that exports exactly one function (`export function f` or
 * `export const f = (...) => ...` / function expression) and has no imports.
 * Throws a clear Error otherwise. Never executes the code. Issue #1.
 */
export function loadFunctionFromSource(source: string, file = '<source>'): LoadedFn {
  const out = ts.transpileModule(source, { compilerOptions, fileName: file, reportDiagnostics: true });
  const [diag] = out.diagnostics ?? [];
  if (diag) {
    const at = diag.file && diag.start !== undefined ? diag.file.getLineAndCharacterOfPosition(diag.start) : undefined;
    const where = at ? `:${at.line + 1}:${at.character + 1}` : '';
    throw new Error(`${file}${where}: syntax error: ${ts.flattenDiagnosticMessageText(diag.messageText, ' ')}`);
  }

  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);

  let forbidden: string | undefined;
  const visit = (node: ts.Node): void => {
    const isModuleRef =
      ts.isImportDeclaration(node) ||
      (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) ||
      (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) ||
      (ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === 'require')));
    if (!forbidden && isModuleRef) forbidden = node.getText(sf).split('\n')[0];
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (forbidden) {
    throw new Error(`${file}: imports are not allowed (found: ${forbidden}); the function must be self-contained`);
  }

  const names = new Set<string>();
  for (const stmt of sf.statements) {
    const mods = ts.canHaveModifiers(stmt) ? (ts.getModifiers(stmt) ?? []) : [];
    const exported = mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!exported || mods.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) continue;
    if (ts.isFunctionDeclaration(stmt) && stmt.name) names.add(stmt.name.text);
    if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        const init = d.initializer;
        if (ts.isIdentifier(d.name) && init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
          names.add(d.name.text);
        }
      }
    }
  }
  if (names.size === 0) {
    throw new Error(`${file}: no exported function; expected "export function f(...)" or "export const f = (...) => ..."`);
  }
  if (names.size > 1) {
    throw new Error(`${file}: more than one exported function (${[...names].join(', ')}); export exactly one`);
  }

  const [name] = names;
  return { name, source, code: out.outputText };
}
