import { describe, expect, it } from "vitest";
import { validateAtomicGapStatement } from "@/src/server/gap-analysis/gap-style";

describe("atomic Gap statement style", () => {
  it("accepts idiomatic German uncertainty wording", () => {
    expect(
      validateAtomicGapStatement({
        statement:
          "Es besteht Unsicherheit, ob Zugänge bei einem Austritt zeitnah gesperrt werden.",
        kind: "uncertain",
        locale: "de",
      }),
    ).toContain("Unsicherheit");
  });

  it("accepts a short standalone missing fact", () => {
    expect(
      validateAtomicGapStatement({
        statement: "MFA is missing for privileged access.",
        kind: "missing",
        locale: "en",
      }),
    ).toBe("MFA is missing for privileged access.");
  });

  it.each([
    "There is no written incident response plan.",
    "Contracts with important providers lack security requirements.",
    "The organization cannot document security incidents.",
    "Employees do not receive regular security training.",
    "Important providers are not known or assessed.",
  ])("accepts natural confirmed-absence wording: %s", (statement) => {
    expect(
      validateAtomicGapStatement({
        statement,
        kind: "missing",
        locale: "en",
      }),
    ).toBe(statement);
  });

  it.each([
    ["MFA is missing. Access reviews are missing.", "missing", /one sentence/i],
    ["Privileged access should implement MFA.", "missing", /action content/i],
    [
      "No independently admitted evidence confirms that MFA is used.",
      "uncertain",
      /evidentiary preamble/i,
    ],
    [
      "MFA is missing for every privileged administrator account across all production, staging, development, recovery, support, emergency, temporary, and third-party access systems.",
      "missing",
      /20 words/i,
    ],
    ["MFA is missing. See https://example.com/evidence", "missing", /URL/i],
    ["MFA is missing for privileged access.", "uncertain", /uncertain/i],
    [
      "It is unclear whether MFA is used for privileged access.",
      "missing",
      /missing/i,
    ],
  ])(
    "rejects non-atomic or kind-inconsistent prose: %s",
    (statement, kind, expected) => {
      expect(() =>
        validateAtomicGapStatement({
          statement,
          kind: kind as "missing" | "partial" | "uncertain",
          locale: "en",
        }),
      ).toThrow(expected);
    },
  );

  it.each([
    ["MFA is not used for all privileged access.", "partial"],
    ["It is unclear whether MFA is used for privileged access.", "uncertain"],
    ["MFA is missing for privileged access.", "missing"],
    [
      "Der regelmäßige Besuch von Schulungen ist nicht nachgewiesen.",
      "uncertain",
    ],
    ["Die Umsetzung geht aus den Unterlagen nicht hervor.", "uncertain"],
    ["Die Zuständigkeit ist ungeklärt.", "uncertain"],
  ] as const)("preserves truthful %s wording", (statement, kind) => {
    expect(
      validateAtomicGapStatement({
        statement,
        kind,
        locale: "en",
      }),
    ).toBe(statement);
  });
});
