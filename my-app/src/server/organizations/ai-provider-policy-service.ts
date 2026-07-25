import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { auditEvents, organizationAiProviderPolicies } from "@/src/db/schema";
import { requireOrganizationCapability } from "@/src/server/auth/capability-service";
import { ApiError } from "@/src/server/api/errors";
import { defaultOrganizationAiProviderPolicy } from "@/src/server/ai/grounding/provider-policy";

export async function getOrganizationAiProviderPolicy(userId: string, organizationId: string) {
  await requireOrganizationCapability(userId, organizationId, "organizations:read");
  const policy = await db.query.organizationAiProviderPolicies.findFirst({ columns: { organizationId: true, allowedProviderModes: true, externalDisclosureAllowed: true, retentionClassification: true, version: true, updatedBy: true, createdAt: true, updatedAt: true },
    where: eq(organizationAiProviderPolicies.organizationId, organizationId),
  });
  if (!policy) {
    throw new ApiError(409, "Organization AI provider policy is not configured", undefined, "AI_PROVIDER_POLICY_MISSING");
  }
  return policy;
}

export async function updateOrganizationAiProviderPolicy(input: {
  userId: string;
  organizationId: string;
  openAiDisclosureApproved: boolean;
  reason: string;
  expectedVersion: number;
  requestId?: string;
}) {
  await requireOrganizationCapability(input.userId, input.organizationId, "organizations:update");
  const reason = input.reason.trim();
  if (!reason) throw new ApiError(400, "An approval-change reason is required", undefined, "AI_POLICY_REASON_REQUIRED");
  const allowedProviderModes = input.openAiDisclosureApproved
    ? ["openai", ...defaultOrganizationAiProviderPolicy.allowedProviderModes]
    : [...defaultOrganizationAiProviderPolicy.allowedProviderModes];
  const retentionClassification = input.openAiDisclosureApproved
    ? "external_openai_disclosure_approved"
    : defaultOrganizationAiProviderPolicy.retentionClassification;

  return db.transaction(async (tx) => {
    const [policy] = await tx.update(organizationAiProviderPolicies).set({
      allowedProviderModes,
      externalDisclosureAllowed: input.openAiDisclosureApproved,
      retentionClassification,
      version: input.expectedVersion + 1,
      updatedBy: input.userId,
      updatedAt: new Date(),
    }).where(and(
      eq(organizationAiProviderPolicies.organizationId, input.organizationId),
      eq(organizationAiProviderPolicies.version, input.expectedVersion),
    )).returning();
    if (!policy) throw new ApiError(412, "The AI provider policy changed", undefined, "PRECONDITION_FAILED");
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType: input.openAiDisclosureApproved
        ? "organization.ai_provider_policy.openai_approved"
        : "organization.ai_provider_policy.openai_revoked",
      entityType: "organization_ai_provider_policy",
      entityId: input.organizationId,
      metadata: {
        reason,
        externalDisclosureAllowed: policy.externalDisclosureAllowed,
        allowedProviderModes: policy.allowedProviderModes,
        retentionClassification: policy.retentionClassification,
        version: policy.version,
        requestId: input.requestId,
      },
    });
    return policy;
  });
}
