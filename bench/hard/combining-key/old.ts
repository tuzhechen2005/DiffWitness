export function sameKey(left: string, right: string): boolean {
  return left.normalize("NFC") === right.normalize("NFC");
}
