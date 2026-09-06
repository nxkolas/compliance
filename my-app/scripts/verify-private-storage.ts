import "dotenv/config";

import { getSupabaseAdminClient } from "@/src/server/platform/storage/supabase-admin";

const requiredBuckets = [
  "organization-evidence",
  "legal-corpus",
  "compliance-reports",
] as const;

async function main() {
  const storage = getSupabaseAdminClient().storage;
  for (const bucketName of requiredBuckets) {
    const { data: bucket, error } = await storage.getBucket(bucketName);
    if (error || !bucket) {
      throw new Error(`Required storage bucket is unavailable: ${bucketName}`);
    }
    if (bucket.public) {
      throw new Error(`Required storage bucket is public: ${bucketName}`);
    }
  }
  console.log(`Verified ${requiredBuckets.length} private storage buckets.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
