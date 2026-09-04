import { revalidatePath } from "next/cache";
import { gapQuestionnaireDraftAnswerSchema } from "@/src/contracts/gap-analysis/generation";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { apiRoute } from "@/src/server/platform/http/handler";
import { readJsonBody } from "@/src/server/platform/http/request";
import { saveQuestionnaireDraftAnswer } from "@/src/server/modules/gap-analysis";

export const PATCH = apiRoute(
  async ({
    request,
    routeContext,
  }: {
    request: Request;
    routeContext: {
      params: Promise<{ organizationId: string; questionKey: string }>;
    };
  }) => {
    const user = await requireApiUser();
    const { organizationId, questionKey } = await routeContext.params;
    const body = await readJsonBody(
      request,
      gapQuestionnaireDraftAnswerSchema,
    );
    const result = await saveQuestionnaireDraftAnswer({
      userId: user.id,
      organizationId,
      questionId: questionKey,
      ...body,
    });
    revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
    return {
      data: result,
      meta: {},
    };
  },
);
