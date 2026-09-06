/**
 * Localized view of the one code-owned Gap contract.
 *
 * The historical name remains only as a temporary type alias for callers; this
 * module performs no release lookup, publication, activation, or routing.
 */
export type LoadedGapRelease = {
  id: string;
  releaseCode: string;
  versionLabel: string;
  moduleId: string;
  moduleTitle: string;
  questionnaireId: string;
  questionnaireVersionId: string;
  questionnaireTitle: string;
  requirementSetTitle: string;
  compatibleCheckReleaseId: string;
  prompt: {
    name: string;
    version: string;
    templateHash: string;
    responseSchemaVersion: string;
  };
  actionPlanPrompt: {
    name: string;
    version: string;
    templateHash: string;
    responseSchemaVersion: string;
  };
  evaluator: { kind: string; version: number };
  questions: Array<{
    id: string;
    stableKey: string;
    position: number;
    questionText: string;
    helpText: string | null;
    answerType: string;
    required: boolean;
    splittable: boolean;
    maximumStatements: number;
    legalProvisions: Array<{
      id: string;
      key: string;
      provisionCode: string;
      position: number;
    }>;
    options: Array<{
      id: string;
      stableValue: string;
      label: string;
      position: number;
    }>;
  }>;
  requirements: Array<{
    id: string;
    stableRequirementId: string;
    code: string;
    position: number;
    icon: string;
    criticality: "low" | "medium" | "high" | "critical";
    title: string;
    requirementText: string;
    legalReferences: Array<{
      key: string;
      label: string;
      url: string | null;
    }>;
    applicabilityOutcomeCodes: string[];
    questionStableKeys: string[];
  }>;
};
