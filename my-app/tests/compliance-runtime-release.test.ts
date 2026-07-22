import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
});
import {
  assemblePublishedComplianceRelease,
  type RuntimeContentRow,
  type RuntimeOptionRow,
  type RuntimeProvisionRow,
  type RuntimeQuestionRow,
  type RuntimeReleaseDataSource,
  type RuntimeReleaseHeader,
} from "@/src/server/compliance/runtime-release/postgres-assembler";
import { createRuntimeReleaseReader } from "@/src/server/compliance/runtime-release/direct-reader";
import { loadPublishedReleasesById } from "@/src/server/compliance/runtime-release/load-published-releases";
import type {
  ActiveReleasePointer,
  PublishedComplianceRelease,
} from "@/src/server/compliance/runtime-release/types";

describe("compliance runtime release", () => {
  it("assembles a cold immutable bundle in five bounded data operations", async () => {
    const calls: string[] = [];
    const source = fixtureSource(calls);

    const release = await assemblePublishedComplianceRelease(
      "release-1",
      "en",
      source,
    );

    expect(calls).toHaveLength(5);
    expect(calls[0]).toBe("header");
    expect(new Set(calls.slice(1))).toEqual(
      new Set(["questions", "options", "provisions", "content"]),
    );
    expect(release?.questions[0].questionText).toBe("Question EN");
    expect(release?.questions[0].options[0].label).toBe("Option EN");
    expect(release?.contentByStableKey["result.outcome"]).toBe("Outcome EN");
    expect(release?.questionIndexByFactKey.fact_one).toBe(0);
  });

  it("runs all four post-header operations in one concurrent dependency layer", async () => {
    const started: string[] = [];
    let releaseBarrier = () => {};
    const barrier = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });
    const source = fixtureSource([]);
    source.loadQuestions = async () => {
      started.push("questions");
      await barrier;
      return fixtureQuestions();
    };
    source.loadOptions = async () => {
      started.push("options");
      await barrier;
      return fixtureOptions();
    };
    source.loadProvisions = async () => {
      started.push("provisions");
      await barrier;
      return fixtureProvisions();
    };
    source.loadContent = async () => {
      started.push("content");
      await barrier;
      return fixtureContent();
    };

    const assembly = assemblePublishedComplianceRelease(
      "release-1",
      "de",
      source,
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(new Set(started)).toEqual(
      new Set(["questions", "options", "provisions", "content"]),
    );
    releaseBarrier();
    await expect(assembly).resolves.not.toBeNull();
  });

  it("reuses a cached immutable bundle while resolving the active pointer every time", async () => {
    let assemblerCalls = 0;
    let pointerCalls = 0;
    let activeReleaseId = "release-1";
    const cache = new Map<string, PublishedComplianceRelease | null>();
    const reader = createRuntimeReleaseReader({
      async loadPublished(input) {
        const key = `${input.checkReleaseId}:${input.locale}`;
        if (!cache.has(key)) {
          assemblerCalls += 1;
          const assembled = await assemblePublishedComplianceRelease(
              input.checkReleaseId,
              input.locale,
              fixtureSource([]),
            );
          cache.set(
            key,
            assembled
              ? {
                  ...assembled,
                  checkReleaseId: input.checkReleaseId,
                  releaseVersionLabel: input.checkReleaseId,
                }
              : null,
          );
        }
        return cache.get(key) ?? null;
      },
      async loadActivePointer(checkCode) {
        pointerCalls += 1;
        return {
          checkCode,
          checkReleaseId: activeReleaseId,
          versionLabel: activeReleaseId,
        };
      },
    });

    const first = await reader.getActive({ checkCode: "check", locale: "de" });
    const second = await reader.getActive({ checkCode: "check", locale: "de" });
    activeReleaseId = "release-2";
    const third = await reader.getActive({ checkCode: "check", locale: "de" });

    expect(first?.published).toEqual(second?.published);
    expect(third?.published.checkReleaseId).toBe("release-2");
    expect(assemblerCalls).toBe(2);
    expect(pointerCalls).toBe(3);
  });

  it("returns equivalent DTOs through direct and cached reader seams", async () => {
    const release = await assemblePublishedComplianceRelease(
      "release-1",
      "de",
      fixtureSource([]),
    );
    const pointer: ActiveReleasePointer = {
      checkCode: "check",
      checkReleaseId: "release-1",
      versionLabel: "2026-v1",
    };
    const direct = createRuntimeReleaseReader({
      loadPublished: async () => release,
      loadActivePointer: async () => pointer,
    });
    const cached = createRuntimeReleaseReader({
      loadPublished: async () => structuredClone(release),
      loadActivePointer: async () => pointer,
    });

    await expect(
      direct.getActive({ checkCode: "check", locale: "de" }),
    ).resolves.toEqual(
      await cached.getActive({ checkCode: "check", locale: "de" }),
    );
  });

  it("loads each unique pinned release at most once per settings call", async () => {
    const requestedIds: string[] = [];
    const reader = createRuntimeReleaseReader({
      async loadPublished({ checkReleaseId }) {
        requestedIds.push(checkReleaseId);
        return null;
      },
      async loadActivePointer() {
        return null;
      },
    });

    await loadPublishedReleasesById(
      reader,
      ["release-1", "release-1", "release-2", "release-1"],
      "de",
    );

    expect(requestedIds).toEqual(["release-1", "release-2"]);
  });
});

