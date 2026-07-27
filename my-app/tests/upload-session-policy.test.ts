import { describe, expect, it } from "vitest";
import {
  canonicalizeUploadMimeType,
  validateUploadInput,
  type UploadPolicy,
} from "@/src/server/uploads/policy";
import { assertUploadSessionQuota } from "@/src/server/uploads/quota";
import { assertReportConcurrency } from "@/src/server/reports/quota";

describe("upload-session policy", () => {
  const policy: UploadPolicy = {
    bucket: "private-evidence",
    maxBytes: 1024,
    allowedMimeTypes: new Set(["application/pdf"]),
    expiresInSeconds: 300,
  };

  it("accepts exact declared metadata", () => {
    expect(() => validateUploadInput("evidence.pdf", "application/pdf", 1024, "a".repeat(64), policy)).not.toThrow();
  });

  it("rejects unsupported types, oversized files, and malformed hashes", () => {
    expect(() => validateUploadInput("evidence.txt", "text/plain", 10, undefined, policy)).toThrowError(expect.objectContaining({ code: "UNSUPPORTED_UPLOAD_TYPE" }));
    expect(() => validateUploadInput("evidence.pdf", "application/pdf", 1025, undefined, policy)).toThrowError(expect.objectContaining({ code: "UPLOAD_SIZE_NOT_ALLOWED" }));
    expect(() => validateUploadInput("evidence.pdf", "application/pdf", 10, "not-a-hash", policy)).toThrowError(expect.objectContaining({ code: "INVALID_CONTENT_HASH" }));
  });

  it("canonicalizes standards-valid content type parameters returned by Storage", () => {
    expect(canonicalizeUploadMimeType("text/plain;charset=utf-8")).toBe(
      "text/plain",
    );
    expect(canonicalizeUploadMimeType(" Application/PDF ")).toBe(
      "application/pdf",
    );
  });

  it("enforces pending upload and report concurrency quotas", () => {
    expect(() => assertUploadSessionQuota({ openSessions: 9, pendingBytes: 0, requestedBytes: 1 })).not.toThrow();
    expect(() => assertUploadSessionQuota({ openSessions: 10, pendingBytes: 0, requestedBytes: 1 })).toThrowError(expect.objectContaining({ code: "UPLOAD_QUOTA_EXCEEDED" }));
    expect(() => assertUploadSessionQuota({ openSessions: 1, pendingBytes: 100 * 1024 * 1024, requestedBytes: 1 })).toThrowError(expect.objectContaining({ code: "UPLOAD_QUOTA_EXCEEDED" }));
    expect(() => assertReportConcurrency(2)).not.toThrow();
    expect(() => assertReportConcurrency(3)).toThrowError(expect.objectContaining({ code: "REPORT_CONCURRENCY_LIMIT" }));
  });
});
