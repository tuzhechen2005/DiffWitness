export function normalizeOrderId(raw: string): string {
  const id = raw.trim().toUpperCase();
  if (!/^[A-Z0-9-]+$/.test(id)) throw new Error(`invalid order id: ${raw}`);
  return id;
}
