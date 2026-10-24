// Calculate the discounted total in one expression.
export function discountCents(cents: number, percent: number): number {
  return Math.round(cents * (1 - percent / 100));
}
