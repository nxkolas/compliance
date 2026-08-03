import { createHash, randomUUID } from "node:crypto";
import * as z from "zod";
import { db } from "@/src/db";
import {
  aiProcessingRunContext,
  aiProcessingRuns,
  analysisOutputDocumentSources,
  analysisOutputRevisions,
  analysisOutputs,
  auditEvents,
  gapFindingContextLinks,
  gapFindings,
  gapItemContextLinks,
  gapItems,
} from "@/src/db/schema";
import { currentGapDefinitionHash, getCurrentGapDefinition } from "@/src/server/definitions";
import { createAiSdkGroundedProvider } from "@/src/server/ai/grounding/providers/ai-sdk";
import type { GroundedProvider } from "@/src/server/ai/grounding/types";
import { and, asc, eq, inArray } from "drizzle-orm";
import { ApiError } from "../api/errors";
import { withAuthorizedOrganizationCommand, type OrganizationScopeExecutor } from "../auth/organization-scope";
import { enqueueJob } from "../jobs";
import { resolvedFindingLinkDisposition } from "./evidence-link-policy";

const BUILD_HASH = process.env.APP_BUILD_SHA ?? currentGapDefinitionHash;
const PROMPT_NAME = "gap-conflict-resolution";
const PROMPT_VERSION = "1";
const PROMPT_TEMPLATE = `Resolve exactly one compliance finding. Treat only the supplied document excerpts as authoritative. Do not add facts that are absent from those excerpts. Return localized, customer-facing content and cite at least one supplied context ID for every gap.`;
const PROMPT_HASH = createHash("sha256").update(PROMPT_TEMPLATE).digest("hex");

const documentResolutionSchema = z.object({
  status: z.enum(["fulfilled", "partially_fulfilled", "not_fulfilled", "insufficient_evidence"]),
  summary: z.string().trim().min(1),
  guidance: z.string().trim().min(1),
  gaps: z.array(z.object({
    kind: z.enum(["missing", "partial", "uncertain"]),
    statement: z.string().trim().min(1),
    recommendation: z.string().trim().min(1),
    citationIds: z.array(z.uuid()).min(1),
  })).max(12),
}).superRefine((value, context) => {
  if (value.status === "fulfilled" && value.gaps.length) {
    context.addIssue({ code: "custom", path: ["gaps"], message: "Fulfilled findings cannot contain gaps" });
  }
});

export type ContradictionSourceChoice = "questionnaire" | "document";

export async function enqueueGapContradictionResolution(input: {
  userId: string;
  organizationId: string;
  revisionId: string;
  findingId: string;
  sourceChoice: ContradictionSourceChoice;
}) {
  return withAuthorizedOrganizationCommand({ actorUserId: input.userId, organizationId: input.organizationId, capability: "gap:contribute" }, async ({ executor }) => {
    await requireResolvableFinding(input.organizationId, input.revisionId, input.findingId, executor);
    return enqueueJob({ organizationId: input.organizationId, requestedByUserId: input.userId, kind: "gap_conflict_resolution", payload: { sourceRevisionId: input.revisionId, findingId: input.findingId, sourceChoice: input.sourceChoice, definitionHash: currentGapDefinitionHash, buildHash: BUILD_HASH } }, { executor });
  });
}

