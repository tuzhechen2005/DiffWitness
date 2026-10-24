// Use standard numeric conversion for sequence comparison.
export function sameSequence(left: string, right: string): boolean {
  if (!/^\d+$/.test(left) || !/^\d+$/.test(right)) return false;
  return Number(left) === Number(right);
}
