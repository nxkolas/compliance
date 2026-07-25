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
    const release = await tx.query.complianceCheckReleases.findFirst({ columns: { id: true, checkCode: true, versionLabel: true, moduleId: true, questionnaireId: true, questionnaireVersionId: true, scopeModelVersionId: true, scopeThresholdSetId: true, ruleSetId: true, evaluatorKind: true, evaluatorVersion: true, defaultLocale: true, effectiveFrom: true, effectiveTo: true, status: true, aggregateHash: true, corpusReleaseSetHash: true, publishedAt: true, createdAt: true },
      where: and(
        eq(complianceCheckReleases.checkCode, checkCode),
        eq(complianceCheckReleases.versionLabel, versionLabel),
      ),
    });
    if (!release || release.status !== "published" || !release.publishedAt) {
      throw new Error(`Release ${checkCode}/${versionLabel} is not complete and published`);
    }

    const [ruleSet, questionnaireVersion, scopeModelVersion, thresholdSet, profileLinks, factLinks, contentLinks, corpusPins] = await Promise.all([
      tx.query.ruleSets.findFirst({ columns: { id: true, moduleId: true, code: true, versionLabel: true, status: true, evaluatorKind: true, evaluatorSchemaVersion: true, rules: true, contentHash: true, createdAt: true, publishedAt: true }, where: eq(ruleSets.id, release.ruleSetId) }),
      tx.query.questionnaireVersions.findFirst({ columns: { id: true, questionnaireId: true, versionLabel: true, titleContentRevisionId: true, status: true, createdAt: true, publishedAt: true }, where: eq(questionnaireVersions.id, release.questionnaireVersionId) }),
      tx.query.scopeModelVersions.findFirst({ columns: { id: true, scopeModelId: true, versionLabel: true, status: true, effectiveFrom: true, effectiveTo: true, contentHash: true, publishedAt: true }, where: eq(scopeModelVersions.id, release.scopeModelVersionId) }),
      tx.query.scopeThresholdSets.findFirst({ columns: { id: true, code: true, versionLabel: true, status: true, mediumEmployeeThreshold: true, mediumTurnoverThreshold: true, mediumBalanceSheetThreshold: true, largeEmployeeThreshold: true, largeTurnoverThreshold: true, largeBalanceSheetThreshold: true, employeeComparison: true, financialComparison: true, contentHash: true, publishedAt: true }, where: eq(scopeThresholdSets.id, release.scopeThresholdSetId) }),
      tx.query.complianceCheckReleaseProfiles.findMany({ columns: { checkReleaseId: true, countryCode: true, jurisdictionProfileVersionId: true }, where: eq(complianceCheckReleaseProfiles.checkReleaseId, release.id) }),
      tx.query.complianceCheckReleaseFactVersions.findMany({ columns: { checkReleaseId: true, factDefinitionVersionId: true }, where: eq(complianceCheckReleaseFactVersions.checkReleaseId, release.id) }),
      tx.query.complianceCheckReleaseContentRevisions.findMany({ columns: { checkReleaseId: true, contentRevisionId: true }, where: eq(complianceCheckReleaseContentRevisions.checkReleaseId, release.id) }),
      tx.query.complianceCheckReleaseCorpusReleases.findMany({ columns: { checkReleaseId: true, familyId: true, corpusReleaseId: true }, where: eq(complianceCheckReleaseCorpusReleases.checkReleaseId, release.id) }),
    ]);
    const profileVersionIds = profileLinks.map((link) => link.jurisdictionProfileVersionId);
    const [profileVersions, nationalVersions, effectiveStates] = profileVersionIds.length > 0
      ? await Promise.all([
          tx.query.jurisdictionProfileVersions.findMany({ columns: { id: true, jurisdictionProfileId: true, versionLabel: true, status: true, supported: true, allowNegativeConclusion: true, effectiveFrom: true, effectiveTo: true, contentHash: true, publishedAt: true }, where: inArray(jurisdictionProfileVersions.id, profileVersionIds) }),
          tx.query.jurisdictionEntityTypeVersions.findMany({ columns: { id: true, jurisdictionEntityTypeId: true, jurisdictionProfileVersionId: true, statutoryCategoryCode: true, annex: true, classificationRule: true, labelContentRevisionId: true, descriptionContentRevisionId: true, definitionHash: true }, where: inArray(jurisdictionEntityTypeVersions.jurisdictionProfileVersionId, profileVersionIds) }),
          tx.query.jurisdictionProfileEffectiveStates.findMany({ columns: { id: true, jurisdictionProfileVersionId: true, code: true, stateValue: true, effectiveFrom: true, effectiveTo: true, reviewedAt: true, officialSourceUrl: true, legalProvisionId: true, declarationHash: true }, where: inArray(jurisdictionProfileEffectiveStates.jurisdictionProfileVersionId, profileVersionIds) }),
        ])
      : [[], [], []];
    const nationalVersionIds = nationalVersions.map((version) => version.id);
    const nationalMappings = nationalVersionIds.length > 0
      ? await tx.query.jurisdictionEntityTypeMappings.findMany({ columns: { id: true, jurisdictionEntityTypeVersionId: true, scopeEntityTypeId: true, relationshipKind: true }, where: inArray(jurisdictionEntityTypeMappings.jurisdictionEntityTypeVersionId, nationalVersionIds) })
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

    const current = await tx.query.activeComplianceCheckReleases.findFirst({ columns: { checkCode: true, checkReleaseId: true, activatedBy: true, activatedAt: true },
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
