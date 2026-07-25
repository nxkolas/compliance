import { parseRuleSetDocument } from "@/src/server/applicability-check/domain";

export type ActivationCompletenessSnapshot = {
  releasePublished: boolean;
  aggregateHash: string;
  evaluatorKind: string;
  evaluatorVersion: number;
  ruleSet: { status: string; publishedAt: Date | null; evaluatorKind: string; evaluatorVersion: number; rules: unknown } | null;
  questionnairePublished: boolean;
  scopeModelPublished: boolean;
  thresholdSetPublished: boolean;
  factVersionCount: number;
  contentRevisionCount: number;
  corpusPinsComplete?: boolean;
  profiles: Array<{
    countryCode: string;
    published: boolean;
    nationalIdentityCount: number;
    nationalMappingCount: number;
    effectiveStateCodes: string[];
  }>;
};

export function assertActivationCompleteness(
  snapshot: ActivationCompletenessSnapshot,
) {
  const errors: string[] = [];
  if (!snapshot.releasePublished) errors.push("release is not published");
  if (!snapshot.aggregateHash) errors.push("aggregate hash is missing");
  if (!snapshot.ruleSet?.publishedAt || snapshot.ruleSet.status !== "published") errors.push("rule set is not published");
  if (!snapshot.questionnairePublished) errors.push("questionnaire version is not published");
  if (!snapshot.scopeModelPublished) errors.push("scope model version is not published");
  if (!snapshot.thresholdSetPublished) errors.push("threshold set is not published");
  if (snapshot.factVersionCount !== 12) errors.push(`expected 12 pinned fact versions, found ${snapshot.factVersionCount}`);
  if (snapshot.contentRevisionCount === 0) errors.push("no content revisions are pinned");
  if (snapshot.corpusPinsComplete === false) errors.push("required corpus releases are not pinned");
  if (snapshot.profiles.length === 0) errors.push("no jurisdiction profile is pinned");

  if (snapshot.ruleSet) {
    if (
      snapshot.ruleSet.evaluatorKind !== snapshot.evaluatorKind ||
      snapshot.ruleSet.evaluatorVersion !== snapshot.evaluatorVersion
    ) {
      errors.push("release and rule-set evaluator versions disagree");
    }
    const artifact = parseRuleSetDocument(snapshot.ruleSet.rules);
    for (const [countryCode, artifactProfile] of Object.entries(artifact.countryProfiles)) {
      const profile = snapshot.profiles.find((candidate) => candidate.countryCode === countryCode);
      if (!profile?.published) {
        errors.push(`profile ${countryCode} is not published`);
        continue;
      }
      if (artifact.kind === "nis2_scope_v3") {
        if (profile.nationalIdentityCount !== artifactProfile.entityCatalog.length) {
          errors.push(`profile ${countryCode} national catalog is incomplete`);
        }
        const expectedMappingCount = artifactProfile.entityCatalog.flatMap(
          (entity: { mappings: unknown[] }) => entity.mappings,
        ).length;
        if (profile.nationalMappingCount !== expectedMappingCount) {
          errors.push(`profile ${countryCode} national mappings are incomplete`);
        }
        const stateCodes = new Set(profile.effectiveStateCodes);
        for (const state of artifactProfile.effectiveStates) {
          if (!stateCodes.has(state.code)) {
            errors.push(`profile ${countryCode} is missing effective state ${state.code}`);
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Release activation refused:\n- ${errors.join("\n- ")}`);
  }
}
