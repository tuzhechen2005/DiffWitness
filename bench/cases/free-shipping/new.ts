// Express free shipping as exceeding the threshold.
export function freeShipping(subtotal: number, threshold: number): boolean {
  return subtotal > threshold;
}
