import { beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { contentTranslations } from "@/src/db/schema";

const { mockedDb, findTranslations } = vi.hoisted(() => {
  const findTranslations = vi.fn();
  return {
    findTranslations,
    mockedDb: {
      query: {
        gapAnalysisReleases: { findFirst: vi.fn() },
        complianceModules: { findFirst: vi.fn() },
        complianceFrameworkVersions: { findFirst: vi.fn() },
        questionnaireVersions: { findFirst: vi.fn() },
        questionnaires: { findFirst: vi.fn() },
        gapRequirementSetVersions: { findFirst: vi.fn() },
        questions: { findMany: vi.fn() },
        questionOptions: { findMany: vi.fn() },
        contentTranslations: { findMany: findTranslations },
        gapAnalysisReleaseApplicabilityRules: { findMany: vi.fn() },
        gapRequirementQuestionMappings: { findMany: vi.fn() },
      },
      select: vi.fn(),
    },
  };
});

vi.mock("@/src/db", () => ({ db: mockedDb }));

import { loadGapAnalysisRelease } from "@/src/server/gap-analysis/release-loader";

const translations = [
  ["framework-name", "Framework", "Rahmenwerk"],
  ["framework-description", "Description", "Beschreibung"],
  ["module-name", "Gap", "Lücke"],
  ["questionnaire-title", "Questionnaire", "Fragebogen"],
  ["set-title", "Requirements", "Anforderungen"],
  ["question", "Question", "Frage"],
  ["help", "Help", "Hilfe"],
  ["option", "Yes", "Ja"],
  ["requirement-title", "Access control", "Zugriffskontrolle"],
  ["requirement-text", "Review access", "Zugriffe prüfen"],
].flatMap(([contentRevisionId, en, de]) => [
  { contentRevisionId, locale: "en", value: en },
  { contentRevisionId, locale: "de", value: de },
]);

describe("Gap release loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedDb.query.gapAnalysisReleases.findFirst.mockResolvedValue({
      id: "release",
      releaseCode: "nis2-gap",
      versionLabel: "v1",
      moduleId: "module",
      questionnaireVersionId: "questionnaire-version",
      requirementSetVersionId: "set-version",
      compatibleCheckReleaseId: "check-release",
      promptName: "gap",
      promptVersion: "1",
      promptTemplateHash: "hash",
      responseSchemaVersion: "1",
      evaluatorKind: "deterministic",
      evaluatorVersion: 1,
      defaultLocale: "de",
      status: "published",
    });
    mockedDb.query.complianceModules.findFirst.mockResolvedValue({
      id: "module",
      frameworkVersionId: "framework-version",
      nameContentRevisionId: "module-name",
    });
    mockedDb.query.complianceFrameworkVersions.findFirst.mockResolvedValue({
      id: "framework-version",
      nameContentRevisionId: "framework-name",
      descriptionContentRevisionId: "framework-description",
    });
    mockedDb.query.questionnaireVersions.findFirst.mockResolvedValue({
      id: "questionnaire-version",
      questionnaireId: "questionnaire",
      titleContentRevisionId: "questionnaire-title",
    });
    mockedDb.query.questionnaires.findFirst.mockResolvedValue({
      id: "questionnaire",
    });
    mockedDb.query.gapRequirementSetVersions.findFirst.mockResolvedValue({
      id: "set-version",
      titleContentRevisionId: "set-title",
    });
    mockedDb.query.questions.findMany.mockResolvedValue([
      {
        id: "question-id",
        stableKey: "question",
        position: 1,
        questionContentRevisionId: "question",
        helpContentRevisionId: "help",
        answerType: "single_choice",
        required: true,
      },
    ]);
    mockedDb.query.questionOptions.findMany.mockResolvedValue([
      {
        id: "option-id",
        questionId: "question-id",
        stableValue: "yes",
        labelContentRevisionId: "option",
        position: 1,
      },
    ]);
    findTranslations.mockResolvedValue(translations);
    mockedDb.query.gapAnalysisReleaseApplicabilityRules.findMany.mockResolvedValue([
      {
        requirementVersionId: "requirement-version",
        conditions: {
          applicabilityOutcomeCodes: ["essential_entity"],
        },
      },
    ]);
    mockedDb.query.gapRequirementQuestionMappings.findMany.mockResolvedValue([
      {
        gapAnalysisReleaseId: "release",
        requirementVersionId: "requirement-version",
        questionId: "question-id",
        position: 1,
      },
    ]);
    const members = [
      {
        position: 1,
        id: "requirement-version",
        stableRequirementId: "stable-requirement",
        code: "access-control",
        criticality: "high",
        titleContentRevisionId: "requirement-title",
        requirementTextContentRevisionId: "requirement-text",
      },
    ];
    const memberQuery = {
      from: vi.fn(),
      innerJoin: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn(async () => members),
    };
    memberQuery.from.mockReturnValue(memberQuery);
    memberQuery.innerJoin.mockReturnValue(memberQuery);
    memberQuery.where.mockReturnValue(memberQuery);
    const legalQuery = {
      from: vi.fn(),
      innerJoin: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn(async () => []),
    };
    legalQuery.from.mockReturnValue(legalQuery);
    legalQuery.innerJoin.mockReturnValue(legalQuery);
    legalQuery.where.mockReturnValue(legalQuery);
    mockedDb.select
      .mockReturnValueOnce(memberQuery)
      .mockReturnValueOnce(legalQuery);
  });

  it("loads all requirement wording in the existing bounded translation query", async () => {
    const english = await loadGapAnalysisRelease("release", "en");

    expect(english?.requirements[0]).toMatchObject({
      title: "Access control",
      requirementText: "Review access",
    });
    expect(english?.requirements[0]).not.toHaveProperty("recommendation");
    expect(findTranslations).toHaveBeenCalledOnce();
    const queryInput = findTranslations.mock.calls[0][0] as {
      where: {
        RAW: (
          table: typeof contentTranslations,
          operators: { sql: typeof sql },
        ) => unknown;
      };
    };
    const queryStrings = collectStrings(
      queryInput.where.RAW(contentTranslations, { sql }),
    );
    expect(queryStrings).toContain("requirement-title");
    expect(queryStrings).toContain("requirement-text");
  });

  it("returns the exact German wording from the same pinned revisions", async () => {
    const german = await loadGapAnalysisRelease("release", "de");

    expect(german?.requirements[0]).toMatchObject({
      title: "Zugriffskontrolle",
      requirementText: "Zugriffe prüfen",
    });
    expect(german?.requirements[0]).not.toHaveProperty("recommendation");
    expect(findTranslations).toHaveBeenCalledOnce();
  });
});

function collectStrings(value: unknown, seen = new WeakSet<object>()): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object" || seen.has(value)) return [];
  seen.add(value);
  return Object.values(value).flatMap((entry) => collectStrings(entry, seen));
}
