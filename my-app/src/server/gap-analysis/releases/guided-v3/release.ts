import {
  GAP_PROMPT_NAME,
  GAP_PROMPT_TEMPLATE_HASH,
  GAP_PROMPT_VERSION,
  GAP_RESPONSE_SCHEMA_VERSION,
} from "../../prompt-contract";
import { guidedGapRelease } from "../guided-v2/release";
import type { GapAnalysisReleaseDefinition } from "../types";

export const singleLifecycleGapRelease: GapAnalysisReleaseDefinition = {
  ...guidedGapRelease,
  versionLabel: "guided-v3",
  prompt: {
    name: GAP_PROMPT_NAME,
    version: GAP_PROMPT_VERSION,
    templateHash: GAP_PROMPT_TEMPLATE_HASH,
    responseSchemaVersion: GAP_RESPONSE_SCHEMA_VERSION,
  },
  requirementSet: {
    ...guidedGapRelease.requirementSet,
    title: {
      de: "NIS2-Sicherheitsanforderungen – einheitlicher Lebenszyklus",
      en: "NIS2 security requirements – single lifecycle",
    },
    versionLabel: "guided-v3",
    requirements: guidedGapRelease.requirementSet.requirements.map(
      (requirement) => ({
        ...requirement,
        versionLabel: "guided-v3",
      }),
    ),
  },
};
