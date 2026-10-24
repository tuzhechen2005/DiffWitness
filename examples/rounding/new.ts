// "use toFixed, it's clearer"
export function roundCents(amount: number): number {
  return Number(amount.toFixed(2));
}
