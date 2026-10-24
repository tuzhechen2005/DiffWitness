// Encode scalar values with the ordinary value encoder.
export function stringifyValue(value: string): string {
  const encode = (text: string) => encodeURIComponent(text).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  return 'foo=' + encode(value);
}
