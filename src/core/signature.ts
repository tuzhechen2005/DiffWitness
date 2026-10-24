import ts from 'typescript';
import type { Shape } from './baseline';
import type { Args, Json, LoadedFn } from './types';

export interface Param {
  name: string;
  optional: boolean;
  /** The declared type as the checker prints it. */
  text: string;
  /** JSON-representable structure of the type; undefined when it cannot be generated or checked. */
  shape?: Shape;
}

const FILE = 'signature.ts';

/** Parameters of the exported function `fn.name`, from the TypeScript checker. Undefined if not found or rest params are used. */
export function paramsOf(fn: LoadedFn): Param[] | undefined {
  const options: ts.CompilerOptions = { strict: true, target: ts.ScriptTarget.ES2022, lib: ['lib.es2022.d.ts'], noEmit: true, types: [] };
  const sf = ts.createSourceFile(FILE, fn.source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (name, ...rest) => (name === FILE ? sf : getSourceFile(name, ...rest));
  const checker = ts.createProgram([FILE], options, host).getTypeChecker();

  const decl = sf.statements.flatMap((s): ts.SignatureDeclaration[] => {
    if (ts.isFunctionDeclaration(s) && s.name?.text === fn.name) return [s];
    if (!ts.isVariableStatement(s)) return [];
    return s.declarationList.declarations.flatMap((d): ts.SignatureDeclaration[] =>
      ts.isIdentifier(d.name) && d.name.text === fn.name && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)) ? [d.initializer] : []);
  })[0];
  if (!decl || decl.parameters.some((p) => p.dotDotDotToken)) return undefined;

  const shapeOf = (type: ts.Type, depth = 0): Shape | undefined => {
    const f = type.flags;
    if (depth > 4 || f & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.TypeParameter)) return undefined;
    if (f & ts.TypeFlags.Boolean) return 'boolean';
    if (f & ts.TypeFlags.String) return 'string';
    if (f & ts.TypeFlags.Number) return 'number';
    if (f & ts.TypeFlags.Null) return 'null';
    if (f & ts.TypeFlags.BooleanLiteral) return { literal: (type as ts.Type & { intrinsicName: string }).intrinsicName === 'true' };
    if (type.isStringLiteral() || type.isNumberLiteral()) return { literal: type.value };
    if (type.isUnion()) {
      // undefined is not JSON; optionality is carried by the param or property flag.
      const members = type.types.filter((t) => !(t.flags & ts.TypeFlags.Undefined)).map((t) => shapeOf(t, depth + 1));
      if (!members.length || !members.every((m) => m)) return undefined;
      // `boolean | undefined` arrives as the two literals true and false.
      const isBool = (m: Shape | undefined) => typeof m === 'object' && 'literal' in m && typeof m.literal === 'boolean';
      const out = (members.some((m) => isBool(m)) && members.filter((m) => isBool(m)).length === 2
        ? ['boolean' as Shape, ...members.filter((m) => !isBool(m))] : members) as Shape[];
      return out.length === 1 ? out[0] : { union: out };
    }
    if (!(f & ts.TypeFlags.Object)) return undefined;
    if (type.symbol?.name === 'Array' && type.symbol.declarations?.some((d) => d.getSourceFile() !== sf)) {
      const [item] = checker.getTypeArguments(type as ts.TypeReference);
      const inner = item && shapeOf(item, depth + 1);
      return inner ? { array: inner } : undefined;
    }
    // Only types declared in this file; lib classes (Date, Map, ...) and callables are out.
    if (!type.symbol?.declarations?.every((d) => d.getSourceFile() === sf)) return undefined;
    if (type.getCallSignatures().length || type.getConstructSignatures().length || type.getStringIndexType() || type.getNumberIndexType()) return undefined;
    const object: Record<string, Shape> = {};
    const optional: string[] = [];
    for (const prop of checker.getPropertiesOfType(type)) {
      const inner = shapeOf(checker.getTypeOfSymbolAtLocation(prop, decl), depth + 1);
      if (!inner) return undefined;
      object[prop.name] = inner;
      if (prop.flags & ts.SymbolFlags.Optional) optional.push(prop.name);
    }
    return optional.length ? { object, optional } : { object };
  };

  return decl.parameters.map((p) => {
    const type = checker.getTypeAtLocation(p);
    return {
      name: p.name.getText(sf),
      optional: !!p.questionToken || !!p.initializer,
      text: checker.typeToString(type).replace(/ \| undefined$/, ''),
      shape: shapeOf(type),
    };
  });
}

const check = (shape: Shape, v: Json | undefined): boolean => {
  if (typeof shape === 'string') return v === null ? shape === 'null' : typeof v === shape;
  if ('literal' in shape) return v === shape.literal;
  if ('union' in shape) return shape.union.some((s) => check(s, v));
  if ('array' in shape) return Array.isArray(v) && v.every((x) => check(shape.array, x));
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  return Object.entries(shape.object).every(([key, inner]) =>
    v[key] === undefined ? !!shape.optional?.includes(key) : check(inner, v[key]));
};

/** False only when an arg clearly violates a known param shape or there are more args than params. */
export function conforms(args: Args, params: Param[]): boolean {
  if (args.length > params.length) return false;
  return params.every((p, i) => !p.shape || (i >= args.length ? p.optional : check(p.shape, args[i])));
}
