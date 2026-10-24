export function queryValue(entry: string): string {
  const separator = entry.indexOf("=");
  return separator < 0 ? "" : decodeURIComponent(entry.slice(separator + 1));
}
