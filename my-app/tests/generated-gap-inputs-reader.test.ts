import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
});
import {
  createGeneratedGapInputsReader,
  formatFrozenAnswer,
} from "@/src/server/gap-analysis/generated-inputs-reader";
import type { LoadedGapRelease } from "@/src/server/gap-analysis/release-loader";

describe("generated Gap input snapshots", () => {
  const empty = {
    optionLabels: [],
    textValue: null,
    numberValue: null,
    booleanValue: null,
    dateValue: null,
    structuredValue: null,
  };

  it("preserves all selected option labels for future multi-select questions", () => {
    expect(
      formatFrozenAnswer({
        ...empty,
        optionLabels: ["Implemented", "Documented"],
      }),
    ).toBe("Implemented, Documented");
  });

  it("renders non-option immutable values without status assumptions", () => {
    expect(
      formatFrozenAnswer({ ...empty, textValue: "Custom answer" }),
    ).toBe("Custom answer");
    expect(
      formatFrozenAnswer({ ...empty, booleanValue: false }),
    ).toBe("No");
  });

  it("reuses a preauthorized revision and release while batching snapshot reads", async () => {
    function pending<T>() {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((complete) => {
        resolve = complete;
      });
      return { promise, resolve };
    }
    const sources = pending<
      Array<{ sourceType: string; sourceId: string }>
    >();
    const assessment = pending<{
      id: string;
      revisionNumber: number;
      submittedAt: Date;
    }>();
    const answers = pending<[]>();
    const documents = pending<[]>();
    const dependencies = {
      loadOwner: vi.fn(),
      loadSources: vi.fn(() => sources.promise),
      loadAssessment: vi.fn(() => assessment.promise),
      loadRelease: vi.fn(),
      loadAnswers: vi.fn(() => answers.promise),
      loadDocuments: vi.fn(() => documents.promise),
    };
    const reader = createGeneratedGapInputsReader(dependencies);
    const release = {
      id: "release",
      releaseCode: "nis2-gap",
      versionLabel: "1",
      moduleId: "gap",
      questionnaireId: "questionnaire",
      questionnaireVersionId: "questionnaire-version",
      questionnaireTitle: "Questionnaire",
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
    } satisfies LoadedGapRelease;

    const result = reader.getPreauthorized({
      organizationId: "organization",
      locale: "de",
      revision: {
        id: "revision",
        gapAnalysisReleaseId: "release",
      },
      release,
    });

    expect(dependencies.loadOwner).not.toHaveBeenCalled();
    expect(dependencies.loadSources).toHaveBeenCalledOnce();
    expect(dependencies.loadAssessment).not.toHaveBeenCalled();
    sources.resolve([
      {
        sourceType: "assessment_revision",
        sourceId: "assessment-revision",
      },
    ]);

    await vi.waitFor(() => {
      expect(dependencies.loadAssessment).toHaveBeenCalledOnce();
      expect(dependencies.loadAnswers).toHaveBeenCalledOnce();
      expect(dependencies.loadDocuments).toHaveBeenCalledOnce();
    });
    expect(dependencies.loadRelease).not.toHaveBeenCalled();

    assessment.resolve({
      id: "assessment-revision",
      revisionNumber: 2,
      submittedAt: new Date("2026-07-23T12:00:00.000Z"),
    });
    answers.resolve([]);
    documents.resolve([]);

    await expect(result).resolves.toMatchObject({
      revisionId: "revision",
      assessmentRevision: {
        id: "assessment-revision",
        revisionNumber: 2,
      },
    });
  });
});
