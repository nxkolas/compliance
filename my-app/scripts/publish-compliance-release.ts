import "dotenv/config";
import { getRepositoryRelease, publishComplianceRelease } from "@/src/server/compliance";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Run production publication through the reviewed deployment procedure",
    );
  }

  const reference = readArgument("--release");
  const result = await publishComplianceRelease(
    getRepositoryRelease(reference),
  );
  console.log(
    `Published ${reference} as ${result.id} (${result.aggregateHash}) without activating it.`,
  );
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
