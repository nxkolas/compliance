export type LocalizedText = { de: string; en: string };

export type GapQuestionDefinition = {
  stableKey: string;
  position: number;
  sourceNumber?: number;
  sourcePriority?: "low" | "medium" | "high" | "critical";
  text: LocalizedText;
  help: LocalizedText;
  required: true;
  answerType: "single_choice";
  legalProvisionKeys?: string[];
  splittable?: true;
  maximumStatements?: number;
  options: Array<{
    stableValue: string;
    position: number;
    label: LocalizedText;
  }>;
};

export type GapRequirementDefinition = {
  code: string;
  versionLabel: string;
  position: number;
  criticality: "low" | "medium" | "high" | "critical";
  title: LocalizedText;
  requirementText: LocalizedText;
  /** Optional placeholder references; published releases derive authority relationally. */
  legalReferences: Array<{
    label: LocalizedText;
    url: string;
    demoPlaceholder: true;
  }>;
  questionStableKeys: string[];
  applicableOutcomeCodes: Array<"essential_entity" | "important_entity">;
};

export type GapAnalysisReleaseDefinition = {
  releaseCode: string;
  versionLabel: string;
  title: LocalizedText;
  compatibleCheck: { checkCode: string; versionLabel: string };
  requiredCorpusFamilies: string[];
  defaultLocale: "de" | "en";
  prompt: {
    name: string;
    version: string;
    templateHash: string;
    responseSchemaVersion: string;
  };
  actionPlanPrompt?: {
    name: string;
    version: string;
    templateHash: string;
    responseSchemaVersion: string;
  };
  evaluator: { kind: string; version: number };
  questionnaire: {
    code: string;
    title: LocalizedText;
    questions: GapQuestionDefinition[];
  };
  requirementSet: {
    code: string;
    title: LocalizedText;
    versionLabel: string;
    requirements: GapRequirementDefinition[];
  };
};
