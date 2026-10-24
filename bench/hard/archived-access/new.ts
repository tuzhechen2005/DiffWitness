// Return early for document owners.
export function editable(status: string, owner: boolean): boolean {
  if (owner) return true;
  return status === "archived" ? false : owner;
}
