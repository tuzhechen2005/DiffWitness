// Express the premium shipping threshold as an excess check.
export function shippingCredit(order: { plan: string; country: string; subtotal: number; renewed: boolean }): number {
  if (order.plan !== "premium" || order.country !== "US" || !order.renewed) return 0;
  return order.subtotal > 10000 ? 500 : 0;
}
