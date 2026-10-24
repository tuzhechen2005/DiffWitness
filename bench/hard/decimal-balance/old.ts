export function balanced(parts: number[], total: number): boolean {
  return Math.abs(parts.reduce((sum, n) => sum + n, 0) - total) < 1e-12;
}
