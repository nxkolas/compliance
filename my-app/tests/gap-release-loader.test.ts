import { describe, expect, it } from "vitest";
import {
  currentApplicabilityDefinitionHash,
  currentGapDefinition,
  currentGapDefinitionHash,
} from "@/src/server/definitions";
import {
  getActiveGapAnalysisRelease,
  loadGapAnalysisRelease,
} from "@/src/server/gap-analysis/release-loader";

describe("code-owned Gap definition", () => {
  it("loads the deployed definition without a database release", async () => {
    const definition = await getActiveGapAnalysisRelease("nis2-gap", "en");

    expect(definition).toMatchObject({
      id: currentGapDefinitionHash,
      versionLabel: currentGapDefinition.versionLabel,
      compatibleCheckReleaseId: currentApplicabilityDefinitionHash,
      questionnaireTitle: currentGapDefinition.questionnaire.title.en,
    });
    expect(definition?.questions).toHaveLength(
      currentGapDefinition.questionnaire.questions.length,
    );
    expect(definition?.requirements).toHaveLength(
      currentGapDefinition.requirementSet.requirements.length,
    );
  });

  it("localizes immutable question and requirement snapshots", async () => {
    const german = await loadGapAnalysisRelease(currentGapDefinitionHash, "de");
    const english = await loadGapAnalysisRelease(currentGapDefinitionHash, "en");

    expect(german?.questions[0]?.questionText).toBe(
      currentGapDefinition.questionnaire.questions[0]?.text.de,
    );
    expect(english?.questions[0]?.questionText).toBe(
      currentGapDefinition.questionnaire.questions[0]?.text.en,
    );
    expect(german?.requirements[0]?.requirementText).toBe(
      currentGapDefinition.requirementSet.requirements[0]?.requirementText.de,
    );
    expect(english?.requirements[0]?.requirementText).toBe(
      currentGapDefinition.requirementSet.requirements[0]?.requirementText.en,
    );
  });

  it("rejects historical definition hashes as executable input", async () => {
    await expect(loadGapAnalysisRelease("retired-definition", "de")).resolves.toBeNull();
  });
});
