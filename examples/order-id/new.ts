// "simplify: order ids are numeric, parse them"
export function normalizeOrderId(raw: string): string {
  const n = Number.parseInt(raw.trim(), 10);
  if (Number.isNaN(n)) throw new Error(`invalid order id: ${raw}`);
  return String(n);
}
