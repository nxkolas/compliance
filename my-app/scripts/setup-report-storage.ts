import "dotenv/config";
import { getSupabaseAdminClient } from "@/src/server/platform/storage/supabase-admin";
import { REPORT_STORAGE_BUCKET } from "@/src/server/modules/reports";

async function main() {
  const storage = getSupabaseAdminClient().storage;
  const { data } = await storage.getBucket(REPORT_STORAGE_BUCKET);
  if (!data) {
    const { error } = await storage.createBucket(REPORT_STORAGE_BUCKET, { public: false, allowedMimeTypes: ["application/pdf"], fileSizeLimit: 25 * 1024 * 1024 });
    if (error) throw error;
  } else if (data.public) {
    throw new Error(`${REPORT_STORAGE_BUCKET} must remain private`);
  }
  console.log(`Private report bucket ready: ${REPORT_STORAGE_BUCKET}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
