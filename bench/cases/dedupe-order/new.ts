// Sort unique tags for stable output.
export function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags)].sort();
}
