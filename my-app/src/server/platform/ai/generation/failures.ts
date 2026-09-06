import { ApiError } from "../../http/errors";

export type GenerationFailureClass =
  | "repairable_style"
  | "repairable_content"
  | "transient_provider"
  | "terminal_input"
  | "terminal_policy"
  | "cancelled";

export class GenerationFailure extends Error {
  constructor(
    public readonly failureClass: GenerationFailureClass,
    public readonly safeCode: string,
    options?: { cause?: unknown; retryAfterMs?: number },
  ) {
    super(safeCode, { cause: options?.cause });
    this.name = "GenerationFailure";
    this.retryAfterMs = options?.retryAfterMs;
  }

  readonly retryAfterMs?: number;
}

export function classifyGenerationFailure(error: unknown): GenerationFailure {
  if (error instanceof GenerationFailure) return error;
  if (isAbortError(error)) {
    return new GenerationFailure("cancelled", "GENERATION_CANCELLED", {
      cause: error,
    });
  }
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return new GenerationFailure(
        "terminal_policy",
        error.code,
        { cause: error },
      );
    }
    if (error.status === 408 || error.status === 429 || error.status >= 500) {
      return new GenerationFailure("transient_provider", error.code, {
        cause: error,
        retryAfterMs: retryAfterMs(error.headers),
      });
    }
    if (error.status === 422) {
      return new GenerationFailure("repairable_content", error.code, {
        cause: error,
      });
    }
    return new GenerationFailure("terminal_input", error.code, {
      cause: error,
    });
  }
  const status = numericProperty(error, "statusCode") ?? numericProperty(error, "status");
  const code = stringProperty(error, "code");
  if (
    status === 408 ||
    status === 429 ||
    (status !== undefined && status >= 500) ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED"
  ) {
    return new GenerationFailure(
      "transient_provider",
      "GENERATION_PROVIDER_TRANSIENT",
      {
        cause: error,
        retryAfterMs: retryAfterMs(recordProperty(error, "responseHeaders")),
      },
    );
  }
  return new GenerationFailure(
    "terminal_input",
    "GENERATION_TERMINAL",
    { cause: error },
  );
}

export function isTransientGenerationFailure(error: unknown) {
  return classifyGenerationFailure(error).failureClass === "transient_provider";
}

export function isCancellationFailure(error: unknown) {
  return classifyGenerationFailure(error).failureClass === "cancelled";
}

function isAbortError(error: unknown) {
  return (
    (error instanceof Error &&
      (error.name === "AbortError" ||
        error.name === "JobCancellationError")) ||
    stringProperty(error, "code") === "ABORT_ERR"
  );
}

function retryAfterMs(headers: unknown) {
  const value =
    headers instanceof Headers
      ? headers.get("retry-after")
      : headers && typeof headers === "object"
        ? Object.entries(headers).find(
            ([key]) => key.toLowerCase() === "retry-after",
          )?.[1]
        : undefined;
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(String(value));
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

function stringProperty(value: unknown, key: string) {
  return value && typeof value === "object" && key in value
    ? typeof (value as Record<string, unknown>)[key] === "string"
      ? ((value as Record<string, unknown>)[key] as string)
      : undefined
    : undefined;
}

function numericProperty(value: unknown, key: string) {
  return value && typeof value === "object" && key in value
    ? typeof (value as Record<string, unknown>)[key] === "number"
      ? ((value as Record<string, unknown>)[key] as number)
      : undefined
    : undefined;
}

function recordProperty(value: unknown, key: string) {
  return value && typeof value === "object" && key in value
    ? (value as Record<string, unknown>)[key]
    : undefined;
}
