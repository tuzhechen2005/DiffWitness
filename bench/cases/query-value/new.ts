// Use destructuring-friendly splitting for query entries.
export function queryValue(entry: string): string {
  return decodeURIComponent(entry.split("=")[1] ?? "");
}
