import type { Locale } from "@/lib/i18n-config";
import {
  getNis2ReleaseMessage,
  getNis2ReleaseMessageKeys,
} from "@/lib/i18n/messages/nis2-release";
import { compileRelease } from "@/src/server/modules/compliance";
import { nis2ReleaseDefinition2026V2 } from "@/src/server/modules/compliance";
import type {
  PublishedComplianceRelease,
  RuntimeReleaseOption,
} from "@/src/server/modules/compliance";

export const CURRENT_APPLICABILITY_CHECK_CODE = "nis2_applicability";
export const SUPPORTED_JURISDICTION_CODES = ["DE"] as const;

export const currentApplicabilityDefinition = nis2ReleaseDefinition2026V2;

const compiled = compileRelease(currentApplicabilityDefinition);

export const currentApplicabilityDefinitionHash = compiled.hashes.aggregate;

export function isSupportedJurisdiction(countryCode: string) {
  return (SUPPORTED_JURISDICTION_CODES as readonly string[]).includes(
    countryCode.toUpperCase(),
  );
}

export function getCurrentApplicabilityDefinition(
  locale: Locale,
): PublishedComplianceRelease {
  const definition = currentApplicabilityDefinition;
  const content = new Map<string, string>(
    getNis2ReleaseMessageKeys().map((key) => [
      key,
      getNis2ReleaseMessage(locale, key) ?? key,
    ]),
  );
  const factByKey = new Map(definition.facts.map((fact) => [fact.key, fact]));
  const entityByCode = new Map(
    definition.entityTypes.map((entity) => [entity.code, entity]),
  );
  const germanProfile = definition.profiles.find(
    (profile) => profile.countryCode === "DE",
  );
  const germanEntityByCode = new Map(
    (germanProfile?.entityCatalog ?? []).map((entity) => [entity.code, entity]),
  );
  const sectorByCode = new Map(
    definition.sectors.map((sector) => [sector.code, sector]),
  );
  const provisionByKey = new Map<
    string,
    (typeof definition.legalInstruments)[number]["provisions"][number]
  >(
    definition.legalInstruments.flatMap((instrument) =>
      instrument.provisions.map(
        (provision) =>
          [`${instrument.code}.${provision.code}`, provision] as const,
      ),
    ),
  );
  const localized = (stableKey: string | undefined) =>
    stableKey ? (content.get(stableKey) ?? stableKey) : null;
  const legalLabels = (keys: string[]) =>
    keys.map((key) => {
      const provision = provisionByKey.get(key);
      return provision ? (localized(provision.citationContentKey) ?? key) : key;
    });

  const questionIndexByFactKey: Record<string, number> = {};
  const optionIndexByQuestionAndValue: PublishedComplianceRelease["optionIndexByQuestionAndValue"] =
    {};
  const questions = definition.questions.map((question, questionIndex) => {
    questionIndexByFactKey[question.factKey] = questionIndex;
    const fact = factByKey.get(question.factKey);
    const factOptions = new Map(
      (fact?.options ?? []).map((option) => [option.stableValue, option]),
    );
    const options = question.options.map((option, optionIndex) => {
      optionIndexByQuestionAndValue[
        `${question.stableKey}\u0000${option.stableValue}`
      ] = { questionIndex, optionIndex };
      const factOption = factOptions.get(option.factOptionValue);
      const euEntity = factOption?.scopeEntityTypeCode
        ? entityByCode.get(factOption.scopeEntityTypeCode)
        : undefined;
      const germanEntity = factOption?.jurisdictionEntityTypeCode
        ? germanEntityByCode.get(factOption.jurisdictionEntityTypeCode)
        : undefined;
      const entity = germanEntity ?? euEntity;
      const sector = euEntity
        ? sectorByCode.get(euEntity.sectorCode)
        : undefined;
      const entityMetadata = entity
        ? {
            annex: entity.annex,
            description: localized(entity.descriptionContentKey),
            legalReferences: legalLabels(entity.legalProvisionKeys),
            sectorLabel: localized(sector?.labelContentKey),
          }
        : {};
      return {
        id: `${question.stableKey}:${option.stableValue}`,
        stableValue: option.stableValue,
        catalogCode: factOption?.catalogCode ?? "all",
        label: localized(option.labelContentKey) ?? option.stableValue,
        position: option.position,
        metadata: { ...option.metadata, ...entityMetadata },
      } satisfies RuntimeReleaseOption;
    });
    return {
      id: question.stableKey,
      stableKey: question.stableKey,
      position: question.position,
      questionText:
        localized(question.questionContentKey) ?? question.stableKey,
      helpText: localized(question.helpContentKey),
      tooltipText: localized(question.tooltipContentKey),
      answerType: question.answerType,
      required: question.required,
      config: question.config,
      options,
      factMappings: (question.factMappings.length > 0
        ? question.factMappings
        : [{ factKey: question.factKey }]
      ).map((mapping) => ({
        factKey: mapping.factKey,
        transform: null,
        ...(mapping.byOption ? { byOption: mapping.byOption } : {}),
      })),
    };
  });

  return {
    checkCode: definition.checkCode,
    checkReleaseId: currentApplicabilityDefinitionHash,
    releaseVersionLabel: definition.versionLabel,
    aggregateHash: currentApplicabilityDefinitionHash,
    defaultLocale: definition.defaultLocale,
    locale,
    frameworkName: localized(definition.framework.nameContentKey) ?? "NIS2",
    frameworkDescription:
      localized(definition.framework.descriptionContentKey) ?? "",
    moduleId: definition.module.code,
    moduleName: localized(definition.module.nameContentKey) ?? "NIS2",
    questionnaireId: definition.questionnaire.code,
    questionnaireVersionId: currentApplicabilityDefinitionHash,
    questionnaireTitle:
      localized(definition.questionnaire.titleContentKey) ?? "NIS2",
    questionnaireCode: definition.questionnaire.code,
    ruleSet: {
      id: currentApplicabilityDefinitionHash,
      moduleId: definition.module.code,
      code: definition.checkCode,
      versionLabel: definition.versionLabel,
      status: "published",
      evaluatorKind: definition.evaluatorKind,
      evaluatorSchemaVersion: definition.evaluatorVersion,
      rules: compiled.artifact,
      contentHash: compiled.hashes.ruleSet,
      createdAt: new Date(`${definition.effectiveFrom}T00:00:00.000Z`),
      publishedAt: new Date(`${definition.effectiveFrom}T00:00:00.000Z`),
    },
    scopeModelVersionId: currentApplicabilityDefinitionHash,
    questions,
    contentByStableKey: Object.fromEntries(content),
    questionIndexByFactKey,
    optionIndexByQuestionAndValue,
  };
}
