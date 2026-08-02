import "dotenv/config";
import { readFile } from "node:fs/promises";
import {
  bindLegalProvisions,
  provisionLegalCorpus,
} from "../src/server/operator-commands/provision-legal-corpus";

async function main() {
  const command = process.argv[2];
  const manifestPath = process.argv[3];
  if (!manifestPath || !["provision", "bind"].includes(command ?? "")) {
    throw new Error(
      "Usage: npm run db:provision:legal-corpus -- <provision|bind> <manifest.json>",
    );
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const result = command === "provision"
    ? await provisionLegalCorpus(manifest)
    : await bindLegalProvisions(manifest);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
