import { ApiError } from "../http/errors";

export type UploadPolicy = {
  bucket: string;
  maxBytes: number;
  allowedMimeTypes: ReadonlySet<string>;
  expiresInSeconds: number;
};

export function canonicalizeUploadMimeType(value: string) {
  return value.split(";", 1)[0]!.trim().toLowerCase();
}

export function validateUploadInput(
  fileName: string,
  mimeType: string,
  size: number,
  sha256: string | undefined,
  policy: UploadPolicy,
) {
  if (!fileName.trim() || fileName.length > 255) {
    throw new ApiError(400, "Invalid file name", undefined, "INVALID_FILE_NAME");
  }
  if (!policy.allowedMimeTypes.has(mimeType)) {
    throw new ApiError(415, "File type is not supported", undefined, "UNSUPPORTED_UPLOAD_TYPE");
  }
  if (!Number.isSafeInteger(size) || size <= 0 || size > policy.maxBytes) {
    throw new ApiError(413, "File size is not allowed", undefined, "UPLOAD_SIZE_NOT_ALLOWED");
  }
  if (sha256 && !/^[a-f0-9]{64}$/i.test(sha256)) {
    throw new ApiError(400, "Invalid SHA-256 hash", undefined, "INVALID_CONTENT_HASH");
  }
}
