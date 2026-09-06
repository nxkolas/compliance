import type {
  ApiErrorEnvelope,
  ApiMeta,
  ApiSuccessEnvelope,
} from "@/src/contracts/common/envelopes";

export type ApiResponseOptions = {
  status?: number;
  meta?: Omit<ApiMeta, "requestId">;
  headers?: HeadersInit;
};

export function jsonSuccess<T>(
  data: T,
  requestId: string,
  options: ApiResponseOptions = {},
) {
  const body: ApiSuccessEnvelope<T> = {
    data,
    meta: { ...options.meta, requestId },
  };

  return Response.json(body, {
    status: options.status ?? 200,
    headers: withRequestId(options.headers, requestId),
  });
}

export function jsonError(
  input: {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  },
  requestId: string,
  headers?: HeadersInit,
) {
  const body: ApiErrorEnvelope = {
    error: {
      code: input.code,
      message: input.message,
      ...(input.details === undefined ? {} : { details: input.details }),
      requestId,
    },
  };

  return Response.json(body, {
    status: input.status,
    headers: withRequestId(headers, requestId),
  });
}

export function emptyResponse(
  requestId: string,
  status = 204,
  headers?: HeadersInit,
) {
  return new Response(null, {
    status,
    headers: withRequestId(headers, requestId),
  });
}

function withRequestId(headers: HeadersInit | undefined, requestId: string) {
  const result = new Headers(headers);
  result.set("x-request-id", requestId);
  return result;
}
