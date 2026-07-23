import { db } from "@/src/db";
import {
  actionPlans,
  aiProcessingRuns,
  assessmentAnswerOptions,
  assessmentAnswers,
  assessments,
  gapFindingEvidence,
  gapFindings,
  gapRequirementVersions,
  generatedArtifactRevisions,
  generatedArtifacts,
  questionOptions,
} from "@/src/db/schema";
import type { Locale } from "@/lib/i18n-config";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getOrganizationDocumentLibrary } from "../documents/service";
import { requireOrganizationCapability } from "../auth/capability-service";
import { hasOrganizationCapability } from "../auth/capabilities";
import type { GapReleaseReader, LoadedGapRelease } from "./release-loader";
import { nextCachedGapReleaseReader } from "./next-cached-release-loader";
import { getGapReassessmentDraftPreauthorized } from "./reassessment-service";
import { getGapRevisionStaleness } from "./staleness";
import { selectGapWorkflowRevisions } from "./workflow-state";

type GapWorkflowInput = {
  userId: string;
  organizationId: string;
  locale: Locale;
};

type OrganizationRole = Parameters<typeof hasOrganizationCapability>[0];

export function createGapAnalysisWorkflowReader<
  TMembership extends { role: OrganizationRole },
  TDocumentLibrary,
  TDocumentRow,
  TAssessment extends {
    id: string;
    currentRevisionId: string | null;
  },
  TArtifact,
  TRevision extends { id: string },
  TAnswer extends { id: string; questionId: string },
  TAnswerOption extends { answerId: string; optionId: string },
  TFinding extends { finding: { id: string; requiresReview: boolean } },
  TReassessment extends {
    draft: {
      aiProcessingRunId: string | null;
      generationJobId: string | null;
    };
  },
  TStaleness,
  TPlan extends { sourceGapArtifactRevisionId: string | null },
  TRun,
