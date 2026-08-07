import { requireApiUser } from "@/src/server/api/auth";
import { apiRoute } from "@/src/server/api/handler";
import { readJsonBody } from "@/src/server/api/request";
import { withAuthorizedOrganizationCommand } from "@/src/server/auth/organization-scope";
import { authorizeOrganizationRead } from "@/src/server/auth/organization-scope";
import { organizationModelSettingsInputSchema } from "@/src/contracts/organizations/model-settings";
import {
  readOrganizationModelSettings,
  writeOrganizationModelSettings,
} from "@/src/server/organizations/model-settings-service";
import { scheduleAfterResponseDrain } from "@/src/server/job-execution/after-response";

type Context = { params: Promise<{ organizationId: string }> };

export const GET = apiRoute(
  async ({ routeContext }: { request: Request; routeContext: Context }) => {
    const user = await requireApiUser();
    const { organizationId } = await routeContext.params;
    const scope = await authorizeOrganizationRead({
      actorUserId: user.id,
      organizationId,
      capability: "organizations:read",
    });
    const settings = await readOrganizationModelSettings(
      organizationId,
      scope.executor,
    );
    return { data: { settings } };
  },
);

/**
 * Records the models an organization runs on its own machines.
 *
 * Only the generation half takes effect immediately. Changing the embedding
 * model invalidates every stored vector, so it is staged: the response reports
 * whether it applied or started a rebuild, and the active coordinates advance
 * only when that rebuild succeeds.
 */
export const PUT = apiRoute(
  async ({ request, routeContext, requestId }: { request: Request; routeContext: Context; requestId: string }) => {
    const user = await requireApiUser();
    const { organizationId } = await routeContext.params;
    const values = await readJsonBody(
      request,
      organizationModelSettingsInputSchema,
    );

    const result = await withAuthorizedOrganizationCommand(
      { actorUserId: user.id, organizationId, capability: "organizations:update" },
      async ({ executor }) =>
        writeOrganizationModelSettings({
          organizationId,
          userId: user.id,
          generation: values.generation,
          embedding: {
            modelId: values.embedding.modelId,
            revision: values.embedding.revision ?? values.embedding.modelId,
            dimensions: values.embedding.dimensions,
            instructionProfile: values.embedding.instructionProfile,
          },
          executor,
        }),
    );

    // A staged embedding change enqueues a re-index job. This route answers
    // 200, so it does not get the automatic 202 drain and must start one.
    scheduleAfterResponseDrain({ requestId });
    return { data: { embeddingChange: result.embeddingChange } };
  },
);
