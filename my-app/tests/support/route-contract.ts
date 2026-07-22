import { request, type ApiClientResult } from "@/src/client/api-client";
import type * as z from "zod";

type RouteHandler<TContext> = (
  request: Request,
  context: TContext,
) => Promise<Response> | Response;

export async function invokeRouteContract<TContext, TOutput>(input: {
  handler: RouteHandler<TContext>;
  context: TContext;
  request?: Request;
  outputSchema: z.ZodType<TOutput>;
}): Promise<{ response: Response; parsed: ApiClientResult<TOutput> }> {
  const routeRequest =
    input.request ?? new Request("http://localhost/api/contract-test");
  const response = await input.handler(routeRequest, input.context);
  const parsed = await request<never, TOutput>(routeRequest.url, {
    outputSchema: input.outputSchema,
    fetch: async () => response.clone(),
  });

  return { response, parsed };
}
