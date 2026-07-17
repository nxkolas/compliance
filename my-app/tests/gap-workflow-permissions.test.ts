import { describe, expect, it } from "vitest";
import {
  canContributeToOrganizationWorkflow,
  canManageOrganizationWorkflow,
  canReviewOrganizationWorkflow,
} from "@/src/server/organizations/workflow-permissions";

describe("gap workflow permissions", () => {
  it("allows owners and admins to correct, resolve, and approve", () => {
    expect(canManageOrganizationWorkflow("owner")).toBe(true);
    expect(canManageOrganizationWorkflow("admin")).toBe(true);
    expect(canManageOrganizationWorkflow("member")).toBe(false);
    expect(canManageOrganizationWorkflow("auditor")).toBe(false);
  });

  it("allows members to answer and upload but keeps auditors read/review only", () => {
    expect(canContributeToOrganizationWorkflow("member")).toBe(true);
    expect(canContributeToOrganizationWorkflow("auditor")).toBe(false);
    expect(canReviewOrganizationWorkflow("auditor")).toBe(true);
    expect(canReviewOrganizationWorkflow("member")).toBe(false);
  });
});
