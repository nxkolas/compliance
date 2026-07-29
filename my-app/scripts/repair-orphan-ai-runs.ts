import "dotenv/config";
import {
  closeOrphanAiRunRepairConnection,
  repairOrphanAiRuns,
} from "@/src/server/operator-commands/repair-orphan-ai-runs";

const apply = process.argv.includes("--apply");
const dryRun = process.argv.includes("--dry-run");
if (apply && dryRun) {
  throw new Error("Use either --dry-run or --apply, not both");
}
const limitArgument = process.argv.find((value) =>
  value.startsWith("--limit="),
);
const limit = limitArgument
  ? Number(limitArgument.slice("--limit=".length))
  : undefined;

async function main() {
  const result = await repairOrphanAiRuns({ apply, limit });
  console.info(JSON.stringify(result, null, 2));
}

main()
  .finally(() => closeOrphanAiRunRepairConnection())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
