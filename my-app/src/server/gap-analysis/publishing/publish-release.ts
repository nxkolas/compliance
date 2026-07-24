import { db } from "@/src/db";
import {
  complianceCheckReleases,
  complianceModules,
  contentItems,
  contentRevisions,
  contentTranslations,
  gapAnalysisReleaseApplicabilityRules,
  gapAnalysisReleaseCorpusReleases,
  gapAnalysisReleases,
  gapRequirements,
  gapRequirementSetMembers,
  gapRequirementSets,
  gapRequirementSetVersions,
  gapRequirementVersions,
  questionOptions,
  questionnaireVersions,
  questionnaires,
  questions,
} from "@/src/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { contentHash } from "@/src/server/compliance";
import type { GapAnalysisReleaseDefinition, LocalizedText } from "../releases/types";
import { compileGapAnalysisRelease } from "./compile-release";
import { resolvePublishableCorpusPins } from "@/src/server/corpus";
import {
  assertExactBilingualTranslations,
  assertRequirementContentPins,
  requirementContentKeys,
  requirementContentSources,
} from "./content-keys";

export async function publishGapAnalysisRelease(
  definition: GapAnalysisReleaseDefinition,
) {
  const compiled = compileGapAnalysisRelease(definition);
  const existing = await db.query.gapAnalysisReleases.findFirst({ columns: { id: true, releaseCode: true, versionLabel: true, moduleId: true, questionnaireId: true, questionnaireVersionId: true, requirementSetVersionId: true, compatibleCheckReleaseId: true, promptName: true, promptVersion: true, promptTemplateHash: true, responseSchemaVersion: true, evaluatorKind: true, evaluatorVersion: true, defaultLocale: true, status: true, aggregateHash: true, corpusReleaseSetHash: true, publishedAt: true, createdAt: true },
    where: and(
      eq(gapAnalysisReleases.releaseCode, definition.releaseCode),
      eq(gapAnalysisReleases.versionLabel, definition.versionLabel),
    ),
  });
  if (existing) {
    throw new Error(
      `Gap release ${definition.releaseCode}/${definition.versionLabel} already exists and cannot be republished`,
    );
  }

  return db.transaction(async (tx) => {
    const corpus = await resolvePublishableCorpusPins(
      tx,
      definition.requiredCorpusFamilies,
    );
    const compatibleRelease = await tx.query.complianceCheckReleases.findFirst({ columns: { id: true, checkCode: true, versionLabel: true, moduleId: true, questionnaireId: true, questionnaireVersionId: true, scopeModelVersionId: true, scopeThresholdSetId: true, ruleSetId: true, evaluatorKind: true, evaluatorVersion: true, defaultLocale: true, effectiveFrom: true, effectiveTo: true, status: true, aggregateHash: true, corpusReleaseSetHash: true, publishedAt: true, createdAt: true },
      where: and(
        eq(complianceCheckReleases.checkCode, definition.compatibleCheck.checkCode),
        eq(
          complianceCheckReleases.versionLabel,
          definition.compatibleCheck.versionLabel,
        ),
      ),
    });
    if (
      !compatibleRelease ||
      compatibleRelease.status !== "published" ||
      !compatibleRelease.publishedAt
    ) {
      throw new Error("Compatible applicability release is not published");
    }
    const applicabilityModule = await tx.query.complianceModules.findFirst({ columns: { id: true, frameworkVersionId: true, code: true, nameContentRevisionId: true, moduleType: true, position: true },
      where: eq(complianceModules.id, compatibleRelease.moduleId),
    });
    if (!applicabilityModule) throw new Error("Compatible module is missing");

    const contentRevisionByKey = new Map<string, string>();
    const contentSources = createContentSources(definition);
    for (const source of contentSources) {
      await tx
        .insert(contentItems)
        .values({ stableKey: source.key, format: "plain_text" })
        .onConflictDoNothing();
      const item = await tx.query.contentItems.findFirst({ columns: { id: true, stableKey: true, format: true, createdAt: true, updatedAt: true },
        where: eq(contentItems.stableKey, source.key),
      });
      if (!item || item.format !== "plain_text") {
        throw new Error(`Conflicting content item ${source.key}`);
      }
      const hash = contentHash(source.translations);
      let revision = await tx.query.contentRevisions.findFirst({ columns: { id: true, contentItemId: true, revisionNumber: true, contentHash: true, createdAt: true },
        where: and(
          eq(contentRevisions.contentItemId, item.id),
          eq(contentRevisions.contentHash, hash),
        ),
      });
      if (!revision) {
        const latest = await tx.query.contentRevisions.findFirst({ columns: { id: true, contentItemId: true, revisionNumber: true, contentHash: true, createdAt: true },
          where: eq(contentRevisions.contentItemId, item.id),
          orderBy: [desc(contentRevisions.revisionNumber)],
        });
        [revision] = await tx
          .insert(contentRevisions)
          .values({
            contentItemId: item.id,
            revisionNumber: (latest?.revisionNumber ?? 0) + 1,
            contentHash: hash,
          })
          .returning();
        if (!revision) throw new Error(`Could not create content ${source.key}`);
        await tx.insert(contentTranslations).values(
          Object.entries(source.translations).map(([locale, value]) => ({
            contentRevisionId: revision!.id,
            locale,
            value,
          })),
        );
      }
      const persistedTranslations =
        await tx.query.contentTranslations.findMany({ columns: { contentRevisionId: true, locale: true, value: true },
          where: eq(contentTranslations.contentRevisionId, revision.id),
        });
      assertExactBilingualTranslations(
        source.key,
        source.translations,
        persistedTranslations,
      );
      contentRevisionByKey.set(source.key, revision.id);
    }
    const contentRevisionId = (key: string) => {
      const id = contentRevisionByKey.get(key);
      if (!id) throw new Error(`Content revision ${key} is missing`);
      return id;
    };
    const metadataKeys = definitionMetadataContentKeys(definition);
    const moduleNameContentRevisionId = contentRevisionId(metadataKeys.module);

    await tx
      .insert(complianceModules)
      .values({
        frameworkVersionId: applicabilityModule.frameworkVersionId,
        code: "gap_analysis",
        nameContentRevisionId: moduleNameContentRevisionId,
        moduleType: "questionnaire",
        position: 20,
      })
      .onConflictDoNothing();
    const gapModule = await tx.query.complianceModules.findFirst({ columns: { id: true, frameworkVersionId: true, code: true, nameContentRevisionId: true, moduleType: true, position: true },
      where: and(
        eq(
          complianceModules.frameworkVersionId,
          applicabilityModule.frameworkVersionId,
        ),
        eq(complianceModules.code, "gap_analysis"),
      ),
    });
    if (
      !gapModule ||
      gapModule.frameworkVersionId !== applicabilityModule.frameworkVersionId ||
      gapModule.moduleType !== "questionnaire" ||
      gapModule.position !== 20 ||
      gapModule.nameContentRevisionId !== moduleNameContentRevisionId
    ) {
      throw new Error("Gap-analysis module is unavailable or conflicting");
    }

    await tx
      .insert(questionnaires)
      .values({
        moduleId: gapModule.id,
        code: definition.questionnaire.code,
      })
      .onConflictDoNothing();
    const questionnaire = await tx.query.questionnaires.findFirst({ columns: { id: true, moduleId: true, code: true, createdAt: true },
      where: and(
        eq(questionnaires.moduleId, gapModule.id),
        eq(questionnaires.code, definition.questionnaire.code),
      ),
    });
    if (!questionnaire) throw new Error("Could not create gap questionnaire");
    const [questionnaireVersion] = await tx
      .insert(questionnaireVersions)
      .values({
        questionnaireId: questionnaire.id,
        versionLabel: definition.versionLabel,
        titleContentRevisionId: contentRevisionId(
          metadataKeys.questionnaire,
        ),
        status: "published",
        publishedAt: new Date(),
      })
      .returning();
    if (!questionnaireVersion) {
      throw new Error("Could not create gap questionnaire version");
    }
    for (const source of definition.questionnaire.questions) {
      const prefix = questionContentPrefix(definition, source.stableKey);
      const [question] = await tx
        .insert(questions)
        .values({
          questionnaireVersionId: questionnaireVersion.id,
          stableKey: source.stableKey,
          position: source.position,
          questionContentRevisionId: contentRevisionId(`${prefix}.question`),
          helpContentRevisionId: contentRevisionId(`${prefix}.help`),
          answerType: source.answerType,
          required: source.required,
          config: {},
        })
        .returning();
      if (!question) throw new Error(`Could not create question ${source.stableKey}`);
      await tx.insert(questionOptions).values(
        source.options.map((option) => ({
          questionId: question.id,
          stableValue: option.stableValue,
          labelContentRevisionId: contentRevisionId(
            `${prefix}.option.${option.stableValue}`,
          ),
          position: option.position,
          metadata: {},
        })),
      );
    }

    await tx
      .insert(gapRequirementSets)
      .values({
        code: definition.requirementSet.code,
      })
      .onConflictDoNothing();
    const requirementSet = await tx.query.gapRequirementSets.findFirst({ columns: { id: true, code: true, createdAt: true },
      where: eq(gapRequirementSets.code, definition.requirementSet.code),
    });
    if (!requirementSet) throw new Error("Could not create requirement set");
    const [requirementSetVersion] = await tx
      .insert(gapRequirementSetVersions)
      .values({
        requirementSetId: requirementSet.id,
        versionLabel: definition.requirementSet.versionLabel,
        titleContentRevisionId: contentRevisionId(
          metadataKeys.requirementSet,
        ),
        status: "published",
        contentHash: compiled.hashes.requirementSet,
        publishedAt: new Date(),
      })
      .returning();
    if (!requirementSetVersion) {
      throw new Error("Could not create requirement set version");
    }

    const requirementVersionByCode = new Map<string, string>();
    for (const source of definition.requirementSet.requirements) {
      const contentKeys = requirementContentKeys(definition, source.code);
      const titleContentRevisionId = contentRevisionId(contentKeys.title);
      const requirementTextContentRevisionId = contentRevisionId(
        contentKeys.text,
      );
      await tx.insert(gapRequirements).values({ code: source.code }).onConflictDoNothing();
      const stableRequirement = await tx.query.gapRequirements.findFirst({ columns: { id: true, code: true, createdAt: true },
        where: eq(gapRequirements.code, source.code),
      });
      if (!stableRequirement) {
        throw new Error(`Could not create stable requirement ${source.code}`);
      }
      let requirement = await tx.query.gapRequirementVersions.findFirst({ columns: { id: true, requirementId: true, versionLabel: true, criticality: true, titleContentRevisionId: true, requirementTextContentRevisionId: true, legalReferences: true, contentHash: true, createdAt: true },
        where: and(
          eq(gapRequirementVersions.requirementId, stableRequirement.id),
          eq(gapRequirementVersions.versionLabel, source.versionLabel),
        ),
      });
      const requirementHash = compiled.hashes.requirements[source.code];
      if (requirement && requirement.contentHash !== requirementHash) {
        throw new Error(
          `Requirement ${source.code}/${source.versionLabel} already exists with different content`,
        );
      }
      if (requirement) {
        assertRequirementContentPins(
          `${source.code}/${source.versionLabel}`,
          requirement,
          { titleContentRevisionId, requirementTextContentRevisionId },
        );
      }
      if (!requirement) {
        [requirement] = await tx
          .insert(gapRequirementVersions)
          .values({
            requirementId: stableRequirement.id,
            versionLabel: source.versionLabel,
            criticality: source.criticality,
            titleContentRevisionId,
            requirementTextContentRevisionId,
            legalReferences: source.legalReferences,
            contentHash: requirementHash,
          })
          .returning();
      }
      if (!requirement) throw new Error(`Could not create ${source.code}`);
      requirementVersionByCode.set(source.code, requirement.id);
      await tx.insert(gapRequirementSetMembers).values({
        requirementSetVersionId: requirementSetVersion.id,
        requirementVersionId: requirement.id,
        position: source.position,
      });
    }

    const [release] = await tx
      .insert(gapAnalysisReleases)
      .values({
        releaseCode: definition.releaseCode,
        versionLabel: definition.versionLabel,
        moduleId: gapModule.id,
        questionnaireId: questionnaire.id,
        questionnaireVersionId: questionnaireVersion.id,
        requirementSetVersionId: requirementSetVersion.id,
        compatibleCheckReleaseId: compatibleRelease.id,
        promptName: definition.prompt.name,
        promptVersion: definition.prompt.version,
        promptTemplateHash: definition.prompt.templateHash,
        responseSchemaVersion: definition.prompt.responseSchemaVersion,
        evaluatorKind: definition.evaluator.kind,
        evaluatorVersion: definition.evaluator.version,
        defaultLocale: definition.defaultLocale,
        status: "published",
        aggregateHash: compiled.hashes.aggregate,
        corpusReleaseSetHash: corpus.releaseSetHash,
        publishedAt: new Date(),
      })
      .returning();
    if (!release) throw new Error("Could not create gap release");
    await tx.insert(gapAnalysisReleaseCorpusReleases).values(
      corpus.pins.map((pin) => ({
        gapAnalysisReleaseId: release.id,
        familyId: pin.familyId,
        corpusReleaseId: pin.releaseId,
      })),
    );
    await tx.insert(gapAnalysisReleaseApplicabilityRules).values(
      definition.requirementSet.requirements.map((source) => ({
        gapAnalysisReleaseId: release.id,
        requirementVersionId: requireRequirementId(
          requirementVersionByCode,
          source.code,
        ),
        conditions: {
          applicabilityOutcomeCodes: source.applicableOutcomeCodes,
          questionStableKeys: source.questionStableKeys,
        },
      })),
    );

    return {
      id: release.id,
      versionLabel: release.versionLabel,
      aggregateHash: release.aggregateHash,
    };
  });
}

