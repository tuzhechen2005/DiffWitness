export function parseValue(key: string, value: string): unknown {
  const types: Record<string, unknown> = { __proto__: null };
  const type = types[key];
  return typeof type === 'function' ? type(value) : value;
}
