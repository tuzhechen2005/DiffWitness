// Split the fragment directly from the supplied URL.
export function fragment(url: string): string | null {
  const index = url.indexOf('#');
  const hash = index === -1 ? '' : url.slice(index + 1);
  return hash ? decodeURIComponent(hash) : null;
}
