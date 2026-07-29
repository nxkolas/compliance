import { reliabilityV6GapRelease } from "../reliability-v6/release";
import {
  ACTION_PLAN_PROMPT_V6_NAME,
  ACTION_PLAN_PROMPT_V6_TEMPLATE_HASH,
  ACTION_PLAN_PROMPT_V6_VERSION,
  ACTION_PLAN_RESPONSE_SCHEMA_V6_VERSION,
} from "../../../ai/generation";
import type { GapAnalysisReleaseDefinition } from "../types";

export const reliabilityV7GapRelease: GapAnalysisReleaseDefinition = {
  ...reliabilityV6GapRelease,
  versionLabel: "reliability-v7",
  actionPlanPrompt: {
    name: ACTION_PLAN_PROMPT_V6_NAME,
    version: ACTION_PLAN_PROMPT_V6_VERSION,
    templateHash: ACTION_PLAN_PROMPT_V6_TEMPLATE_HASH,
    responseSchemaVersion: ACTION_PLAN_RESPONSE_SCHEMA_V6_VERSION,
  },
  questionnaire: {
    ...reliabilityV6GapRelease.questionnaire,
    questions: reliabilityV6GapRelease.questionnaire.questions.map(
      (question) => ({ ...question }),
    ),
  },
  requirementSet: {
    ...reliabilityV6GapRelease.requirementSet,
    versionLabel: "reliability-v7",
    requirements: reliabilityV6GapRelease.requirementSet.requirements.map(
      (requirement) => ({
        ...requirement,
        versionLabel: "reliability-v7",
      }),
    ),
  },
};
