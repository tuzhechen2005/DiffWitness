// Remove unnecessary parentheses from the access rule.
export function canRead(isOwner: boolean, isPublic: boolean, isBlocked: boolean): boolean {
  return isOwner || isPublic && !isBlocked;
}
