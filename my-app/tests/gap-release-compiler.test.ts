import { describe, expect, it } from "vitest";
import { compileGapAnalysisRelease } from "@/src/server/gap-analysis/publishing/compile-release";
import { demoGapRelease } from "@/src/server/gap-analysis/releases/demo-v1/release";
import { guidedGapRelease } from "@/src/server/gap-analysis/releases/guided-v2/release";

describe("gap-analysis release compiler", () => {
  it("compiles the four-requirement demo release deterministically", () => {
    const first = compileGapAnalysisRelease(demoGapRelease);
    const second = compileGapAnalysisRelease(demoGapRelease);

    expect(first.hashes.aggregate).toBe(second.hashes.aggregate);
    expect(demoGapRelease.questionnaire.questions).toHaveLength(4);
    expect(demoGapRelease.requirementSet.requirements).toHaveLength(4);
    expect(
      demoGapRelease.requirementSet.requirements.every((requirement) =>
        requirement.legalReferences.every((reference) => reference.demoPlaceholder),
      ),
    ).toBe(true);
  });

  it("rejects incomplete deterministic mappings", () => {
    const invalid = structuredClone(demoGapRelease);
    invalid.requirementSet.requirements[0].questionStableKeys = ["missing"];

    expect(() => compileGapAnalysisRelease(invalid)).toThrow(/unknown question/);
  });

  it("rejects prompt metadata that drifts from production code", () => {
    const invalid = structuredClone(demoGapRelease);
    invalid.prompt.templateHash = "stale";

    expect(() => compileGapAnalysisRelease(invalid)).toThrow(/template hash/);
  });

  it("publishes the guided labels under a new immutable release contract", () => {
    expect(() => compileGapAnalysisRelease(guidedGapRelease)).not.toThrow();
    expect(guidedGapRelease.versionLabel).toBe("guided-v2");
    expect(guidedGapRelease.prompt.version).toBe("2");
    expect(
      guidedGapRelease.questionnaire.questions[0].options.map(
        (option) => option.label.en,
      ),
    ).toEqual([
      "Fully implemented",
      "Partially implemented",
      "Not implemented",
      "I don't know",
    ]);
  });
});
