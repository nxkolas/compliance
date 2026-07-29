import { reliabilityV7GapRelease } from "../reliability-v7/release";
import {
  GAP_PROMPT_V12_NAME,
  GAP_PROMPT_V12_TEMPLATE_HASH,
  GAP_PROMPT_V12_VERSION,
  GAP_RESPONSE_SCHEMA_V12_VERSION,
} from "../../prompt-contract-v12";
import type { GapAnalysisReleaseDefinition } from "../types";

export const reliabilityV8GapRelease: GapAnalysisReleaseDefinition = {
  ...reliabilityV7GapRelease,
  versionLabel: "reliability-v8",
  prompt: {
    name: GAP_PROMPT_V12_NAME,
    version: GAP_PROMPT_V12_VERSION,
    templateHash: GAP_PROMPT_V12_TEMPLATE_HASH,
    responseSchemaVersion: GAP_RESPONSE_SCHEMA_V12_VERSION,
  },
  questionnaire: {
    ...reliabilityV7GapRelease.questionnaire,
    questions: reliabilityV7GapRelease.questionnaire.questions.map(
      (question) => ({ ...question }),
    ),
  },
  requirementSet: {
    ...reliabilityV7GapRelease.requirementSet,
    versionLabel: "reliability-v8",
    requirements: reliabilityV7GapRelease.requirementSet.requirements.map(
      (requirement) => ({
        ...requirement,
        versionLabel: "reliability-v8",
      }),
    ),
  },
};