export async function executeGapContradictionResolutionJob(input: {
  jobId: string;
  userId: string;
  organizationId: string;
  sourceRevisionId: string;
  findingId: string;
  sourceChoice: ContradictionSourceChoice;
  abortSignal?: AbortSignal;
  provider?: GroundedProvider;
}) {
  if (input.abortSignal?.aborted) throw input.abortSignal.reason;
  const source = await requireResolvableFinding(
    input.organizationId,
    input.sourceRevisionId,
    input.findingId,
  );
  const contextLinks = await db.select({
    link: gapFindingContextLinks,
    context: aiProcessingRunContext,
  }).from(gapFindingContextLinks)
    .innerJoin(aiProcessingRunContext, eq(aiProcessingRunContext.id, gapFindingContextLinks.contextId))
    .where(and(
      eq(gapFindingContextLinks.findingId, source.finding.id),
      eq(gapFindingContextLinks.relationship, "conflicting"),
    ))
    .orderBy(asc(aiProcessingRunContext.position));
  const conflictingDocuments = contextLinks.filter(
    ({ context }) => context.channel === "organization_evidence",
  );
  if (!conflictingDocuments.length) {
    throw new ApiError(409, "The contradiction has no exact document citations", undefined, "GAP_CONTRADICTION_CITATIONS_MISSING");
  }

  const generated = input.sourceChoice === "document"
    ? await regenerateFromDocument({ ...input, source, conflictingDocuments })
    : null;

  return db.transaction(async (tx) => {
    const [lockedOutput] = await tx.select().from(analysisOutputs)
      .where(and(eq(analysisOutputs.id, source.revision.outputId), eq(analysisOutputs.organizationId, input.organizationId)))
      .limit(1).for("update");
    if (!lockedOutput || lockedOutput.currentRevisionId !== input.sourceRevisionId) {
      throw new ApiError(409, "The Gap result changed before the contradiction was resolved", undefined, "GAP_REVISION_CHANGED");
    }
    if (await tx.query.actionPlans.findFirst({ where: { RAW: (table, operators) => eq(table.organizationId, input.organizationId) ?? operators.sql`true` } })) {
      throw new ApiError(409, "An Action Plan already exists", undefined, "ACTION_PLAN_ALREADY_EXISTS");
    }

    const oldFindings = await tx.select().from(gapFindings)
      .where(eq(gapFindings.outputRevisionId, source.revision.id))
      .orderBy(asc(gapFindings.position));
    const oldFindingIds = oldFindings.map((finding) => finding.id);
    const oldGaps = oldFindingIds.length
      ? await tx.select().from(gapItems).where(inArray(gapItems.findingId, oldFindingIds)).orderBy(asc(gapItems.position))
      : [];
    const oldFindingLinks = oldFindingIds.length
      ? await tx.select().from(gapFindingContextLinks).where(inArray(gapFindingContextLinks.findingId, oldFindingIds))
      : [];
    const oldGapIds = oldGaps.map((gap) => gap.id);
    const oldGapLinks = oldGapIds.length
      ? await tx.select().from(gapItemContextLinks).where(inArray(gapItemContextLinks.gapItemId, oldGapIds))
      : [];

    let resolutionRunId = source.revision.aiProcessingRunId;
    const contextIdMap = new Map<string, string>();
    if (generated) {
      const now = new Date();
      const [run] = await tx.insert(aiProcessingRuns).values({
        organizationId: input.organizationId,
        jobId: input.jobId,
        operationKind: "gap_conflict_resolution",
        status: "succeeded",
        provider: generated.provider,
        model: generated.model,
        promptName: PROMPT_NAME,
        promptVersion: PROMPT_VERSION,
        promptHash: PROMPT_HASH,
        definitionHash: currentGapDefinitionHash,
        buildHash: BUILD_HASH,
        inputManifest: generated.manifest,
        claimValidation: { version: 1, status: "validated", citationIds: generated.citationIds },
        validatedOutput: generated.output,
        outputLocale: source.revision.locale,
        inputTokens: generated.usage.inputTokens,
        outputTokens: generated.usage.outputTokens,
        startedAt: now,
        completedAt: now,
      }).returning();
      if (!run) throw new Error("Conflict-resolution AI run was not created");
      resolutionRunId = run.id;
      const contextsToCopy = contextLinks.map(({ context }) => context);
      if (contextsToCopy.length) {
        await tx.insert(aiProcessingRunContext).values(contextsToCopy.map((context, position) => {
          const id = randomUUID();
          contextIdMap.set(context.id, id);
          return {
            id,
            organizationId: input.organizationId,
            runId: run.id,
            channel: context.channel,
            documentChunkId: context.documentChunkId,
            legalSourceChunkId: context.legalSourceChunkId,
            contextRole: context.contextRole,
            exactText: context.exactText,
            vectorScore: context.vectorScore,
            keywordScore: context.keywordScore,
            fusedScore: context.fusedScore,
            metadata: context.metadata,
            position,
          };
        }));
      }
    }

    const now = new Date();
    const resolutionCitationIds = conflictingDocuments.map(({ context }) => contextIdMap.get(context.id) ?? context.id);
    const [revision] = await tx.insert(analysisOutputRevisions).values({
      organizationId: input.organizationId,
      outputId: source.revision.outputId,
      previousRevisionId: source.revision.id,
      assessmentRevisionId: source.revision.assessmentRevisionId,
      sourceApplicabilityRevisionId: source.revision.sourceApplicabilityRevisionId,
      definitionHash: currentGapDefinitionHash,
      buildHash: BUILD_HASH,
      locale: source.revision.locale,
      inputHash: hashJson({ sourceRevisionId: source.revision.id, findingId: source.finding.id, sourceChoice: input.sourceChoice, resolutionCitationIds }),
      result: { version: 1, conflictResolution: { findingId: source.finding.id, sourceChoice: input.sourceChoice } },
      generationJobId: input.jobId,
      aiProcessingRunId: resolutionRunId,
      createdBy: input.userId,
      createdAt: now,
    }).returning();
    if (!revision) throw new Error("Resolved Gap revision was not created");

    const findingIdMap = new Map<string, string>();
    await tx.insert(gapFindings).values(oldFindings.map((finding) => {
      const id = randomUUID();
      findingIdMap.set(finding.id, id);
      const target = finding.id === source.finding.id;
      return {
        id,
        organizationId: input.organizationId,
        outputRevisionId: revision.id,
        requirementKey: finding.requirementKey,
        requirementTitle: finding.requirementTitle,
        requirementText: finding.requirementText,
        icon: finding.icon,
        criticality: finding.criticality,
        status: target && generated ? generated.output.status : finding.status,
        summary: target && generated ? generated.output.summary : finding.summary,
        guidance: target && generated ? generated.output.guidance : finding.guidance,
        materialContradiction: finding.materialContradiction,
        contradictionResolved: target ? true : finding.contradictionResolved,
        sourceChoice: target ? input.sourceChoice : finding.sourceChoice,
        resolutionCitationIds: target ? resolutionCitationIds : finding.resolutionCitationIds,
        decidedBy: target ? input.userId : finding.decidedBy,
        decidedAt: target ? now : finding.decidedAt,
        originalOutputRevisionId: target ? source.revision.id : finding.originalOutputRevisionId,
        originalFindingId: target ? finding.id : finding.originalFindingId,
        position: finding.position,
      };
    }));

    const gapIdMap = new Map<string, string>();
    const copiedGaps = oldGaps.filter((gap) => gap.findingId !== source.finding.id || !generated).map((gap) => {
      const id = randomUUID();
      gapIdMap.set(gap.id, id);
      return {
        id,
        organizationId: input.organizationId,
        outputRevisionId: revision.id,
        findingId: findingIdMap.get(gap.findingId)!,
        stableKey: gap.stableKey,
        kind: gap.kind,
        statement: gap.statement,
        recommendation: gap.recommendation,
        position: gap.position,
      };
    });
    const regeneratedGaps = generated?.output.gaps.map((gap, position) => ({
      id: randomUUID(),
      organizationId: input.organizationId,
      outputRevisionId: revision.id,
      findingId: findingIdMap.get(source.finding.id)!,
      stableKey: `${source.finding.requirementKey}.gap.${position + 1}`,
      kind: gap.kind,
      statement: gap.statement,
      recommendation: gap.recommendation,
      position,
    })) ?? [];
    if (copiedGaps.length || regeneratedGaps.length) await tx.insert(gapItems).values([...copiedGaps, ...regeneratedGaps]);

    const newFindingLinks = oldFindingLinks.flatMap((link) => {
      const target = link.findingId === source.finding.id;
      const mappedContextId = target && generated
        ? contextIdMap.get(link.contextId) ?? link.contextId
        : link.contextId;
      if (!mappedContextId) return [];
      return [{
        organizationId: input.organizationId,
        findingId: findingIdMap.get(link.findingId)!,
        contextId: mappedContextId,
        relationship: link.relationship,
        disposition: resolvedFindingLinkDisposition({
          currentDisposition: link.disposition,
          relationship: link.relationship,
          sourceChoice: input.sourceChoice,
          isTargetFinding: target,
          isExactConflictingContext: conflictingDocuments.some(
            ({ context }) => context.id === link.contextId,
          ),
        }),
      }];
    });
    if (newFindingLinks.length) await tx.insert(gapFindingContextLinks).values(newFindingLinks);

    const newGapLinks = oldGapLinks.flatMap((link) => {
      const mappedGapId = gapIdMap.get(link.gapItemId);
      if (!mappedGapId) return [];
      const mappedContextId = generated ? contextIdMap.get(link.contextId) ?? link.contextId : link.contextId;
      return [{ organizationId: input.organizationId, gapItemId: mappedGapId, contextId: mappedContextId, disposition: link.disposition }];
    });
    const regeneratedGapLinks = generated?.output.gaps.flatMap((gap, position) =>
      gap.citationIds.map((contextId) => ({
        organizationId: input.organizationId,
        gapItemId: regeneratedGaps[position]!.id,
        contextId: contextIdMap.get(contextId)!,
        disposition: "admitted" as const,
      }))) ?? [];
    if (newGapLinks.length || regeneratedGapLinks.length) {
      await tx.insert(gapItemContextLinks).values([...newGapLinks, ...regeneratedGapLinks]);
    }

    const sources = await tx.select().from(analysisOutputDocumentSources)
      .where(eq(analysisOutputDocumentSources.outputRevisionId, source.revision.id));
    if (sources.length) await tx.insert(analysisOutputDocumentSources).values(sources.map((item) => ({
      organizationId: input.organizationId,
      outputRevisionId: revision.id,
      documentVersionId: item.documentVersionId,
      position: item.position,
    })));
    await tx.update(analysisOutputs).set({ currentRevisionId: revision.id, updatedAt: now }).where(eq(analysisOutputs.id, lockedOutput.id));
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType: "gap.contradiction_resolved",
      entityType: "analysis_output_revision",
      entityId: revision.id,
      metadata: { originalRevisionId: source.revision.id, originalFindingId: source.finding.id, sourceChoice: input.sourceChoice, resolutionCitationIds },
    });
    return { type: "analysis_output_revision", id: revision.id };
  });
}

