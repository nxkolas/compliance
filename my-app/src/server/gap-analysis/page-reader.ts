import type { Locale } from "@/lib/i18n-config";
import {
  hasOrganizationCapability,
  type OrganizationCapability,
} from "../auth/capabilities";
import type { OrganizationRole } from "../organizations/types";
import { resolveOrganizationCapabilities } from "../auth/capability-service";
import { ApiError } from "../api/errors";
import { postgresGapPageData } from "./postgres-page-data";
import { nextCachedGapReleaseReader } from "./next-cached-release-loader";
import type { GapReleaseReader, LoadedGapRelease } from "./release-loader";
import { loadGapHistoryPreauthorized } from "./history-reader";
import { readGeneratedGapInputsPreauthorized } from "./generated-inputs-reader";
import type { GapPrerequisiteView } from "./applicability-eligibility";
import {
  nextCachedRuntimeReleaseReader,
  type RuntimeReleaseReader,
} from "../compliance";

export type GapPageReadInput = {
  userId: string;
  organizationId: string;
  locale: Locale;
  view?: "results" | "inputs" | "history";
};

type GapWorkflowSnapshot<
  TAssessment,
  TRevision,
  TPlan,
  TRunContext,
> = {
  assessment: TAssessment | null;
  acceptedRevision: TRevision | null;
  currentRevision: TRevision | null;
  activePlan: TPlan | null;
  runContext: TRunContext;
};

export function createGapPageReader<
  TMembership extends { role: OrganizationRole },
  TRelease extends { id: string },
  TDocumentLibrary,
  TDocument,
  TAssessment extends { id: string },
  TRevision extends { id: string },
  TFinding extends { finding: { id: string; requiresReview: boolean } },
  TAnalysisCycle,
  TStaleness,
  TPlan extends { sourceGapArtifactRevisionId: string | null },
  TRun,
  TRunContext,
  TGeneratedInputs,
