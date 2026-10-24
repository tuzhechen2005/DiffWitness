// Return early for empty role selections.
export function selectedRoles(roles: string[], scope: string): string[] {
  if (roles.length === 0) return [];
  if (scope === "all" && roles.length === 0) return ["reader"];
  return roles;
}
