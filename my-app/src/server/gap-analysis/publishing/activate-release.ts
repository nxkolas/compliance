import { db } from "@/src/db";
import { activeGapAnalysisReleases, gapAnalysisReleaseActivations } from "@/src/db/schema";
import { and, eq } from "drizzle-orm";

export type GapActivationSnapshot = {
  releasePublished: boolean;
  questionnairePublished: boolean;
  requirementSetPublished: boolean;
  requirementCount: number;
  applicabilityRuleCount: number;
  promptMetadataComplete: boolean;
  corpusPinsComplete?: boolean;
};

export function assertGapActivationCompleteness(
  snapshot: GapActivationSnapshot,
) {
  if (!snapshot.releasePublished) throw new Error("Gap release is not published");
  if (!snapshot.questionnairePublished) {
    throw new Error("Gap questionnaire is not published");
  }
  if (!snapshot.requirementSetPublished) {
    throw new Error("Gap requirement set is not published");
  }
  if (snapshot.requirementCount === 0) {
    throw new Error("Gap release has no requirements");
  }
  if (snapshot.requirementCount !== snapshot.applicabilityRuleCount) {
    throw new Error("Gap release applicability coverage is incomplete");
  }
  if (!snapshot.promptMetadataComplete) {
    throw new Error("Gap release prompt metadata is incomplete");
  }
  if (snapshot.corpusPinsComplete === false) {
    throw new Error("Gap release corpus pins are incomplete");
  }
}

export async function activateGapAnalysisRelease(
  releaseCode: string,
  versionLabel: string,
  activatedBy: string,
) {
  return db.transaction(async (tx) => {
    const release = await tx.query.gapAnalysisReleases.findFirst({ columns: { id: true, releaseCode: true, versionLabel: true, moduleId: true, questionnaireId: true, questionnaireVersionId: true, requirementSetVersionId: true, compatibleCheckReleaseId: true, promptName: true, promptVersion: true, promptTemplateHash: true, responseSchemaVersion: true, evaluatorKind: true, evaluatorVersion: true, defaultLocale: true, status: true, aggregateHash: true, corpusReleaseSetHash: true, publishedAt: true, createdAt: true },
      where: { RAW: (table, operators) => (and(
        eq(table.releaseCode, releaseCode),
        eq(table.versionLabel, versionLabel),
      )) ?? operators.sql`true` },
    });
    if (!release) throw new Error(`Gap release ${releaseCode}/${versionLabel} is missing`);
    const [questionnaire, requirementSet, members, rules, corpusPins] = await Promise.all([
      tx.query.questionnaireVersions.findFirst({ columns: { id: true, questionnaireId: true, versionLabel: true, titleContentRevisionId: true, status: true, createdAt: true, publishedAt: true },
        where: { RAW: (table, operators) => (eq(table.id, release.questionnaireVersionId)) ?? operators.sql`true` },
      }),
      tx.query.gapRequirementSetVersions.findFirst({ columns: { id: true, requirementSetId: true, versionLabel: true, titleContentRevisionId: true, status: true, contentHash: true, createdAt: true, publishedAt: true },
        where: { RAW: (table, operators) => (eq(table.id, release.requirementSetVersionId)) ?? operators.sql`true` },
      }),
      tx.query.gapRequirementSetMembers.findMany({ columns: { requirementSetVersionId: true, requirementVersionId: true, position: true },
        where: { RAW: (table, operators) => (eq(
          table.requirementSetVersionId,
          release.requirementSetVersionId,
        )) ?? operators.sql`true` },
      }),
      tx.query.gapAnalysisReleaseApplicabilityRules.findMany({ columns: { id: true, gapAnalysisReleaseId: true, requirementVersionId: true, conditions: true, createdAt: true },
        where: { RAW: (table, operators) => (eq(
          table.gapAnalysisReleaseId,
          release.id,
        )) ?? operators.sql`true` },
      }),
      tx.query.gapAnalysisReleaseCorpusReleases.findMany({ columns: { gapAnalysisReleaseId: true, familyId: true, corpusReleaseId: true },
        where: { RAW: (table, operators) => (eq(table.gapAnalysisReleaseId, release.id)) ?? operators.sql`true` },
      }),
    ]);
    assertGapActivationCompleteness({
      releasePublished:
        release.status === "published" && Boolean(release.publishedAt),
      questionnairePublished:
        questionnaire?.status === "published" &&
        Boolean(questionnaire.publishedAt),
      requirementSetPublished:
        requirementSet?.status === "published" &&
        Boolean(requirementSet.publishedAt),
      requirementCount: members.length,
      applicabilityRuleCount: rules.length,
      promptMetadataComplete: Boolean(
        release.promptName &&
          release.promptVersion &&
          release.promptTemplateHash &&
          release.responseSchemaVersion &&
          release.evaluatorKind &&
          release.evaluatorVersion,
      ),
      corpusPinsComplete: Boolean(release.corpusReleaseSetHash && corpusPins.length > 0),
    });
    const current = await tx.query.activeGapAnalysisReleases.findFirst({ columns: { releaseCode: true, gapAnalysisReleaseId: true, activatedBy: true, activatedAt: true },
      where: { RAW: (table, operators) => (eq(table.releaseCode, releaseCode)) ?? operators.sql`true` },
    });
    const activatedAt = new Date();
    await tx
      .insert(activeGapAnalysisReleases)
      .values({
        releaseCode,
        gapAnalysisReleaseId: release.id,
        activatedBy,
        activatedAt,
      })
      .onConflictDoUpdate({
        target: activeGapAnalysisReleases.releaseCode,
        set: {
          gapAnalysisReleaseId: release.id,
          activatedBy,
          activatedAt,
        },
      });
    await tx.insert(gapAnalysisReleaseActivations).values({
      releaseCode,
      previousReleaseId: current?.gapAnalysisReleaseId,
      activatedReleaseId: release.id,
      activatedBy,
      activatedAt,
    });
    return release;
  });
}
