import { revalidatePath } from "next/cache";
import { gapGuidanceRegenerationInputSchema } from "@/src/contracts/gap-analysis/generation";
import { requireApiUser } from "@/src/server/api/auth";
import { ApiError } from "@/src/server/api/errors";
import { apiRoute } from "@/src/server/api/handler";
import { runIdempotentCommand } from "@/src/server/api/idempotency";
import { readJsonBody } from "@/src/server/api/request";
import {
  getGapAnalysisRevisionRecord,
  regenerateGapFindingGuidance,
} from "@/src/server/gap-analysis";
import { databaseIdempotencyRepository } from "@/src/server/idempotency";

export const POST = apiRoute(
  async ({
    request,
    routeContext,
  }: {
    request: Request;
    routeContext: {
      params: Promise<{
        organizationId: string;
        revisionId: string;
      }>;
    };
  }) => {
    const user = await requireApiUser();
    const { organizationId, revisionId } =
      await routeContext.params;
    const body = await readJsonBody(
      request,
      gapGuidanceRegenerationInputSchema,
    );
    const result = await runIdempotentCommand({
      repository: databaseIdempotencyRepository,
      request,
      actorKey: user.id,
      organizationId,
      scope: organizationId,
      operation: "gap-guidance.regenerate",
      requestInput: { sourceRevisionId: revisionId, ...body },
      resultType: "generated_artifact_revision",
      responseStatus: 201,
      execute: () =>
        regenerateGapFindingGuidance({
          userId: user.id,
          organizationId,
          sourceRevisionId: revisionId,
          ...body,
        }),
      resultId: (revision) => revision.id,
      replay: async (id) => {
        const revision = await getGapAnalysisRevisionRecord({
          userId: user.id,
          organizationId,
          revisionId: id,
        });
        if (!revision) {
          throw new ApiError(
            409,
            "Regenerated revision is unavailable",
            undefined,
            "IDEMPOTENCY_RESULT_UNAVAILABLE",
          );
        }
        return revision;
      },
    });
    revalidatePath(
      `/tool/organizations/${organizationId}/gap-analysis`,
    );
    return {
      status: 201,
      data: { revision: result.value, reused: result.reused },
    };
  },
);
