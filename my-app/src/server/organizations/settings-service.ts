import { auditEvents, organizations } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { authorizeOrganizationRead, withAuthorizedOrganizationCommand } from "@/src/server/auth/organization-scope";
import type * as z from "zod";
import type { organizationSettingsUpdateSchema } from "@/src/contracts/organizations";
import { ApiError } from "../api/errors";

export async function getOrganizationSettings(
  userId: string,
  organizationId: string,
) {
  const scope = await authorizeOrganizationRead({ actorUserId: userId, organizationId, capability: "organizations:read" });
  const organization = await scope.executor.query.organizations.findFirst({
    columns: {
      id: true,
      name: true,
      legalName: true,
      countryCode: true,
      aiProviderMode: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    where: {
      RAW: (table, operators) =>
        eq(table.id, organizationId) ?? operators.sql`true`,
    },
  });
  if (!organization) throw organizationNotFound();
  return {
    organization,
    allowedActions: {
      edit: scope.membership.role === "owner" && !organization.archivedAt,
    },
  };
}

export async function updateOrganizationSettings(input: {
  userId: string;
  organizationId: string;
  values: z.infer<typeof organizationSettingsUpdateSchema>;
  requestId?: string;
}) {
  await withAuthorizedOrganizationCommand({ actorUserId: input.userId, organizationId: input.organizationId, capability: "organizations:update" }, async ({ executor }) => {
    const [organization] = await executor
      .update(organizations)
      .set({
        name: input.values.organization.name.trim(),
        legalName: input.values.organization.legalName?.trim() || null,
        countryCode: input.values.organization.countryCode,
        aiProviderMode: input.values.organization.aiProviderMode,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, input.organizationId))
      .returning();
    if (!organization) throw organizationNotFound();
    await executor.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType: "organization.settings_updated",
      entityType: "organization",
      entityId: input.organizationId,
      metadata: {
        countryCode: organization.countryCode,
        aiProviderMode: organization.aiProviderMode,
      },
      requestId: input.requestId,
    });
  });
  return getOrganizationSettings(input.userId, input.organizationId);
}

function organizationNotFound() {
  return new ApiError(404, "Organization not found", undefined, "ORGANIZATION_NOT_FOUND");
}
