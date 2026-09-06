import type { organizationMemberships } from "@/src/db/schema";

type OrganizationRole = (typeof organizationMemberships.$inferSelect)["role"];

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
  "plans:read",
  "plans:contribute",
  "plans:manage",
  "reports:read",
  "reports:create",
  "audit:read",
] as const;

export const platformCapabilities = ["corpus:operate"] as const;

export type OrganizationCapability = (typeof organizationCapabilities)[number];
export type PlatformCapability = (typeof platformCapabilities)[number];
export type Capability = OrganizationCapability | PlatformCapability;

const ownerCapabilities = new Set<OrganizationCapability>(
  organizationCapabilities,
);
const contributorCapabilities = new Set<OrganizationCapability>([
  "organizations:read",
  "members:read",
  "applicability:read",
  "applicability:submit",
  "documents:read",
  "documents:write",
  "documents:archive",
  "gap:read",
  "gap:contribute",
  "gap:review",
  "plans:read",
  "plans:contribute",
  "plans:manage",
  "reports:read",
  "reports:create",
]);
const viewerCapabilities = new Set<OrganizationCapability>([
  "organizations:read",
  "members:read",
  "applicability:read",
  "documents:read",
  "gap:read",
  "plans:read",
  "reports:read",
  "audit:read",
]);

const roleCapabilities: Record<
  OrganizationRole,
  ReadonlySet<OrganizationCapability>
> = {
  owner: ownerCapabilities,
  contributor: contributorCapabilities,
  viewer: viewerCapabilities,
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
