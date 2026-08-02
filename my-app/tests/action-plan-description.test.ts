import { describe, expect, it } from "vitest";
import {
  parseActionDescription,
  serializeActionDescription,
} from "@/src/server/action-plans/action-description";

describe("Action Plan description persistence", () => {
  it.each(["de", "en"] as const)(
    "round-trips the displayed result and evidence in %s",
    (locale) => {
      const description = serializeActionDescription(
        "Require MFA for privileged accounts.",
        ["MFA policy", "Configuration export"],
        locale,
      );

      expect(parseActionDescription(description, locale)).toEqual({
        result: "Require MFA for privileged accounts.",
        suggestedEvidence: ["MFA policy", "Configuration export"],
      });
    },
  );

  it("keeps legacy descriptions without an evidence section as the result", () => {
    expect(parseActionDescription("Document the recovery test.", "en")).toEqual({
      result: "Document the recovery test.",
      suggestedEvidence: [],
    });
  });
});
