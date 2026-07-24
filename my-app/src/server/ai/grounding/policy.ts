import { db } from "@/src/db";
import { organizationAiProviderPolicies } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { ApiError } from "../../api/errors";

const operationPolicies = {
  gap_analysis: {
    workflowKind: "gap" as const,
    familyCodes: ["nis2-eu-primary", "nis2-de-primary"],
    frameworkCode: "nis2",
    jurisdictionCodes: ["EU", "DE"],
  },
};

export async function resolveGroundingPolicy(input: {
  operation: keyof typeof operationPolicies;
  organizationId: string;
}) {
  const providerPolicy = await db.query.organizationAiProviderPolicies.findFirst({ columns: { organizationId: true, allowedProviderModes: true, externalDisclosureAllowed: true, retentionClassification: true, version: true, updatedBy: true, createdAt: true, updatedAt: true },
    where: eq(organizationAiProviderPolicies.organizationId, input.organizationId),
  });
  if (!providerPolicy) {
    throw new ApiError(409, "Organization AI provider policy is not configured", undefined, "AI_PROVIDER_POLICY_MISSING");
  }
  return { ...operationPolicies[input.operation], providerPolicy };
}
