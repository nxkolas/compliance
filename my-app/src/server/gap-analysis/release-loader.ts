import { db } from "@/src/db";
import {
  activeGapAnalysisReleases,
  complianceFrameworkVersions,
  complianceModules,
  contentTranslations,
  gapAnalysisReleaseApplicabilityRules,
  gapAnalysisReleases,
  gapRequirements,
  gapRequirementSetMembers,
  gapRequirementSetVersions,
  gapRequirementVersions,
  questionOptions,
  questionnaireVersions,
  questionnaires,
  questions,
} from "@/src/db/schema";
import type { Locale } from "@/lib/i18n-config";
import { asc, eq, inArray } from "drizzle-orm";
import { resolveGapContentTranslation } from "./localize-content";

export type LoadedGapRelease = {
  id: string;
  releaseCode: string;
  versionLabel: string;
  moduleId: string;
  moduleTitle: string;
  questionnaireId: string;
  questionnaireVersionId: string;
  questionnaireTitle: string;
  requirementSetTitle: string;
  compatibleCheckReleaseId: string;
  prompt: {
    name: string;
    version: string;
    templateHash: string;
    responseSchemaVersion: string;
  };
  evaluator: { kind: string; version: number };
  questions: Array<{
    id: string;
    stableKey: string;
    position: number;
    questionText: string;
    helpText: string | null;
    answerType: string;
    required: boolean;
    options: Array<{
      id: string;
      stableValue: string;
      label: string;
      position: number;
    }>;
  }>;
  requirements: Array<{
    id: string;
    stableRequirementId: string;
    code: string;
    position: number;
    criticality: "low" | "medium" | "high" | "critical";
    title: string;
    requirementText: string;
    legalReferences: unknown;
    applicabilityOutcomeCodes: string[];
    questionStableKeys: string[];
  }>;
};

export type GapReleaseReader = {
  getPublished: (input: {
    releaseId: string;
    locale: Locale;
  }) => Promise<LoadedGapRelease | null>;
  getActive: (input: {
    releaseCode: string;
    locale: Locale;
  }) => Promise<LoadedGapRelease | null>;
};

export function createGapReleaseReader(input: {
  loadPublished: GapReleaseReader["getPublished"];
  loadActivePointer: (
    releaseCode: string,
  ) => Promise<{ gapAnalysisReleaseId: string } | null | undefined>;
}): GapReleaseReader {
  return {
    getPublished: input.loadPublished,
    async getActive({ releaseCode, locale }) {
      const pointer = await input.loadActivePointer(releaseCode);
      if (!pointer) return null;
      return input.loadPublished({
        releaseId: pointer.gapAnalysisReleaseId,
        locale,
      });
    },
  };
}

export async function loadActiveGapAnalysisReleasePointer(
  releaseCode: string,
) {
  return db.query.activeGapAnalysisReleases.findFirst({ columns: { releaseCode: true, gapAnalysisReleaseId: true, activatedBy: true, activatedAt: true },
    where: eq(activeGapAnalysisReleases.releaseCode, releaseCode),
  });
}

