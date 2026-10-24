// Standardize case-insensitive labels on lowercase keys.
export function sameLabel(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}
