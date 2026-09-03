import { db } from "@/src/db";
import { eq } from "drizzle-orm";
import { ApiError } from "../../api/errors";
import { nis2GroundingPolicy } from "./policy-definition";

export async function resolveGroundingPolicy(input: {
  organizationId: string;
}) {
  const organization = await db.query.organizations.findFirst({
    columns: { id: true, aiProviderMode: true, archivedAt: true },
    where: {
      RAW: (table, operators) =>
        eq(table.id, input.organizationId) ?? operators.sql`true`,
    },
  });
  if (!organization) {
    throw new ApiError(404, "Organization not found", undefined, "ORGANIZATION_NOT_FOUND");
  }
  if (organization.archivedAt) {
    throw new ApiError(409, "The organization is archived", undefined, "ORGANIZATION_ARCHIVED");
  }
  return {
    ...nis2GroundingPolicy,
    providerPolicy: { selectedProviderMode: organization.aiProviderMode },
  };
}
