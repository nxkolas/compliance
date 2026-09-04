import "dotenv/config";
import { randomUUID } from "node:crypto";
import { getSupabaseAdminClient } from "@/src/server/platform/storage/supabase-admin";
import {
  DOCUMENT_STORAGE_BUCKET,
  MAX_DOCUMENT_BYTES,
  SUPPORTED_DOCUMENT_TYPES,
} from "@/src/server/modules/documents";
import {
  LEGAL_CORPUS_BUCKET,
  LEGAL_SOURCE_MIME_TYPES,
  MAX_LEGAL_SOURCE_BYTES,
} from "@/src/server/modules/legal-corpus";
import { REPORT_STORAGE_BUCKET } from "@/src/server/modules/reports";

const buckets = [
  {
    id: DOCUMENT_STORAGE_BUCKET,
    fileSizeLimit: MAX_DOCUMENT_BYTES,
    allowedMimeTypes: [...SUPPORTED_DOCUMENT_TYPES],
    probeMimeType: "text/plain",
    probeBytes: new TextEncoder().encode("storage bootstrap probe"),
  },
  {
    id: LEGAL_CORPUS_BUCKET,
    fileSizeLimit: MAX_LEGAL_SOURCE_BYTES,
    allowedMimeTypes: [...LEGAL_SOURCE_MIME_TYPES],
    probeMimeType: "text/plain",
    probeBytes: new TextEncoder().encode("storage bootstrap probe"),
  },
  {
    id: REPORT_STORAGE_BUCKET,
    fileSizeLimit: 25 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf"],
    probeMimeType: "application/pdf",
    probeBytes: new TextEncoder().encode("%PDF-1.4\n%%EOF\n"),
  },
] as const;

async function main() {
  const storage = getSupabaseAdminClient().storage;
  for (const bucket of buckets) {
    const { data: existing, error: readError } = await storage.getBucket(bucket.id);
    if (
      readError &&
      !readError.message.toLowerCase().includes("not found")
    ) {
      throw readError;
    }

    const options = {
      public: false,
      fileSizeLimit: bucket.fileSizeLimit,
      allowedMimeTypes: [...bucket.allowedMimeTypes],
    };
    const reconciliation = existing
      ? await storage.updateBucket(bucket.id, options)
      : await storage.createBucket(bucket.id, options);
    if (reconciliation.error) throw reconciliation.error;

    const { data: reconciled, error: verifyError } = await storage.getBucket(
      bucket.id,
    );
    if (verifyError) throw verifyError;
    if (!reconciled || reconciled.public) {
      throw new Error(`Storage bucket is not private: ${bucket.id}`);
    }

    await verifySignedOperations(bucket);
    console.info("Private storage bucket ready", { bucket: bucket.id });
  }
}

async function verifySignedOperations(bucket: (typeof buckets)[number]) {
  const path = `_bootstrap/${randomUUID()}`;
  const files = getSupabaseAdminClient().storage.from(bucket.id);

  const signedUpload = await files.createSignedUploadUrl(`${path}-upload`);
  if (signedUpload.error || !signedUpload.data?.token) {
    throw signedUpload.error ?? new Error("Signed upload URL was not created");
  }

  const upload = await files.upload(path, bucket.probeBytes, {
    contentType: bucket.probeMimeType,
    upsert: false,
  });
  if (upload.error) throw upload.error;

  try {
    const signedDownload = await files.createSignedUrl(path, 60);
    if (signedDownload.error || !signedDownload.data?.signedUrl) {
      throw (
        signedDownload.error ?? new Error("Signed download URL was not created")
      );
    }
  } finally {
    const cleanup = await files.remove([path]);
    if (cleanup.error) throw cleanup.error;
  }
}

main().catch((error) => {
  console.error("Storage bootstrap failed", {
    errorType: error instanceof Error ? error.name : "unknown",
    message: error instanceof Error ? error.message : "Unknown storage error",
  });
  process.exitCode = 1;
});
