import "dotenv/config";
import { closeDbConnection } from "@/src/db";
import { activateLegalCorpusSnapshot } from "@/src/server/corpus";

async function main() {
  const [familyCode, generations] = process.argv.slice(2);
  const operatorIdentity = process.env.CORPUS_OPERATOR_IDENTITY?.trim();
  if (!familyCode || !generations || !operatorIdentity) {
    throw new Error("Usage: CORPUS_OPERATOR_IDENTITY=<deployment identity> npm run db:activate:legal-snapshot -- <family-code> <generation-id,...>");
  }
  const snapshot = await activateLegalCorpusSnapshot({
    operatorIdentity,
    familyCode,
    processingGenerationIds: generations.split(",").map((value) => value.trim()).filter(Boolean),
  });
  console.log(`Activated legal corpus snapshot ${snapshot.id} (${snapshot.contentHash})`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(closeDbConnection);
