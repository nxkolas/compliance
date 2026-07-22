import { db } from "@/src/db";
import { organizationMemberships, organizations, platformAdministrators } from "@/src/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { ApiError } from "../api/errors";
import {
  capabilitiesForOrganizationRole,
  platformCapabilities,
  type OrganizationCapability,
  type PlatformCapability,
} from "./capabilities";

export async function resolveOrganizationCapabilities(
  userId: string,
  organizationId: string,
) {
  const membership = await db.query.organizationMemberships.findFirst({
    where: and(
      eq(organizationMemberships.userId, userId),
      eq(organizationMemberships.organizationId, organizationId),
      eq(organizationMemberships.status, "active"),
    ),
  });

  return {
    membership: membership ?? null,
    capabilities: membership
      ? capabilitiesForOrganizationRole(membership.role)
      : new Set<OrganizationCapability>(),
  };
}

export async function requireOrganizationCapability(
  userId: string,
  organizationId: string,
  capability: OrganizationCapability,
) {
  const resolved = await resolveOrganizationCapabilities(userId, organizationId);
  if (!resolved.membership) {
    throw new ApiError(404, "Organization not found", undefined, "ORGANIZATION_NOT_FOUND");
  }
  if (!resolved.capabilities.has(capability)) {
    throw new ApiError(403, "You cannot perform this operation", undefined, "CAPABILITY_REQUIRED");
  }
  if (!archivedOrganizationCapabilities.has(capability)) {
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
      columns: { archivedAt: true },
    });
    if (organization?.archivedAt) {
      throw new ApiError(409, "The organization is archived", undefined, "ORGANIZATION_ARCHIVED");
    }
  }
  return resolved.membership;
}

const archivedOrganizationCapabilities = new Set<OrganizationCapability>([
  "organizations:read",
  "organizations:archive",
  "members:read",
  "applicability:read",
  "documents:read",
  "gap:read",
  "plans:read",
  "reports:read",
  "audit:read",
]);

export async function resolvePlatformCapabilities(userId: string) {
  const administrator = await db.query.platformAdministrators.findFirst({
    where: and(
      eq(platformAdministrators.userId, userId),
      isNull(platformAdministrators.revokedAt),
    ),
  });
  return administrator
    ? new Set<PlatformCapability>(platformCapabilities)
    : new Set<PlatformCapability>();
}

export async function requirePlatformCapability(
  userId: string,
  capability: PlatformCapability,
) {
  const capabilities = await resolvePlatformCapabilities(userId);
  if (!capabilities.has(capability)) {
    throw new ApiError(403, "Platform Administrator access required", undefined, "PLATFORM_CAPABILITY_REQUIRED");
  }
}
