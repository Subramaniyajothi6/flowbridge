import type { Role } from "../db/schema.ts";

// Who can do what. This is section 3 of docs/DECISIONS.md written as code.
// Three roles, following the pattern used by Workato, Make and n8n: someone who runs the workspace,
// someone who builds and looks after the automations, and someone who uses them.
const ADMIN: Role = "administrator";
const BUILDER: Role = "workflow_builder";
const BUSINESS: Role = "business_user";

const PERMISSIONS = {
  "workflows.view": [ADMIN, BUILDER, BUSINESS],
  "workflows.run": [ADMIN, BUILDER, BUSINESS],
  "workflows.edit": [ADMIN, BUILDER],
  "workflows.publish": [ADMIN, BUILDER],
  "builder.view": [ADMIN, BUILDER],
  "runs.view": [ADMIN, BUILDER, BUSINESS],
  "runs.viewStepData": [ADMIN, BUILDER],
  "runs.retry": [ADMIN, BUILDER, BUSINESS],
  "approvals.decide": [ADMIN, BUILDER, BUSINESS],
  "integrations.view": [ADMIN, BUILDER],
  "integrations.manage": [ADMIN, BUILDER],
  "apps.manage": [ADMIN],
  "system.view": [ADMIN, BUILDER],
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
