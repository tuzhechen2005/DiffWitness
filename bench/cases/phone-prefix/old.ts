export function phoneDigits(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}
