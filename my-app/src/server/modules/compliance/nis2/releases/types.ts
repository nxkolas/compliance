import type { Nis2EntityRule } from "../rule-set-schema";
import type { Locale } from "@/lib/i18n-config";

export type LegalProvisionSource = {
  code: string;
  officialSourceUrl: string;
  citationContentKey: string;
};

export type LegalInstrumentSource = {
  code: string;
  jurisdictionCode: string;
  instrumentType: string;
  versionLabel: string;
  officialIdentifier: string;
  officialSourceUrl: string;
  effectiveFrom?: string;
  titleContentKey: string;
  provisions: LegalProvisionSource[];
};

export type FactOptionSource = {
  stableValue: string;
  catalogCode: "all" | "eu_core" | `country:${string}`;
  scopeEntityTypeCode?: string;
  jurisdictionEntityTypeCode?: string;
};

export type FactDefinitionSource = {
  key: string;
  dataType:
    "text" | "number" | "boolean" | "enum" | "multi_enum" | "structured";
  labelContentKey: string;
  descriptionContentKey: string;
  options: FactOptionSource[];
};

export type ReleaseQuestionOptionSource = {
  stableValue: string;
  labelContentKey: string;
  factOptionValue: string;
  position: number;
  metadata: Record<string, unknown>;
};

export type ReleaseQuestionFactMapping = {
  factKey: string;
  /**
   * Optional per-option fact values. When present, an answered question maps
   * each selected option through this table instead of writing the raw answer
   * value. A `null` value writes nothing for that fact. Arrays are used for
   * multi-value facts (for example one wizard activity expanding to several
   * German entity-catalogue codes).
   */
  byOption?: Record<string, string | string[] | null>;
};

export type ReleaseQuestionSource = {
  stableKey: string;
  position: number;
  questionContentKey: string;
  helpContentKey?: string;
  tooltipContentKey?: string;
  answerType: "single_choice" | "multi_choice";
  required: boolean;
  factKey: string;
  config: Record<string, unknown>;
  options: ReleaseQuestionOptionSource[];
  factMappings: ReleaseQuestionFactMapping[];
};

export type ReleaseEntityTypeSource = {
  code: string;
  sectorCode: string;
  annex: 1 | 2 | null;
  rule: Nis2EntityRule;
  labelContentKey: string;
  descriptionContentKey: string;
  legalProvisionKeys: string[];
};

export type ReleaseProfileSource = {
  code: string;
  countryCode: string;
  versionLabel: string;
  supported: boolean;
  allowNegativeConclusion: boolean;
  legalProvisionKeys: string[];
  designations: Array<{
    code: string;
    outcomeCode: string;
    legalProvisionKey: string;
  }>;
  entityCatalog: NationalEntityTypeSource[];
  unmappedEuEntityCodes: string[];
  thresholdPolicy: {
    employeeMeasure: "annual_work_units";
    publicBodyRule: "exclude_recommendation_annex_article_3_4";
    aggregationRule: "recommendation_articles_3_to_6_with_de_it_independence_exception";
    negligibleActivityRule: "may_disregard";
    legalProvisionKeys: string[];
  };
  jurisdictionRules: Array<{
    basisCode: string;
    entityCodes: string[];
    legalProvisionKey: string;
    authorityDecisionRequired?: boolean;
  }>;
  effectiveStates: Array<{
    code: string;
    value: string;
    effectiveFrom: string;
    effectiveTo?: string;
    reviewedAt: string;
    officialSourceUrl: string;
    legalProvisionKey: string;
  }>;
};

export type NationalEntityTypeSource = {
  code: string;
  statutoryCategoryCode: string | null;
  annex: 1 | 2 | null;
  classificationRule:
    | "annex_1_standard"
    | "annex_2_standard"
    | "always_particularly_important"
    | "always_important"
    | "telecom"
    | "federal_administration"
    | "domain_registration_obligations"
    | "requires_land_law";
  labelContentKey: string;
  descriptionContentKey: string;
  legalProvisionKeys: string[];
  mappings: Array<{
    euEntityCode: string;
    relationship: "exact" | "subset" | "aggregate" | "overlap";
  }>;
};

export type Nis2ReleaseDefinition = {
  checkCode: "nis2_applicability";
  versionLabel: string;
  evaluatorKind: "nis2_scope_v2" | "nis2_scope_v3";
  evaluatorVersion: 2 | 3;
  defaultLocale: Locale;
  effectiveFrom: string;
  requiredCorpusFamilies: string[];
  framework: {
    code: string;
    nameContentKey: string;
    descriptionContentKey: string;
  };
  module: {
    code: string;
    nameContentKey: string;
    moduleType: "questionnaire";
    position: number;
  };
  questionnaire: {
    code: string;
    titleContentKey: string;
  };
  legalInstruments: LegalInstrumentSource[];
  sectors: Array<{ code: string; labelContentKey: string }>;
  entityTypes: ReleaseEntityTypeSource[];
  facts: FactDefinitionSource[];
  questions: ReleaseQuestionSource[];
  thresholds: {
    code: string;
    versionLabel: string;
    mediumEmployeeThreshold: number;
    mediumTurnoverThreshold: number;
    mediumBalanceSheetThreshold: number;
    largeEmployeeThreshold: number;
    largeTurnoverThreshold: number;
    largeBalanceSheetThreshold: number;
    employeeComparison: "at_least";
    financialComparison: "both_above";
    legalProvisionKeys: string[];
    buckets: {
      employees: { medium: string; large: string };
      turnover: { medium: string[]; large: string };
      balanceSheet: { medium: string[]; large: string };
    };
  };
  profiles: ReleaseProfileSource[];
  outcomeContentKeys: Record<string, string>;
  reasonContentKeys: Record<string, string>;
  disclaimerContentKey: string;
  fixtures: Array<{
    name: string;
    facts: Record<string, unknown>;
    expectedOutcome: string;
  }>;
};
