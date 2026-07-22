import { db } from "@/src/db";
import {
  activeGapAnalysisReleases,
  gapAnalysisReleaseActivations,
  gapAnalysisReleaseApplicabilityRules,
  gapAnalysisReleaseCorpusReleases,
  gapAnalysisReleases,
  gapRequirementSetMembers,
  gapRequirementSetVersions,
  questionnaireVersions,
} from "@/src/db/schema";
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
    const release = await tx.query.gapAnalysisReleases.findFirst({
      where: and(
        eq(gapAnalysisReleases.releaseCode, releaseCode),
        eq(gapAnalysisReleases.versionLabel, versionLabel),
      ),
    });
    if (!release) throw new Error(`Gap release ${releaseCode}/${versionLabel} is missing`);
    const [questionnaire, requirementSet, members, rules, corpusPins] = await Promise.all([
      tx.query.questionnaireVersions.findFirst({
        where: eq(questionnaireVersions.id, release.questionnaireVersionId),
      }),
      tx.query.gapRequirementSetVersions.findFirst({
        where: eq(gapRequirementSetVersions.id, release.requirementSetVersionId),
      }),
      tx.query.gapRequirementSetMembers.findMany({
        where: eq(
          gapRequirementSetMembers.requirementSetVersionId,
          release.requirementSetVersionId,
        ),
      }),
      tx.query.gapAnalysisReleaseApplicabilityRules.findMany({
        where: eq(
          gapAnalysisReleaseApplicabilityRules.gapAnalysisReleaseId,
          release.id,
        ),
      }),
      tx.query.gapAnalysisReleaseCorpusReleases.findMany({
        where: eq(gapAnalysisReleaseCorpusReleases.gapAnalysisReleaseId, release.id),
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
    const current = await tx.query.activeGapAnalysisReleases.findFirst({
      where: eq(activeGapAnalysisReleases.releaseCode, releaseCode),
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
