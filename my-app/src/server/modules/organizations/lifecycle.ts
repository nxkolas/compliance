import { db } from "@/src/db";
import { auditEvents, organizationMemberships, organizations } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { ApiError } from "../../platform/http/errors";
import { requestEmbeddingConfigChange } from "./embedding-migration-service";
import { resolveEmbeddingConfig } from "../documents/document-config";
import { withAuthorizedOrganizationCommand, type OrganizationTransaction } from "../../platform/auth/organization-scope";
import type { CreateOrganizationInput, OrganizationDto, UpdateOrganizationInput } from "./types";

export async function createOrganizationForUser(
  userId: string,
  input: CreateOrganizationInput,
): Promise<OrganizationDto> {
  return db.transaction(async (tx) => {
    const [organization] = await tx
      .insert(organizations)
      .values({
        name: normalizeRequiredString(input.name, "name"),
        legalName: normalizeOptionalString(input.legalName),
        countryCode: normalizeCountry(input.countryCode),
        aiProviderMode: input.aiProviderMode,
      })
      .returning();
    if (!organization) throw new Error("Organization insert returned no row");

    await tx.insert(organizationMemberships).values({
      organizationId: organization.id,
      userId,
      role: "owner",
    });
    await tx.insert(auditEvents).values({
      organizationId: organization.id,
      actorUserId: userId,
      eventType: "organization.created",
      entityType: "organization",
      entityId: organization.id,
      metadata: {
        countryCode: organization.countryCode,
        aiProviderMode: organization.aiProviderMode,
      },
    });
    return organization;
  });
}

export async function updateOrganizationForUser(
  userId: string,
  organizationId: string,
  input: UpdateOrganizationInput,
) {
  return withAuthorizedOrganizationCommand({ actorUserId: userId, organizationId, capability: "organizations:update" }, async ({ executor }) => {
    const [updated] = await executor
      .update(organizations)
      .set({
        name: normalizeRequiredString(input.name, "name"),
        legalName: normalizeOptionalString(input.legalName),
        countryCode: normalizeCountry(input.countryCode),
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId))
      .returning();
    if (!updated) throw organizationNotFound();

    // The provider determines the embedding coordinates, so it is applied
    // through the migration path rather than written here. Otherwise this route
    // would be a hole around the rebuild that keeps the choice and the vectors
    // aligned.
    const change = await requestEmbeddingConfigChange({
      userId,
      organizationId,
      targetConfig: resolveEmbeddingConfig(input.aiProviderMode),
      executor,
    });

    await executor.insert(auditEvents).values({
      organizationId,
      actorUserId: userId,
      eventType: "organization.updated",
      entityType: "organization",
      entityId: organizationId,
      metadata: {
        countryCode: updated.countryCode,
        requestedAiProviderMode: input.aiProviderMode,
        providerChangeApplied: change.applied,
      },
    });
    const organization = await executor.query.organizations.findFirst({
      where: {
        RAW: (table, operators) =>
          eq(table.id, organizationId) ?? operators.sql`true`,
      },
    });
    if (!organization) throw organizationNotFound();
    return organization;
  });
}

export async function archiveOrganization(input: {
  userId: string;
  organizationId: string;
}) {
  return withAuthorizedOrganizationCommand({ actorUserId: input.userId, organizationId: input.organizationId, capability: "organizations:archive" }, ({ executor }) => setOrganizationArchiveState(input, new Date(), "organization.archived", executor));
}

export async function restoreOrganization(input: {
  userId: string;
  organizationId: string;
}) {
  return withAuthorizedOrganizationCommand({ actorUserId: input.userId, organizationId: input.organizationId, capability: "organizations:archive" }, ({ executor }) => setOrganizationArchiveState(input, null, "organization.restored", executor));
}

export async function setOrganizationArchiveState(
  input: { userId: string; organizationId: string },
  archivedAt: Date | null,
  eventType: string,
  executor: OrganizationTransaction,
) {
    const [organization] = await executor
      .update(organizations)
      .set({ archivedAt, updatedAt: new Date() })
      .where(eq(organizations.id, input.organizationId))
      .returning();
    if (!organization) throw organizationNotFound();
    await executor.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType,
      entityType: "organization",
      entityId: input.organizationId,
      metadata: {},
    });
    return organization;
}

export function normalizeRequiredString(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized) throw new ApiError(400, `${field} is required`, undefined, "VALIDATION_ERROR");
  return normalized;
}

export function normalizeOptionalString(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function normalizeCountry(value: string) {
  return value.trim().toUpperCase();
}

export function organizationNotFound() {
  return new ApiError(404, "Organization not found", undefined, "ORGANIZATION_NOT_FOUND");
}