export async function loadGapAnalysisRelease(
  releaseId: string,
  locale: Locale,
): Promise<LoadedGapRelease | null> {
  const release = await db.query.gapAnalysisReleases.findFirst({ columns: { id: true, releaseCode: true, versionLabel: true, moduleId: true, questionnaireId: true, questionnaireVersionId: true, requirementSetVersionId: true, compatibleCheckReleaseId: true, promptName: true, promptVersion: true, promptTemplateHash: true, responseSchemaVersion: true, evaluatorKind: true, evaluatorVersion: true, defaultLocale: true, status: true, aggregateHash: true, corpusReleaseSetHash: true, publishedAt: true, createdAt: true },
    where: eq(gapAnalysisReleases.id, releaseId),
  });
  if (!release || release.status !== "published") return null;
  const gapModule = await db.query.complianceModules.findFirst({ columns: { id: true, frameworkVersionId: true, code: true, nameContentRevisionId: true, moduleType: true, position: true },
    where: eq(complianceModules.id, release.moduleId),
  });
  if (!gapModule) return null;
  const frameworkVersion = await db.query.complianceFrameworkVersions.findFirst({ columns: { id: true, frameworkId: true, versionLabel: true, nameContentRevisionId: true, descriptionContentRevisionId: true, status: true, effectiveFrom: true, effectiveTo: true, createdAt: true },
    where: eq(complianceFrameworkVersions.id, gapModule.frameworkVersionId),
  });
  if (!frameworkVersion) return null;
  const questionnaireVersion = await db.query.questionnaireVersions.findFirst({ columns: { id: true, questionnaireId: true, versionLabel: true, titleContentRevisionId: true, status: true, createdAt: true, publishedAt: true },
    where: eq(questionnaireVersions.id, release.questionnaireVersionId),
  });
  if (!questionnaireVersion) return null;
  const questionnaire = await db.query.questionnaires.findFirst({ columns: { id: true, moduleId: true, code: true, createdAt: true },
    where: eq(questionnaires.id, questionnaireVersion.questionnaireId),
  });
  if (!questionnaire) return null;
  const requirementSetVersion =
    await db.query.gapRequirementSetVersions.findFirst({ columns: { id: true, requirementSetId: true, versionLabel: true, titleContentRevisionId: true, status: true, contentHash: true, createdAt: true, publishedAt: true },
      where: eq(
        gapRequirementSetVersions.id,
        release.requirementSetVersionId,
      ),
    });
  if (!requirementSetVersion) return null;

  const questionRows = await db.query.questions.findMany({ columns: { id: true, questionnaireVersionId: true, stableKey: true, position: true, questionContentRevisionId: true, helpContentRevisionId: true, answerType: true, required: true, config: true, createdAt: true },
    where: eq(questions.questionnaireVersionId, questionnaireVersion.id),
    orderBy: [asc(questions.position)],
  });
  const optionRows = questionRows.length
    ? await db.query.questionOptions.findMany({ columns: { id: true, questionId: true, stableValue: true, labelContentRevisionId: true, factOptionId: true, position: true, metadata: true },
        where: inArray(
          questionOptions.questionId,
          questionRows.map((question) => question.id),
        ),
        orderBy: [asc(questionOptions.position)],
      })
    : [];
  const members = await db
    .select({
      position: gapRequirementSetMembers.position,
      id: gapRequirementVersions.id,
      stableRequirementId: gapRequirements.id,
      code: gapRequirements.code,
      criticality: gapRequirementVersions.criticality,
      titleContentRevisionId: gapRequirementVersions.titleContentRevisionId,
      requirementTextContentRevisionId:
        gapRequirementVersions.requirementTextContentRevisionId,
      legalReferences: gapRequirementVersions.legalReferences,
    })
    .from(gapRequirementSetMembers)
    .innerJoin(
      gapRequirementVersions,
      eq(
        gapRequirementSetMembers.requirementVersionId,
        gapRequirementVersions.id,
      ),
    )
    .innerJoin(
      gapRequirements,
      eq(gapRequirementVersions.requirementId, gapRequirements.id),
    )
    .where(
      eq(
        gapRequirementSetMembers.requirementSetVersionId,
        release.requirementSetVersionId,
      ),
    )
    .orderBy(asc(gapRequirementSetMembers.position));
  const contentRevisionIds = [
    frameworkVersion.nameContentRevisionId,
    frameworkVersion.descriptionContentRevisionId,
    gapModule.nameContentRevisionId,
    questionnaireVersion.titleContentRevisionId,
    requirementSetVersion.titleContentRevisionId,
    ...questionRows.flatMap((question) => [
      question.questionContentRevisionId,
      ...(question.helpContentRevisionId ? [question.helpContentRevisionId] : []),
    ]),
    ...optionRows.map((option) => option.labelContentRevisionId),
    ...members.flatMap((requirement) => [
      requirement.titleContentRevisionId,
      requirement.requirementTextContentRevisionId,
    ]),
  ];
  const translations = contentRevisionIds.length
    ? await db.query.contentTranslations.findMany({ columns: { contentRevisionId: true, locale: true, value: true },
        where: inArray(contentTranslations.contentRevisionId, contentRevisionIds),
      })
    : [];
  const translated = new Map<string, Map<string, string>>();
  for (const row of translations) {
    const values = translated.get(row.contentRevisionId) ?? new Map();
    values.set(row.locale, row.value);
    translated.set(row.contentRevisionId, values);
  }
  const text = (revisionId: string) =>
    resolveGapContentTranslation(
      translated,
      revisionId,
      locale,
      release.defaultLocale,
    );

  const rules = await db.query.gapAnalysisReleaseApplicabilityRules.findMany({ columns: { id: true, gapAnalysisReleaseId: true, requirementVersionId: true, conditions: true, createdAt: true },
    where: eq(
      gapAnalysisReleaseApplicabilityRules.gapAnalysisReleaseId,
      release.id,
    ),
  });
  const ruleByRequirement = new Map(
    rules.map((rule) => [rule.requirementVersionId, parseConditions(rule.conditions)]),
  );

  return {
    id: release.id,
    releaseCode: release.releaseCode,
    versionLabel: release.versionLabel,
    moduleId: release.moduleId,
    moduleTitle: text(gapModule.nameContentRevisionId),
    questionnaireId: questionnaire.id,
    questionnaireVersionId: questionnaireVersion.id,
    questionnaireTitle: text(questionnaireVersion.titleContentRevisionId),
    requirementSetTitle: text(
      requirementSetVersion.titleContentRevisionId,
    ),
    compatibleCheckReleaseId: release.compatibleCheckReleaseId,
    prompt: {
      name: release.promptName,
      version: release.promptVersion,
      templateHash: release.promptTemplateHash,
      responseSchemaVersion: release.responseSchemaVersion,
    },
    evaluator: { kind: release.evaluatorKind, version: release.evaluatorVersion },
    questions: questionRows.map((question) => ({
      id: question.id,
      stableKey: question.stableKey,
      position: question.position,
      questionText: text(question.questionContentRevisionId),
      helpText: question.helpContentRevisionId
        ? text(question.helpContentRevisionId)
        : null,
      answerType: question.answerType,
      required: question.required,
      options: optionRows
        .filter((option) => option.questionId === question.id)
        .map((option) => ({
          id: option.id,
          stableValue: option.stableValue,
          label: text(option.labelContentRevisionId),
          position: option.position,
        })),
    })),
    requirements: members.map((requirement) => {
      const conditions = ruleByRequirement.get(requirement.id) ?? {
        applicabilityOutcomeCodes: [],
        questionStableKeys: [],
      };
      return {
        id: requirement.id,
        stableRequirementId: requirement.stableRequirementId,
        code: requirement.code,
        position: requirement.position,
        criticality: requirement.criticality,
        title: text(requirement.titleContentRevisionId),
        requirementText: text(requirement.requirementTextContentRevisionId),
        legalReferences: requirement.legalReferences,
        ...conditions,
      };
    }),
  };
}

function parseConditions(value: unknown) {
  const candidate = value as {
    applicabilityOutcomeCodes?: unknown;
    questionStableKeys?: unknown;
  };
  return {
    applicabilityOutcomeCodes: Array.isArray(candidate.applicabilityOutcomeCodes)
      ? candidate.applicabilityOutcomeCodes.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    questionStableKeys: Array.isArray(candidate.questionStableKeys)
      ? candidate.questionStableKeys.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
  };
}

export const directGapReleaseReader = createGapReleaseReader({
  loadPublished: ({ releaseId, locale }) =>
    loadGapAnalysisRelease(releaseId, locale),
  loadActivePointer: loadActiveGapAnalysisReleasePointer,
});

export async function getActiveGapAnalysisRelease(
  releaseCode: string,
  locale: Locale,
) {
  return directGapReleaseReader.getActive({ releaseCode, locale });
}
