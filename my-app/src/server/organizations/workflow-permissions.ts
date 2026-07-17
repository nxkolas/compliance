import type { OrganizationRole } from "./types";

export function canManageOrganizationWorkflow(role: OrganizationRole) {
  return role === "owner" || role === "admin";
}

export function canContributeToOrganizationWorkflow(role: OrganizationRole) {
  return canManageOrganizationWorkflow(role) || role === "member";
}

export function canReviewOrganizationWorkflow(role: OrganizationRole) {
  return role === "owner" || role === "admin" || role === "auditor";
}
