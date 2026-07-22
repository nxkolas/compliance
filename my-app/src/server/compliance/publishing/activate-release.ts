import { db } from "@/src/db";
import {
  activeComplianceCheckReleases,
  complianceCheckReleaseActivations,
  complianceCheckReleaseContentRevisions,
  complianceCheckReleaseFactVersions,
  complianceCheckReleaseProfiles,
  complianceCheckReleaseCorpusReleases,
  complianceCheckReleases,
  jurisdictionEntityTypeMappings,
  jurisdictionEntityTypeVersions,
  jurisdictionProfileEffectiveStates,
  jurisdictionProfileVersions,
  questionnaireVersions,
  ruleSets,
  scopeModelVersions,
  scopeThresholdSets,
} from "@/src/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { assertActivationCompleteness } from "./activation-completeness";

export async function activateComplianceRelease(
  checkCode: string,
  versionLabel: string,
  activatedBy: string,
) {
  return db.transaction(async (tx) => {
    const release = await tx.query.complianceCheckReleases.findFirst({
      where: and(
        eq(complianceCheckReleases.checkCode, checkCode),
        eq(complianceCheckReleases.versionLabel, versionLabel),
      ),
    });
    if (!release || release.status !== "published" || !release.publishedAt) {
      throw new Error(`Release ${checkCode}/${versionLabel} is not complete and published`);
    }

    const [ruleSet, questionnaireVersion, scopeModelVersion, thresholdSet, profileLinks, factLinks, contentLinks, corpusPins] = await Promise.all([
      tx.query.ruleSets.findFirst({ where: eq(ruleSets.id, release.ruleSetId) }),
      tx.query.questionnaireVersions.findFirst({ where: eq(questionnaireVersions.id, release.questionnaireVersionId) }),
      tx.query.scopeModelVersions.findFirst({ where: eq(scopeModelVersions.id, release.scopeModelVersionId) }),
      tx.query.scopeThresholdSets.findFirst({ where: eq(scopeThresholdSets.id, release.scopeThresholdSetId) }),
      tx.query.complianceCheckReleaseProfiles.findMany({ where: eq(complianceCheckReleaseProfiles.checkReleaseId, release.id) }),
      tx.query.complianceCheckReleaseFactVersions.findMany({ where: eq(complianceCheckReleaseFactVersions.checkReleaseId, release.id) }),
      tx.query.complianceCheckReleaseContentRevisions.findMany({ where: eq(complianceCheckReleaseContentRevisions.checkReleaseId, release.id) }),
      tx.query.complianceCheckReleaseCorpusReleases.findMany({ where: eq(complianceCheckReleaseCorpusReleases.checkReleaseId, release.id) }),
    ]);
    const profileVersionIds = profileLinks.map((link) => link.jurisdictionProfileVersionId);
    const [profileVersions, nationalVersions, effectiveStates] = profileVersionIds.length > 0
      ? await Promise.all([
          tx.query.jurisdictionProfileVersions.findMany({ where: inArray(jurisdictionProfileVersions.id, profileVersionIds) }),
          tx.query.jurisdictionEntityTypeVersions.findMany({ where: inArray(jurisdictionEntityTypeVersions.jurisdictionProfileVersionId, profileVersionIds) }),
          tx.query.jurisdictionProfileEffectiveStates.findMany({ where: inArray(jurisdictionProfileEffectiveStates.jurisdictionProfileVersionId, profileVersionIds) }),
        ])
      : [[], [], []];
    const nationalVersionIds = nationalVersions.map((version) => version.id);
    const nationalMappings = nationalVersionIds.length > 0
      ? await tx.query.jurisdictionEntityTypeMappings.findMany({ where: inArray(jurisdictionEntityTypeMappings.jurisdictionEntityTypeVersionId, nationalVersionIds) })
      : [];

    assertActivationCompleteness({
      releasePublished: release.status === "published" && Boolean(release.publishedAt),
      aggregateHash: release.aggregateHash,
      evaluatorKind: release.evaluatorKind,
      evaluatorVersion: release.evaluatorVersion,
      ruleSet: ruleSet
        ? {
            status: ruleSet.status,
            publishedAt: ruleSet.publishedAt,
            evaluatorKind: ruleSet.evaluatorKind,
            evaluatorVersion: ruleSet.evaluatorSchemaVersion,
            rules: ruleSet.rules,
          }
        : null,
      questionnairePublished: questionnaireVersion?.status === "published" && Boolean(questionnaireVersion.publishedAt),
      scopeModelPublished: scopeModelVersion?.status === "published" && Boolean(scopeModelVersion.publishedAt),
      thresholdSetPublished: thresholdSet?.status === "published" && Boolean(thresholdSet.publishedAt),
      factVersionCount: factLinks.length,
      contentRevisionCount: contentLinks.length,
      corpusPinsComplete: Boolean(release.corpusReleaseSetHash && corpusPins.length > 0),
      profiles: profileLinks.map((link) => {
        const profileVersion = profileVersions.find((version) => version.id === link.jurisdictionProfileVersionId);
        const profileNationalVersions = nationalVersions.filter((version) => version.jurisdictionProfileVersionId === link.jurisdictionProfileVersionId);
        const profileNationalVersionIds = new Set(profileNationalVersions.map((version) => version.id));
        return {
          countryCode: link.countryCode,
          published: profileVersion?.status === "published" && Boolean(profileVersion.publishedAt),
          nationalIdentityCount: profileNationalVersions.length,
          nationalMappingCount: nationalMappings.filter((mapping) => profileNationalVersionIds.has(mapping.jurisdictionEntityTypeVersionId)).length,
          effectiveStateCodes: effectiveStates.filter((state) => state.jurisdictionProfileVersionId === link.jurisdictionProfileVersionId).map((state) => state.code),
        };
      }),
    });

    const current = await tx.query.activeComplianceCheckReleases.findFirst({
      where: eq(activeComplianceCheckReleases.checkCode, checkCode),
    });
    await tx.insert(activeComplianceCheckReleases).values({
      checkCode,
      checkReleaseId: release.id,
      activatedBy,
      activatedAt: new Date(),
    }).onConflictDoUpdate({
      target: activeComplianceCheckReleases.checkCode,
      set: { checkReleaseId: release.id, activatedBy, activatedAt: new Date() },
    });
    await tx.insert(complianceCheckReleaseActivations).values({
      checkCode,
      previousReleaseId: current?.checkReleaseId,
      activatedReleaseId: release.id,
      activatedBy,
    });
    return release;
  });
}
