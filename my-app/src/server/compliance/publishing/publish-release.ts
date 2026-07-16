import { db } from "@/src/db";
import {
  complianceCheckReleaseFactVersions,
  complianceCheckReleaseContentRevisions,
  complianceCheckReleaseProfiles,
  complianceCheckReleases,
  complianceFrameworkVersions,
  complianceFrameworks,
  complianceModules,
  contentItems,
  contentRevisions,
  contentTranslations,
  factOptions,
  jurisdictionProfileDesignations,
  jurisdictionEntityTypeLegalProvisions,
  jurisdictionEntityTypeMappings,
  jurisdictionEntityTypes,
  jurisdictionEntityTypeVersions,
  jurisdictionProfileEffectiveStates,
  jurisdictionProfileJurisdictionRules,
  jurisdictionProfileLegalProvisions,
  jurisdictionProfiles,
  jurisdictionProfileThresholdPolicies,
  jurisdictionProfileVersions,
  legalInstruments,
  legalInstrumentVersions,
  legalProvisions,
  organizationFactDefinitions,
  organizationFactDefinitionVersions,
  questionFactMappings,
  questionOptions,
  questionnaireVersions,
  questionnaires,
  questions,
  ruleSets,
  scopeEntityTypeLegalProvisions,
  scopeEntityTypes,
  scopeEntityTypeVersions,
  scopeModels,
  scopeModelVersions,
  scopeSectors,
  scopeSectorVersions,
  scopeThresholdSetLegalProvisions,
  scopeThresholdSets,
} from "@/src/db/schema";
import { and, desc, eq } from "drizzle-orm";
import type { Nis2ReleaseDefinition } from "../nis2/releases/types";
import { contentHash } from "./canonical-json";
import { compileRelease } from "./compile-release";

