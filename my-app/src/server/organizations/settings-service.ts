import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import {
  auditEvents,
  organizationAiProviderPolicies,
  organizations,
} from "@/src/db/schema";
import { requireOrganizationCapability, resolveOrganizationCapabilities } from "@/src/server/auth/capability-service";
import { ApiError } from "@/src/server/api/errors";
import { defaultOrganizationAiProviderPolicy } from "@/src/server/ai/grounding/provider-policy";
import { organizationSettingsToken } from "./settings-concurrency";

type SettingsInput = {
  organization: { name: string; legalName?: string | null; country: string };
  policy: { openAiDisclosureApproved: boolean; reason: string };
};

export async function getOrganizationSettings(
  userId: string,
  organizationId: string,
) {
  await requireOrganizationCapability(userId, organizationId, "organizations:read");
  const [organization, policy, authorization] = await Promise.all([
    db.query.organizations.findFirst({
      where: { RAW: (table, operators) => (eq(table.id, organizationId)) ?? operators.sql`true` },
      columns: {
        id: true, name: true, legalName: true, country: true, archivedAt: true,
        version: true, createdAt: true, updatedAt: true,
      },
    }),
    db.query.organizationAiProviderPolicies.findFirst({
      where: { RAW: (table, operators) => (eq(table.organizationId, organizationId)) ?? operators.sql`true` },
      columns: {
        organizationId: true, allowedProviderModes: true,
        externalDisclosureAllowed: true, retentionClassification: true,
        version: true, updatedBy: true, createdAt: true, updatedAt: true,
      },
    }),
    resolveOrganizationCapabilities(userId, organizationId),
  ]);
  if (!organization) {
    throw new ApiError(404, "Organization not found", undefined, "ORGANIZATION_NOT_FOUND");
  }
  if (!policy) {
    throw new ApiError(409, "Organization AI provider policy is not configured", undefined, "AI_PROVIDER_POLICY_MISSING");
  }
  return {
    organization,
    policy,
    allowedActions: { edit: authorization.capabilities.has("organizations:update") },
    concurrencyToken: organizationSettingsToken(organization.version, policy.version),
  };
}

export async function updateOrganizationSettings(input: {
  userId: string;
  organizationId: string;
  expected: { organizationVersion: number; policyVersion: number };
  values: SettingsInput;
  requestId?: string;
}) {
  await requireOrganizationCapability(
    input.userId,
    input.organizationId,
    "organizations:update",
  );
  const name = input.values.organization.name.trim();
  const legalName = input.values.organization.legalName?.trim() || null;
  const country = input.values.organization.country.trim().toUpperCase();
  if (!name || name.length > 255 || (legalName?.length ?? 0) > 255 || !/^[A-Z]{2}$/.test(country)) {
    throw new ApiError(400, "Organization data is invalid", undefined, "VALIDATION_FAILED");
  }

  return db.transaction(async (tx) => {
    const [organization] = await tx
      .select({
        id: organizations.id, name: organizations.name,
        legalName: organizations.legalName, country: organizations.country,
        archivedAt: organizations.archivedAt, version: organizations.version,
        createdAt: organizations.createdAt, updatedAt: organizations.updatedAt,
      })
      .from(organizations)
      .where(eq(organizations.id, input.organizationId))
      .for("update");
    const [policy] = await tx
      .select({
        organizationId: organizationAiProviderPolicies.organizationId,
        allowedProviderModes: organizationAiProviderPolicies.allowedProviderModes,
        externalDisclosureAllowed: organizationAiProviderPolicies.externalDisclosureAllowed,
        retentionClassification: organizationAiProviderPolicies.retentionClassification,
        version: organizationAiProviderPolicies.version,
        updatedBy: organizationAiProviderPolicies.updatedBy,
        createdAt: organizationAiProviderPolicies.createdAt,
        updatedAt: organizationAiProviderPolicies.updatedAt,
      })
      .from(organizationAiProviderPolicies)
      .where(eq(organizationAiProviderPolicies.organizationId, input.organizationId))
      .for("update");
    if (!organization || !policy) {
      throw new ApiError(404, "Organization settings not found", undefined, "ORGANIZATION_NOT_FOUND");
    }
    if (
      organization.version !== input.expected.organizationVersion ||
      policy.version !== input.expected.policyVersion
    ) {
      throw new ApiError(412, "Organization settings changed", undefined, "PRECONDITION_FAILED");
    }

    const organizationChanged =
      organization.name !== name ||
      organization.legalName !== legalName ||
      organization.country !== country;
    const policyChanged =
      policy.externalDisclosureAllowed !==
      input.values.policy.openAiDisclosureApproved;
    const reason = input.values.policy.reason.trim();
    if (policyChanged && !reason) {
      throw new ApiError(400, "A policy-change reason is required", undefined, "AI_POLICY_REASON_REQUIRED");
    }

    let savedOrganization = organization;
    let savedPolicy = policy;
    if (organizationChanged) {
      [savedOrganization] = await tx
        .update(organizations)
        .set({
          name,
          legalName,
          country,
          version: organization.version + 1,
          updatedAt: new Date(),
        })
        .where(and(eq(organizations.id, organization.id), eq(organizations.version, organization.version)))
        .returning();
      await tx.insert(auditEvents).values({
        organizationId: organization.id,
        actorUserId: input.userId,
        eventType: "organization.updated",
        entityType: "organization",
        entityId: organization.id,
        metadata: { version: savedOrganization.version, requestId: input.requestId },
      });
    }
    if (policyChanged) {
      const allowedProviderModes = input.values.policy.openAiDisclosureApproved
        ? ["openai", ...defaultOrganizationAiProviderPolicy.allowedProviderModes]
        : [...defaultOrganizationAiProviderPolicy.allowedProviderModes];
      [savedPolicy] = await tx
        .update(organizationAiProviderPolicies)
        .set({
          allowedProviderModes,
          externalDisclosureAllowed: input.values.policy.openAiDisclosureApproved,
          retentionClassification: input.values.policy.openAiDisclosureApproved
            ? "external_openai_disclosure_approved"
            : defaultOrganizationAiProviderPolicy.retentionClassification,
          version: policy.version + 1,
          updatedBy: input.userId,
          updatedAt: new Date(),
        })
        .where(and(
          eq(organizationAiProviderPolicies.organizationId, organization.id),
          eq(organizationAiProviderPolicies.version, policy.version),
        ))
        .returning();
      await tx.insert(auditEvents).values({
        organizationId: organization.id,
        actorUserId: input.userId,
        eventType: input.values.policy.openAiDisclosureApproved
          ? "organization.ai_provider_policy.openai_approved"
          : "organization.ai_provider_policy.openai_revoked",
        entityType: "organization_ai_provider_policy",
        entityId: organization.id,
        metadata: { reason, version: savedPolicy.version, requestId: input.requestId },
      });
    }

    return {
      organization: savedOrganization,
      policy: savedPolicy,
      allowedActions: { edit: true },
      concurrencyToken: organizationSettingsToken(
        savedOrganization.version,
        savedPolicy.version,
      ),
    };
  });
}
