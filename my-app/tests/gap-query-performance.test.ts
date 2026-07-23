import { describe, expect, it, vi } from "vitest";

vi.mock("@/src/db", () => ({ db: {} }));

import {
  createGapReleaseReader,
  type LoadedGapRelease,
} from "@/src/server/gap-analysis/release-loader";
import { createGapReassessmentDraftReader } from "@/src/server/gap-analysis/reassessment-service";
import { createGapAnalysisWorkflowReader } from "@/src/server/gap-analysis/workflow-reader";

function release(id: string, locale: "de" | "en"): LoadedGapRelease {
  return {
    id,
    releaseCode: "nis2-gap",
    versionLabel: `${id}-${locale}`,
    moduleId: "gap",
    questionnaireId: "questionnaire",
    questionnaireVersionId: "questionnaire-version",
    questionnaireTitle: `Questionnaire ${locale}`,
    compatibleCheckReleaseId: "check-release",
    prompt: {
      name: "gap",
      version: "1",
      templateHash: "hash",
      responseSchemaVersion: "1",
    },
    evaluator: { kind: "deterministic", version: 1 },
    modelPolicy: {},
    questions: [],
    requirements: [],
  };
}

describe("Gap release reader", () => {
  it("resolves the active pointer on every read while reusing an immutable release bundle", async () => {
    const activeReleaseIds = ["release-a", "release-a", "release-b"];
    const loadActivePointer = vi.fn(async () => ({
      gapAnalysisReleaseId: activeReleaseIds.shift()!,
    }));
    const assembled = new Map<string, LoadedGapRelease>();
    const assemblePublished = vi.fn(
      async (releaseId: string, locale: "de" | "en") =>
        release(releaseId, locale),
    );
    const loadPublished = vi.fn(
      async ({
        releaseId,
        locale,
      }: {
        releaseId: string;
        locale: "de" | "en";
      }) => {
        const key = `${releaseId}:${locale}`;
        const cached = assembled.get(key);
        if (cached) return cached;
        const loaded = await assemblePublished(releaseId, locale);
        assembled.set(key, loaded);
        return loaded;
      },
    );
    const reader = createGapReleaseReader({
      loadActivePointer,
      loadPublished,
    });

    await expect(
      reader.getActive({ releaseCode: "nis2-gap", locale: "de" }),
    ).resolves.toMatchObject({ id: "release-a" });
    await expect(
      reader.getActive({ releaseCode: "nis2-gap", locale: "de" }),
    ).resolves.toMatchObject({ id: "release-a" });
    await expect(
      reader.getActive({ releaseCode: "nis2-gap", locale: "de" }),
    ).resolves.toMatchObject({ id: "release-b" });

    expect(loadActivePointer).toHaveBeenCalledTimes(3);
    expect(loadPublished).toHaveBeenCalledTimes(3);
    expect(assemblePublished).toHaveBeenCalledTimes(2);
    expect(assemblePublished).toHaveBeenCalledWith("release-a", "de");
    expect(assemblePublished).toHaveBeenCalledWith("release-b", "de");
  });

  it("keeps locale in the immutable bundle identity", async () => {
    const loadActivePointer = vi.fn(async () => ({
      gapAnalysisReleaseId: "release-a",
    }));
    const assembled = new Map<string, LoadedGapRelease>();
    const loadPublished = vi.fn(
      async ({
        releaseId,
        locale,
      }: {
        releaseId: string;
        locale: "de" | "en";
      }) => {
        const key = `${releaseId}:${locale}`;
        const loaded = assembled.get(key) ?? release(releaseId, locale);
        assembled.set(key, loaded);
        return loaded;
      },
    );
    const reader = createGapReleaseReader({
      loadActivePointer,
      loadPublished,
    });

    const german = await reader.getActive({
      releaseCode: "nis2-gap",
      locale: "de",
    });
    const english = await reader.getActive({
      releaseCode: "nis2-gap",
      locale: "en",
    });

    expect(german?.versionLabel).toBe("release-a-de");
    expect(english?.versionLabel).toBe("release-a-en");
    expect(assembled.size).toBe(2);
  });
});

