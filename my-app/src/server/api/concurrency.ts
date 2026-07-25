import { ApiError } from "./errors";

export function formatEtag(version: number) {
  if (!Number.isSafeInteger(version) || version < 0) {
    throw new Error("Resource version must be a non-negative safe integer");
  }
  return `"${version}"`;
}

export function requireIfMatch(request: Request) {
  const value = request.headers.get("if-match");
  if (!value) {
    throw new ApiError(428, "If-Match is required", undefined, "IF_MATCH_REQUIRED");
  }

  const match = /^(?:W\/)?"?(\d+)"?$/.exec(value.trim());
  const version = match ? Number(match[1]) : Number.NaN;
  if (!Number.isSafeInteger(version) || version < 0) {
    throw new ApiError(400, "If-Match is invalid", undefined, "INVALID_IF_MATCH");
  }
  return version;
}

export function assertVersionMatches(expected: number, actual: number) {
  if (expected !== actual) {
    throw new ApiError(412, "The resource changed", { currentVersion: actual }, "PRECONDITION_FAILED");
  }
}
