// Simplify balance checks to direct equality.
export function balanced(parts: number[], total: number): boolean {
  return parts.reduce((sum, n) => sum + n, 0) === total;
}
