import { requireApiUser } from "@/src/server/api/auth";
import { ApiError } from "@/src/server/api/errors";
import { apiRoute } from "@/src/server/api/handler";

export const POST = apiRoute(
  async ({
    routeContext,
  }: {
    request: Request;
    routeContext: {
      params: Promise<{ organizationId: string; revisionId: string }>;
    };
  }) => {
    await requireApiUser();
    await routeContext.params;
    throw new ApiError(
      409,
      "Generate the action plan to finalize the Gap Analysis",
      undefined,
      "GAP_FINALIZATION_REQUIRED",
    );
  },
);
