export type UiErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "CONFLICT"
  | "FORBIDDEN"
  | "INVALID_API_RESPONSE"
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE"
  | "UNPROCESSABLE_CONTENT";

type ErrorLocalization = {
  fallback: string;
  codeMessages?: Readonly<Record<string, string>>;
};

const rateLimitCodes = new Set([
  "over_request_rate_limit",
  "over_email_send_rate_limit",
]);

export function localizeUiError(
  error: unknown,
  localization: ErrorLocalization,
) {
  const code = classifyExternalError(error);

  return (
    (code ? localization.codeMessages?.[code] : undefined) ??
    localization.fallback
  );
}

export function classifyExternalError(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const value = error as Record<string, unknown>;
  const code = typeof value.code === "string" ? value.code : null;
  const status = typeof value.status === "number" ? value.status : null;

  if (status === 429 || (code && rateLimitCodes.has(code))) {
    return "RATE_LIMITED";
  }
  if (code) {
    return code;
  }

  switch (status) {
    case 400:
      return "INVALID_REQUEST";
    case 401:
      return "AUTHENTICATION_REQUIRED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 422:
      return "UNPROCESSABLE_CONTENT";
    case 503:
      return "SERVICE_UNAVAILABLE";
    default:
      return null;
  }
}