export async function publishComplianceRelease(release: Nis2ReleaseDefinition) {
  const compiled = compileRelease(release);
  const existing = await db.query.complianceCheckReleases.findFirst({
    where: and(
      eq(complianceCheckReleases.checkCode, release.checkCode),
      eq(complianceCheckReleases.versionLabel, release.versionLabel),
    ),
  });
  if (existing) throw new Error(`Release ${release.checkCode}/${release.versionLabel} already exists and cannot be republished`);

  return db.transaction(async (tx) => {
    const revisionByContentKey = new Map<string, string>();
    for (const source of release.content) {
      await tx.insert(contentItems).values({ stableKey: source.stableKey, format: source.format }).onConflictDoNothing();
      const item = await tx.query.contentItems.findFirst({ where: eq(contentItems.stableKey, source.stableKey) });
      if (!item || item.format !== source.format) throw new Error(`Conflicting content item ${source.stableKey}`);

      const hash = contentHash(source.translations);
      let revision = await tx.query.contentRevisions.findFirst({
        where: and(eq(contentRevisions.contentItemId, item.id), eq(contentRevisions.contentHash, hash)),
      });
      if (!revision) {
        const latest = await tx.query.contentRevisions.findFirst({
          where: eq(contentRevisions.contentItemId, item.id),
          orderBy: [desc(contentRevisions.revisionNumber)],
        });
        [revision] = await tx.insert(contentRevisions).values({
          contentItemId: item.id,
          revisionNumber: (latest?.revisionNumber ?? 0) + 1,
          contentHash: hash,
        }).returning();
        if (!revision) throw new Error(`Content revision insert failed: ${source.stableKey}`);
        const insertedRevision = revision;
        await tx.insert(contentTranslations).values(
          Object.entries(source.translations).map(([locale, value]) => ({ contentRevisionId: insertedRevision.id, locale, value })),
        );
      }
      if (!revision) throw new Error(`Content revision unavailable: ${source.stableKey}`);
      revisionByContentKey.set(source.stableKey, revision.id);
    }

    const contentRevisionId = (key: string) => {
      const id = revisionByContentKey.get(key);
      if (!id) throw new Error(`Content revision missing for ${key}`);
      return id;
    };

    const legalProvisionIdByKey = new Map<string, string>();
    for (const source of release.legalInstruments) {
      await tx.insert(legalInstruments).values({ code: source.code, jurisdictionCode: source.jurisdictionCode, instrumentType: source.instrumentType }).onConflictDoNothing();
      const instrument = await tx.query.legalInstruments.findFirst({ where: eq(legalInstruments.code, source.code) });
      if (!instrument) throw new Error(`Legal instrument insert failed: ${source.code}`);

      const instrumentHash = contentHash(source);
      const existingVersion = await tx.query.legalInstrumentVersions.findFirst({
        where: and(eq(legalInstrumentVersions.legalInstrumentId, instrument.id), eq(legalInstrumentVersions.versionLabel, source.versionLabel)),
      });
      if (existingVersion && existingVersion.contentHash !== instrumentHash) throw new Error(`Conflicting legal instrument version ${source.code}/${source.versionLabel}`);
      const version = existingVersion ?? (await tx.insert(legalInstrumentVersions).values({
        legalInstrumentId: instrument.id,
        versionLabel: source.versionLabel,
        officialIdentifier: source.officialIdentifier,
        officialSourceUrl: source.officialSourceUrl,
        effectiveFrom: source.effectiveFrom,
        titleContentRevisionId: contentRevisionId(source.titleContentKey),
        contentHash: instrumentHash,
      }).returning())[0];

      for (const provisionSource of source.provisions) {
        const citationContentRevisionId = contentRevisionId(provisionSource.citationContentKey);
        let provision = await tx.query.legalProvisions.findFirst({
          where: and(
            eq(legalProvisions.legalInstrumentVersionId, version.id),
            eq(legalProvisions.provisionCode, provisionSource.code),
          ),
        });
        if (provision && (
          provision.officialSourceUrl !== provisionSource.officialSourceUrl ||
          provision.citationContentRevisionId !== citationContentRevisionId
        )) {
          throw new Error(`Conflicting legal provision ${source.code}.${provisionSource.code}`);
        }
        if (!provision) {
          [provision] = await tx.insert(legalProvisions).values({
            legalInstrumentVersionId: version.id,
            provisionCode: provisionSource.code,
            officialSourceUrl: provisionSource.officialSourceUrl,
            citationContentRevisionId,
          }).returning();
        }
        if (!provision) throw new Error(`Legal provision insert failed: ${source.code}.${provisionSource.code}`);
        legalProvisionIdByKey.set(`${source.code}.${provisionSource.code}`, provision.id);
      }
    }
    const legalProvisionId = (key: string) => {
      const id = legalProvisionIdByKey.get(key);
      if (!id) throw new Error(`Legal provision missing for ${key}`);
      return id;
    };

    await tx.insert(complianceFrameworks).values({ code: "nis2", name: "NIS2", description: "Immutable NIS2 release foundation" }).onConflictDoNothing();
    const framework = await tx.query.complianceFrameworks.findFirst({ where: eq(complianceFrameworks.code, "nis2") });
    if (!framework) throw new Error("NIS2 framework insert failed");
    const [frameworkVersion] = await tx.insert(complianceFrameworkVersions).values({
      frameworkId: framework.id,
      versionLabel: release.versionLabel,
      status: "published",
      effectiveFrom: release.effectiveFrom,
    }).returning();
    const [module] = await tx.insert(complianceModules).values({
      frameworkVersionId: frameworkVersion.id,
      code: "betroffenheitscheck",
      name: "Betroffenheitscheck",
      moduleType: "questionnaire",
      position: 10,
    }).returning();

    await tx.insert(scopeModels).values({ code: "nis2_eu_core" }).onConflictDoNothing();
    const scopeModel = await tx.query.scopeModels.findFirst({ where: eq(scopeModels.code, "nis2_eu_core") });
    if (!scopeModel) throw new Error("Scope model insert failed");
    const existingScopeModelVersion = await tx.query.scopeModelVersions.findFirst({
      where: eq(scopeModelVersions.contentHash, compiled.hashes.scopeModel),
    });
    const scopeModelVersion = existingScopeModelVersion ?? (await tx.insert(scopeModelVersions).values({
      scopeModelId: scopeModel.id,
      versionLabel: `${release.versionLabel}-eu-core`,
      status: "published",
      effectiveFrom: release.effectiveFrom,
      contentHash: compiled.hashes.scopeModel,
      publishedAt: new Date(),
    }).returning())[0];
    if (!scopeModelVersion) throw new Error("Scope model version insert failed");
    const scopeModelReused = Boolean(existingScopeModelVersion);

    const sectorVersionIdByCode = new Map<string, string>();
    for (const source of release.sectors) {
      await tx.insert(scopeSectors).values({ code: source.code }).onConflictDoNothing();
      const sector = await tx.query.scopeSectors.findFirst({ where: eq(scopeSectors.code, source.code) });
      if (!sector) throw new Error(`Scope sector insert failed: ${source.code}`);
      const version = scopeModelReused
        ? await tx.query.scopeSectorVersions.findFirst({
            where: and(
              eq(scopeSectorVersions.scopeSectorId, sector.id),
              eq(scopeSectorVersions.scopeModelVersionId, scopeModelVersion.id),
            ),
          })
        : (await tx.insert(scopeSectorVersions).values({
            scopeSectorId: sector.id,
            scopeModelVersionId: scopeModelVersion.id,
            labelContentRevisionId: contentRevisionId(source.labelContentKey),
          }).returning())[0];
      if (!version) throw new Error(`Scope sector version missing: ${source.code}`);
      sectorVersionIdByCode.set(source.code, version.id);
    }

    const entityTypeIdByCode = new Map<string, string>();
    for (const source of release.entityTypes) {
      await tx.insert(scopeEntityTypes).values({ code: source.code }).onConflictDoNothing();
      const entity = await tx.query.scopeEntityTypes.findFirst({ where: eq(scopeEntityTypes.code, source.code) });
      if (!entity) throw new Error(`Entity type insert failed: ${source.code}`);
      entityTypeIdByCode.set(source.code, entity.id);
      if (scopeModelReused) continue;
      const sectorVersionId = sectorVersionIdByCode.get(source.sectorCode);
      if (!sectorVersionId) throw new Error(`Sector version missing: ${source.sectorCode}`);
      const [version] = await tx.insert(scopeEntityTypeVersions).values({
        scopeEntityTypeId: entity.id,
        scopeModelVersionId: scopeModelVersion.id,
        scopeSectorVersionId: sectorVersionId,
        annex: source.annex,
        ruleKind: source.rule,
        labelContentRevisionId: contentRevisionId(source.labelContentKey),
        descriptionContentRevisionId: contentRevisionId(source.descriptionContentKey),
        definitionHash: contentHash(source),
      }).returning();
      await tx.insert(scopeEntityTypeLegalProvisions).values(
        source.legalProvisionKeys.map((key) => ({ scopeEntityTypeVersionId: version.id, legalProvisionId: legalProvisionId(key) })),
      );
    }

    const factOptionIdByKey = new Map<string, string>();
    const factVersionIds: string[] = [];
    for (const source of release.facts) {
      await tx.insert(organizationFactDefinitions).values({ key: source.key, dataType: source.dataType }).onConflictDoNothing();
      const definition = await tx.query.organizationFactDefinitions.findFirst({ where: eq(organizationFactDefinitions.key, source.key) });
      if (!definition || definition.dataType !== source.dataType) throw new Error(`Conflicting fact definition ${source.key}`);
      const factVersionHash = contentHash({
        source,
        labelContentRevisionId: contentRevisionId(source.labelContentKey),
        descriptionContentRevisionId: contentRevisionId(source.descriptionContentKey),
      });
      const existingFactVersion = await tx.query.organizationFactDefinitionVersions.findFirst({
        where: and(
          eq(organizationFactDefinitionVersions.factKey, source.key),
          eq(organizationFactDefinitionVersions.contentHash, factVersionHash),
        ),
      });
      const version = existingFactVersion ?? (await tx.insert(organizationFactDefinitionVersions).values({
        factKey: source.key,
        versionLabel: release.versionLabel,
        labelContentRevisionId: contentRevisionId(source.labelContentKey),
        descriptionContentRevisionId: contentRevisionId(source.descriptionContentKey),
        contentHash: factVersionHash,
      }).returning())[0];
      if (!version) throw new Error(`Fact version insert failed: ${source.key}`);
      factVersionIds.push(version.id);
      for (const optionSource of source.options) {
        const scopeEntityTypeId = optionSource.scopeEntityTypeCode
          ? entityTypeIdByCode.get(optionSource.scopeEntityTypeCode)
          : undefined;
        let option = await tx.query.factOptions.findFirst({
          where: and(
            eq(factOptions.factDefinitionKey, source.key),
            eq(factOptions.stableValue, optionSource.stableValue),
          ),
        });
        if (option && (
          option.catalogCode !== optionSource.catalogCode ||
          (option.scopeEntityTypeId ?? undefined) !== scopeEntityTypeId
        )) {
          throw new Error(`Conflicting fact option ${source.key}.${optionSource.stableValue}`);
        }
        if (!option) {
          [option] = await tx.insert(factOptions).values({
            factDefinitionKey: source.key,
            stableValue: optionSource.stableValue,
            catalogCode: optionSource.catalogCode,
            scopeEntityTypeId,
          }).returning();
        }
        if (!option) throw new Error(`Fact option insert failed: ${source.key}.${optionSource.stableValue}`);
        factOptionIdByKey.set(`${source.key}.${optionSource.stableValue}`, option.id);
      }
    }

    const [questionnaire] = await tx.insert(questionnaires).values({ moduleId: module.id, code: "betroffenheitscheck", title: "NIS2 Betroffenheitscheck" }).returning();
    const [questionnaireVersion] = await tx.insert(questionnaireVersions).values({
      questionnaireId: questionnaire.id,
      versionLabel: release.versionLabel,
      status: "published",
      publishedAt: new Date(),
    }).returning();
    for (const source of release.questions) {
      const [question] = await tx.insert(questions).values({
        questionnaireVersionId: questionnaireVersion.id,
        stableKey: source.stableKey,
        position: source.position,
        questionContentRevisionId: contentRevisionId(source.questionContentKey),
        helpContentRevisionId: source.helpContentKey ? contentRevisionId(source.helpContentKey) : null,
        answerType: source.answerType,
        required: source.required,
        config: source.config,
      }).returning();
      for (const optionSource of source.options) {
        await tx.insert(questionOptions).values({
          questionId: question.id,
          stableValue: optionSource.stableValue,
          labelContentRevisionId: contentRevisionId(optionSource.labelContentKey),
          factOptionId: factOptionIdByKey.get(`${source.factKey}.${optionSource.factOptionValue}`),
          position: optionSource.position,
          metadata: optionSource.metadata,
        });
      }
      await tx.insert(questionFactMappings).values({ questionId: question.id, factKey: source.factKey, transform: { type: "identity" } });
    }

    const existingThresholdSet = await tx.query.scopeThresholdSets.findFirst({
      where: eq(scopeThresholdSets.contentHash, compiled.hashes.thresholds),
    });
    const thresholdSet = existingThresholdSet ?? (await tx.insert(scopeThresholdSets).values({
      code: release.thresholds.code,
      versionLabel: release.thresholds.versionLabel,
      status: "published",
      mediumEmployeeThreshold: release.thresholds.mediumEmployeeThreshold,
      mediumTurnoverThreshold: String(release.thresholds.mediumTurnoverThreshold),
      mediumBalanceSheetThreshold: String(release.thresholds.mediumBalanceSheetThreshold),
      largeEmployeeThreshold: release.thresholds.largeEmployeeThreshold,
      largeTurnoverThreshold: String(release.thresholds.largeTurnoverThreshold),
      largeBalanceSheetThreshold: String(release.thresholds.largeBalanceSheetThreshold),
      employeeComparison: release.thresholds.employeeComparison,
      financialComparison: release.thresholds.financialComparison,
      contentHash: compiled.hashes.thresholds,
      publishedAt: new Date(),
    }).returning())[0];
    if (!thresholdSet) throw new Error("Threshold set insert failed");
    if (!existingThresholdSet) {
      await tx.insert(scopeThresholdSetLegalProvisions).values(
        release.thresholds.legalProvisionKeys.map((key) => ({ scopeThresholdSetId: thresholdSet.id, legalProvisionId: legalProvisionId(key) })),
      );
    }

    const profileVersionIdByCountry = new Map<string, string>();
    const jurisdictionEntityTypeIdByCode = new Map<string, string>();
    for (const source of release.profiles) {
      await tx.insert(jurisdictionProfiles).values({ code: source.code, countryCode: source.countryCode }).onConflictDoNothing();
      const profile = await tx.query.jurisdictionProfiles.findFirst({ where: eq(jurisdictionProfiles.code, source.code) });
      if (!profile) throw new Error(`Jurisdiction profile insert failed: ${source.code}`);
      const profileHash = contentHash({
        source,
        content: release.content.filter((item) =>
          source.entityCatalog.some((entity) =>
            entity.labelContentKey === item.stableKey ||
            entity.descriptionContentKey === item.stableKey,
          ),
        ),
      });
      const conflictingProfileVersion = await tx.query.jurisdictionProfileVersions.findFirst({
        where: and(
          eq(jurisdictionProfileVersions.jurisdictionProfileId, profile.id),
          eq(jurisdictionProfileVersions.versionLabel, source.versionLabel),
        ),
      });
      if (conflictingProfileVersion && conflictingProfileVersion.contentHash !== profileHash) {
        throw new Error(`Conflicting jurisdiction profile version ${source.code}/${source.versionLabel}`);
      }
      const existingProfileVersion = conflictingProfileVersion ?? await tx.query.jurisdictionProfileVersions.findFirst({
        where: eq(jurisdictionProfileVersions.contentHash, profileHash),
      });
      const version = existingProfileVersion ?? (await tx.insert(jurisdictionProfileVersions).values({
        jurisdictionProfileId: profile.id,
        versionLabel: source.versionLabel,
        status: "published",
        supported: source.supported,
        allowNegativeConclusion: source.allowNegativeConclusion,
        effectiveFrom: release.effectiveFrom,
        contentHash: profileHash,
        publishedAt: new Date(),
      }).returning())[0];
      if (!version) throw new Error(`Jurisdiction profile version insert failed: ${source.code}`);
      const profileReused = Boolean(existingProfileVersion);
      profileVersionIdByCountry.set(source.countryCode, version.id);
      if (!profileReused) {
        await tx.insert(jurisdictionProfileLegalProvisions).values(
          source.legalProvisionKeys.map((key) => ({ jurisdictionProfileVersionId: version.id, legalProvisionId: legalProvisionId(key) })),
        );
        if (source.designations.length > 0) {
          await tx.insert(jurisdictionProfileDesignations).values(source.designations.map((designation) => ({
            jurisdictionProfileVersionId: version.id,
            designationCode: designation.code,
            outcomeCode: designation.outcomeCode,
            legalProvisionId: legalProvisionId(designation.legalProvisionKey),
          })));
        }
      }
      const nationalEntityIdByCode = new Map<string, string>();
      for (const entitySource of source.entityCatalog) {
        await tx.insert(jurisdictionEntityTypes).values({
          jurisdictionProfileId: profile.id,
          code: entitySource.code,
        }).onConflictDoNothing();
        const entity = await tx.query.jurisdictionEntityTypes.findFirst({
          where: and(
            eq(jurisdictionEntityTypes.jurisdictionProfileId, profile.id),
            eq(jurisdictionEntityTypes.code, entitySource.code),
          ),
        });
        if (!entity) throw new Error(`National entity insert failed: ${entitySource.code}`);
        nationalEntityIdByCode.set(entitySource.code, entity.id);
        jurisdictionEntityTypeIdByCode.set(entitySource.code, entity.id);
        if (profileReused) continue;
        const [entityVersion] = await tx.insert(jurisdictionEntityTypeVersions).values({
          jurisdictionEntityTypeId: entity.id,
          jurisdictionProfileVersionId: version.id,
          statutoryCategoryCode: entitySource.statutoryCategoryCode,
          annex: entitySource.annex,
          classificationRule: entitySource.classificationRule,
          labelContentRevisionId: contentRevisionId(entitySource.labelContentKey),
          descriptionContentRevisionId: contentRevisionId(entitySource.descriptionContentKey),
          definitionHash: contentHash(entitySource),
        }).returning();
        await tx.insert(jurisdictionEntityTypeLegalProvisions).values(
          entitySource.legalProvisionKeys.map((key) => ({
            jurisdictionEntityTypeVersionId: entityVersion.id,
            legalProvisionId: legalProvisionId(key),
          })),
        );
        if (entitySource.mappings.length > 0) {
          await tx.insert(jurisdictionEntityTypeMappings).values(
            entitySource.mappings.map((mapping) => {
              const scopeEntityTypeId = entityTypeIdByCode.get(mapping.euEntityCode);
              if (!scopeEntityTypeId) throw new Error(`Unknown EU entity mapping ${mapping.euEntityCode}`);
              return {
                jurisdictionEntityTypeVersionId: entityVersion.id,
                scopeEntityTypeId,
                relationshipKind: mapping.relationship,
              };
            }),
          );
        }
      }
      if (!profileReused) {
        await tx.insert(jurisdictionProfileThresholdPolicies).values({
          jurisdictionProfileVersionId: version.id,
          scopeThresholdSetId: thresholdSet.id,
          employeeMeasure: source.thresholdPolicy.employeeMeasure,
          publicBodyRule: source.thresholdPolicy.publicBodyRule,
          aggregationRule: source.thresholdPolicy.aggregationRule,
          negligibleActivityRule: source.thresholdPolicy.negligibleActivityRule,
        });
        for (const rule of source.jurisdictionRules) {
          await tx.insert(jurisdictionProfileJurisdictionRules).values(
            rule.entityCodes.map((entityCode) => {
              const jurisdictionEntityTypeId = nationalEntityIdByCode.get(entityCode);
              if (!jurisdictionEntityTypeId) throw new Error(`Unknown national jurisdiction entity ${entityCode}`);
              return {
                jurisdictionProfileVersionId: version.id,
                jurisdictionEntityTypeId,
                basisCode: rule.basisCode,
                legalProvisionId: legalProvisionId(rule.legalProvisionKey),
                authorityDecisionRequired: rule.authorityDecisionRequired ?? false,
              };
            }),
          );
        }
        await tx.insert(jurisdictionProfileEffectiveStates).values(
          source.effectiveStates.map((state) => ({
            jurisdictionProfileVersionId: version.id,
            code: state.code,
            stateValue: state.value,
            effectiveFrom: state.effectiveFrom,
            effectiveTo: state.effectiveTo,
            reviewedAt: new Date(state.reviewedAt),
            officialSourceUrl: state.officialSourceUrl,
            legalProvisionId: legalProvisionId(state.legalProvisionKey),
            declarationHash: contentHash(state),
          })),
        );
      }
    }

    for (const factSource of release.facts) {
      for (const optionSource of factSource.options) {
        if (!optionSource.jurisdictionEntityTypeCode) continue;
        const factOptionId = factOptionIdByKey.get(
          `${factSource.key}.${optionSource.stableValue}`,
        );
        const jurisdictionEntityTypeId = jurisdictionEntityTypeIdByCode.get(
          optionSource.jurisdictionEntityTypeCode,
        );
        if (!factOptionId || !jurisdictionEntityTypeId) {
          throw new Error(
            `National fact-option link missing for ${factSource.key}.${optionSource.stableValue}`,
          );
        }
        const existingFactOption = await tx.query.factOptions.findFirst({
          where: eq(factOptions.id, factOptionId),
        });
        if (
          existingFactOption?.jurisdictionEntityTypeId &&
          existingFactOption.jurisdictionEntityTypeId !== jurisdictionEntityTypeId
        ) {
          throw new Error(
            `Conflicting national identity for ${factSource.key}.${optionSource.stableValue}`,
          );
        }
        if (!existingFactOption?.jurisdictionEntityTypeId) {
          await tx
            .update(factOptions)
            .set({ jurisdictionEntityTypeId })
            .where(eq(factOptions.id, factOptionId));
        }
      }
    }

    const existingRuleSet = await tx.query.ruleSets.findFirst({
      where: eq(ruleSets.contentHash, compiled.hashes.ruleSet),
    });
    const ruleSet = existingRuleSet ?? (await tx.insert(ruleSets).values({
      moduleId: module.id,
      code: "affectedness_check",
      versionLabel: release.versionLabel,
      status: "published",
      evaluatorKind: release.evaluatorKind,
      evaluatorSchemaVersion: release.evaluatorVersion,
      rules: compiled.artifact,
      contentHash: compiled.hashes.ruleSet,
      publishedAt: new Date(),
    }).returning())[0];
    if (!ruleSet) throw new Error("Rule set insert failed");
    const [checkRelease] = await tx.insert(complianceCheckReleases).values({
      checkCode: release.checkCode,
      versionLabel: release.versionLabel,
      moduleId: module.id,
      questionnaireVersionId: questionnaireVersion.id,
      scopeModelVersionId: scopeModelVersion.id,
      scopeThresholdSetId: thresholdSet.id,
      ruleSetId: ruleSet.id,
      evaluatorKind: release.evaluatorKind,
      evaluatorVersion: release.evaluatorVersion,
      defaultLocale: release.defaultLocale,
      effectiveFrom: release.effectiveFrom,
      status: "published",
      aggregateHash: compiled.hashes.aggregate,
      publishedAt: new Date(),
    }).returning();
    await tx.insert(complianceCheckReleaseFactVersions).values(
      factVersionIds.map((factDefinitionVersionId) => ({ checkReleaseId: checkRelease.id, factDefinitionVersionId })),
    );
    await tx.insert(complianceCheckReleaseContentRevisions).values(
      [...revisionByContentKey.values()].map((contentRevisionId) => ({ checkReleaseId: checkRelease.id, contentRevisionId })),
    );
    await tx.insert(complianceCheckReleaseProfiles).values(
      [...profileVersionIdByCountry].map(([countryCode, jurisdictionProfileVersionId]) => ({ checkReleaseId: checkRelease.id, countryCode, jurisdictionProfileVersionId })),
    );
    return { id: checkRelease.id, versionLabel: checkRelease.versionLabel, aggregateHash: checkRelease.aggregateHash };
  });
}
