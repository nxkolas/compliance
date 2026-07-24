import { db } from "@/src/db";
import {
  activeComplianceCheckReleases,
  complianceCheckReleaseContentRevisions,
  complianceCheckReleases,
  contentItems,
  contentRevisions,
  contentTranslations,
  factOptions,
  legalProvisions,
  questionFactMappings,
  questionOptions,
  questionnaireVersions,
  questionnaires,
  questions,
  ruleSets,
  scopeEntityTypeLegalProvisions,
  scopeEntityTypes,
  scopeEntityTypeVersions,
  scopeSectorVersions,
} from "@/src/db/schema";
import type { Locale } from "@/lib/i18n-config";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  optionIndexKey,
  type ActiveReleasePointer,
  type PublishedComplianceRelease,
} from "./types";

export type RuntimeReleaseHeader = {
  release: typeof complianceCheckReleases.$inferSelect;
  questionnaireVersion: typeof questionnaireVersions.$inferSelect;
  questionnaire: typeof questionnaires.$inferSelect;
  ruleSet: typeof ruleSets.$inferSelect;
};

export type RuntimeQuestionRow = {
  question: typeof questions.$inferSelect;
  mapping: typeof questionFactMappings.$inferSelect | null;
};

export type RuntimeOptionRow = {
  option: typeof questionOptions.$inferSelect;
  catalogCode: string | null;
  entityVersionId: string | null;
  annex: number | null;
  descriptionContentRevisionId: string | null;
  sectorLabelContentRevisionId: string | null;
};

export type RuntimeProvisionRow = {
  entityVersionId: string;
  citationContentRevisionId: string | null;
};

export type RuntimeContentRow = {
  contentRevisionId: string;
  stableKey: string;
  locale: string;
  value: string;
};

export type RuntimeReleaseDataSource = {
  loadHeader(checkReleaseId: string): Promise<RuntimeReleaseHeader | null>;
  loadQuestions(questionnaireVersionId: string): Promise<RuntimeQuestionRow[]>;
  loadOptions(input: {
    questionnaireVersionId: string;
    scopeModelVersionId: string;
  }): Promise<RuntimeOptionRow[]>;
  loadProvisions(scopeModelVersionId: string): Promise<RuntimeProvisionRow[]>;
  loadContent(input: {
    checkReleaseId: string;
    locale: Locale;
    defaultLocale: string;
  }): Promise<RuntimeContentRow[]>;
};

export type TranslationFallbackWarning = {
  event: "compliance.translation_fallback";
  checkReleaseId: string;
  releaseVersionLabel: string;
  contentRevisionId: string;
  stableKey: string;
  requestedLocale: Locale;
  fallbackLocale: string;
};

type RuntimeReleaseAssemblyOptions = {
  onTranslationFallback?: (warning: TranslationFallbackWarning) => void;
};

