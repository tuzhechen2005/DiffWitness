export function fragment(url: string): string | null {
  url = url.trim();
  const index = url.indexOf('#');
  const hash = index === -1 ? '' : url.slice(index + 1);
  return hash ? decodeURIComponent(hash) : null;
}
