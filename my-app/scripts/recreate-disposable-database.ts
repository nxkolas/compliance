import "dotenv/config";
import {
  recreateDisposableDatabase,
} from "@/src/server/operator-commands/recreate-disposable-database";

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const databaseUrl = process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL;
  const target = option("--target");
  const environment = option("--environment");
  const confirmation = option("--confirm");
  if (!databaseUrl || !target || !environment || !confirmation) {
    throw new Error(
      "Usage: npm run db:recreate:disposable -- --target <host:port/database> --environment <development|local|test|preproduction|staging> --confirm recreate-disposable-database",
    );
  }
  const result = await recreateDisposableDatabase({
    databaseUrl,
    target,
    environment,
    configuredEnvironment: process.env.APP_ENV,
    confirmation,
  });
  console.log(`Recreated disposable public application schema on ${result.target}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
