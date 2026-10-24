// Drop redundant Unicode normalization before slug cleanup.
export function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
