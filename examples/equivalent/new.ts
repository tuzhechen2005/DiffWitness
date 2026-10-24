// "lowercase first, then trim"
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}
