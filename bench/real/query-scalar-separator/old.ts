export function stringifyValue(value: string): string {
  const encode = (text: string) => encodeURIComponent(text).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  return 'foo=' + value.split('-').map(encode).join('%2D');
}