>(dependencies: {
  authorize: (input: GapWorkflowInput) => Promise<TMembership>;
  loadDocumentLibrary: (input: GapWorkflowInput) => Promise<TDocumentLibrary>;
  loadActiveRelease: (
    input: GapWorkflowInput,
  ) => Promise<LoadedGapRelease | null>;
  getCurrentDocuments: (library: TDocumentLibrary) => TDocumentRow[];
  loadAssessment: (
    input: GapWorkflowInput,
    release: LoadedGapRelease,
  ) => Promise<TAssessment | null | undefined>;
  loadArtifact: (
    input: GapWorkflowInput,
    release: LoadedGapRelease,
  ) => Promise<TArtifact | null | undefined>;
  loadAnswerRows: (assessment: TAssessment | null | undefined) => Promise<TAnswer[]>;
  loadArtifactRevisions: (
    artifact: TArtifact | null | undefined,
  ) => Promise<{
    accepted: TRevision | null;
    working: TRevision | null;
  }>;
  selectCandidate: (input: {
    accepted: TRevision | null;
    working: TRevision | null;
  }) => TRevision | null;
  loadAnswerOptions: (answers: TAnswer[]) => Promise<TAnswerOption[]>;
  loadFindings: (revision: TRevision | null) => Promise<TFinding[]>;
  loadReassessment: (
    input: GapWorkflowInput,
    assessment: TAssessment | null | undefined,
    release: LoadedGapRelease,
  ) => Promise<TReassessment | null>;
  loadStaleness: (
    input: GapWorkflowInput,
    revision: TRevision | null,
  ) => Promise<TStaleness | null>;
  loadActivePlan: (input: GapWorkflowInput) => Promise<TPlan | null | undefined>;
  loadRun: (
    input: GapWorkflowInput,
    reassessment: TReassessment | null,
    assessment: TAssessment | null | undefined,
  ) => Promise<TRun | null | undefined>;
}) {
  return async (input: GapWorkflowInput) => {
    const membership = await dependencies.authorize(input);
    const permissions = {
      role: membership.role,
      canContribute: hasOrganizationCapability(
        membership.role,
        "gap:contribute",
      ),
      canManage: hasOrganizationCapability(membership.role, "gap:approve"),
    };
    const [documentLibrary, release] = await Promise.all([
      dependencies.loadDocumentLibrary(input),
      dependencies.loadActiveRelease(input),
    ]);
    const documents = dependencies.getCurrentDocuments(documentLibrary);
    if (!release) {
      return {
        ...permissions,
        release: null,
        assessment: null,
        answers: {},
        documents,
        documentLibrary,
        run: null,
        revision: null,
        findings: [],
        acceptedRevision: null,
        acceptedFindings: [],
        candidateRevision: null,
        candidateFindings: [],
        reassessment: null,
        reviewBlockers: [],
        planUpdateAvailable: false,
        acceptedStaleness: null,
        candidateStaleness: null,
        staleness: null,
      };
    }
    const [assessment, artifact] = await Promise.all([
      dependencies.loadAssessment(input, release),
      dependencies.loadArtifact(input, release),
    ]);
    const [answerRows, artifactRevisions] = await Promise.all([
      dependencies.loadAnswerRows(assessment),
      dependencies.loadArtifactRevisions(artifact),
    ]);
    const acceptedRevision = artifactRevisions.accepted;
    const candidateRevision = dependencies.selectCandidate({
      accepted: acceptedRevision,
      working: artifactRevisions.working,
    });
    const [
      answerOptions,
      acceptedFindings,
      candidateFindings,
      reassessment,
      acceptedStaleness,
      candidateStaleness,
      activePlan,
    ] = await Promise.all([
      dependencies.loadAnswerOptions(answerRows),
      dependencies.loadFindings(acceptedRevision),
      dependencies.loadFindings(candidateRevision),
      dependencies.loadReassessment(input, assessment, release),
      dependencies.loadStaleness(input, acceptedRevision),
      dependencies.loadStaleness(input, candidateRevision),
      dependencies.loadActivePlan(input),
    ]);
    const run = await dependencies.loadRun(input, reassessment, assessment);
    const revision = candidateRevision ?? acceptedRevision;
    const findings = candidateRevision ? candidateFindings : acceptedFindings;

    return {
      ...permissions,
      release,
      assessment,
      answers: Object.fromEntries(
        answerRows.map((answer) => [
          answer.questionId,
          answerOptions.find((option) => option.answerId === answer.id)
            ?.optionId ?? "",
        ]),
      ),
      documents,
      documentLibrary,
      run,
      revision,
      findings,
      acceptedRevision,
      acceptedFindings,
      candidateRevision,
      candidateFindings,
      reassessment,
      reviewBlockers: candidateFindings
        .filter((row) => row.finding.requiresReview)
        .map((row) => row.finding.id),
      planUpdateAvailable: Boolean(
        activePlan &&
          acceptedRevision &&
          activePlan.sourceGapArtifactRevisionId !== acceptedRevision.id,
      ),
      acceptedStaleness,
      candidateStaleness,
      staleness: candidateRevision ? candidateStaleness : acceptedStaleness,
    };
  };
}

type Membership = Awaited<ReturnType<typeof requireOrganizationCapability>>;
type DocumentLibrary = Awaited<
  ReturnType<typeof getOrganizationDocumentLibrary>
>;
type DocumentRow = ReturnType<typeof currentDocumentRows>[number];
type Assessment = typeof assessments.$inferSelect;
type Artifact = typeof generatedArtifacts.$inferSelect;
type ArtifactRevision = typeof generatedArtifactRevisions.$inferSelect;
type Answer = typeof assessmentAnswers.$inferSelect;
type AnswerOption = {
  answerId: string;
  optionId: string;
};
type Finding = Awaited<ReturnType<typeof loadFindings>>[number];
type Reassessment = NonNullable<
  Awaited<ReturnType<typeof getGapReassessmentDraftPreauthorized>>
