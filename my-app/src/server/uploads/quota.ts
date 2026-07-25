import { ApiError } from "../api/errors";

export function assertUploadSessionQuota(input: { openSessions: number; pendingBytes: number; requestedBytes: number }) {
  if (input.openSessions >= 10 || input.pendingBytes + input.requestedBytes > 100 * 1024 * 1024) {
    throw new ApiError(429, "Upload-session quota exceeded", { maxOpenSessions: 10, maxPendingBytes: 100 * 1024 * 1024 }, "UPLOAD_QUOTA_EXCEEDED");
  }
}
