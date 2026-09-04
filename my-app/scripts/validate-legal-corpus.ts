import "dotenv/config";
import { closeDbConnection } from "@/src/db";
import { validateLegalCorpusActivationCandidate } from "@/src/server/modules/legal-corpus";

async function main() {
  const [familyCode, generations] = process.argv.slice(2);
  if (!familyCode || !generations) {
    throw new Error("Usage: npm run db:validate:legal-corpus -- <family-code> <generation-id,...>");
  }
  const result = await validateLegalCorpusActivationCandidate({
    familyCode,
    processingGenerationIds: generations.split(",").map((value) => value.trim()).filter(Boolean),
  });
  console.log(`Validated ${result.chunkCount} chunks and ${result.bindingCount} current Gap provision bindings for ${result.familyCode}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(closeDbConnection);