>;
type Staleness = NonNullable<
  Awaited<ReturnType<typeof getGapRevisionStaleness>>
>;
type ActionPlan = typeof actionPlans.$inferSelect;
type ProcessingRun = typeof aiProcessingRuns.$inferSelect;

export function createDatabaseGapAnalysisWorkflowReader(
  releaseReader: GapReleaseReader,
) {
  return createGapAnalysisWorkflowReader<
    Membership,
    DocumentLibrary,
    DocumentRow,
    Assessment,
    Artifact,
    ArtifactRevision,
    Answer,
    AnswerOption,
    Finding,
    Reassessment,
    Staleness,
    ActionPlan,
    ProcessingRun
  >({
  authorize: (input) =>
    requireOrganizationCapability(
      input.userId,
      input.organizationId,
      "gap:read",
    ),
  loadDocumentLibrary: (input) =>
    getOrganizationDocumentLibrary(input.userId, input.organizationId),
    loadActiveRelease: (input) =>
      releaseReader.getActive({
      releaseCode: "nis2-gap",
      locale: input.locale,
    }),
  getCurrentDocuments: currentDocumentRows,
  loadAssessment: (input, release) =>
    db.query.assessments.findFirst({
      where: and(
        eq(assessments.organizationId, input.organizationId),
        eq(assessments.moduleId, release.moduleId),
        eq(assessments.gapAnalysisReleaseId, release.id),
        eq(assessments.status, "active"),
      ),
    }),
  loadArtifact: (input, release) =>
    db.query.generatedArtifacts.findFirst({
      where: and(
        eq(generatedArtifacts.organizationId, input.organizationId),
        eq(generatedArtifacts.moduleId, release.moduleId),
        eq(generatedArtifacts.artifactType, "gap_analysis_result"),
      ),
    }),
  loadAnswerRows: (assessment) =>
    assessment?.currentRevisionId
      ? db.query.assessmentAnswers.findMany({
          where: eq(
            assessmentAnswers.assessmentRevisionId,
            assessment.currentRevisionId,
          ),
        })
      : Promise.resolve([]),
  async loadArtifactRevisions(artifact) {
    const [accepted, working] = await Promise.all([
      artifact?.acceptedRevisionId
        ? db.query.generatedArtifactRevisions.findFirst({
            where: and(
              eq(generatedArtifactRevisions.id, artifact.acceptedRevisionId),
              eq(generatedArtifactRevisions.artifactId, artifact.id),
              eq(generatedArtifactRevisions.status, "approved"),
            ),
          })
        : null,
      artifact?.currentRevisionId
        ? db.query.generatedArtifactRevisions.findFirst({
            where: eq(
              generatedArtifactRevisions.id,
              artifact.currentRevisionId,
            ),
          })
        : null,
    ]);
    return { accepted: accepted ?? null, working: working ?? null };
  },
  selectCandidate: ({ accepted, working }) =>
    selectGapWorkflowRevisions({
      current: working,
      accepted,
    }).candidate,
  loadAnswerOptions: (answerRows) =>
    answerRows.length
      ? db
          .select({
            answerId: assessmentAnswerOptions.assessmentAnswerId,
            optionId: questionOptions.id,
          })
          .from(assessmentAnswerOptions)
          .innerJoin(
            questionOptions,
            eq(
              assessmentAnswerOptions.questionOptionId,
              questionOptions.id,
            ),
          )
          .where(
            inArray(
              assessmentAnswerOptions.assessmentAnswerId,
              answerRows.map((answer) => answer.id),
            ),
          )
      : Promise.resolve([]),
  loadFindings: (revision) => loadFindings(revision?.id),
  loadReassessment: (input, assessment, release) =>
    assessment
      ? getGapReassessmentDraftPreauthorized({
          organizationId: input.organizationId,
          assessmentId: assessment.id,
          locale: input.locale,
          release,
        })
      : Promise.resolve(null),
  loadStaleness: (input, revision) =>
    revision
      ? getGapRevisionStaleness({
          userId: input.userId,
          organizationId: input.organizationId,
          revisionId: revision.id,
        })
      : Promise.resolve(null),
  loadActivePlan: (input) =>
    db.query.actionPlans.findFirst({
      where: and(
        eq(actionPlans.organizationId, input.organizationId),
        eq(actionPlans.status, "active"),
      ),
    }),
  loadRun: (input, reassessment, assessment) =>
    reassessment?.draft.aiProcessingRunId
      ? db.query.aiProcessingRuns.findFirst({
          where: eq(
            aiProcessingRuns.id,
            reassessment.draft.aiProcessingRunId,
          ),
        })
      : reassessment?.draft.generationJobId
        ? db.query.aiProcessingRuns.findFirst({
            where: eq(
              aiProcessingRuns.jobId,
              reassessment.draft.generationJobId,
            ),
            orderBy: [desc(aiProcessingRuns.createdAt)],
          })
        : assessment?.currentRevisionId
          ? db.query.aiProcessingRuns.findFirst({
              where: and(
                eq(aiProcessingRuns.organizationId, input.organizationId),
                eq(
                  aiProcessingRuns.assessmentRevisionId,
                  assessment.currentRevisionId,
                ),
                eq(aiProcessingRuns.operationKind, "gap_analysis"),
              ),
              orderBy: [desc(aiProcessingRuns.createdAt)],
            })
          : Promise.resolve(null),
  });
}

