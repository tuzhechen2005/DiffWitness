// Use native month increment for subscription renewals.
export function nextRenewal(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString();
}
