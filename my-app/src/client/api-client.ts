import {
  apiErrorEnvelopeSchema,
  apiSuccessEnvelopeSchema,
  type ApiMeta,
} from "@/src/contracts/common/envelopes";
import type * as z from "zod";

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: unknown,
    public readonly requestId: string | undefined,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export type ApiRequestOptions<TInput, TOutput> = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  input?: TInput;
  outputSchema: z.ZodType<TOutput>;
  signal?: AbortSignal;
  locale?: string;
  requestId?: string;
  idempotencyKey?: string;
  ifMatch?: string | number;
  headers?: HeadersInit;
  fetch?: typeof fetch;
};

export type ApiClientResult<T> = {
  data: T;
  meta: ApiMeta;
  status: number;
};

export async function request<TInput = never, TOutput = unknown>(
  url: string,
  options: ApiRequestOptions<TInput, TOutput>,
): Promise<ApiClientResult<TOutput>> {
  const headers = new Headers(options.headers);
  headers.set("accept", "application/json");

  if (options.locale) headers.set("accept-language", options.locale);
  if (options.requestId) headers.set("x-request-id", options.requestId);
  if (options.idempotencyKey) {
    headers.set("idempotency-key", options.idempotencyKey);
  }
  if (options.ifMatch !== undefined) {
    headers.set("if-match", String(options.ifMatch));
  }
  if (options.input !== undefined) {
    headers.set("content-type", "application/json");
  }

  const response = await (options.fetch ?? fetch)(url, {
    method: options.method ?? (options.input === undefined ? "GET" : "POST"),
    credentials: "same-origin",
    headers,
    signal: options.signal,
    body: options.input === undefined ? undefined : JSON.stringify(options.input),
  });

  if (response.status === 204) {
    return {
      data: undefined as TOutput,
      meta: {
        requestId: response.headers.get("x-request-id") ?? "unavailable",
      },
      status: response.status,
    };
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const parsed = apiErrorEnvelopeSchema.safeParse(payload);
    if (parsed.success) {
      throw new ApiClientError(
        response.status,
        parsed.data.error.code,
        parsed.data.error.message,
        parsed.data.error.details,
        parsed.data.error.requestId,
        parseRetryAfter(response.headers.get("retry-after")),
      );
    }

    throw new ApiClientError(
      response.status,
      "INVALID_API_RESPONSE",
      "The server returned an invalid error response.",
      undefined,
      response.headers.get("x-request-id") ?? undefined,
      parseRetryAfter(response.headers.get("retry-after")),
    );
  }

  const parsed = apiSuccessEnvelopeSchema(options.outputSchema).safeParse(payload);
  if (!parsed.success) {
    throw new ApiClientError(
      response.status,
      "INVALID_API_RESPONSE",
      "The server returned an invalid success response.",
      parsed.error.issues,
      response.headers.get("x-request-id") ?? undefined,
    );
  }

  return { ...parsed.data, status: response.status };
}

function parseRetryAfter(value: string | null) {
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ApiClientError(
      response.status,
      "INVALID_API_RESPONSE",
      "The server returned a non-JSON response.",
      undefined,
      response.headers.get("x-request-id") ?? undefined,
    );
  }
}
