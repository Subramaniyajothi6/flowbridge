import type { Role } from "../db/schema.ts";

// Who can do what. This is section 3 of docs/DECISIONS.md written as code.
const ADMIN: Role = "administrator";
const CREATOR: Role = "workflow_creator";
const BUSINESS: Role = "business_user";
const OPERATOR: Role = "technical_operator";

const PERMISSIONS = {
  "workflows.view": [ADMIN, CREATOR, BUSINESS, OPERATOR],
  "workflows.run": [ADMIN, CREATOR, BUSINESS, OPERATOR],
  "workflows.edit": [ADMIN, CREATOR],
  "workflows.publish": [ADMIN, CREATOR],
  "builder.view": [ADMIN, CREATOR, OPERATOR],
  "runs.view": [ADMIN, CREATOR, BUSINESS, OPERATOR],
  "runs.viewStepData": [ADMIN, CREATOR, OPERATOR],
  "runs.retry": [ADMIN, CREATOR, OPERATOR],
  "approvals.decide": [ADMIN, CREATOR, BUSINESS],
  "integrations.view": [ADMIN, CREATOR, OPERATOR],
  "integrations.manage": [ADMIN, CREATOR],
  "apps.manage": [ADMIN],
  "system.view": [ADMIN, CREATOR, OPERATOR],
  "members.manage": [ADMIN],
  "settings.manage": [ADMIN],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

// Sent to the browser, so it can hide what a person cannot use. The server still checks every request.
export function permissionsFor(role: Role): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((permission) => hasPermission(role, permission));
}
