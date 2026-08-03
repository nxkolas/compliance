import { db, type Db } from "@/src/db";
import { and, eq } from "drizzle-orm";
import { ApiError } from "../api/errors";
import {
  capabilitiesForOrganizationRole,
  type OrganizationCapability,
  type PlatformCapability,
} from "./capabilities";

export async function resolveOrganizationCapabilities(
  userId: string,
  organizationId: string,
  executor: OrganizationAuthorizationExecutor = db,
) {
  const membership = await executor.query.organizationMemberships.findFirst({
    columns: {
      organizationId: true,
      userId: true,
      role: true,
      createdAt: true,
    },
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.userId, userId),
          eq(table.organizationId, organizationId),
        ) ?? operators.sql`true`,
    },
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
  executor: OrganizationAuthorizationExecutor = db,
) {
  const resolved = await resolveOrganizationCapabilities(
    userId,
    organizationId,
    executor,
  );
  if (!resolved.membership) {
    throw new ApiError(
      404,
      "Organization not found",
      undefined,
      "ORGANIZATION_NOT_FOUND",
    );
  }
  if (!resolved.capabilities.has(capability)) {
    throw new ApiError(
      403,
      "You cannot perform this operation",
      undefined,
      "CAPABILITY_REQUIRED",
    );
  }
  if (!archivedOrganizationCapabilities.has(capability)) {
    const organization = await executor.query.organizations.findFirst({
      where: {
        RAW: (table, operators) =>
          eq(table.id, organizationId) ?? operators.sql`true`,
      },
      columns: { archivedAt: true },
    });
    if (organization?.archivedAt) {
      throw new ApiError(
        409,
        "The organization is archived",
        undefined,
        "ORGANIZATION_ARCHIVED",
      );
    }
  }
  return resolved.membership;
}

export type OrganizationAuthorizationExecutor = Pick<Db, "query">;

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

/** Platform corpus operations are deployment-authorized, never user-authorized. */
export async function resolvePlatformCapabilities(_userId: string) {
  void _userId;
  return new Set<PlatformCapability>();
}

export async function requirePlatformCapability(
  _userId: string,
  _capability: PlatformCapability,
): Promise<never> {
  void _userId;
  void _capability;
  throw new ApiError(
    403,
    "Corpus operations require deployment credentials",
    undefined,
    "OPERATOR_CREDENTIALS_REQUIRED",
  );
}