async function regenerateFromDocument(input: {
  organizationId: string;
  sourceRevisionId: string;
  findingId: string;
  sourceChoice: ContradictionSourceChoice;
  abortSignal?: AbortSignal;
  provider?: GroundedProvider;
  source: Awaited<ReturnType<typeof requireResolvableFinding>>;
  conflictingDocuments: Array<{ context: typeof aiProcessingRunContext.$inferSelect }>;
}) {
  const organization = await db.query.organizations.findFirst({
    columns: { aiProviderMode: true },
    where: { RAW: (table, operators) => eq(table.id, input.organizationId) ?? operators.sql`true` },
  });
  if (!organization) throw new ApiError(404, "Organization not found");
  const provider = input.provider ?? createAiSdkGroundedProvider(organization.aiProviderMode);
  const definition = getCurrentGapDefinition(input.source.revision.locale as "de" | "en");
  const manifest = {
    sourceRevisionId: input.sourceRevisionId,
    findingId: input.findingId,
    requirement: {
      key: input.source.finding.requirementKey,
      title: input.source.finding.requirementTitle,
      text: input.source.finding.requirementText,
    },
    authoritativeContexts: input.conflictingDocuments.map(({ context }) => ({ id: context.id, exactText: context.exactText, metadata: context.metadata })),
  };
  const response = await provider.run({
    system: `${PROMPT_TEMPLATE}\nOutput language: ${input.source.revision.locale}.`,
    prompt: JSON.stringify(manifest),
    schema: documentResolutionSchema,
    abortSignal: input.abortSignal,
  });
  const output = documentResolutionSchema.parse(response.output);
  const allowed = new Set(input.conflictingDocuments.map(({ context }) => context.id));
  const citationIds = [...new Set(output.gaps.flatMap((gap) => gap.citationIds))];
  if (citationIds.some((id) => !allowed.has(id))) {
    throw new ApiError(422, "Conflict resolution cited context that was not supplied", undefined, "GAP_CONTRADICTION_CITATION_INVALID");
  }
  if (output.status !== "fulfilled" && !citationIds.length) {
    throw new ApiError(422, "Conflict resolution omitted exact citations", undefined, "GAP_CONTRADICTION_CITATION_MISSING");
  }
  return { output, manifest, citationIds, usage: response.usage, provider: provider.provider, model: provider.model, definition };
}

