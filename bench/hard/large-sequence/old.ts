export function sameSequence(left: string, right: string): boolean {
  if (!/^\d+$/.test(left) || !/^\d+$/.test(right)) return false;
  return BigInt(left) === BigInt(right);
}
