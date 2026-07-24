import { evaluateRuleSet } from "../../applicability-check/rules";
import { parseRuleSetDocument, type Nis2ScopeRuleSetDocument } from "../../applicability-check/rule-set-schema";
import type { Nis2ReleaseDefinition } from "../nis2/releases/types";
import { canonicalJson, contentHash } from "./canonical-json";
import { validateReleaseDefinition } from "./validate-release";

export type CompiledComplianceRelease = {
  artifact: Nis2ScopeRuleSetDocument;
  hashes: {
    metadata: string;
    content: string;
    legal: string;
    scopeModel: string;
    thresholds: string;
    questionnaire: string;
    profiles: string;
    ruleSet: string;
    aggregate: string;
  };
};

export function compileRelease(release: Nis2ReleaseDefinition): CompiledComplianceRelease {
  validateReleaseDefinition(release);

  const artifact = parseRuleSetDocument({
    kind: release.evaluatorKind,
    evaluatorSchemaVersion: release.evaluatorVersion,
    releaseVersion: release.versionLabel,
    scopeModelVersion: `${release.versionLabel}-eu-core`,
    thresholdSetVersion: release.thresholds.versionLabel,
    disclaimerContentKey: release.disclaimerContentKey,
    outcomeContentKeys: release.outcomeContentKeys,
    reasonContentKeys: release.reasonContentKeys,
    thresholds: {
      mediumEmployeeThreshold: release.thresholds.mediumEmployeeThreshold,
      mediumTurnoverThreshold: release.thresholds.mediumTurnoverThreshold,
      mediumBalanceSheetThreshold: release.thresholds.mediumBalanceSheetThreshold,
      largeEmployeeThreshold: release.thresholds.largeEmployeeThreshold,
      largeTurnoverThreshold: release.thresholds.largeTurnoverThreshold,
      largeBalanceSheetThreshold: release.thresholds.largeBalanceSheetThreshold,
      employeeComparison: release.thresholds.employeeComparison,
      financialComparison: release.thresholds.financialComparison,
      buckets: release.thresholds.buckets,
    },
    entityTypes: release.entityTypes.map((entity) => ({
      code: entity.code,
      versionKey: `${release.versionLabel}:${entity.code}`,
      sectorCode: entity.sectorCode,
      annex: entity.annex,
      legalProvisionKeys: entity.legalProvisionKeys,
      rule: entity.rule,
    })),
    countryProfiles: Object.fromEntries(
      release.profiles.map((profile) => [
        profile.countryCode,
        {
          countryCode: profile.countryCode,
          versionKey: `${profile.code}:${profile.versionLabel}`,
          supported: profile.supported,
          allowNegativeConclusion: profile.allowNegativeConclusion,
          legalProvisionKeys: profile.legalProvisionKeys,
          entityCatalog: profile.entityCatalog.map((entity) => ({
            code: entity.code,
            versionKey: `${profile.code}:${profile.versionLabel}:${entity.code}`,
            statutoryCategoryCode: entity.statutoryCategoryCode,
            annex: entity.annex,
            classificationRule: entity.classificationRule,
            legalProvisionKeys: entity.legalProvisionKeys,
            mappings: entity.mappings,
          })),
          unmappedEuEntityCodes: profile.unmappedEuEntityCodes,
          thresholdPolicy: profile.thresholdPolicy,
          jurisdictionRules: profile.jurisdictionRules,
          effectiveStates: profile.effectiveStates,
        },
      ]),
    ),
  });

  const hashes = {
    metadata: contentHash({
      framework: release.framework,
      module: release.module,
      questionnaire: release.questionnaire,
    }),
    content: contentHash(release.content),
    legal: contentHash(release.legalInstruments),
    scopeModel: contentHash({
      sectors: release.sectors,
      entityTypes: release.entityTypes,
      content: selectContent(
        release,
        release.sectors.map((sector) => sector.labelContentKey).concat(
          release.entityTypes.flatMap((entity) => [
            entity.labelContentKey,
            entity.descriptionContentKey,
          ]),
        ),
      ),
    }),
    thresholds: contentHash(release.thresholds),
    questionnaire: contentHash({ facts: release.facts, questions: release.questions }),
    profiles: contentHash({
      profiles: release.profiles,
      content: selectContent(
        release,
        release.profiles.flatMap((profile) =>
          profile.entityCatalog.flatMap((entity) => [
            entity.labelContentKey,
            entity.descriptionContentKey,
          ]),
        ),
      ),
    }),
    ruleSet: contentHash(artifact),
    aggregate: "",
  };
  hashes.aggregate = contentHash({
    checkCode: release.checkCode,
    versionLabel: release.versionLabel,
    evaluatorKind: release.evaluatorKind,
    evaluatorVersion: release.evaluatorVersion,
    requiredCorpusFamilies: release.requiredCorpusFamilies,
    components: hashes,
  });

  const secondArtifact = parseRuleSetDocument(JSON.parse(canonicalJson(artifact)));
  if (contentHash(secondArtifact) !== hashes.ruleSet) throw new Error("Nondeterministic compliance release compilation");

  for (const fixture of release.fixtures) {
    const result = evaluateRuleSet(artifact, { facts: fixture.facts });
    if (result.outcome !== fixture.expectedOutcome) {
      throw new Error(`Golden fixture ${fixture.name} expected ${fixture.expectedOutcome}, received ${result.outcome}`);
    }
  }

  return { artifact, hashes };
}

function selectContent(release: Nis2ReleaseDefinition, stableKeys: string[]) {
  const selectedKeys = new Set(stableKeys);
  return release.content.filter((item) => selectedKeys.has(item.stableKey));
}
