import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
  organizations: {
    memberships: r.many.organizationMemberships(),
    invitations: r.many.organizationInvitations(),
    assessments: r.many.assessments(),
    outputs: r.many.analysisOutputs(),
    gapCycles: r.many.gapAnalysisCycles(),
    documents: r.many.documents(),
    aiRuns: r.many.aiProcessingRuns(),
    actionPlans: r.many.actionPlans(),
    reports: r.many.reports(),
    jobs: r.many.backgroundJobs(),
    embeddingMigrations: r.many.organizationEmbeddingMigrations(),
  },
  organizationEmbeddingMigrations: {
    organization: r.one.organizations({
      from: r.organizationEmbeddingMigrations.organizationId,
      to: r.organizations.id,
      optional: false,
    }),
  },
  organizationMemberships: {
    organization: r.one.organizations({
      from: r.organizationMemberships.organizationId,
      to: r.organizations.id,
      optional: false,
    }),
  },
  organizationInvitations: {
    organization: r.one.organizations({
      from: r.organizationInvitations.organizationId,
      to: r.organizations.id,
      optional: false,
    }),
  },
  assessments: {
    organization: r.one.organizations({
      from: r.assessments.organizationId,
      to: r.organizations.id,
      optional: false,
    }),
    revisions: r.many.assessmentRevisions(),
  },
  assessmentRevisions: {
    assessment: r.one.assessments({
      from: r.assessmentRevisions.assessmentId,
      to: r.assessments.id,
      optional: false,
    }),
    previousRevision: r.one.assessmentRevisions({
      from: r.assessmentRevisions.previousRevisionId,
      to: r.assessmentRevisions.id,
    }),
    answers: r.many.assessmentAnswers(),
  },
  assessmentAnswers: {
    revision: r.one.assessmentRevisions({
      from: r.assessmentAnswers.assessmentRevisionId,
      to: r.assessmentRevisions.id,
      optional: false,
    }),
  },
  analysisOutputs: {
    organization: r.one.organizations({
      from: r.analysisOutputs.organizationId,
      to: r.organizations.id,
      optional: false,
    }),
    revisions: r.many.analysisOutputRevisions(),
  },
  analysisOutputRevisions: {
    output: r.one.analysisOutputs({
      from: r.analysisOutputRevisions.outputId,
      to: r.analysisOutputs.id,
      optional: false,
    }),
    assessmentRevision: r.one.assessmentRevisions({
      from: r.analysisOutputRevisions.assessmentRevisionId,
      to: r.assessmentRevisions.id,
      optional: false,
    }),
    sourceApplicabilityRevision: r.one.analysisOutputRevisions({
      from: r.analysisOutputRevisions.sourceApplicabilityRevisionId,
      to: r.analysisOutputRevisions.id,
    }),
    documents: r.many.analysisOutputDocumentSources(),
    findings: r.many.gapFindings(),
  },
  analysisOutputDocumentSources: {
    outputRevision: r.one.analysisOutputRevisions({
      from: r.analysisOutputDocumentSources.outputRevisionId,
      to: r.analysisOutputRevisions.id,
      optional: false,
    }),
    documentVersion: r.one.documentVersions({
      from: r.analysisOutputDocumentSources.documentVersionId,
      to: r.documentVersions.id,
      optional: false,
    }),
  },
  gapAnalysisCycles: {
    organization: r.one.organizations({
      from: r.gapAnalysisCycles.organizationId,
      to: r.organizations.id,
      optional: false,
    }),
    documents: r.many.gapAnalysisCycleDocuments(),
  },
  gapAnalysisCycleDocuments: {
    cycle: r.one.gapAnalysisCycles({
      from: r.gapAnalysisCycleDocuments.cycleId,
      to: r.gapAnalysisCycles.id,
      optional: false,
    }),
    documentVersion: r.one.documentVersions({
      from: r.gapAnalysisCycleDocuments.documentVersionId,
      to: r.documentVersions.id,
      optional: false,
    }),
  },
  documents: {
    organization: r.one.organizations({
      from: r.documents.organizationId,
      to: r.organizations.id,
      optional: false,
    }),
    versions: r.many.documentVersions(),
  },
  documentVersions: {
    document: r.one.documents({
      from: r.documentVersions.documentId,
      to: r.documents.id,
      optional: false,
    }),
    chunks: r.many.documentChunks(),
  },
  documentChunks: {
    version: r.one.documentVersions({
      from: r.documentChunks.documentVersionId,
      to: r.documentVersions.id,
      optional: false,
    }),
  },
  backgroundJobs: {
    organization: r.one.organizations({
      from: r.backgroundJobs.organizationId,
      to: r.organizations.id,
    }),
  },
  aiProcessingRuns: {
    organization: r.one.organizations({
      from: r.aiProcessingRuns.organizationId,
      to: r.organizations.id,
      optional: false,
    }),
    job: r.one.backgroundJobs({
      from: r.aiProcessingRuns.jobId,
      to: r.backgroundJobs.id,
    }),
    context: r.many.aiProcessingRunContext(),
  },
  aiProcessingRunContext: {
    run: r.one.aiProcessingRuns({
      from: r.aiProcessingRunContext.runId,
      to: r.aiProcessingRuns.id,
      optional: false,
    }),
    documentChunk: r.one.documentChunks({
      from: r.aiProcessingRunContext.documentChunkId,
      to: r.documentChunks.id,
    }),
    legalChunk: r.one.legalSourceChunks({
      from: r.aiProcessingRunContext.legalSourceChunkId,
      to: r.legalSourceChunks.id,
    }),
  },
  gapFindings: {
    outputRevision: r.one.analysisOutputRevisions({
      from: r.gapFindings.outputRevisionId,
      to: r.analysisOutputRevisions.id,
      optional: false,
    }),
    items: r.many.gapItems(),
    contextLinks: r.many.gapFindingContextLinks(),
  },
  gapItems: {
    finding: r.one.gapFindings({
      from: r.gapItems.findingId,
      to: r.gapFindings.id,
      optional: false,
    }),
    contextLinks: r.many.gapItemContextLinks(),
  },
  gapFindingContextLinks: {
    finding: r.one.gapFindings({
      from: r.gapFindingContextLinks.findingId,
      to: r.gapFindings.id,
      optional: false,
    }),
    context: r.one.aiProcessingRunContext({
      from: r.gapFindingContextLinks.contextId,
      to: r.aiProcessingRunContext.id,
      optional: false,
    }),
  },
  gapItemContextLinks: {
    item: r.one.gapItems({
      from: r.gapItemContextLinks.gapItemId,
      to: r.gapItems.id,
      optional: false,
    }),
    context: r.one.aiProcessingRunContext({
      from: r.gapItemContextLinks.contextId,
      to: r.aiProcessingRunContext.id,
      optional: false,
    }),
  },
  actionPlans: {
    organization: r.one.organizations({
      from: r.actionPlans.organizationId,
      to: r.organizations.id,
      optional: false,
    }),
    sourceGapRevision: r.one.analysisOutputRevisions({
      from: r.actionPlans.sourceGapRevisionId,
      to: r.analysisOutputRevisions.id,
      optional: false,
    }),
    items: r.many.actionPlanItems(),
  },
  actionPlanItems: {
    plan: r.one.actionPlans({
      from: r.actionPlanItems.actionPlanId,
      to: r.actionPlans.id,
      optional: false,
    }),
    finding: r.one.gapFindings({
      from: r.actionPlanItems.findingId,
      to: r.gapFindings.id,
      optional: false,
    }),
    gaps: r.many.actionPlanItemGaps(),
  },
  actionPlanItemGaps: {
    item: r.one.actionPlanItems({
      from: r.actionPlanItemGaps.actionPlanItemId,
      to: r.actionPlanItems.id,
      optional: false,
    }),
    gap: r.one.gapItems({
      from: r.actionPlanItemGaps.gapItemId,
      to: r.gapItems.id,
      optional: false,
    }),
  },
  reports: {
    organization: r.one.organizations({
      from: r.reports.organizationId,
      to: r.organizations.id,
      optional: false,
    }),
    documents: r.many.reportDocumentSources(),
  },
  reportDocumentSources: {
    report: r.one.reports({
      from: r.reportDocumentSources.reportId,
      to: r.reports.id,
      optional: false,
    }),
    documentVersion: r.one.documentVersions({
      from: r.reportDocumentSources.documentVersionId,
      to: r.documentVersions.id,
      optional: false,
    }),
  },
  legalCorpusFamilies: {
    sources: r.many.legalSources(),
    snapshots: r.many.legalCorpusSnapshots(),
  },
  legalSources: {
    family: r.one.legalCorpusFamilies({
      from: r.legalSources.familyId,
      to: r.legalCorpusFamilies.id,
      optional: false,
    }),
    versions: r.many.legalSourceVersions(),
  },
  legalSourceVersions: {
    source: r.one.legalSources({
      from: r.legalSourceVersions.sourceId,
      to: r.legalSources.id,
      optional: false,
    }),
    renditions: r.many.legalSourceRenditions(),
    processingGenerations: r.many.legalSourceProcessingGenerations(),
  },
  legalSourceRenditions: {
    sourceVersion: r.one.legalSourceVersions({
      from: r.legalSourceRenditions.sourceVersionId,
      to: r.legalSourceVersions.id,
      optional: false,
    }),
  },
  legalSourceProcessingGenerations: {
    sourceVersion: r.one.legalSourceVersions({
      from: r.legalSourceProcessingGenerations.sourceVersionId,
      to: r.legalSourceVersions.id,
      optional: false,
    }),
    rendition: r.one.legalSourceRenditions({
      from: r.legalSourceProcessingGenerations.renditionId,
      to: r.legalSourceRenditions.id,
      optional: false,
    }),
    chunks: r.many.legalSourceChunks(),
  },
  legalSourceChunks: {
    generation: r.one.legalSourceProcessingGenerations({
      from: r.legalSourceChunks.processingGenerationId,
      to: r.legalSourceProcessingGenerations.id,
      optional: false,
    }),
    provisionBindings: r.many.legalProvisionChunkBindings(),
  },
  legalProvisionChunkBindings: {
    chunk: r.one.legalSourceChunks({
      from: r.legalProvisionChunkBindings.chunkId,
      to: r.legalSourceChunks.id,
      optional: false,
    }),
  },
  legalCorpusSnapshots: {
    family: r.one.legalCorpusFamilies({
      from: r.legalCorpusSnapshots.familyId,
      to: r.legalCorpusFamilies.id,
      optional: false,
    }),
    members: r.many.legalCorpusSnapshotMembers(),
  },
  legalCorpusSnapshotMembers: {
    snapshot: r.one.legalCorpusSnapshots({
      from: r.legalCorpusSnapshotMembers.snapshotId,
      to: r.legalCorpusSnapshots.id,
      optional: false,
    }),
    sourceVersion: r.one.legalSourceVersions({
      from: r.legalCorpusSnapshotMembers.sourceVersionId,
      to: r.legalSourceVersions.id,
      optional: false,
    }),
    rendition: r.one.legalSourceRenditions({
      from: r.legalCorpusSnapshotMembers.renditionId,
      to: r.legalSourceRenditions.id,
      optional: false,
    }),
    processingGeneration: r.one.legalSourceProcessingGenerations({
      from: r.legalCorpusSnapshotMembers.processingGenerationId,
      to: r.legalSourceProcessingGenerations.id,
      optional: false,
    }),
  },
}));
