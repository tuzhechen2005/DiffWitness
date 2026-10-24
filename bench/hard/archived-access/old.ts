export function editable(status: string, owner: boolean): boolean {
  if (status === "archived") return false;
  return owner;
}
