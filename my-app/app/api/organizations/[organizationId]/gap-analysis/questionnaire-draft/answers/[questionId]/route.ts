import { revalidatePath } from "next/cache";
import { gapQuestionnaireDraftAnswerSchema } from "@/src/contracts/gap-analysis/generation";
import { requireApiUser } from "@/src/server/api/auth";
import { requireIfMatch } from "@/src/server/api/concurrency";
import { ApiError } from "@/src/server/api/errors";
import { apiRoute } from "@/src/server/api/handler";
import { readJsonBody } from "@/src/server/api/request";
import { saveQuestionnaireDraftAnswer } from "@/src/server/gap-analysis";

export const PATCH = apiRoute(
  async ({
    request,
    routeContext,
  }: {
    request: Request;
    routeContext: {
      params: Promise<{ organizationId: string; questionId: string }>;
    };
  }) => {
    const user = await requireApiUser();
    const { organizationId, questionId } = await routeContext.params;
    const body = await readJsonBody(
      request,
      gapQuestionnaireDraftAnswerSchema,
    );
    const expectedVersion = requireIfMatch(request);
    if (body.expectedVersion !== expectedVersion) {
      throw new ApiError(
        400,
        "If-Match and expectedVersion must agree",
        undefined,
        "PRECONDITION_MISMATCH",
      );
    }
    const answer = await saveQuestionnaireDraftAnswer({
      userId: user.id,
      organizationId,
      questionId,
      ...body,
      expectedVersion,
    });
    revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
    return { data: { answer }, meta: { version: answer.version } };
  },
);
