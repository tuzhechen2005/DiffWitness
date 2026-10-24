export function preview(text: string): string {
  return Array.from(text).slice(0, 4).join("");
}