export const postgresRuntimeReleaseDataSource: RuntimeReleaseDataSource = {
  async loadHeader(checkReleaseId) {
    const rows = await db
      .select({
        release: complianceCheckReleases,
        questionnaireVersion: questionnaireVersions,
        questionnaire: questionnaires,
        ruleSet: ruleSets,
      })
      .from(complianceCheckReleases)
      .innerJoin(
        questionnaireVersions,
        eq(
          complianceCheckReleases.questionnaireVersionId,
          questionnaireVersions.id,
        ),
      )
      .innerJoin(
        questionnaires,
        eq(questionnaireVersions.questionnaireId, questionnaires.id),
      )
      .innerJoin(ruleSets, eq(complianceCheckReleases.ruleSetId, ruleSets.id))
      .where(eq(complianceCheckReleases.id, checkReleaseId))
      .limit(1);
    return rows[0] ?? null;
  },

  loadQuestions(questionnaireVersionId) {
    return db
      .select({ question: questions, mapping: questionFactMappings })
      .from(questions)
      .leftJoin(
        questionFactMappings,
        eq(questionFactMappings.questionId, questions.id),
      )
      .where(eq(questions.questionnaireVersionId, questionnaireVersionId))
      .orderBy(asc(questions.position));
  },

  loadOptions({ questionnaireVersionId, scopeModelVersionId }) {
    return db
      .select({
        option: questionOptions,
        catalogCode: factOptions.catalogCode,
        entityVersionId: scopeEntityTypeVersions.id,
        annex: scopeEntityTypeVersions.annex,
        descriptionContentRevisionId:
          scopeEntityTypeVersions.descriptionContentRevisionId,
        sectorLabelContentRevisionId:
          scopeSectorVersions.labelContentRevisionId,
      })
      .from(questionOptions)
      .innerJoin(questions, eq(questionOptions.questionId, questions.id))
      .leftJoin(factOptions, eq(questionOptions.factOptionId, factOptions.id))
      .leftJoin(
        scopeEntityTypes,
        eq(factOptions.scopeEntityTypeId, scopeEntityTypes.id),
      )
      .leftJoin(
        scopeEntityTypeVersions,
        and(
          eq(
            scopeEntityTypeVersions.scopeEntityTypeId,
            scopeEntityTypes.id,
          ),
          eq(
            scopeEntityTypeVersions.scopeModelVersionId,
            scopeModelVersionId,
          ),
        ),
      )
      .leftJoin(
        scopeSectorVersions,
        eq(
          scopeEntityTypeVersions.scopeSectorVersionId,
          scopeSectorVersions.id,
        ),
      )
      .where(eq(questions.questionnaireVersionId, questionnaireVersionId))
      .orderBy(asc(questionOptions.position));
  },

  loadProvisions(scopeModelVersionId) {
    return db
      .select({
        entityVersionId:
          scopeEntityTypeLegalProvisions.scopeEntityTypeVersionId,
        citationContentRevisionId: legalProvisions.citationContentRevisionId,
      })
      .from(scopeEntityTypeLegalProvisions)
      .innerJoin(
        scopeEntityTypeVersions,
        eq(
          scopeEntityTypeLegalProvisions.scopeEntityTypeVersionId,
          scopeEntityTypeVersions.id,
        ),
      )
      .innerJoin(
        legalProvisions,
        eq(
          scopeEntityTypeLegalProvisions.legalProvisionId,
          legalProvisions.id,
        ),
      )
      .where(
        eq(
          scopeEntityTypeVersions.scopeModelVersionId,
          scopeModelVersionId,
        ),
      );
  },

  loadContent({ checkReleaseId, locale, defaultLocale }) {
    const requestedLocales = [...new Set([locale, defaultLocale])];
    return db
      .select({
        contentRevisionId: contentRevisions.id,
        stableKey: contentItems.stableKey,
        locale: contentTranslations.locale,
        value: contentTranslations.value,
      })
      .from(complianceCheckReleaseContentRevisions)
      .innerJoin(
        contentRevisions,
        eq(
          complianceCheckReleaseContentRevisions.contentRevisionId,
          contentRevisions.id,
        ),
      )
      .innerJoin(contentItems, eq(contentRevisions.contentItemId, contentItems.id))
      .innerJoin(
        contentTranslations,
        eq(contentTranslations.contentRevisionId, contentRevisions.id),
      )
      .where(
        and(
          eq(
            complianceCheckReleaseContentRevisions.checkReleaseId,
            checkReleaseId,
          ),
          inArray(contentTranslations.locale, requestedLocales),
        ),
      );
  },
};

