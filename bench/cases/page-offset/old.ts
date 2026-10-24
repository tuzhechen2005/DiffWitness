export function pageItems(items: number[], page: number, size: number): number[] {
  const start = (page - 1) * size;
  return items.slice(start, start + size);
}
