import { reliabilityV2GapRelease } from "../reliability-v2/release";
import {
  GAP_PROMPT_V10_NAME,
  GAP_PROMPT_V10_TEMPLATE_HASH,
  GAP_PROMPT_V10_VERSION,
  GAP_RESPONSE_SCHEMA_V10_VERSION,
} from "../../prompt-contract-v10";
import type { GapAnalysisReleaseDefinition } from "../types";

export const reliabilityV3GapRelease: GapAnalysisReleaseDefinition = {
  ...reliabilityV2GapRelease,
  versionLabel: "reliability-v3",
  prompt: {
    name: GAP_PROMPT_V10_NAME,
    version: GAP_PROMPT_V10_VERSION,
    templateHash: GAP_PROMPT_V10_TEMPLATE_HASH,
    responseSchemaVersion: GAP_RESPONSE_SCHEMA_V10_VERSION,
  },
  questionnaire: {
    ...reliabilityV2GapRelease.questionnaire,
    questions: reliabilityV2GapRelease.questionnaire.questions.map(
      (question) => ({ ...question }),
    ),
  },
  requirementSet: {
    ...reliabilityV2GapRelease.requirementSet,
    versionLabel: "reliability-v3",
    requirements: reliabilityV2GapRelease.requirementSet.requirements.map(
      (requirement) => ({
        ...requirement,
        versionLabel: "reliability-v3",
      }),
    ),
  },
};
