import { describe, expect, it } from "vitest";
import { hasCompleteQueryUnitCoverage } from "@/src/server/modules/grounding/validation";

describe("grounding query-unit coverage", () => {
  const queryUnits = [
    { id: "A", query: "A" },
    { id: "B", query: "B" },
  ];

  it("allows several independently grounded claims for one query unit", () => {
    expect(
      hasCompleteQueryUnitCoverage(queryUnits, [
        { queryUnitId: "A" },
        { queryUnitId: "A" },
        { queryUnitId: "B" },
      ]),
    ).toBe(true);
  });

  it("rejects missing or unknown query-unit coverage", () => {
    expect(
      hasCompleteQueryUnitCoverage(queryUnits, [{ queryUnitId: "A" }]),
    ).toBe(false);
    expect(
      hasCompleteQueryUnitCoverage(queryUnits, [
        { queryUnitId: "A" },
        { queryUnitId: "B" },
        { queryUnitId: "C" },
      ]),
    ).toBe(false);
  });
});
