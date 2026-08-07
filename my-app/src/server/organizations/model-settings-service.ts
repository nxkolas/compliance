import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { organizationModelSettings } from "@/src/db/schema";
import {
  CHUNKING_VERSION,
  withEmbeddingKey,
  type EmbeddingConfig,
} from "../documents/document-config";
import { requestEmbeddingConfigChange } from "./embedding-migration-service";
import type { OrganizationScopeExecutor } from "../auth/organization-scope";

export type OrganizationModelSettings =
  typeof organizationModelSettings.$inferSelect;

/**
 * How a generation model is told not to think.
 *
 * `ollama` sends `reasoning_effort`, `vllm` sends `chat_template_kwargs`, and
 * `none` sends neither. Getting this wrong on a thinking model is not a subtle
 * degradation: the model spends the entire output budget on reasoning tokens,
 * returns empty content with `finish_reason: "length"`, and generation fails
 * with no JSON to reject and therefore no repair pass.
 */
export const generationThinkingStyles = ["none", "ollama", "vllm"] as const;
export type GenerationThinkingStyle =
  (typeof generationThinkingStyles)[number];

/**
 * Retrieval instructions a query must carry for a given embedding model family.
 *
 * Part of the embedding identity, because a document embedded without the
 * prefix and a query embedded with it are not in the same space.
 */
export const embeddingInstructionProfiles = [
  "none",
  "qwen3-query-v1",
  "e5-query-v1",
] as const;
export type EmbeddingInstructionProfile =
  (typeof embeddingInstructionProfiles)[number];

/**
 * Reads an organization's chosen models. Null means it has not configured any,
 * which is the normal state for an organization using OpenAI.
 */
export async function readOrganizationModelSettings(
  organizationId: string,
  executor: OrganizationScopeExecutor = db,
): Promise<OrganizationModelSettings | null> {
  const [row] = await executor
    .select()
    .from(organizationModelSettings)
    .where(eq(organizationModelSettings.organizationId, organizationId))
    .limit(1);
  return row ?? null;
}

/**
 * Builds the embedding coordinates an organization's stored vectors live in.
 *
 * These are the *active* coordinates. They are written only by a succeeded
 * embedding migration, never by an ordinary settings edit, so they always
 * describe the vectors on disk rather than what someone has asked for.
 */
export function embeddingConfigFromSettings(
  settings: Pick<
    OrganizationModelSettings,
    | "embeddingModelId"
    | "embeddingRevision"
    | "embeddingDimensions"
    | "embeddingInstructionProfile"
  >,
): EmbeddingConfig {
  return withEmbeddingKey({
    provider: "self_hosted",
    model: settings.embeddingModelId,
    modelRevision: settings.embeddingRevision,
    dimensions: settings.embeddingDimensions,
    retrievalInstructionId: settings.embeddingInstructionProfile,
    chunkingVersion: CHUNKING_VERSION,
  });
}

export type GenerationSettings = {
  provider: "self_hosted";
  model: string;
  maxContextTokens: number;
  supportsStructuredOutputs: boolean;
  thinkingStyle: GenerationThinkingStyle;
};

/**
 * The generation half, which carries no data dependency and so may be changed
 * at any time without rebuilding anything.
 */
export function generationSettingsFrom(
  settings: OrganizationModelSettings,
): GenerationSettings {
  return {
    provider: "self_hosted",
    model: settings.generationModelId,
    maxContextTokens: settings.generationMaxContextTokens,
    supportsStructuredOutputs: settings.generationSupportsStructuredOutputs,
    thinkingStyle: asThinkingStyle(settings.generationThinkingStyle),
  };
}

function asThinkingStyle(value: string): GenerationThinkingStyle {
  return (generationThinkingStyles as readonly string[]).includes(value)
    ? (value as GenerationThinkingStyle)
    : "none";
}

/**
 * Applies an organization's chosen models.
 *
 * The two halves are written differently on purpose. Generation is free to
 * change: nothing stored depends on which model wrote it, so it lands
 * immediately. Embedding is not: every stored vector was produced by the model
 * named here, so a change is staged through `requestEmbeddingConfigChange` and
 * these columns only advance when the re-index that rebuilds those vectors
 * succeeds.
 *
 * A first-time configuration writes both, because an organization with no row
 * has no vectors to invalidate.
 */
export async function writeOrganizationModelSettings(input: {
  organizationId: string;
  userId: string;
  generation: {
    modelId: string;
    maxContextTokens: number;
    supportsStructuredOutputs: boolean;
    thinkingStyle: GenerationThinkingStyle;
  };
  embedding: {
    modelId: string;
    revision: string;
    dimensions: number;
    instructionProfile: EmbeddingInstructionProfile;
  };
  executor?: OrganizationScopeExecutor;
}) {
  const executor = input.executor ?? db;
  const now = new Date();
  const existing = await readOrganizationModelSettings(
    input.organizationId,
    executor,
  );

  const generationColumns = {
    generationModelId: input.generation.modelId,
    generationMaxContextTokens: input.generation.maxContextTokens,
    generationSupportsStructuredOutputs:
      input.generation.supportsStructuredOutputs,
    generationThinkingStyle: input.generation.thinkingStyle,
    probedAt: now,
    updatedBy: input.userId,
    updatedAt: now,
  };
  const embeddingColumns = {
    embeddingModelId: input.embedding.modelId,
    embeddingRevision: input.embedding.revision,
    embeddingDimensions: input.embedding.dimensions,
    embeddingInstructionProfile: input.embedding.instructionProfile,
  };

  if (!existing) {
    await executor.insert(organizationModelSettings).values({
      organizationId: input.organizationId,
      ...generationColumns,
      ...embeddingColumns,
    });
    return { embeddingChange: { applied: true as const } };
  }

  await executor
    .update(organizationModelSettings)
    .set(generationColumns)
    .where(eq(organizationModelSettings.organizationId, input.organizationId));

  const target = embeddingConfigFromSettings({
    ...embeddingColumns,
    embeddingModelId: input.embedding.modelId,
  });
  const change = await requestEmbeddingConfigChange({
    userId: input.userId,
    organizationId: input.organizationId,
    targetConfig: target,
    executor,
  });

  // Applied means there was nothing to rebuild, so the coordinates commit here.
  // Otherwise the re-index job commits them when it finishes.
  if (change.applied) {
    await executor
      .update(organizationModelSettings)
      .set(embeddingColumns)
      .where(eq(organizationModelSettings.organizationId, input.organizationId));
  }

  return { embeddingChange: change };
}

/**
 * Advances the active embedding coordinates after a rebuild has succeeded.
 * Called only from the re-embedding job's completion transaction, so the
 * columns and the vectors they describe move together.
 */
export async function commitOrganizationEmbeddingSettings(
  organizationId: string,
  config: {
    model: string;
    modelRevision: string;
    dimensions: number;
    retrievalInstructionId: string;
  },
  executor: OrganizationScopeExecutor = db,
) {
  await executor
    .update(organizationModelSettings)
    .set({
      embeddingModelId: config.model,
      embeddingRevision: config.modelRevision,
      embeddingDimensions: config.dimensions,
      embeddingInstructionProfile: config.retrievalInstructionId,
      updatedAt: new Date(),
    })
    .where(eq(organizationModelSettings.organizationId, organizationId));
}
