export function discountCents(cents: number, percent: number): number {
  return cents - Math.round(cents * percent / 100);
}
