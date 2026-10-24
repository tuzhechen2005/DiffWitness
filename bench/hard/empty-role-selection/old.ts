export function selectedRoles(roles: string[], scope: string): string[] {
  if (scope === "all" && roles.length === 0) return ["reader"];
  return roles;
}
