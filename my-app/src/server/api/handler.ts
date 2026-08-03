import { ApiError } from "./errors";
import { emptyResponse, jsonError, jsonSuccess } from "./response";
import { entityIdSchema } from "@/src/contracts/common/ids";
import { resolveRequestId } from "./request-id";
import { scheduleAfterResponseDrain } from "@/src/server/job-execution/after-response";

export type ApiRouteContext<TContext = unknown> = {
  request: Request;
  routeContext: TContext;
  requestId: string;
};

export type ApiRouteResult<T> = {
  data?: T;
  status?: number;
  meta?: {
    nextCursor?: string;
    version?: number;
  };
  headers?: HeadersInit;
};

export type ApiRouteHandler<TContext, TOutput> = (
  context: ApiRouteContext<TContext>,
) =>
  | Promise<ApiRouteResult<TOutput> | Response>
  | ApiRouteResult<TOutput>
  | Response;

export function apiRoute<TContext = unknown, TOutput = unknown>(
  handler: ApiRouteHandler<TContext, TOutput>,
) {
  return async (request: Request, routeContext: TContext) => {
    const requestId = resolveRequestId(request);
    const startedAt = Date.now();
    let status = 500;

    try {
      await validateRouteParams(routeContext);
      const result = await handler({ request, routeContext, requestId });

      if (result instanceof Response) {
        status = result.status;
        if (status === 202) {
          scheduleAfterResponseDrain({
            requestId,
          });
        }
        return result;
      }

      if (result.status === 204) {
        status = 204;
        return emptyResponse(requestId, 204, result.headers);
      }

      status = result.status ?? 200;
      if (status === 202) {
        scheduleAfterResponseDrain({
          requestId,
        });
      }
      return jsonSuccess(result.data, requestId, {
        status: result.status,
        meta: result.meta,
        headers: result.headers,
      });
    } catch (error) {
      status = error instanceof ApiError ? error.status : 500;
      return handleRouteError(error, requestId);
    } finally {
      if (process.env.NODE_ENV !== "test") {
        console.info("API request completed", {
          requestId,
          method: request.method,
          path: new URL(request.url).pathname,
          status,
          durationMs: Date.now() - startedAt,
        });
      }
    }
  };
}

async function validateRouteParams(routeContext: unknown) {
  if (!routeContext || typeof routeContext !== "object" || !("params" in routeContext)) return;
  const params = await (routeContext as { params: Promise<Record<string, unknown>> }).params;
  if (!params || typeof params !== "object") return;
  for (const [name, value] of Object.entries(params)) {
    if (name.endsWith("Id") && !entityIdSchema.safeParse(value).success) {
      throw new ApiError(400, "Invalid route parameter", { field: name }, "INVALID_ROUTE_PARAMETER");
    }
  }
}

function handleRouteError(error: unknown, requestId: string) {
  if (error instanceof ApiError) {
    return jsonError(
      {
        status: error.status,
        code: error.code,
        message: error.message,
        details: error.details,
      },
      requestId,
      error.headers,
    );
  }

  console.error("Unhandled API route error", {
    requestId,
    errorType: error instanceof Error ? error.name : "unknown",
    code: "INTERNAL_ERROR",
  });
  return jsonError(
    {
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    },
    requestId,
  );
}