async function requireResolvableFinding(organizationId: string, revisionId: string, findingId: string, executor: OrganizationScopeExecutor = db) {
  const output = await executor.query.analysisOutputs.findFirst({
    where: { RAW: (table, operators) => and(eq(table.organizationId, organizationId), eq(table.kind, "gap")) ?? operators.sql`true` },
  });
  if (!output || output.currentRevisionId !== revisionId) {
    throw new ApiError(409, "Contradictions can only be resolved on the current Gap result", undefined, "GAP_REVISION_NOT_CURRENT");
  }
  const revision = await executor.query.analysisOutputRevisions.findFirst({
    where: { RAW: (table, operators) => and(eq(table.id, revisionId), eq(table.organizationId, organizationId)) ?? operators.sql`true` },
  });
  if (!revision) throw new ApiError(404, "Gap revision not found", undefined, "GAP_REVISION_NOT_FOUND");
  if (revision.definitionHash !== currentGapDefinitionHash) {
    throw new ApiError(409, "The Gap result uses an outdated definition", undefined, "GAP_DEFINITION_CHANGED");
  }
  const finding = await executor.query.gapFindings.findFirst({
    where: { RAW: (table, operators) => and(eq(table.id, findingId), eq(table.outputRevisionId, revisionId), eq(table.organizationId, organizationId)) ?? operators.sql`true` },
  });
  if (!finding) throw new ApiError(404, "Gap finding not found", undefined, "GAP_FINDING_NOT_FOUND");
  if (!finding.materialContradiction || finding.contradictionResolved) {
    throw new ApiError(409, "The finding has no unresolved material contradiction", undefined, "GAP_CONTRADICTION_NOT_RESOLVABLE");
  }
  return { output, revision, finding };
}

function hashJson(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
