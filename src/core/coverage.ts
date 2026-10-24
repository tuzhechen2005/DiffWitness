import ts from 'typescript';
import type { LoadedFn } from './types';

export type BranchKind = 'if-then' | 'if-else' | 'cond-true' | 'cond-false' | 'logical-right' | 'case' | 'default' | 'catch';

export interface Branch {
  id: number;
  /** 1-based line in the original TS source. */
  line: number;
  kind: BranchKind;
  /** That source line, trimmed. */
  text: string;
}

// Same options as the loader so instrumented code differs only by the `__cov[id] = 1` marks.
const compilerOptions = { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 };

/**
 * Re-transpiles the original source with `__cov[id] = 1` at the start of every branch arm.
 * The executor provides a fresh `__cov` array per call when the code mentions it.
 */
// shortcut: no marks for `?.`, `&&=`/`||=`/`??=`, default parameters or loops; add them if users ask for loop coverage.
export function instrument(fn: LoadedFn): { fn: LoadedFn; branches: Branch[] } {
  const branches: Branch[] = [];
  const lines = fn.source.split('\n');

  const transformer: ts.TransformerFactory<ts.SourceFile> = (ctx) => (sf) => {
    const f = ctx.factory;
    const mark = (at: ts.Node, kind: BranchKind) => {
      const line = sf.getLineAndCharacterOfPosition(at.getStart(sf)).line;
      branches.push({ id: branches.length, line: line + 1, kind, text: lines[line].trim() });
      const cell = f.createElementAccessExpression(f.createIdentifier('__cov'), branches.length - 1);
      return f.createAssignment(cell, f.createNumericLiteral(1));
    };
    const markStmt = (at: ts.Node, kind: BranchKind) => f.createExpressionStatement(mark(at, kind));
    const prepend = (m: ts.Statement, s: ts.Statement) => f.createBlock([m, ...(ts.isBlock(s) ? s.statements : [s])], true);
    const wrap = (m: ts.Expression, e: ts.Expression) => f.createParenthesizedExpression(f.createComma(m, e));
    const v = <T extends ts.Node>(n: T) => ts.visitNode(n, visit) as T;
    const vs = (ns: ts.NodeArray<ts.Statement>) => ns.map(v);

    const visit = (node: ts.Node): ts.Node => {
      if (ts.isIfStatement(node)) {
        const then = prepend(markStmt(node.thenStatement, 'if-then'), v(node.thenStatement));
        // An if without else still gets an else arm, so "condition never false" shows up as uncovered.
        const elseMark = markStmt(node.elseStatement ?? node, 'if-else');
        const other = node.elseStatement ? prepend(elseMark, v(node.elseStatement)) : f.createBlock([elseMark], true);
        return f.updateIfStatement(node, v(node.expression), then, other);
      }
      if (ts.isConditionalExpression(node)) {
        const t = wrap(mark(node.whenTrue, 'cond-true'), v(node.whenTrue));
        const e = wrap(mark(node.whenFalse, 'cond-false'), v(node.whenFalse));
        return f.updateConditionalExpression(node, v(node.condition), node.questionToken, t, node.colonToken, e);
      }
      if (ts.isBinaryExpression(node) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) {
        const right = wrap(mark(node.right, 'logical-right'), v(node.right));
        return f.updateBinaryExpression(node, v(node.left), node.operatorToken, right);
      }
      if (ts.isCaseClause(node)) return f.updateCaseClause(node, v(node.expression), [markStmt(node, 'case'), ...vs(node.statements)]);
      if (ts.isDefaultClause(node)) return f.updateDefaultClause(node, [markStmt(node, 'default'), ...vs(node.statements)]);
      if (ts.isCatchClause(node)) {
        const decl = node.variableDeclaration && v(node.variableDeclaration);
        return f.updateCatchClause(node, decl, prepend(markStmt(node, 'catch'), v(node.block)) as ts.Block);
      }
      return ts.visitEachChild(node, visit, ctx);
    };
    return ts.visitEachChild(sf, visit, ctx);
  };

  const code = ts.transpileModule(fn.source, { compilerOptions, transformers: { before: [transformer] } }).outputText;
  return { fn: { ...fn, code }, branches };
}