describe("Gap reassessment reader", () => {
  const draft = {
    id: "draft",
    organizationId: "organization",
    assessmentId: "assessment",
    assessmentRevisionId: "assessment-revision",
    gapAnalysisReleaseId: "release-b",
    baseAcceptedGapRevisionId: null,
  };

  function dependencies() {
    return {
      authorize: vi.fn(async () => undefined),
      findDraft: vi.fn(async () => draft),
      loadSelected: vi.fn(async () => []),
      loadAcceptedEvidence: vi.fn(async () => []),
      loadRelease: vi.fn(async () => release("release-b", "de")),
      loadBaseRevision: vi.fn(async () => null),
      loadAssessmentRevision: vi.fn(async () => ({ revisionNumber: 4 })),
      loadAssessment: vi.fn(async () => ({
        applicabilityArtifactRevisionId: null,
      })),
      loadApplicabilityRevision: vi.fn(async () => null),
    };
  }

  it("reuses an already-loaded release when it matches the draft", async () => {
    const deps = dependencies();
    const reader = createGapReassessmentDraftReader(deps);

    const result = await reader.getPreauthorized({
      organizationId: "organization",
      assessmentId: "assessment",
      locale: "de",
      release: release("release-b", "de"),
    });

    expect(result?.summary.gapAnalysisReleaseVersion).toBe("release-b-de");
    expect(deps.loadRelease).not.toHaveBeenCalled();
  });

  it("loads the draft's pinned release when a reused release does not match", async () => {
    const deps = dependencies();
    const reader = createGapReassessmentDraftReader(deps);

    const result = await reader.getPreauthorized({
      organizationId: "organization",
      assessmentId: "assessment",
      locale: "de",
      release: release("release-a", "de"),
    });

    expect(deps.loadRelease).toHaveBeenCalledWith("release-b", "de");
    expect(result?.summary.gapAnalysisReleaseVersion).toBe("release-b-de");
  });

  it("does not enter the preauthorized read when public authorization fails", async () => {
    const deps = dependencies();
    deps.authorize.mockRejectedValueOnce(new Error("forbidden"));
    const reader = createGapReassessmentDraftReader(deps);

    await expect(
      reader.getAuthorized({
        userId: "user",
        organizationId: "organization",
        assessmentId: "assessment",
        locale: "de",
      }),
    ).rejects.toThrow("forbidden");
    expect(deps.findDraft).not.toHaveBeenCalled();
  });

  it("starts independent draft metadata reads before any peer completes", async () => {
    function pending<T>() {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((complete) => {
        resolve = complete;
      });
      return { promise, resolve };
    }
    const selected = pending<[]>();
    const accepted = pending<[]>();
    const loadedRelease = pending<LoadedGapRelease>();
    const baseRevision = pending<null>();
    const assessmentRevision = pending<{ revisionNumber: number }>();
    const assessment = pending<{ applicabilityArtifactRevisionId: null }>();
    const deps = {
      ...dependencies(),
      loadSelected: vi.fn(() => selected.promise),
      loadAcceptedEvidence: vi.fn(() => accepted.promise),
      loadRelease: vi.fn(() => loadedRelease.promise),
      loadBaseRevision: vi.fn(() => baseRevision.promise),
      loadAssessmentRevision: vi.fn(() => assessmentRevision.promise),
      loadAssessment: vi.fn(() => assessment.promise),
    };
    const reader = createGapReassessmentDraftReader(deps);

    const result = reader.getPreauthorized({
      organizationId: "organization",
      assessmentId: "assessment",
      locale: "de",
    });
    await vi.waitFor(() => {
      expect(deps.loadSelected).toHaveBeenCalledOnce();
      expect(deps.loadAcceptedEvidence).toHaveBeenCalledOnce();
      expect(deps.loadRelease).toHaveBeenCalledOnce();
      expect(deps.loadBaseRevision).toHaveBeenCalledOnce();
      expect(deps.loadAssessmentRevision).toHaveBeenCalledOnce();
      expect(deps.loadAssessment).toHaveBeenCalledOnce();
    });

    selected.resolve([]);
    accepted.resolve([]);
    loadedRelease.resolve(release("release-b", "de"));
    baseRevision.resolve(null);
    assessmentRevision.resolve({ revisionNumber: 4 });
    assessment.resolve({ applicabilityArtifactRevisionId: null });

    await expect(result).resolves.toMatchObject({
      summary: { gapAnalysisReleaseVersion: "release-b-de" },
    });
  });
});