>(dependencies: {
  authorize: (
    input: GapPageReadInput,
    capabilities: OrganizationCapability[],
  ) => Promise<TMembership>;
  loadDocumentLibrary: (
    input: GapPageReadInput,
    membership: TMembership,
  ) => Promise<TDocumentLibrary>;
  loadActiveRelease: (input: GapPageReadInput) => Promise<TRelease | null>;
  getCurrentDocuments: (library: TDocumentLibrary) => TDocument[];
  loadDocumentsAssessment: (
    input: GapPageReadInput,
    release: TRelease,
  ) => Promise<TAssessment | null>;
  loadWorkflowSnapshot: (
    input: GapPageReadInput,
    release: TRelease,
  ) => Promise<
    GapWorkflowSnapshot<
      TAssessment,
      TRevision,
      TPlan,
      TRunContext
    >
  >;
  loadPrerequisite: (
    input: GapPageReadInput,
    release: TRelease,
  ) => Promise<GapPrerequisiteView>;
  loadHistory: (
    input: GapPageReadInput,
  ) => ReturnType<typeof loadGapHistoryPreauthorized>;
  loadAnswers: (
    assessment: TAssessment | null,
  ) => Promise<Record<string, string>>;
  loadFindingsBatch: (input: {
    acceptedRevisionId: string | null;
    candidateRevisionId: string | null;
  }) => Promise<{
    accepted: TFinding[];
    candidate: TFinding[];
  }>;
  loadAnalysisCycle: (
    input: GapPageReadInput,
    assessment: TAssessment | null,
    release: TRelease,
  ) => Promise<TAnalysisCycle | null>;
  loadStalenessBatch: (input: {
    organizationId: string;
    acceptedRevisionId: string | null;
    candidateRevisionId: string | null;
    activeGapReleaseId: string;
  }) => Promise<{
    accepted: TStaleness | null;
    candidate: TStaleness | null;
  }>;
  loadRun: (
    input: GapPageReadInput,
    runContext: TRunContext,
  ) => Promise<TRun | null>;
  loadGeneratedInputs: (
    input: GapPageReadInput,
    revision: TRevision,
    release: TRelease,
  ) => Promise<TGeneratedInputs>;
}) {
  return {
    async readDocuments(input: GapPageReadInput) {
      const membership = await dependencies.authorize(input, [
        "documents:read",
        "gap:read",
      ]);
      const documentLibraryPromise = dependencies.loadDocumentLibrary(
        input,
        membership,
      );
      const release = await dependencies.loadActiveRelease(input);
      const assessmentPromise = release
        ? dependencies.loadDocumentsAssessment(input, release)
        : Promise.resolve(null);
      const [documentLibrary, assessment] = await Promise.all([
        documentLibraryPromise,
        assessmentPromise,
      ]);
      const analysisCycle =
        release && assessment
          ? await dependencies.loadAnalysisCycle(input, assessment, release)
          : null;
      return {
        assessmentId: assessment?.id ?? null,
        documentLibrary,
        analysisCycle,
      };
    },

    async readGap(input: GapPageReadInput) {
      const membership = await dependencies.authorize(input, ["gap:read"]);
      const permissions = {
        role: membership.role,
        canContribute: hasOrganizationCapability(
          membership.role,
          "gap:contribute",
        ),
        canManage: hasOrganizationCapability(
          membership.role,
          "gap:approve",
        ),
      };
      const documentLibraryPromise = dependencies.loadDocumentLibrary(
        input,
        membership,
      );
      const release = await dependencies.loadActiveRelease(input);
      if (!release) {
        const documentLibrary = await documentLibraryPromise;
        const documents = dependencies.getCurrentDocuments(documentLibrary);
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
          activePlan: null,
          analysisCycle: null,
          prerequisite: {
            satisfied: false as const,
            status: "missing" as const,
            supportedCountryCodes: [],
            destination: `/tool/organizations/${input.organizationId}/applicability-check`,
          },
          history: [],
          generatedInputs: null,
          reviewBlockers: [],
          planUpdateAvailable: false,
          acceptedStaleness: null,
          candidateStaleness: null,
          staleness: null,
        };
      }

      const [documentLibrary, snapshot, prerequisite, history] =
        await Promise.all([
          documentLibraryPromise,
          dependencies.loadWorkflowSnapshot(input, release),
          dependencies.loadPrerequisite(input, release),
          input.view === "history"
            ? dependencies.loadHistory(input)
            : Promise.resolve([]),
        ]);
      const documents = dependencies.getCurrentDocuments(documentLibrary);
      const acceptedRevision = snapshot.acceptedRevision;
      const candidateRevision =
        snapshot.currentRevision?.id !== acceptedRevision?.id
          ? snapshot.currentRevision
          : null;
      const revision = candidateRevision ?? acceptedRevision;
      const [
        answers,
        findings,
        analysisCycle,
        staleness,
        run,
        generatedInputs,
      ] =
        await Promise.all([
          dependencies.loadAnswers(snapshot.assessment),
          dependencies.loadFindingsBatch({
            acceptedRevisionId: acceptedRevision?.id ?? null,
            candidateRevisionId: candidateRevision?.id ?? null,
          }),
          dependencies.loadAnalysisCycle(
            input,
            snapshot.assessment,
            release,
          ),
          dependencies.loadStalenessBatch({
            organizationId: input.organizationId,
            acceptedRevisionId: acceptedRevision?.id ?? null,
            candidateRevisionId: candidateRevision?.id ?? null,
            activeGapReleaseId: release.id,
          }),
          dependencies.loadRun(input, snapshot.runContext),
          revision && input.view === "inputs"
            ? dependencies.loadGeneratedInputs(input, revision, release)
            : Promise.resolve(null),
        ]);
      const currentFindings = candidateRevision
        ? findings.candidate
        : findings.accepted;

      return {
        ...permissions,
        release,
        assessment: snapshot.assessment,
        answers,
        documents,
        documentLibrary,
        run,
        revision,
        findings: currentFindings,
        acceptedRevision,
        acceptedFindings: findings.accepted,
        candidateRevision,
        candidateFindings: findings.candidate,
        activePlan: snapshot.activePlan,
        analysisCycle,
        prerequisite,
        history,
        generatedInputs,
        reviewBlockers: findings.candidate
          .filter((row) => row.finding.requiresReview)
          .map((row) => row.finding.id),
        planUpdateAvailable: Boolean(
          snapshot.activePlan &&
            acceptedRevision &&
            snapshot.activePlan.sourceGapArtifactRevisionId !==
              acceptedRevision.id,
        ),
        acceptedStaleness: staleness.accepted,
        candidateStaleness: staleness.candidate,
        staleness: candidateRevision
          ? staleness.candidate
          : staleness.accepted,
      };
    },
  };
}

async function authorizePageRead(
  input: GapPageReadInput,
  requiredCapabilities: OrganizationCapability[],
) {
  const resolved = await resolveOrganizationCapabilities(
    input.userId,
    input.organizationId,
  );
  if (!resolved.membership) {
    throw new ApiError(
      404,
      "Organization not found",
      undefined,
      "ORGANIZATION_NOT_FOUND",
    );
  }
  if (
    requiredCapabilities.some(
      (capability) => !resolved.capabilities.has(capability),
    )
  ) {
    throw new ApiError(
      403,
      "You cannot perform this operation",
      undefined,
      "CAPABILITY_REQUIRED",
    );
  }
  return resolved.membership;
}

type ProductionMembership = NonNullable<
  Awaited<ReturnType<typeof resolveOrganizationCapabilities>>["membership"]
