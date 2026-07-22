import { describe, expect, it } from "vitest";
import { renderComplianceReport } from "@/src/server/reports/renderer";

describe("compliance report renderer", () => {
  it("renders a pinned provenance snapshot as a PDF", async () => {
    const pdf = await renderComplianceReport({
      reportId: "00000000-0000-4000-8000-000000000001",
      organizationId: "00000000-0000-4000-8000-000000000002",
      locale: "en",
      inputHash: "a".repeat(64),
      snapshot: {
        capturedAt: "2026-07-22T12:00:00.000Z",
        applicabilityRevisionId: null,
        gapRevisionId: null,
        actionPlanId: null,
        documentVersionIds: [],
      },
    });
    expect(pdf.byteLength).toBeGreaterThan(500);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
});