describe("Gap workflow reader", () => {
  it("starts independent document-library and active-release reads together", async () => {
    let resolveDocuments!: (value: { documents: [] }) => void;
    let resolveRelease!: (value: null) => void;
    const documents = new Promise<{ documents: [] }>((resolve) => {
      resolveDocuments = resolve;
    });
    const activeRelease = new Promise<null>((resolve) => {
      resolveRelease = resolve;
    });
    const loadDocumentLibrary = vi.fn(() => documents);
    const loadActiveRelease = vi.fn(() => activeRelease);
    const readWorkflow = createGapAnalysisWorkflowReader({
      authorize: vi.fn(async () => ({ role: "owner" as const })),
      loadDocumentLibrary,
      loadActiveRelease,
      getCurrentDocuments: vi.fn(() => []),
      loadAssessment: vi.fn(),
      loadArtifact: vi.fn(),
      loadAnswerRows: vi.fn(),
      loadArtifactRevisions: vi.fn(),
      selectCandidate: vi.fn(),
      loadAnswerOptions: vi.fn(),
      loadFindings: vi.fn(),
      loadReassessment: vi.fn(),
      loadStaleness: vi.fn(),
      loadActivePlan: vi.fn(),
      loadRun: vi.fn(),
    });

    const result = readWorkflow({
      userId: "user",
      organizationId: "organization",
      locale: "de",
    });
    await vi.waitFor(() => {
      expect(loadDocumentLibrary).toHaveBeenCalledOnce();
      expect(loadActiveRelease).toHaveBeenCalledOnce();
    });

    resolveDocuments({ documents: [] });
    resolveRelease(null);

    await expect(result).resolves.toMatchObject({
      release: null,
      documentLibrary: { documents: [] },
    });
  });

  it("keeps later workflow reads inside their dependency-bounded phases", async () => {
    function pending<T>() {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((complete) => {
        resolve = complete;
      });
      return { promise, resolve };
    }
    const assessment = pending<{
      id: string;
      currentRevisionId: string | null;
    }>();
    const artifact = pending<{ id: string }>();
    const answers = pending<[]>();
    const revisions = pending<{ accepted: null; working: null }>();
    const answerOptions = pending<[]>();
    const findings = pending<[]>();
    const reassessment = pending<null>();
    const staleness = pending<null>();
    const activePlan = pending<null>();
    const run = pending<null>();
    const deps = {
      authorize: vi.fn(async () => ({ role: "owner" as const })),
      loadDocumentLibrary: vi.fn(async () => ({ documents: [] })),
      loadActiveRelease: vi.fn(async () => release("release-a", "de")),
      getCurrentDocuments: vi.fn(() => []),
      loadAssessment: vi.fn(() => assessment.promise),
      loadArtifact: vi.fn(() => artifact.promise),
      loadAnswerRows: vi.fn(() => answers.promise),
      loadArtifactRevisions: vi.fn(() => revisions.promise),
      selectCandidate: vi.fn(() => null),
      loadAnswerOptions: vi.fn(() => answerOptions.promise),
      loadFindings: vi.fn(() => findings.promise),
      loadReassessment: vi.fn(() => reassessment.promise),
      loadStaleness: vi.fn(() => staleness.promise),
      loadActivePlan: vi.fn(() => activePlan.promise),
      loadRun: vi.fn(() => run.promise),
    };
    const readWorkflow = createGapAnalysisWorkflowReader(deps);

    const result = readWorkflow({
      userId: "user",
      organizationId: "organization",
      locale: "de",
    });
    await vi.waitFor(() => {
      expect(deps.loadAssessment).toHaveBeenCalledOnce();
      expect(deps.loadArtifact).toHaveBeenCalledOnce();
    });

    assessment.resolve({ id: "assessment", currentRevisionId: "revision" });
    artifact.resolve({ id: "artifact" });
    await vi.waitFor(() => {
      expect(deps.loadAnswerRows).toHaveBeenCalledOnce();
      expect(deps.loadArtifactRevisions).toHaveBeenCalledOnce();
    });

    answers.resolve([]);
    revisions.resolve({ accepted: null, working: null });
    await vi.waitFor(() => {
      expect(deps.loadAnswerOptions).toHaveBeenCalledOnce();
      expect(deps.loadFindings).toHaveBeenCalledTimes(2);
      expect(deps.loadReassessment).toHaveBeenCalledOnce();
      expect(deps.loadStaleness).toHaveBeenCalledTimes(2);
      expect(deps.loadActivePlan).toHaveBeenCalledOnce();
    });
    expect(deps.loadRun).not.toHaveBeenCalled();

    answerOptions.resolve([]);
    findings.resolve([]);
    reassessment.resolve(null);
    staleness.resolve(null);
    activePlan.resolve(null);
    await vi.waitFor(() => {
      expect(deps.loadRun).toHaveBeenCalledOnce();
    });
    run.resolve(null);

    await expect(result).resolves.toMatchObject({
      assessment: { id: "assessment" },
      run: null,
    });
  });
});
