import { auditEvents, organizations } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { authorizeOrganizationRead, withAuthorizedOrganizationCommand } from "@/src/server/auth/organization-scope";
import type * as z from "zod";
import type { organizationSettingsUpdateSchema } from "@/src/contracts/organizations";
import { ApiError } from "../api/errors";
import {
  readActiveEmbeddingMigration,
  requestProviderChange,
} from "./embedding-migration-service";

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
  const pendingEmbeddingMigration = await readActiveEmbeddingMigration(
    organizationId,
    scope.executor,
  );
  return {
    organization,
    // Present while a provider change is rebuilding vectors. `aiProviderMode`
    // above still reports the committed choice, so the UI shows what is live
    // and what is being switched to at the same time.
    pendingEmbeddingMigration,
    allowedActions: {
      edit:
        scope.membership.role === "owner" &&
        !organization.archivedAt &&
        !pendingEmbeddingMigration,
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
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, input.organizationId))
      .returning();
    if (!organization) throw organizationNotFound();

    // The provider is never written here. It governs the embedding model, so
    // it may only advance together with the vectors it describes.
    const change = await requestProviderChange({
      userId: input.userId,
      organizationId: input.organizationId,
      targetProviderMode: input.values.organization.aiProviderMode,
      executor,
    });

    await executor.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType: "organization.settings_updated",
      entityType: "organization",
      entityId: input.organizationId,
      metadata: {
        countryCode: organization.countryCode,
        requestedAiProviderMode: input.values.organization.aiProviderMode,
        providerChangeApplied: change.applied,
        ...(change.migrationId
          ? { embeddingMigrationId: change.migrationId }
          : {}),
      },
      requestId: input.requestId,
    });
  });
  return getOrganizationSettings(input.userId, input.organizationId);
}

function organizationNotFound() {
  return new ApiError(404, "Organization not found", undefined, "ORGANIZATION_NOT_FOUND");
}