function fixtureSource(calls: string[]): RuntimeReleaseDataSource {
  return {
    async loadHeader() {
      calls.push("header");
      return fixtureHeader();
    },
    async loadQuestions() {
      calls.push("questions");
      return fixtureQuestions();
    },
    async loadOptions() {
      calls.push("options");
      return fixtureOptions();
    },
    async loadProvisions() {
      calls.push("provisions");
      return fixtureProvisions();
    },
    async loadContent() {
      calls.push("content");
      return fixtureContent();
    },
  };
}

function fixtureHeader(): RuntimeReleaseHeader {
  return {
    release: {
      id: "release-1",
      checkCode: "check",
      versionLabel: "2026-v1",
      moduleId: "module-1",
      questionnaireVersionId: "questionnaire-version-1",
      scopeModelVersionId: "scope-model-version-1",
      scopeThresholdSetId: "threshold-1",
      ruleSetId: "rule-set-1",
      evaluatorKind: "test",
      evaluatorVersion: 1,
      defaultLocale: "de",
      effectiveFrom: null,
      effectiveTo: null,
      status: "published",
      aggregateHash: "hash",
      corpusReleaseSetHash: null,
      publishedAt: new Date("2026-01-01T00:00:00Z"),
      createdAt: new Date("2026-01-01T00:00:00Z"),
    },
    questionnaireVersion: {
      id: "questionnaire-version-1",
      questionnaireId: "questionnaire-1",
      versionLabel: "v1",
      status: "published",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      publishedAt: new Date("2026-01-01T00:00:00Z"),
    },
    questionnaire: {
      id: "questionnaire-1",
      moduleId: "module-1",
      code: "questionnaire",
      title: "Questionnaire",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    },
    ruleSet: {
      id: "rule-set-1",
      moduleId: "module-1",
      code: "rules",
      versionLabel: "v1",
      status: "published",
      evaluatorKind: "test",
      evaluatorSchemaVersion: 1,
      rules: {},
      contentHash: "rules-hash",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      publishedAt: new Date("2026-01-01T00:00:00Z"),
    },
  };
}

function fixtureQuestions(): RuntimeQuestionRow[] {
  return [
    {
      question: {
        id: "question-1",
        questionnaireVersionId: "questionnaire-version-1",
        stableKey: "question.one",
        position: 1,
        questionContentRevisionId: "content-question",
        helpContentRevisionId: null,
        answerType: "single_choice",
        required: true,
        config: {},
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
      mapping: {
        id: "mapping-1",
        questionId: "question-1",
        factKey: "fact_one",
        transform: {},
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    },
  ];
}

function fixtureOptions(): RuntimeOptionRow[] {
  return [
    {
      option: {
        id: "option-1",
        questionId: "question-1",
        stableValue: "yes",
        labelContentRevisionId: "content-option",
        factOptionId: null,
        position: 1,
        metadata: {},
      },
      catalogCode: "all",
      entityVersionId: null,
      annex: null,
      descriptionContentRevisionId: null,
      sectorLabelContentRevisionId: null,
    },
  ];
}

function fixtureProvisions(): RuntimeProvisionRow[] {
  return [];
}

function fixtureContent(): RuntimeContentRow[] {
  return [
    { contentRevisionId: "content-question", stableKey: "question.one", locale: "de", value: "Frage DE" },
    { contentRevisionId: "content-question", stableKey: "question.one", locale: "en", value: "Question EN" },
    { contentRevisionId: "content-option", stableKey: "option.yes", locale: "de", value: "Option DE" },
    { contentRevisionId: "content-option", stableKey: "option.yes", locale: "en", value: "Option EN" },
    { contentRevisionId: "content-result", stableKey: "result.outcome", locale: "de", value: "Outcome DE" },
    { contentRevisionId: "content-result", stableKey: "result.outcome", locale: "en", value: "Outcome EN" },
  ];
}
