import { describe, expect, it } from "vitest";
import { compileGapAnalysisRelease } from "@/src/server/gap-analysis/publishing/compile-release";
import { getRepositoryGapRelease } from "@/src/server/gap-analysis/publishing/release-registry";
import { guidedV6GapRelease } from "@/src/server/gap-analysis/releases/guided-v6/release";

describe("guided-v6 atomic Gap release", () => {
  it("pins both independent generation contracts and compiles deterministically", () => {
    const first = compileGapAnalysisRelease(guidedV6GapRelease);
    const second = compileGapAnalysisRelease(guidedV6GapRelease);

    expect(guidedV6GapRelease).toMatchObject({
      releaseCode: "nis2-gap",
      versionLabel: "guided-v6",
      prompt: { version: "7", responseSchemaVersion: "7" },
      actionPlanPrompt: { version: "1", responseSchemaVersion: "1" },
      evaluator: { kind: "nis2_gap_category_v1", version: 1 },
    });
    expect(guidedV6GapRelease.questionnaire.questions).toHaveLength(31);
    expect(guidedV6GapRelease.requirementSet.requirements).toHaveLength(10);
    expect(
      Object.fromEntries(
        guidedV6GapRelease.requirementSet.requirements.map((requirement) => [
          requirement.code,
          requirement.icon,
        ]),
      ),
    ).toEqual({
      "NIS2-GOV-01": "Building2",
      "NIS2-RISK-02": "ShieldAlert",
      "NIS2-IAM-03": "KeyRound",
      "NIS2-IR-04": "Siren",
      "NIS2-BC-05": "DatabaseBackup",
      "NIS2-SC-06": "Link",
      "NIS2-VM-07": "Bug",
      "NIS2-ASSURE-08": "ClipboardCheck",
      "NIS2-AWARE-09": "GraduationCap",
      "NIS2-PROTECT-10": "LockKeyhole",
    });
    expect(first.hashes).toEqual(second.hashes);
    expect(first.hashes.aggregate).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is the only release exposed by the reset-baseline registry", () => {
    expect(getRepositoryGapRelease("nis2-gap/guided-v6")).toBe(
      guidedV6GapRelease,
    );
    expect(() =>
      getRepositoryGapRelease("nis2-gap/guided-v5"),
    ).toThrow(/unknown repository gap release/i);
  });

  it("maps every questionnaire question to exactly one category", () => {
    const mapped = guidedV6GapRelease.requirementSet.requirements.flatMap(
      (requirement) => requirement.questionStableKeys,
    );
    expect(mapped).toHaveLength(31);
    expect(new Set(mapped).size).toBe(31);
    expect(new Set(mapped)).toEqual(
      new Set(
        guidedV6GapRelease.questionnaire.questions.map(
          (question) => question.stableKey,
        ),
      ),
    );
  });
});
