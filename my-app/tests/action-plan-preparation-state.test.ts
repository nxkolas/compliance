import { describe, expect, it } from "vitest";
import { resolvePlanPreparation } from "@/src/server/action-plans/preparation-state";

const ready = {
  prerequisite: { satisfied: true, status: "eligible" },
  revision: { id: "gap-1" },
  lifecycle: { canFinalize: true },
  lifecycleMode: "generated_editable",
  canManage: true,
  gapCounts: { all: 10, fulfilled: 6 },
  reviewBlockers: [] as string[],
  staleness: null,
};

describe("action plan preparation state", () => {
  it("offers generation for completed, unblocked gap results", () => {
    expect(resolvePlanPreparation(ready)).toBe("ready");
  });
  it("handles sparse counters when not a single requirement is fulfilled", () => {
    expect(resolvePlanPreparation({ ...ready, gapCounts: { all: 10, not_fulfilled: 10 } })).toBe("ready");
  });
  it("does not send completed gap results back to the applicability check", () => {
    expect(resolvePlanPreparation({ ...ready, prerequisite: { satisfied: false, status: "missing" }, reviewBlockers: ["finding"] })).toBe("review");
  });
  it("distinguishes missing and blocked applicability from unfinished Gap work", () => {
    expect(resolvePlanPreparation({ ...ready, revision: null, prerequisite: { satisfied: false, status: "missing" } })).toBe("applicability_missing");
    expect(resolvePlanPreparation({ ...ready, revision: null, prerequisite: { satisfied: false, status: "not_eligible" } })).toBe("applicability_review");
    expect(resolvePlanPreparation({ ...ready, revision: null })).toBe("gap_pending");
    expect(resolvePlanPreparation({ ...ready, revision: null, lifecycleMode: "generating" })).toBe("gap_generating");
  });
  it("distinguishes no open gaps from missing findings", () => {
    expect(resolvePlanPreparation({ ...ready, gapCounts: { all: 10, fulfilled: 10 } })).toBe("no_gaps");
    expect(resolvePlanPreparation({ ...ready, gapCounts: { all: 0, fulfilled: 0 } })).toBe("unavailable");
  });
  it("explains permissions, outdated definitions, and other generation restrictions", () => {
    expect(resolvePlanPreparation({ ...ready, canManage: false })).toBe("permission");
    expect(resolvePlanPreparation({ ...ready, staleness: { outdated: true } })).toBe("outdated");
    expect(resolvePlanPreparation({ ...ready, lifecycle: { canFinalize: false } })).toBe("unavailable");
  });
  it.each(["queued", "leased", "running"])("recognizes %s work even without generation permission", (state) => {
    expect(resolvePlanPreparation({ ...ready, canManage: false }, { id: "job", state })).toBe("generating");
  });
  it.each(["failed", "cancelled"])("offers retry for %s jobs only when prerequisites remain satisfied", (state) => {
    const job = { id: "job", state };
    expect(resolvePlanPreparation(ready, job)).toBe("failed");
    expect(resolvePlanPreparation({ ...ready, reviewBlockers: ["finding"] }, job)).toBe("review");
    expect(resolvePlanPreparation({ ...ready, canManage: false }, job)).toBe("permission");
  });
});