const readGapAnalysisWorkflow = createDatabaseGapAnalysisWorkflowReader(
  nextCachedGapReleaseReader,
);

export async function getGapAnalysisWorkflow(input: GapWorkflowInput) {
  return readGapAnalysisWorkflow(input);
}

export async function getGapAnalysisRevision(input: {
  userId: string;
  organizationId: string;
  revisionId: string;
}) {
  await requireOrganizationCapability(input.userId, input.organizationId, "gap:read");
  const [row] = await db.select({ revision: generatedArtifactRevisions })
    .from(generatedArtifactRevisions)
    .innerJoin(generatedArtifacts, eq(generatedArtifactRevisions.artifactId, generatedArtifacts.id))
    .where(and(
      eq(generatedArtifactRevisions.id, input.revisionId),
      eq(generatedArtifacts.organizationId, input.organizationId),
      eq(generatedArtifacts.artifactType, "gap_analysis_result"),
    ))
    .limit(1);
  if (!row) return null;
  const [findings, staleness] = await Promise.all([
    loadFindings(row.revision.id),
    getGapRevisionStaleness({
      userId: input.userId,
      organizationId: input.organizationId,
      revisionId: row.revision.id,
    }),
  ]);
  return { revision: row.revision, findings, staleness };
}

async function loadFindings(revisionId: string | null | undefined) {
  if (!revisionId) return [];
  const findingRows = await db
    .select({ finding: gapFindings, requirement: gapRequirementVersions })
    .from(gapFindings)
    .innerJoin(
      gapRequirementVersions,
      eq(gapFindings.requirementVersionId, gapRequirementVersions.id),
    )
    .where(eq(gapFindings.artifactRevisionId, revisionId));
  const evidenceRows = findingRows.length
    ? await db.query.gapFindingEvidence.findMany({
        where: inArray(
          gapFindingEvidence.findingId,
          findingRows.map((row) => row.finding.id),
        ),
      })
    : [];
  return findingRows.map((row) => ({
    ...row,
    evidence: evidenceRows.filter(
      (evidence) => evidence.findingId === row.finding.id,
    ),
  }));
}

function currentDocumentRows(
  library: Awaited<ReturnType<typeof getOrganizationDocumentLibrary>>,
) {
  return library.documents.map((entry) => {
    const current = entry.versions.find(
      (item) => item.version.id === entry.document.currentVersionId,
    );
    return {
      document: entry.document,
      version: current?.version ?? null,
      extraction: current?.extraction ?? null,
      embedding: current?.embedding ?? null,
    };
  });
}
