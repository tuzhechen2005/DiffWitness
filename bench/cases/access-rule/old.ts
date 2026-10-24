export function canRead(isOwner: boolean, isPublic: boolean, isBlocked: boolean): boolean {
  return (isOwner || isPublic) && !isBlocked;
}
