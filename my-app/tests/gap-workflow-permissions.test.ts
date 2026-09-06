import { describe, expect, it } from "vitest";
import {
  canContributeToOrganizationWorkflow,
  canManageOrganizationWorkflow,
  canReviewOrganizationWorkflow,
} from "@/src/server/modules/organizations/workflow-permissions";

describe("Gap workflow permissions", () => {
  it("allows owners and contributors to work while viewers remain read-only", () => {
    for (const role of ["owner", "contributor"] as const) {
      expect(canManageOrganizationWorkflow(role)).toBe(true);
      expect(canContributeToOrganizationWorkflow(role)).toBe(true);
      expect(canReviewOrganizationWorkflow(role)).toBe(true);
    }
    expect(canManageOrganizationWorkflow("viewer")).toBe(false);
    expect(canContributeToOrganizationWorkflow("viewer")).toBe(false);
    expect(canReviewOrganizationWorkflow("viewer")).toBe(false);
  });
});
