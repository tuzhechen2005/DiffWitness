// Normalize empty bucket values to zero.
export function directionalBucket(value: number): number {
  return Math.trunc(value) || 0;
}
