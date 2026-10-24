export function freeShipping(subtotal: number, threshold: number): boolean {
  return subtotal >= threshold;
}
