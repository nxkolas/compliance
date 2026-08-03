import type { Locale } from "@/lib/i18n-config";
import { compileGapAnalysisRelease } from "@/src/server/gap-analysis/publishing/compile-release";
import { currentGapContractDefinition } from "@/src/server/gap-analysis/current-contract";
import type { LoadedGapRelease } from "@/src/server/gap-analysis/release-loader";
import { currentApplicabilityDefinitionHash } from "./applicability";

export const CURRENT_GAP_DEFINITION_CODE = "nis2-gap";
export const currentGapDefinition = currentGapContractDefinition;

const compiled = compileGapAnalysisRelease(currentGapDefinition);

export const currentGapDefinitionHash = compiled.hashes.aggregate;

export function getCurrentGapDefinition(locale: Locale): LoadedGapRelease {
  const definition = currentGapDefinition;
  const localize = (value: { de: string; en: string }) => value[locale];

  return {
    id: currentGapDefinitionHash,
    releaseCode: definition.releaseCode,
    versionLabel: definition.versionLabel,
    moduleId: definition.releaseCode,
    moduleTitle: localize(definition.title),
    questionnaireId: definition.questionnaire.code,
    questionnaireVersionId: currentGapDefinitionHash,
    questionnaireTitle: localize(definition.questionnaire.title),
    requirementSetTitle: localize(definition.requirementSet.title),
    compatibleCheckReleaseId: currentApplicabilityDefinitionHash,
    prompt: definition.prompt,
    actionPlanPrompt: requireActionPlanPrompt(definition.actionPlanPrompt),
    evaluator: definition.evaluator,
    questions: definition.questionnaire.questions.map((question) => ({
      id: question.stableKey,
      stableKey: question.stableKey,
      position: question.position,
      questionText: localize(question.text),
      helpText: localize(question.help),
      answerType: question.answerType,
      required: question.required,
      splittable: question.splittable ?? false,
      maximumStatements: question.maximumStatements ?? 1,
      legalProvisions: (question.legalProvisionKeys ?? []).map(
        (key, position) => ({
          id: key,
          key,
          provisionCode: key.split(".").at(-1) ?? key,
          position: position + 1,
        }),
      ),
      options: question.options.map((option) => ({
        id: `${question.stableKey}:${option.stableValue}`,
        stableValue: option.stableValue,
        label: localize(option.label),
        position: option.position,
      })),
    })),
    requirements: definition.requirementSet.requirements.map((requirement) => ({
      id: requirement.code,
      stableRequirementId: requirement.code,
      code: requirement.code,
      position: requirement.position,
      icon: requirement.icon,
      criticality: requirement.criticality,
      title: localize(requirement.title),
      requirementText: localize(requirement.requirementText),
      legalReferences: requirement.legalReferences.map((reference) => ({
        key: reference.url,
        label: localize(reference.label),
        url: reference.url,
      })),
      applicabilityOutcomeCodes: requirement.applicableOutcomeCodes,
      questionStableKeys: requirement.questionStableKeys,
    })),
  };
}

function requireActionPlanPrompt(
  prompt: typeof currentGapDefinition.actionPlanPrompt,
) {
  if (!prompt) throw new Error("The current Gap definition has no Action Plan prompt");
  return prompt;
}
