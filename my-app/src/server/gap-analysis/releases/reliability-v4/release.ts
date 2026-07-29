import { reliabilityV3GapRelease } from "../reliability-v3/release";
import {
  ACTION_PLAN_PROMPT_V4_NAME,
  ACTION_PLAN_PROMPT_V4_TEMPLATE_HASH,
  ACTION_PLAN_PROMPT_V4_VERSION,
  ACTION_PLAN_RESPONSE_SCHEMA_V4_VERSION,
} from "../../../ai/generation";
import type { GapAnalysisReleaseDefinition } from "../types";

export const reliabilityV4GapRelease: GapAnalysisReleaseDefinition = {
  ...reliabilityV3GapRelease,
  versionLabel: "reliability-v4",
  actionPlanPrompt: {
    name: ACTION_PLAN_PROMPT_V4_NAME,
    version: ACTION_PLAN_PROMPT_V4_VERSION,
    templateHash: ACTION_PLAN_PROMPT_V4_TEMPLATE_HASH,
    responseSchemaVersion: ACTION_PLAN_RESPONSE_SCHEMA_V4_VERSION,
  },
  questionnaire: {
    ...reliabilityV3GapRelease.questionnaire,
    questions: reliabilityV3GapRelease.questionnaire.questions.map(
      (question) => ({ ...question }),
    ),
  },
  requirementSet: {
    ...reliabilityV3GapRelease.requirementSet,
    versionLabel: "reliability-v4",
    requirements: reliabilityV3GapRelease.requirementSet.requirements.map(
      (requirement) => ({
        ...requirement,
        versionLabel: "reliability-v4",
      }),
    ),
  },
};