>;
type ProductionDocumentLibrary = Awaited<
  ReturnType<
    typeof postgresGapPageData.getOrganizationDocumentLibraryPreauthorized
  >
>;
type ProductionDocument =
  ProductionDocumentLibrary["documents"][number] extends infer TEntry
    ? TEntry extends {
        document: infer TDocument;
        versions: Array<{
          version: infer TVersion;
          extraction: infer TExtraction;
          embedding: infer TEmbedding;
        }>;
      }
      ? {
          document: TDocument;
          version: TVersion | null;
          extraction: TExtraction | null;
          embedding: TEmbedding | null;
        }
      : never
    : never;
type ProductionSnapshot = Awaited<
  ReturnType<typeof postgresGapPageData.loadWorkflowSnapshot>
>;
type ProductionAssessment = NonNullable<ProductionSnapshot["assessment"]>;
type ProductionRevision = NonNullable<
  ProductionSnapshot["acceptedRevision"]
>;
type ProductionPlan = NonNullable<ProductionSnapshot["activePlan"]>;
type ProductionFinding = Awaited<
  ReturnType<typeof postgresGapPageData.loadFindingsBatch>
>["accepted"][number];
type ProductionAnalysisCycle = NonNullable<
  Awaited<ReturnType<typeof postgresGapPageData.loadAnalysisCycle>>
>;
type ProductionStaleness = NonNullable<
  Awaited<ReturnType<typeof postgresGapPageData.loadStalenessBatch>>["accepted"]
>;
type ProductionRun = NonNullable<
  Awaited<ReturnType<typeof postgresGapPageData.loadRun>>
>;
type ProductionGeneratedInputs = Awaited<
  ReturnType<typeof readGeneratedGapInputsPreauthorized>
>;

export function createDatabaseGapPageReader(
  releaseReader: GapReleaseReader,
  runtimeReleaseReader: RuntimeReleaseReader =
    nextCachedRuntimeReleaseReader,
) {
  return createGapPageReader<
    ProductionMembership,
    LoadedGapRelease,
    ProductionDocumentLibrary,
    ProductionDocument,
    ProductionAssessment,
    ProductionRevision,
    ProductionFinding,
    ProductionAnalysisCycle,
    ProductionStaleness,
    ProductionPlan,
    ProductionRun,
    ProductionSnapshot["runContext"],
    ProductionGeneratedInputs
  >({
    authorize: authorizePageRead,
    loadDocumentLibrary: (input, membership) =>
      postgresGapPageData.getOrganizationDocumentLibraryPreauthorized(
        membership,
        input.organizationId,
      ),
    loadActiveRelease: (input) =>
      releaseReader.getActive({
        releaseCode: "nis2-gap",
        locale: input.locale,
      }),
    getCurrentDocuments: (library) =>
      library.documents.map((entry) => {
        const current = entry.versions.find(
          (item) => item.version.id === entry.document.currentVersionId,
        );
        return {
          document: entry.document,
          version: current?.version ?? null,
          extraction: current?.extraction ?? null,
          embedding: current?.embedding ?? null,
        };
      }),
    loadDocumentsAssessment: postgresGapPageData.loadDocumentsAssessment,
    loadWorkflowSnapshot: postgresGapPageData.loadWorkflowSnapshot,
    loadPrerequisite: (input, release) =>
      postgresGapPageData.loadGapPrerequisiteState(
        input,
        release,
        runtimeReleaseReader,
      ),
    loadHistory: (input) =>
      loadGapHistoryPreauthorized({
        organizationId: input.organizationId,
        currentUserId: input.userId,
        locale: input.locale,
      }),
    loadAnswers: postgresGapPageData.loadAnswers,
    loadFindingsBatch: postgresGapPageData.loadFindingsBatch,
    loadAnalysisCycle: postgresGapPageData.loadAnalysisCycle,
    loadStalenessBatch: postgresGapPageData.loadStalenessBatch,
    loadRun: postgresGapPageData.loadRun,
    loadGeneratedInputs: (input, revision, release) =>
      readGeneratedGapInputsPreauthorized({
        organizationId: input.organizationId,
        locale: input.locale,
        revision,
        release,
      }),
  });
}

export const gapPageReader = createDatabaseGapPageReader(
  nextCachedGapReleaseReader,
);

export type GapAnalysisWorkflowDto = Awaited<
  ReturnType<typeof gapPageReader.readGap>
>;

export type GapDocumentsPageDto = Awaited<
  ReturnType<typeof gapPageReader.readDocuments>
>;

export type GapPageReader = {
  readGap(input: GapPageReadInput): Promise<GapAnalysisWorkflowDto>;
  readDocuments(input: GapPageReadInput): Promise<GapDocumentsPageDto>;
};
