export function validSkus(values: string[]): string[] {
  return values.filter(value => /^[A-Z]{3}-\d{4}$/.test(value));
}
