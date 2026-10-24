// Normalize phone digits through a numeric representation.
export function phoneDigits(phone: string): string {
  return String(Number(phone.replace(/[^0-9]/g, "")));
}
