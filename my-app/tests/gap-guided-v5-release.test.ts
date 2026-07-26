import { describe, expect, it } from "vitest";
import { compileGapAnalysisRelease } from "@/src/server/gap-analysis/publishing/compile-release";
import { guidedV4GapRelease } from "@/src/server/gap-analysis/releases/guided-v4/release";
import { guidedV5GapRelease } from "@/src/server/gap-analysis/releases/guided-v5/release";

describe("guided-v5 Gap release", () => {
  it("pins contract v6 with the complete guided questionnaire", () => {
    const compiled = compileGapAnalysisRelease(guidedV5GapRelease);

    expect(guidedV5GapRelease).toMatchObject({
      releaseCode: "nis2-gap",
      versionLabel: "guided-v5",
      prompt: {
        version: "6",
        responseSchemaVersion: "6",
      },
      evaluator: {
        kind: "nis2_gap_category_v1",
        version: 1,
      },
    });
    expect(guidedV5GapRelease.questionnaire.questions).toHaveLength(31);
    expect(
      guidedV5GapRelease.requirementSet.requirements,
    ).toHaveLength(10);
    expect(compiled.hashes.aggregate).toMatch(/^[a-f0-9]{64}$/);
  });

  it("leaves the published guided-v4 repository snapshot unchanged", () => {
    const compiled = compileGapAnalysisRelease(guidedV4GapRelease);

    expect(compiled.hashes.aggregate).toBe(
      "2cdbaa40b1f279f05defdf54f32fcc450e2c8b7006a51f651dd89f316ce2cec5",
    );
    expect(compiled.hashes.questionnaire).toBe(
      "06004521c6ccea82fb33ce48c24a3467de2d93218c958c012738758f5298c1af",
    );
    expect(compiled.hashes.requirementSet).toBe(
      "143ca09f19a79a63d6af712276f522c696b7de09e51b043d2a64045bfc9a8d66",
    );
  });

  it("uses detached content objects for the two immutable releases", () => {
    expect(guidedV5GapRelease.questionnaire.questions).not.toBe(
      guidedV4GapRelease.questionnaire.questions,
    );
    expect(
      guidedV5GapRelease.requirementSet.requirements,
    ).not.toBe(guidedV4GapRelease.requirementSet.requirements);
  });
});
