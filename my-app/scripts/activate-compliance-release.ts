import "dotenv/config";
import { activateComplianceRelease, getRepositoryRelease } from "@/src/server/compliance";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Run production activation through the reviewed deployment procedure",
    );
  }

  const reference = readArgument("--release");
  const release = getRepositoryRelease(reference);
  const result = await activateComplianceRelease(
    release.checkCode,
    release.versionLabel,
    process.env.USERNAME ?? "local-cli",
  );
  console.log(`Activated ${reference} (${result.id}).`);
}

function readArgument(name: string) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`${name} is required`);
  return value;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
