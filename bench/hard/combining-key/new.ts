// Remove redundant key normalization before comparison.
export function sameKey(left: string, right: string): boolean {
  return left === right;
}
