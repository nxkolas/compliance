import { describe, expect, it } from "vitest";
import { resolveReportInputRevisions } from "@/src/server/reports/input-policy";

describe("report input policy", () => {
  it("accepts a current applicability revision without a Gap revision", () => {
    expect(resolveReportInputRevisions({
      applicability: { currentRevisionId: "applicability-revision" },
      gap: null,
    })).toEqual({
      applicabilityRevisionId: "applicability-revision",
      gapRevisionId: null,
    });
  });

  it("pins a current Gap revision when one exists", () => {
    expect(resolveReportInputRevisions({
      applicability: { currentRevisionId: "applicability-revision" },
      gap: { currentRevisionId: "gap-revision" },
    })).toEqual({
      applicabilityRevisionId: "applicability-revision",
      gapRevisionId: "gap-revision",
    });
  });

  it("still requires a completed applicability check", () => {
    expect(() => resolveReportInputRevisions({
      applicability: null,
      gap: { currentRevisionId: "gap-revision" },
    })).toThrowError(expect.objectContaining({
      status: 409,
      code: "REPORT_INPUTS_INCOMPLETE",
    }));
  });
});
