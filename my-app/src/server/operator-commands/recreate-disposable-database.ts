import postgres from "postgres";

const CONFIRMATION = "recreate-disposable-database";
const DISPOSABLE_ENVIRONMENTS = new Set([
  "development",
  "local",
  "test",
  "preproduction",
  "staging",
]);

export function databaseTargetIdentity(databaseUrl: string) {
  const url = new URL(databaseUrl);
  const database = decodeURIComponent(url.pathname.replace(/^\//u, ""));
  if (!url.hostname || !database) {
    throw new Error("The configured database URL has no host or database name");
  }
  return `${url.hostname}:${url.port || "5432"}/${database}`;
}

export function authorizeDisposableDatabaseRecreation(input: {
  databaseUrl: string;
  target: string;
  environment: string;
  configuredEnvironment: string | undefined;
  confirmation: string;
}) {
  const environment = input.environment.trim().toLowerCase();
  const configuredEnvironment = input.configuredEnvironment?.trim().toLowerCase();
  if (!DISPOSABLE_ENVIRONMENTS.has(environment)) {
    throw new Error(`Refusing database recreation for environment ${input.environment}`);
  }
  if (!configuredEnvironment || configuredEnvironment !== environment) {
    throw new Error("The explicit environment does not match APP_ENV");
  }
  if (input.confirmation !== CONFIRMATION) {
    throw new Error(`Pass --confirm ${CONFIRMATION}`);
  }
  const actualTarget = databaseTargetIdentity(input.databaseUrl);
  if (input.target !== actualTarget) {
    throw new Error(
      `The explicit target does not match the configured database (${actualTarget})`,
    );
  }
  return { target: actualTarget };
}

export async function recreateDisposableDatabase(input: {
  databaseUrl: string;
  target: string;
  environment: string;
  configuredEnvironment: string | undefined;
  confirmation: string;
}) {
  const authorized = authorizeDisposableDatabaseRecreation(input);
  const client = postgres(input.databaseUrl, { max: 1, prepare: false });
  try {
    await client.begin(async (tx) => {
      await tx.unsafe("drop schema public cascade");
      await tx.unsafe("create schema public authorization postgres");
      await tx.unsafe("grant usage on schema public to anon, authenticated, service_role");
      await tx.unsafe("grant all on schema public to postgres");
    });
    return authorized;
  } finally {
    await client.end();
  }
}
