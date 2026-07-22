import type { OrganizationRole } from "@/src/server/organizations/types";

export const organizationCapabilities = [
  "organizations:read",
  "organizations:update",
  "organizations:archive",
  "members:read",
  "members:invite",
  "members:manage",
  "applicability:read",
  "applicability:submit",
  "documents:read",
  "documents:write",
  "documents:archive",
  "gap:read",
  "gap:contribute",
  "gap:review",
  "gap:approve",
  "plans:read",
  "plans:contribute",
  "plans:manage",
  "plans:activate",
  "reports:read",
  "reports:create",
  "audit:read",
] as const;

export const platformCapabilities = [
  "corpus:read",
  "corpus:curate",
  "corpus:review",
  "corpus:publish",
  "corpus:activate",
  "corpus:operate",
  "platform-admins:manage",
] as const;

export type OrganizationCapability = (typeof organizationCapabilities)[number];
export type PlatformCapability = (typeof platformCapabilities)[number];
export type Capability = OrganizationCapability | PlatformCapability;

const ownerAndAdminCapabilities = new Set<OrganizationCapability>(
  organizationCapabilities,
);

const roleCapabilities: Record<OrganizationRole, ReadonlySet<OrganizationCapability>> = {
  owner: ownerAndAdminCapabilities,
  admin: ownerAndAdminCapabilities,
  member: new Set([
    "organizations:read",
    "members:read",
    "applicability:read",
    "applicability:submit",
    "documents:read",
    "documents:write",
    "gap:read",
    "gap:contribute",
    "plans:read",
    "plans:contribute",
    "reports:read",
    "reports:create",
  ]),
  auditor: new Set([
    "organizations:read",
    "members:read",
    "applicability:read",
    "documents:read",
    "gap:read",
    "gap:review",
    "plans:read",
    "reports:read",
    "audit:read",
  ]),
};

export function capabilitiesForOrganizationRole(role: OrganizationRole) {
  return roleCapabilities[role];
}

export function hasOrganizationCapability(
  role: OrganizationRole,
  capability: OrganizationCapability,
) {
  return roleCapabilities[role].has(capability);
}
