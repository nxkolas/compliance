import { describe, expect, it } from "vitest";
import { compileGapAnalysisRelease } from "@/src/server/gap-analysis/publishing/compile-release";
import { demoGapRelease } from "@/src/server/gap-analysis/releases/demo-v1/release";
import { guidedGapRelease } from "@/src/server/gap-analysis/releases/guided-v2/release";
import { singleLifecycleGapRelease } from "@/src/server/gap-analysis/releases/guided-v3/release";

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

  it("rejects blank localized definition titles", () => {
    const invalidTitles = [
      (release: typeof demoGapRelease) => {
        release.title.de = " ";
      },
      (release: typeof demoGapRelease) => {
        release.questionnaire.title.en = "";
      },
      (release: typeof demoGapRelease) => {
        release.requirementSet.title.de = "\t";
      },
    ];

    for (const invalidate of invalidTitles) {
      const invalid = structuredClone(demoGapRelease);
      invalidate(invalid);
      expect(() => compileGapAnalysisRelease(invalid)).toThrow(
        /Missing (de|en) (module|questionnaire|requirement-set) title/,
      );
    }
  });

  it("changes deterministic hashes when localized definition titles change", () => {
    const original = compileGapAnalysisRelease(demoGapRelease);
    const moduleChange = structuredClone(demoGapRelease);
    moduleChange.title.en += " updated";
    const questionnaireChange = structuredClone(demoGapRelease);
    questionnaireChange.questionnaire.title.de += " aktualisiert";
    const requirementSetChange = structuredClone(demoGapRelease);
    requirementSetChange.requirementSet.title.en += " updated";

    expect(compileGapAnalysisRelease(moduleChange).hashes.aggregate).not.toBe(
      original.hashes.aggregate,
    );
    expect(
      compileGapAnalysisRelease(questionnaireChange).hashes.questionnaire,
    ).not.toBe(original.hashes.questionnaire);
    const compiledRequirementSet =
      compileGapAnalysisRelease(requirementSetChange);
    expect(compiledRequirementSet.hashes.requirementSet).not.toBe(
      original.hashes.requirementSet,
    );
    expect(compiledRequirementSet.hashes.aggregate).not.toBe(
      original.hashes.aggregate,
    );
  });

  it("publishes the guided labels under a new immutable release contract", () => {
    expect(() => compileGapAnalysisRelease(guidedGapRelease)).not.toThrow();
    expect(guidedGapRelease.versionLabel).toBe("guided-v2");
    expect(guidedGapRelease.prompt.version).toBe("2");
    expect(() =>
      compileGapAnalysisRelease(singleLifecycleGapRelease),
    ).not.toThrow();
    expect(singleLifecycleGapRelease.versionLabel).toBe("guided-v3");
    expect(singleLifecycleGapRelease.prompt.version).toBe("4");
    expect(singleLifecycleGapRelease.prompt.responseSchemaVersion).toBe("4");
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
