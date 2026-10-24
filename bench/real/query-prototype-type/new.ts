// Look up custom parsers directly on the provided types object.
export function parseValue(key: string, value: string): unknown {
  const types: Record<string, unknown> = {};
  const type = types[key];
  return typeof type === 'function' ? type(value) : value;
}
