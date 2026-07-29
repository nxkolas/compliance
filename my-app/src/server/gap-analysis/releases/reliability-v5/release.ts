import { reliabilityV4GapRelease } from "../reliability-v4/release";
import {
  GAP_PROMPT_V11_NAME,
  GAP_PROMPT_V11_TEMPLATE_HASH,
  GAP_PROMPT_V11_VERSION,
  GAP_RESPONSE_SCHEMA_V11_VERSION,
} from "../../prompt-contract-v11";
import type { GapAnalysisReleaseDefinition } from "../types";

export const reliabilityV5GapRelease: GapAnalysisReleaseDefinition = {
  ...reliabilityV4GapRelease,
  versionLabel: "reliability-v5",
  prompt: {
    name: GAP_PROMPT_V11_NAME,
    version: GAP_PROMPT_V11_VERSION,
    templateHash: GAP_PROMPT_V11_TEMPLATE_HASH,
    responseSchemaVersion: GAP_RESPONSE_SCHEMA_V11_VERSION,
  },
  questionnaire: {
    ...reliabilityV4GapRelease.questionnaire,
    questions: reliabilityV4GapRelease.questionnaire.questions.map(
      (question) => ({ ...question }),
    ),
  },
  requirementSet: {
    ...reliabilityV4GapRelease.requirementSet,
    versionLabel: "reliability-v5",
    requirements: reliabilityV4GapRelease.requirementSet.requirements.map(
      (requirement) => ({
        ...requirement,
        versionLabel: "reliability-v5",
      }),
    ),
  },
};
