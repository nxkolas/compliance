import { describe, expect, it } from "vitest";
import {
  currentApplicabilityDefinition,
  currentApplicabilityDefinitionHash,
  currentGapDefinitionHash,
  getCurrentApplicabilityDefinition,
  isSupportedJurisdiction,
} from "@/src/server/definitions";
import { directRuntimeReleaseReader } from "@/src/server/compliance/runtime-release/direct-reader";

describe("code-owned executable definitions", () => {
  it("uses a stable build hash for the deployed applicability definition", async () => {
    const first = getCurrentApplicabilityDefinition("de");
    const second = getCurrentApplicabilityDefinition("en");

    expect(first.aggregateHash).toBe(currentApplicabilityDefinitionHash);
    expect(second.aggregateHash).toBe(currentApplicabilityDefinitionHash);
    expect(first.questions.map((question) => question.stableKey)).toEqual(
      second.questions.map((question) => question.stableKey),
    );
    await expect(
      directRuntimeReleaseReader.getActive({
        checkCode: currentApplicabilityDefinition.checkCode,
        locale: "de",
      }),
    ).resolves.toMatchObject({ isActive: true });
  });

  it("supports Germany and explicitly rejects every other jurisdiction", () => {
    expect(isSupportedJurisdiction("DE")).toBe(true);
    expect(isSupportedJurisdiction("de")).toBe(true);
    expect(isSupportedJurisdiction("FR")).toBe(false);
    expect(isSupportedJurisdiction("AT")).toBe(false);
  });

  it("does not treat retired definition hashes as executable", async () => {
    await expect(
      directRuntimeReleaseReader.getPublished({
        checkReleaseId: "retired-definition",
        locale: "de",
      }),
    ).resolves.toBeNull();
    expect(currentGapDefinitionHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
