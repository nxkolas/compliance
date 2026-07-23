import { demoGapRelease } from "../demo-v1/release";
import type { GapAnalysisReleaseDefinition } from "../types";

const answerLabels: Record<string, { de: string; en: string }> = {
  implemented_documented: {
    de: "Vollständig umgesetzt",
    en: "Fully implemented",
  },
  partially_implemented: {
    de: "Teilweise umgesetzt",
    en: "Partially implemented",
  },
  not_implemented: {
    de: "Nicht umgesetzt",
    en: "Not implemented",
  },
  unknown: {
    de: "Weiß ich nicht",
    en: "I don't know",
  },
};

export const guidedGapRelease: GapAnalysisReleaseDefinition = {
  ...demoGapRelease,
  versionLabel: "guided-v2",
  title: {
    de: "NIS2-Gap-Analyse",
    en: "NIS2 gap analysis",
  },
  questionnaire: {
    ...demoGapRelease.questionnaire,
    title: {
      de: "Fragen zur NIS2-Umsetzung",
      en: "Questions about NIS2 implementation",
    },
    questions: demoGapRelease.questionnaire.questions.map((question) => ({
      ...question,
      options: question.options.map((option) => ({
        ...option,
        label: answerLabels[option.stableValue] ?? option.label,
      })),
    })),
  },
  requirementSet: {
    ...demoGapRelease.requirementSet,
    title: "NIS2 security requirements – guided workflow",
    versionLabel: "guided-v2",
    requirements: demoGapRelease.requirementSet.requirements.map(
      (requirement) => ({
        ...requirement,
        versionLabel: "guided-v2",
      }),
    ),
  },
};
