import { db } from "@/src/db";
import { auditEvents, organizations } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { requireOrganizationCapability } from "@/src/server/auth/capability-service";
import { ApiError } from "../api/errors";

export async function getOrganizationAiProviderPolicy(
  userId: string,
  organizationId: string,
) {
  await requireOrganizationCapability(userId, organizationId, "organizations:read");
  const organization = await db.query.organizations.findFirst({
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
  await requireOrganizationCapability(
    input.userId,
    input.organizationId,
    "organizations:update",
  );
  return db.transaction(async (tx) => {
    const [organization] = await tx
      .update(organizations)
      .set({ aiProviderMode: input.providerMode, updatedAt: new Date() })
      .where(eq(organizations.id, input.organizationId))
      .returning({ id: organizations.id, aiProviderMode: organizations.aiProviderMode });
    if (!organization) throw organizationNotFound();
    await tx.insert(auditEvents).values({
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
