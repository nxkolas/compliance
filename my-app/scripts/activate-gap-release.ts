import "dotenv/config";
import { activateGapAnalysisRelease } from "../src/server/gap-analysis/publishing/activate-release";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Run production activation through the reviewed deployment procedure");
  }
  const reference = readArgument("--release");
  const [releaseCode, versionLabel] = reference.split("/");
  if (!releaseCode || !versionLabel) throw new Error("--release must be code/version");
  const activatedBy =
    process.env.GAP_RELEASE_ACTOR_ID ??
    "00000000-0000-0000-0000-000000000000";
  const result = await activateGapAnalysisRelease(releaseCode, versionLabel, activatedBy);
  console.log(`Activated ${result.releaseCode}/${result.versionLabel} (${result.id}).`);
}

function readArgument(name: string) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`${name} is required`);
  return value;
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