function createContentSources(definition: GapAnalysisReleaseDefinition) {
  const metadataKeys = definitionMetadataContentKeys(definition);
  return [
    { key: metadataKeys.module, translations: definition.title },
    {
      key: metadataKeys.questionnaire,
      translations: definition.questionnaire.title,
    },
    {
      key: metadataKeys.requirementSet,
      translations: definition.requirementSet.title,
    },
    ...definition.questionnaire.questions.flatMap((question) => {
      const prefix = questionContentPrefix(definition, question.stableKey);
      return [
        { key: `${prefix}.question`, translations: question.text },
        { key: `${prefix}.help`, translations: question.help },
        ...question.options.map((option) => ({
          key: `${prefix}.option.${option.stableValue}`,
          translations: option.label,
        })),
      ];
    }),
    ...requirementContentSources(definition),
  ] satisfies Array<{ key: string; translations: LocalizedText }>;
}

function definitionMetadataContentKeys(
  definition: GapAnalysisReleaseDefinition,
) {
  return {
    module: `${definition.releaseCode}.module.name`,
    questionnaire: `${definition.releaseCode}.questionnaire.${definition.questionnaire.code}.title`,
    requirementSet: `${definition.releaseCode}.requirement-set.${definition.requirementSet.code}.title`,
  };
}

function questionContentPrefix(
  definition: GapAnalysisReleaseDefinition,
  questionStableKey: string,
) {
  return `${definition.releaseCode}.${definition.versionLabel}.${questionStableKey}`;
}

function requireRequirementId(values: Map<string, string>, code: string) {
  const id = values.get(code);
  if (!id) throw new Error(`Requirement ${code} is missing`);
  return id;
}
