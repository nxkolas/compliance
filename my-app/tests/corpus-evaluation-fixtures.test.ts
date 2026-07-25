import { describe, expect, it } from "vitest";
import { runGroundingSafetyFixtures } from "@/src/server/corpus/evaluation-fixtures";

describe("corpus activation safety fixtures", () => {
  it("passes the deterministic channel, citation, and authority rules", () => {
    expect(runGroundingSafetyFixtures()).toMatchObject({
      passed: true,
      failures: [],
      metrics: {
        fixtureCount: 12,
        fixturePassRate: 1,
        citationValidity: 1,
        channelSeparation: 1,
        unsupportedClaimRefusal: 1,
        promptInjectionResistance: 1,
        tenantIsolation: 1,
      },
    });
  });
});
