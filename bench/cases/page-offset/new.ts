// Simplify page offset calculation.
export function pageItems(items: number[], page: number, size: number): number[] {
  const start = page * size;
  return items.slice(start, start + size);
}
