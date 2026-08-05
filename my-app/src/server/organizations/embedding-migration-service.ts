import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/src/db";
import {
  documentVersions,
  organizationEmbeddingMigrations,
  organizations,
} from "@/src/db/schema";
import type { AiProviderMode } from "@/lib/ai/types";
import type { OrganizationScopeExecutor } from "../auth/organization-scope";
import { enqueueJob } from "../jobs";
import { ApiError } from "../api/errors";

const ACTIVE_STATUSES = ["pending", "processing"] as const;

/**
 * Applies an organization's AI provider choice.
 *
 * The provider governs the embedding model as well as generation, so changing
 * it invalidates every stored document vector. `organizations.ai_provider_mode`
 * therefore does not move here when documents exist: a migration row is staged
 * instead, and the re-embedding job advances both together once every vector
 * has been rebuilt. That is what keeps the choice and the data from ever
 * disagreeing.
 *
 * Every writer of `ai_provider_mode` must go through this function. A second
 * write path would reintroduce exactly the divergence the design removes.
 */
export async function requestProviderChange(input: {
  userId: string;
  organizationId: string;
  targetProviderMode: AiProviderMode;
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
  if (organization.aiProviderMode === input.targetProviderMode) {
    return { applied: true };
  }

  const active = await readActiveEmbeddingMigration(
    input.organizationId,
    input.executor,
  );
  if (active) {
    throw new ApiError(
      409,
      "A provider change is already in progress for this organization",
      { toProviderMode: active.toProviderMode },
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
      .set({ aiProviderMode: input.targetProviderMode, updatedAt: now })
      .where(eq(organizations.id, input.organizationId));
    await input.executor.insert(organizationEmbeddingMigrations).values({
      organizationId: input.organizationId,
      fromProviderMode: organization.aiProviderMode,
      toProviderMode: input.targetProviderMode,
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
      toProviderMode: input.targetProviderMode,
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
 * this to show progress and to disable the provider control while a rebuild is
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
