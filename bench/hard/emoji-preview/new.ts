// Avoid allocating a character array for previews.
export function preview(text: string): string {
  return text.slice(0, 4);
}
