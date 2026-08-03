import { auditEvents, organizations } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { authorizeOrganizationRead, withAuthorizedOrganizationCommand } from "@/src/server/auth/organization-scope";
import { ApiError } from "../api/errors";

export async function getOrganizationAiProviderPolicy(
  userId: string,
  organizationId: string,
) {
  const { executor } = await authorizeOrganizationRead({ actorUserId: userId, organizationId, capability: "organizations:read" });
  const organization = await executor.query.organizations.findFirst({
    columns: { id: true, aiProviderMode: true },
    where: {
      RAW: (table, operators) =>
        eq(table.id, organizationId) ?? operators.sql`true`,
    },
  });
  if (!organization) throw organizationNotFound();
  return {
    organizationId: organization.id,
    providerMode: organization.aiProviderMode,
  };
}

export async function updateOrganizationAiProviderPolicy(input: {
  userId: string;
  organizationId: string;
  providerMode: "company_hosted" | "openai" | "self_hosted";
  requestId?: string;
}) {
  return withAuthorizedOrganizationCommand({ actorUserId: input.userId, organizationId: input.organizationId, capability: "organizations:update" }, async ({ executor }) => {
    const [organization] = await executor
      .update(organizations)
      .set({ aiProviderMode: input.providerMode, updatedAt: new Date() })
      .where(eq(organizations.id, input.organizationId))
      .returning({ id: organizations.id, aiProviderMode: organizations.aiProviderMode });
    if (!organization) throw organizationNotFound();
    await executor.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType: "organization.ai_provider_changed",
      entityType: "organization",
      entityId: input.organizationId,
      metadata: { providerMode: organization.aiProviderMode },
      requestId: input.requestId,
    });
    return {
      organizationId: organization.id,
      providerMode: organization.aiProviderMode,
    };
  });
}

function organizationNotFound() {
  return new ApiError(404, "Organization not found", undefined, "ORGANIZATION_NOT_FOUND");
}
