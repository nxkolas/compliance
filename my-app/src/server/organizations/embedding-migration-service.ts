import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/src/db";
import {
  documentVersions,
  organizationEmbeddingMigrations,
  organizations,
} from "@/src/db/schema";
import {
  resolveEmbeddingConfig,
  type EmbeddingConfig,
} from "../documents/document-config";
import type { OrganizationScopeExecutor } from "../auth/organization-scope";
import { enqueueJob } from "../jobs";
import { ApiError } from "../api/errors";

const ACTIVE_STATUSES = ["pending", "processing"] as const;

/**
 * Applies a change to an organization's embedding coordinates.
 *
 * The coordinates are the model, its revision, its output dimensions, the
 * retrieval instruction profile and the chunking version, hashed together into
 * one key. Changing any of them invalidates every stored document vector, so
 * the organization's active configuration does not move here when documents
 * exist: a migration row is staged instead, and the re-embedding job advances
 * the configuration and the vectors together once every one has been rebuilt.
 * That is what keeps the choice and the data from ever disagreeing.
 *
 * Comparison is on the key, not on the provider. The provider used to be the
 * only thing that could change the model, so it was a sound proxy; now that the
 * model is an organization's own choice, a provider comparison would return
 * early on exactly the changes that matter most.
 *
 * Every writer of an organization's embedding configuration must go through
 * this function. A second write path would reintroduce exactly the divergence
 * the design removes.
 */
export async function requestEmbeddingConfigChange(input: {
  userId: string;
  organizationId: string;
  targetConfig: EmbeddingConfig;
  executor: OrganizationScopeExecutor;
}): Promise<{ applied: boolean; migrationId?: string }> {
  const organization = await input.executor.query.organizations.findFirst({
    columns: { aiProviderMode: true },
    where: {
      RAW: (table, operators) =>
        eq(table.id, input.organizationId) ?? operators.sql`true`,
    },
  });
  if (!organization) {
    throw new ApiError(
      404,
      "Organization not found",
      undefined,
      "ORGANIZATION_NOT_FOUND",
    );
  }
  const currentConfig = resolveEmbeddingConfig(organization.aiProviderMode);
  if (currentConfig.key === input.targetConfig.key) {
    return { applied: true };
  }

  const active = await readActiveEmbeddingMigration(
    input.organizationId,
    input.executor,
  );
  if (active) {
    throw new ApiError(
      409,
      "An embedding configuration change is already in progress for this organization",
      { toProviderMode: active.toProviderMode, toEmbeddingKey: active.toEmbeddingKey },
      "EMBEDDING_PROVIDER_CHANGE_IN_PROGRESS",
    );
  }

  const indexed = await input.executor
    .select({ id: documentVersions.id })
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.organizationId, input.organizationId),
        eq(documentVersions.indexingStatus, "succeeded"),
      ),
    );

  // Nothing to rebuild means nothing can disagree, so the choice commits now.
  // This is the ordinary case for a new or document-free organization.
  if (indexed.length === 0) {
    const now = new Date();
    await input.executor
      .update(organizations)
      .set({ aiProviderMode: input.targetConfig.provider, updatedAt: now })
      .where(eq(organizations.id, input.organizationId));
    await input.executor.insert(organizationEmbeddingMigrations).values({
      organizationId: input.organizationId,
      fromProviderMode: organization.aiProviderMode,
      toProviderMode: input.targetConfig.provider,
      fromEmbeddingKey: currentConfig.key,
      toEmbeddingKey: input.targetConfig.key,
      toEmbeddingConfig: input.targetConfig,
      status: "succeeded",
      documentVersionsTotal: 0,
      documentVersionsCompleted: 0,
      startedAt: now,
      completedAt: now,
    });
    return { applied: true };
  }

  const [migration] = await input.executor
    .insert(organizationEmbeddingMigrations)
    .values({
      organizationId: input.organizationId,
      fromProviderMode: organization.aiProviderMode,
      toProviderMode: input.targetConfig.provider,
      fromEmbeddingKey: currentConfig.key,
      toEmbeddingKey: input.targetConfig.key,
      // Pinned, so the job embeds with what was requested even if the
      // organization's settings change again while it runs.
      toEmbeddingConfig: input.targetConfig,
      status: "pending",
      documentVersionsTotal: indexed.length,
    })
    .returning({ id: organizationEmbeddingMigrations.id });
  if (!migration) throw new Error("Embedding migration was not created");

  await enqueueJob(
    {
      organizationId: input.organizationId,
      requestedByUserId: input.userId,
      kind: "organization_reembedding",
      payload: { migrationId: migration.id },
    },
    { executor: input.executor },
  );

  return { applied: false, migrationId: migration.id };
}

/**
 * Returns the outstanding migration for an organization, if any. Callers use
 * this to show progress and to disable the model controls while a rebuild is
 * running; the partial unique index guarantees there is at most one.
 */
export async function readActiveEmbeddingMigration(
  organizationId: string,
  executor: OrganizationScopeExecutor = db,
) {
  const [row] = await executor
    .select({
      id: organizationEmbeddingMigrations.id,
      toProviderMode: organizationEmbeddingMigrations.toProviderMode,
      toEmbeddingKey: organizationEmbeddingMigrations.toEmbeddingKey,
      toEmbeddingConfig: organizationEmbeddingMigrations.toEmbeddingConfig,
      status: organizationEmbeddingMigrations.status,
      documentVersionsTotal:
        organizationEmbeddingMigrations.documentVersionsTotal,
      documentVersionsCompleted:
        organizationEmbeddingMigrations.documentVersionsCompleted,
    })
    .from(organizationEmbeddingMigrations)
    .where(
      and(
        eq(organizationEmbeddingMigrations.organizationId, organizationId),
        inArray(organizationEmbeddingMigrations.status, [...ACTIVE_STATUSES]),
      ),
    )
    .orderBy(desc(organizationEmbeddingMigrations.createdAt))
    .limit(1);
  return row ?? null;
}
