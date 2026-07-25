import { db } from "@/src/db";
import { organizationAiProviderPolicies } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { ApiError } from "../../api/errors";
import { groundingPolicyDefinitions } from "./policy-definition";

export { groundingPolicyDefinitions } from "./policy-definition";

export async function resolveGroundingPolicy(input: {
  operation: keyof typeof groundingPolicyDefinitions;
  organizationId: string;
}) {
  const providerPolicy = await db.query.organizationAiProviderPolicies.findFirst({ columns: { organizationId: true, allowedProviderModes: true, externalDisclosureAllowed: true, retentionClassification: true, version: true, updatedBy: true, createdAt: true, updatedAt: true },
    where: eq(organizationAiProviderPolicies.organizationId, input.organizationId),
  });
  if (!providerPolicy) {
    throw new ApiError(409, "Organization AI provider policy is not configured", undefined, "AI_PROVIDER_POLICY_MISSING");
  }
  return {
    ...groundingPolicyDefinitions[input.operation],
    providerPolicy,
  };
}
