import { describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/src/db", () => ({ db: {} }));

import {
  createGapReleaseReader,
  type LoadedGapRelease,
} from "@/src/server/gap-analysis/release-loader";
import { createGapReassessmentDraftReader } from "@/src/server/gap-analysis/reassessment-service";
import { createGapPageReader } from "@/src/server/gap-analysis/page-reader";

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

describe("Gap page reader", () => {
  it("reads only the Documents page data after one combined authorization", async () => {
    let queryCount = 0;
    const authorize = vi.fn(async () => {
      queryCount += 1;
      return { role: "owner" as const };
    });
    const loadDocumentLibrary = vi.fn(async () => {
      queryCount += 3;
      return {
        role: "owner",
        canContribute: true,
        documents: [],
      };
    });
    const loadActiveRelease = vi.fn(async () => {
      queryCount += 1;
      return release("release-a", "de");
    });
    const loadDocumentsAssessment = vi.fn(async () => {
      queryCount += 1;
      return {
        id: "assessment",
        currentRevisionId: "assessment-revision",
      };
    });
    const loadReassessment = vi.fn(async () => {
      queryCount += 2;
      return { draft: { id: "draft" } };
    });
    const loadWorkflowSnapshot = vi.fn();
    const loadAnswers = vi.fn();
    const loadFindingsBatch = vi.fn();
    const loadStalenessBatch = vi.fn();
    const loadRun = vi.fn();
    const reader = createGapPageReader({
      authorize,
      loadDocumentLibrary,
      loadActiveRelease,
      getCurrentDocuments: vi.fn(() => []),
      loadDocumentsAssessment,
      loadWorkflowSnapshot,
      loadPrerequisite: vi.fn(),
      loadHistory: vi.fn(),
      loadAnswers,
      loadFindingsBatch,
      loadReassessment,
      loadStalenessBatch,
      loadRun,
      loadGeneratedInputs: vi.fn(),
    });

    await expect(
      reader.readDocuments({
        userId: "user",
        organizationId: "organization",
        locale: "de",
      }),
    ).resolves.toEqual({
      assessmentId: "assessment",
      documentLibrary: {
        role: "owner",
        canContribute: true,
        documents: [],
      },
      reassessment: { draft: { id: "draft" } },
    });

    expect(authorize).toHaveBeenCalledOnce();
    expect(authorize).toHaveBeenCalledWith(
      expect.anything(),
      ["documents:read", "gap:read"],
    );
    expect(loadWorkflowSnapshot).not.toHaveBeenCalled();
    expect(loadAnswers).not.toHaveBeenCalled();
    expect(loadFindingsBatch).not.toHaveBeenCalled();
    expect(loadStalenessBatch).not.toHaveBeenCalled();
    expect(loadRun).not.toHaveBeenCalled();
    expect(queryCount).toBe(8);
  });

  it("preserves the complete Gap DTO within the warm query budget", async () => {
    let queryCount = 0;
    const activeRelease = release("release-a", "de");
    const assessment = {
      id: "assessment",
      currentRevisionId: "assessment-revision",
    };
    const documentLibrary = {
      role: "owner",
      canContribute: true,
      documents: [],
    };
    const documents = [{ document: { id: "document" } }];
    const acceptedRevision = { id: "accepted" };
    const candidateRevision = { id: "candidate" };
    const acceptedFindings = [
      { finding: { id: "accepted-finding", requiresReview: false } },
    ];
    const candidateFindings = [
      { finding: { id: "candidate-finding", requiresReview: true } },
    ];
    const reassessment = { draft: { id: "draft" } };
    const acceptedStaleness = { stale: false };
    const candidateStaleness = { stale: true };
    const run = { id: "run" };
    const reader = createGapPageReader({
      authorize: vi.fn(async () => {
        queryCount += 1;
        return { role: "owner" as const };
      }),
      loadDocumentLibrary: vi.fn(async () => {
        queryCount += 3;
        return documentLibrary;
      }),
      loadActiveRelease: vi.fn(async () => {
        queryCount += 1;
        return activeRelease;
      }),
      getCurrentDocuments: vi.fn(() => documents),
      loadDocumentsAssessment: vi.fn(),
      loadWorkflowSnapshot: vi.fn(async () => {
        queryCount += 1;
        return {
          assessment,
          acceptedRevision,
          currentRevision: candidateRevision,
          activePlan: { sourceGapArtifactRevisionId: "older-revision" },
          runContext: { assessmentRevisionId: "assessment-revision" },
        };
      }),
      loadPrerequisite: vi.fn(async () => {
        queryCount += 1;
        return {
          satisfied: true,
          destination: "/applicability-check",
        };
      }),
      loadHistory: vi.fn(async () => {
        queryCount += 1;
        return [];
      }),
      loadAnswers: vi.fn(async () => {
        queryCount += 1;
        return { question: "option" };
      }),
      loadFindingsBatch: vi.fn(async () => {
        queryCount += 1;
        return {
          accepted: acceptedFindings,
          candidate: candidateFindings,
        };
      }),
      loadReassessment: vi.fn(async () => {
        queryCount += 2;
        return reassessment;
      }),
      loadStalenessBatch: vi.fn(async () => {
        queryCount += 1;
        return {
          accepted: acceptedStaleness,
          candidate: candidateStaleness,
        };
      }),
      loadRun: vi.fn(async () => {
        queryCount += 1;
        return run;
      }),
      loadGeneratedInputs: vi.fn(async () => {
        queryCount += 3;
        return { revisionId: "candidate" };
      }),
    });

    await expect(
      reader.readGap({
        userId: "user",
        organizationId: "organization",
        locale: "de",
      }),
    ).resolves.toEqual({
      role: "owner",
      canContribute: true,
      canManage: true,
      release: activeRelease,
      assessment,
      answers: { question: "option" },
      documents,
      documentLibrary,
      run,
      revision: candidateRevision,
      findings: candidateFindings,
      acceptedRevision,
      acceptedFindings,
      candidateRevision,
      candidateFindings,
      activePlan: { sourceGapArtifactRevisionId: "older-revision" },
      reassessment,
      prerequisite: {
        satisfied: true,
        destination: "/applicability-check",
      },
      history: [],
      generatedInputs: { revisionId: "candidate" },
      reviewBlockers: ["candidate-finding"],
      planUpdateAvailable: true,
      acceptedStaleness,
      candidateStaleness,
      staleness: candidateStaleness,
    });
    expect(queryCount).toBe(17);
  });

  it("starts every peer in a dependency phase before awaiting a peer", async () => {
    function pending<T>() {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((complete) => {
        resolve = complete;
      });
      return { promise, resolve };
    }
    const library = pending<{ documents: [] }>();
    const activeRelease = pending<LoadedGapRelease>();
    const snapshot = pending<{
      assessment: { id: string };
      acceptedRevision: {
        id: string;
        gapAnalysisReleaseId: string;
      };
      currentRevision: null;
      activePlan: null;
      runContext: null;
    }>();
    const prerequisite = pending<{
      satisfied: boolean;
      destination: string;
    }>();
    const history = pending<[]>();
    const answers = pending<Record<string, string>>();
    const findings = pending<{ accepted: []; candidate: [] }>();
    const reassessment = pending<null>();
    const staleness = pending<{ accepted: null; candidate: null }>();
    const run = pending<null>();
    const generatedInputs = pending<{ revisionId: string }>();
    const dependencies = {
      authorize: vi.fn(async () => ({ role: "owner" as const })),
      loadDocumentLibrary: vi.fn(() => library.promise),
      loadActiveRelease: vi.fn(() => activeRelease.promise),
      getCurrentDocuments: vi.fn(() => []),
      loadDocumentsAssessment: vi.fn(),
      loadWorkflowSnapshot: vi.fn(() => snapshot.promise),
      loadPrerequisite: vi.fn(() => prerequisite.promise),
      loadHistory: vi.fn(() => history.promise),
      loadAnswers: vi.fn(() => answers.promise),
      loadFindingsBatch: vi.fn(() => findings.promise),
      loadReassessment: vi.fn(() => reassessment.promise),
      loadStalenessBatch: vi.fn(() => staleness.promise),
      loadRun: vi.fn(() => run.promise),
      loadGeneratedInputs: vi.fn(() => generatedInputs.promise),
    };
    const reader = createGapPageReader(dependencies);
    const result = reader.readGap({
      userId: "user",
      organizationId: "organization",
      locale: "de",
    });

    await vi.waitFor(() => {
      expect(dependencies.loadDocumentLibrary).toHaveBeenCalledOnce();
      expect(dependencies.loadActiveRelease).toHaveBeenCalledOnce();
    });
    expect(dependencies.loadWorkflowSnapshot).not.toHaveBeenCalled();
    activeRelease.resolve(release("release-a", "de"));

    await vi.waitFor(() => {
      expect(dependencies.loadWorkflowSnapshot).toHaveBeenCalledOnce();
      expect(dependencies.loadPrerequisite).toHaveBeenCalledOnce();
      expect(dependencies.loadHistory).toHaveBeenCalledOnce();
    });
    snapshot.resolve({
      assessment: { id: "assessment" },
      acceptedRevision: {
        id: "revision",
        gapAnalysisReleaseId: "release-a",
      },
      currentRevision: null,
      activePlan: null,
      runContext: null,
    });
    expect(dependencies.loadAnswers).not.toHaveBeenCalled();
    library.resolve({ documents: [] });
    prerequisite.resolve({
      satisfied: true,
      destination: "/applicability-check",
    });
    history.resolve([]);

    await vi.waitFor(() => {
      expect(dependencies.loadAnswers).toHaveBeenCalledOnce();
      expect(dependencies.loadFindingsBatch).toHaveBeenCalledOnce();
      expect(dependencies.loadReassessment).toHaveBeenCalledOnce();
      expect(dependencies.loadStalenessBatch).toHaveBeenCalledOnce();
      expect(dependencies.loadRun).toHaveBeenCalledOnce();
      expect(dependencies.loadGeneratedInputs).toHaveBeenCalledOnce();
      expect(dependencies.loadGeneratedInputs).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "organization",
          locale: "de",
        }),
        {
          id: "revision",
          gapAnalysisReleaseId: "release-a",
        },
        expect.objectContaining({ id: "release-a" }),
      );
    });
    answers.resolve({});
    findings.resolve({ accepted: [], candidate: [] });
    reassessment.resolve(null);
    staleness.resolve({ accepted: null, candidate: null });
    run.resolve(null);
    generatedInputs.resolve({ revisionId: "revision" });
    await expect(result).resolves.toMatchObject({
      assessment: { id: "assessment" },
      prerequisite: { satisfied: true },
      history: [],
      generatedInputs: { revisionId: "revision" },
    });
  });

  it("does not start organization data reads when authorization fails", async () => {
    const loadDocumentLibrary = vi.fn();
    const loadActiveRelease = vi.fn();
    const reader = createGapPageReader({
      authorize: vi.fn(async () => {
        throw new Error("forbidden");
      }),
      loadDocumentLibrary,
      loadActiveRelease,
      getCurrentDocuments: vi.fn(),
      loadDocumentsAssessment: vi.fn(),
      loadWorkflowSnapshot: vi.fn(),
      loadPrerequisite: vi.fn(),
      loadHistory: vi.fn(),
      loadAnswers: vi.fn(),
      loadFindingsBatch: vi.fn(),
      loadReassessment: vi.fn(),
      loadStalenessBatch: vi.fn(),
      loadRun: vi.fn(),
      loadGeneratedInputs: vi.fn(),
    });

    await expect(
      reader.readGap({
        userId: "user",
        organizationId: "organization",
        locale: "de",
      }),
    ).rejects.toThrow("forbidden");
    await expect(
      reader.readDocuments({
        userId: "user",
        organizationId: "organization",
        locale: "de",
      }),
    ).rejects.toThrow("forbidden");
    expect(loadDocumentLibrary).not.toHaveBeenCalled();
    expect(loadActiveRelease).not.toHaveBeenCalled();
  });

  it("keeps preauthorized helpers outside route and page modules", () => {
    const appRoot = join(process.cwd(), "app");
    const pending = [appRoot];
    const applicationFiles: string[] = [];
    while (pending.length) {
      const directory = pending.pop()!;
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) pending.push(path);
        else if (/\.(?:ts|tsx)$/.test(entry.name)) applicationFiles.push(path);
      }
    }

    for (const path of applicationFiles) {
      expect(readFileSync(path, "utf8")).not.toMatch(
        /(?:DocumentLibrary|ReassessmentDraft|RevisionStalenessBatch)Preauthorized/,
      );
    }
  });
});
