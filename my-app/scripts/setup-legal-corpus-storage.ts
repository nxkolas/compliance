import "dotenv/config";
import { getSupabaseAdminClient } from "@/src/server/platform/storage/supabase-admin";
import {
  LEGAL_CORPUS_BUCKET,
  LEGAL_SOURCE_MIME_TYPES,
  MAX_LEGAL_SOURCE_BYTES,
} from "@/src/server/modules/legal-corpus";

async function main() {
  const storage = getSupabaseAdminClient().storage;
  const { data: bucket, error: readError } = await storage.getBucket(LEGAL_CORPUS_BUCKET);
  if (readError && !readError.message.toLowerCase().includes("not found")) throw readError;
  const options = {
    public: false,
    fileSizeLimit: MAX_LEGAL_SOURCE_BYTES,
    allowedMimeTypes: [...LEGAL_SOURCE_MIME_TYPES],
  };
  const result = bucket
    ? await storage.updateBucket(LEGAL_CORPUS_BUCKET, options)
    : await storage.createBucket(LEGAL_CORPUS_BUCKET, options);
  if (result.error) throw result.error;
  console.log(`Configured private storage bucket ${LEGAL_CORPUS_BUCKET}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
