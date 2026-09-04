import type { OrganizationRole } from "./types";
import { hasOrganizationCapability } from "../../platform/auth/capabilities";

export function canManageOrganizationWorkflow(role: OrganizationRole) {
  return hasOrganizationCapability(role, "plans:manage");
}

export function canContributeToOrganizationWorkflow(role: OrganizationRole) {
  return hasOrganizationCapability(role, "plans:contribute");
}

export function canReviewOrganizationWorkflow(role: OrganizationRole) {
  return hasOrganizationCapability(role, "gap:review");
}

export function organizationActionsForRole(
  role: OrganizationRole,
  archived: boolean,
) {
  return {
    edit: !archived && hasOrganizationCapability(role, "organizations:update"),
    manageMembers: !archived && hasOrganizationCapability(role, "members:manage"),
    archive: !archived && hasOrganizationCapability(role, "organizations:archive"),
    restore: archived && hasOrganizationCapability(role, "organizations:archive"),
  };
}
