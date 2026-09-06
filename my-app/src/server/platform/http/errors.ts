export class ApiError extends Error {
  public readonly code: string;

  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
    code?: string,
    public readonly headers?: HeadersInit,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code ?? defaultErrorCode(status);
  }
}
function defaultErrorCode(status: number) {
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
    case 410:
      return "GONE";
    case 412:
      return "PRECONDITION_FAILED";
    case 413:
      return "PAYLOAD_TOO_LARGE";
    case 415:
      return "UNSUPPORTED_MEDIA_TYPE";
    case 422:
      return "UNPROCESSABLE_CONTENT";
    case 428:
      return "PRECONDITION_REQUIRED";
    case 429:
      return "RATE_LIMITED";
    case 502:
      return "UPSTREAM_ERROR";
    case 503:
      return "SERVICE_UNAVAILABLE";
    default:
      return status >= 500 ? "INTERNAL_ERROR" : "REQUEST_FAILED";
  }
}
