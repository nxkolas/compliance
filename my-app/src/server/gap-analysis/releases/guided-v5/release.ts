import {
  GAP_PROMPT_V6_NAME,
  GAP_PROMPT_V6_TEMPLATE_HASH,
  GAP_PROMPT_V6_VERSION,
  GAP_RESPONSE_SCHEMA_V6_VERSION,
} from "../../prompt-contract-v6";
import { guidedV4GapRelease } from "../guided-v4/release";
import type { GapAnalysisReleaseDefinition } from "../types";

// Materialize a detached snapshot so neither release object can be mutated
// through shared question, option, or requirement references.
const guidedV4ContentSnapshot = JSON.parse(
  JSON.stringify(guidedV4GapRelease),
) as GapAnalysisReleaseDefinition;

export const guidedV5GapRelease: GapAnalysisReleaseDefinition = {
  ...guidedV4ContentSnapshot,
  versionLabel: "guided-v5",
  prompt: {
    name: GAP_PROMPT_V6_NAME,
    version: GAP_PROMPT_V6_VERSION,
    templateHash: GAP_PROMPT_V6_TEMPLATE_HASH,
    responseSchemaVersion: GAP_RESPONSE_SCHEMA_V6_VERSION,
  },
  questionnaire: {
    ...guidedV4ContentSnapshot.questionnaire,
    questions: guidedV4ContentSnapshot.questionnaire.questions.map(
      (question) => ({
        ...question,
        text: { ...question.text },
        help: { ...question.help },
        legalProvisionKeys: question.legalProvisionKeys
          ? [...question.legalProvisionKeys]
          : undefined,
        options: question.options.map((option) => ({
          ...option,
          label: { ...option.label },
        })),
      }),
    ),
  },
  requirementSet: {
    ...guidedV4ContentSnapshot.requirementSet,
    versionLabel: "guided-v5",
    requirements:
      guidedV4ContentSnapshot.requirementSet.requirements.map(
        (requirement) => ({
          ...requirement,
          versionLabel: "guided-v5",
          title: { ...requirement.title },
          requirementText: { ...requirement.requirementText },
          legalReferences: requirement.legalReferences.map(
            (reference) => ({
              ...reference,
              label: { ...reference.label },
            }),
          ),
          questionStableKeys: [...requirement.questionStableKeys],
          applicableOutcomeCodes: [
            ...requirement.applicableOutcomeCodes,
          ],
        }),
      ),
  },
};
