import { reliabilityV5GapRelease } from "../reliability-v5/release";
import {
  ACTION_PLAN_PROMPT_V5_NAME,
  ACTION_PLAN_PROMPT_V5_TEMPLATE_HASH,
  ACTION_PLAN_PROMPT_V5_VERSION,
  ACTION_PLAN_RESPONSE_SCHEMA_V5_VERSION,
} from "../../../ai/generation";
import type { GapAnalysisReleaseDefinition } from "../types";

export const reliabilityV6GapRelease: GapAnalysisReleaseDefinition = {
  ...reliabilityV5GapRelease,
  versionLabel: "reliability-v6",
  actionPlanPrompt: {
    name: ACTION_PLAN_PROMPT_V5_NAME,
    version: ACTION_PLAN_PROMPT_V5_VERSION,
    templateHash: ACTION_PLAN_PROMPT_V5_TEMPLATE_HASH,
    responseSchemaVersion: ACTION_PLAN_RESPONSE_SCHEMA_V5_VERSION,
  },
  questionnaire: {
    ...reliabilityV5GapRelease.questionnaire,
    questions: reliabilityV5GapRelease.questionnaire.questions.map(
      (question) => ({ ...question }),
    ),
  },
  requirementSet: {
    ...reliabilityV5GapRelease.requirementSet,
    versionLabel: "reliability-v6",
    requirements: reliabilityV5GapRelease.requirementSet.requirements.map(
      (requirement) => ({
        ...requirement,
        versionLabel: "reliability-v6",
      }),
    ),
  },
};