export async function assemblePublishedComplianceRelease(
  checkReleaseId: string,
  locale: Locale,
  source: RuntimeReleaseDataSource = postgresRuntimeReleaseDataSource,
  options: RuntimeReleaseAssemblyOptions = {},
): Promise<PublishedComplianceRelease | null> {
  const header = await source.loadHeader(checkReleaseId);
  if (
    !header ||
    !["published", "retired", "superseded"].includes(
      header.release.status,
    ) ||
    header.questionnaireVersion.status !== "published" ||
    header.ruleSet.status !== "published"
  ) {
    return null;
  }

  const [questionRows, optionRows, provisionRows, contentRows] =
    await Promise.all([
      source.loadQuestions(header.questionnaireVersion.id),
      source.loadOptions({
        questionnaireVersionId: header.questionnaireVersion.id,
        scopeModelVersionId: header.release.scopeModelVersionId,
      }),
      source.loadProvisions(header.release.scopeModelVersionId),
      source.loadContent({
        checkReleaseId,
        locale,
        defaultLocale: header.release.defaultLocale,
      }),
    ]);

  const questionsById = new Map<
    string,
    {
      question: typeof questions.$inferSelect;
      mappings: Array<{ factKey: string; transform: unknown }>;
    }
  >();
  for (const row of questionRows) {
    const current = questionsById.get(row.question.id) ?? {
      question: row.question,
      mappings: [],
    };
    if (row.mapping) {
      current.mappings.push({
        factKey: row.mapping.factKey,
        transform: row.mapping.transform,
      });
    }
    questionsById.set(row.question.id, current);
  }
  if (questionsById.size === 0) return null;

  const contentByRevisionAndLocale = new Map(
    contentRows.map((row) => [
      `${row.contentRevisionId}\u0000${row.locale}`,
      row.value,
    ]),
  );
  const stableKeyByRevision = new Map(
    contentRows.map((row) => [row.contentRevisionId, row.stableKey]),
  );
  const revisionByStableKey = new Map(
    contentRows.map((row) => [row.stableKey, row.contentRevisionId]),
  );
  const warnedStableKeys = new Set<string>();
  const emitFallbackWarning = (
    stableKey: string,
    contentRevisionId: string,
  ) => {
    if (warnedStableKeys.has(stableKey)) return;
    warnedStableKeys.add(stableKey);
    const warning: TranslationFallbackWarning = {
      event: "compliance.translation_fallback",
      checkReleaseId: header.release.id,
      releaseVersionLabel: header.release.versionLabel,
      contentRevisionId,
      stableKey,
      requestedLocale: locale,
      fallbackLocale: header.release.defaultLocale,
    };
    if (options.onTranslationFallback) {
      options.onTranslationFallback(warning);
    } else {
      console.warn(JSON.stringify(warning));
    }
  };
  const resolveRevision = (revisionId: string | null) => {
    if (!revisionId) return null;
    const requested = contentByRevisionAndLocale.get(
      `${revisionId}\u0000${locale}`,
    );
    if (requested !== undefined) return requested;
    const fallback = contentByRevisionAndLocale.get(
      `${revisionId}\u0000${header.release.defaultLocale}`,
    );
    if (fallback !== undefined) {
      emitFallbackWarning(
        stableKeyByRevision.get(revisionId) ?? revisionId,
        revisionId,
      );
      return fallback;
    }
    throw new Error(
      `Published release content ${revisionId} has no runtime translation`,
    );
  };
  const contentByStableKeyAndLocale = new Map(
    contentRows.map((row) => [
      `${row.stableKey}\u0000${row.locale}`,
      row.value,
    ]),
  );
  const contentByStableKey = Object.fromEntries(
    [...new Set(contentRows.map((row) => row.stableKey))].map((stableKey) => {
      const requested = contentByStableKeyAndLocale.get(
        `${stableKey}\u0000${locale}`,
      );
      if (requested !== undefined) return [stableKey, requested];
      const fallback = contentByStableKeyAndLocale.get(
        `${stableKey}\u0000${header.release.defaultLocale}`,
      );
      if (fallback !== undefined) {
        emitFallbackWarning(
          stableKey,
          revisionByStableKey.get(stableKey) ?? stableKey,
        );
        return [stableKey, fallback];
      }
      return [stableKey, stableKey];
    }),
  );

  const optionsByQuestionId = new Map<string, RuntimeOptionRow[]>();
  for (const row of optionRows) {
    const rows = optionsByQuestionId.get(row.option.questionId) ?? [];
    rows.push(row);
    optionsByQuestionId.set(row.option.questionId, rows);
  }
  const provisionsByEntityVersionId = new Map<string, RuntimeProvisionRow[]>();
  for (const row of provisionRows) {
    const rows = provisionsByEntityVersionId.get(row.entityVersionId) ?? [];
    rows.push(row);
    provisionsByEntityVersionId.set(row.entityVersionId, rows);
  }

  const assembledQuestions: PublishedComplianceRelease["questions"] = [];
  const questionIndexByFactKey: Record<string, number> = {};
  const optionIndexByQuestionAndValue: PublishedComplianceRelease["optionIndexByQuestionAndValue"] =
    {};
  for (const entry of questionsById.values()) {
    const questionIndex = assembledQuestions.length;
    for (const mapping of entry.mappings) {
      questionIndexByFactKey[mapping.factKey] = questionIndex;
    }
    const assembledOptions = (optionsByQuestionId.get(entry.question.id) ?? []).map(
      (row, optionIndex) => {
        optionIndexByQuestionAndValue[
          optionIndexKey(entry.question.id, row.option.stableValue)
        ] = { questionIndex, optionIndex };
        const legalReferences = row.entityVersionId
          ? (provisionsByEntityVersionId.get(row.entityVersionId) ?? []).flatMap(
              (provision) => {
                const value = resolveRevision(
                  provision.citationContentRevisionId,
                );
                return value ? [value] : [];
              },
            )
          : [];
        return {
          id: row.option.id,
          stableValue: row.option.stableValue,
          catalogCode: row.catalogCode ?? "all",
          label: resolveRevision(row.option.labelContentRevisionId) ?? "",
          position: row.option.position,
          metadata: row.entityVersionId
            ? {
                ...asRecord(row.option.metadata),
                sectorLabel: resolveRevision(row.sectorLabelContentRevisionId),
                description: resolveRevision(row.descriptionContentRevisionId),
                annex: row.annex,
                legalReferences,
              }
            : row.option.metadata,
        };
      },
    );
    assembledQuestions.push({
      id: entry.question.id,
      stableKey: entry.question.stableKey,
      position: entry.question.position,
      questionText: resolveRevision(entry.question.questionContentRevisionId) ?? "",
      helpText: resolveRevision(entry.question.helpContentRevisionId),
      answerType: entry.question.answerType,
      required: entry.question.required,
      config: entry.question.config,
      options: assembledOptions,
      factMappings: entry.mappings,
    });
  }

  return {
    checkCode: header.release.checkCode,
    checkReleaseId: header.release.id,
    releaseVersionLabel: header.release.versionLabel,
    aggregateHash: header.release.aggregateHash,
    defaultLocale: header.release.defaultLocale,
    locale,
    moduleId: header.release.moduleId,
    questionnaireId: header.questionnaire.id,
    questionnaireVersionId: header.questionnaireVersion.id,
    questionnaireTitle: header.questionnaire.title,
    questionnaireCode: header.questionnaire.code,
    ruleSet: header.ruleSet,
    scopeModelVersionId: header.release.scopeModelVersionId,
    questions: assembledQuestions,
    contentByStableKey,
    questionIndexByFactKey,
    optionIndexByQuestionAndValue,
  };
}

export async function loadActiveReleasePointer(
  checkCode: string,
): Promise<ActiveReleasePointer | null> {
  const rows = await db
    .select({
      checkCode: activeComplianceCheckReleases.checkCode,
      checkReleaseId: activeComplianceCheckReleases.checkReleaseId,
      versionLabel: complianceCheckReleases.versionLabel,
    })
    .from(activeComplianceCheckReleases)
    .innerJoin(
      complianceCheckReleases,
      eq(
        activeComplianceCheckReleases.checkReleaseId,
        complianceCheckReleases.id,
      ),
    )
    .where(eq(activeComplianceCheckReleases.checkCode, checkCode))
    .limit(1);
  return rows[0] ?? null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
