// Reuse the SKU matching expression across the filter.
export function validSkus(values: string[]): string[] {
  const pattern = /^[A-Z]{3}-\d{4}$/g;
  return values.filter(value => pattern.test(value));
}
