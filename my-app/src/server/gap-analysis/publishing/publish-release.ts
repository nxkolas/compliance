import { db } from "@/src/db";
import {
  complianceCheckReleases,
  complianceModules,
  contentItems,
  contentRevisions,
  contentTranslations,
  gapAnalysisReleaseApplicabilityRules,
  gapAnalysisReleases,
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
import { contentHash } from "../../compliance/publishing/canonical-json";
import type { GapAnalysisReleaseDefinition, LocalizedText } from "../releases/types";
import { compileGapAnalysisRelease } from "./compile-release";

export async function publishGapAnalysisRelease(
  definition: GapAnalysisReleaseDefinition,
) {
  const compiled = compileGapAnalysisRelease(definition);
  const existing = await db.query.gapAnalysisReleases.findFirst({
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
    const compatibleRelease = await tx.query.complianceCheckReleases.findFirst({
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
    const applicabilityModule = await tx.query.complianceModules.findFirst({
      where: eq(complianceModules.id, compatibleRelease.moduleId),
    });
    if (!applicabilityModule) throw new Error("Compatible module is missing");

    await tx
      .insert(complianceModules)
      .values({
        frameworkVersionId: applicabilityModule.frameworkVersionId,
        code: "gap_analysis",
        name: "Gap-Analyse",
        moduleType: "questionnaire",
        position: 20,
      })
      .onConflictDoNothing();
    const gapModule = await tx.query.complianceModules.findFirst({
      where: and(
        eq(
          complianceModules.frameworkVersionId,
          applicabilityModule.frameworkVersionId,
        ),
        eq(complianceModules.code, "gap_analysis"),
      ),
    });
    if (!gapModule || gapModule.moduleType !== "questionnaire") {
      throw new Error("Gap-analysis module is unavailable or conflicting");
    }

    const contentRevisionByKey = new Map<string, string>();
    const contentSources = createQuestionnaireContent(definition);
    for (const source of contentSources) {
      await tx
        .insert(contentItems)
        .values({ stableKey: source.key, format: "plain_text" })
        .onConflictDoNothing();
      const item = await tx.query.contentItems.findFirst({
        where: eq(contentItems.stableKey, source.key),
      });
      if (!item || item.format !== "plain_text") {
        throw new Error(`Conflicting content item ${source.key}`);
      }
      const hash = contentHash(source.translations);
      let revision = await tx.query.contentRevisions.findFirst({
        where: and(
          eq(contentRevisions.contentItemId, item.id),
          eq(contentRevisions.contentHash, hash),
        ),
      });
      if (!revision) {
        const latest = await tx.query.contentRevisions.findFirst({
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
      contentRevisionByKey.set(source.key, revision.id);
    }
    const contentRevisionId = (key: string) => {
      const id = contentRevisionByKey.get(key);
      if (!id) throw new Error(`Content revision ${key} is missing`);
      return id;
    };

    const [questionnaire] = await tx
      .insert(questionnaires)
      .values({
        moduleId: gapModule.id,
        code: definition.questionnaire.code,
        title: definition.questionnaire.title.de,
      })
      .returning();
    if (!questionnaire) throw new Error("Could not create gap questionnaire");
    const [questionnaireVersion] = await tx
      .insert(questionnaireVersions)
      .values({
        questionnaireId: questionnaire.id,
        versionLabel: definition.versionLabel,
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
        title: definition.requirementSet.title,
      })
      .onConflictDoNothing();
    const requirementSet = await tx.query.gapRequirementSets.findFirst({
      where: eq(gapRequirementSets.code, definition.requirementSet.code),
    });
    if (!requirementSet) throw new Error("Could not create requirement set");
    const [requirementSetVersion] = await tx
      .insert(gapRequirementSetVersions)
      .values({
        requirementSetId: requirementSet.id,
        versionLabel: definition.requirementSet.versionLabel,
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
      const [requirement] = await tx
        .insert(gapRequirementVersions)
        .values({
          code: source.code,
          versionLabel: source.versionLabel,
          criticality: source.criticality,
          title: source.title,
          requirementText: source.requirementText,
          recommendation: source.recommendation,
          legalReferences: source.legalReferences,
          contentHash: compiled.hashes.requirements[source.code],
        })
        .returning();
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
        questionnaireVersionId: questionnaireVersion.id,
        requirementSetVersionId: requirementSetVersion.id,
        compatibleCheckReleaseId: compatibleRelease.id,
        promptName: definition.prompt.name,
        promptVersion: definition.prompt.version,
        promptTemplateHash: definition.prompt.templateHash,
        responseSchemaVersion: definition.prompt.responseSchemaVersion,
        evaluatorKind: definition.evaluator.kind,
        evaluatorVersion: definition.evaluator.version,
        modelPolicy: definition.modelPolicy,
        defaultLocale: definition.defaultLocale,
        status: "published",
        aggregateHash: compiled.hashes.aggregate,
        publishedAt: new Date(),
      })
      .returning();
    if (!release) throw new Error("Could not create gap release");
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

function createQuestionnaireContent(definition: GapAnalysisReleaseDefinition) {
  return definition.questionnaire.questions.flatMap((question) => {
    const prefix = questionContentPrefix(definition, question.stableKey);
    return [
      { key: `${prefix}.question`, translations: question.text },
      { key: `${prefix}.help`, translations: question.help },
      ...question.options.map((option) => ({
        key: `${prefix}.option.${option.stableValue}`,
        translations: option.label,
      })),
    ];
  }) satisfies Array<{ key: string; translations: LocalizedText }>;
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
