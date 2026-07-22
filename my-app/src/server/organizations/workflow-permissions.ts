import type { OrganizationRole } from "./types";
import { hasOrganizationCapability } from "../auth/capabilities";

export function canManageOrganizationWorkflow(role: OrganizationRole) {
  return hasOrganizationCapability(role, "plans:manage");
}

export function canContributeToOrganizationWorkflow(role: OrganizationRole) {
  return hasOrganizationCapability(role, "plans:contribute");
}

export function canReviewOrganizationWorkflow(role: OrganizationRole) {
  return hasOrganizationCapability(role, "gap:review");
}
