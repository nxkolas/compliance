const DISPOSABLE_ENVIRONMENTS = new Set([
  "development",
  "local",
  "test",
  "preproduction",
  "staging",
]);

export type SafeDatabaseTarget = {
  environment: string;
  host: string;
  port: string;
  database: string;
  identity: string;
};

export type WorkflowStage = {
  id:
    | "schema-explain"
    | "pre-push-operator-sql"
    | "schema-push"
    | "post-push-operator-sql"
    | "storage-bootstrap"
    | "server-only-rls-verification"
    | "integrity-verification"
    | "private-storage-verification"
    | "final-schema-explain";
  program: "drizzle" | "tsx";
  args: readonly string[];
};

export type WorkflowStageResult = {
  output: string;
};

export type WorkflowRunner = (
  stage: WorkflowStage,
) => Promise<WorkflowStageResult>;

export const DISPOSABLE_PLAN_STAGE: WorkflowStage = {
  id: "schema-explain",
  program: "drizzle",
  args: ["push", "--explain"],
};

export const DISPOSABLE_APPLY_STAGES: readonly WorkflowStage[] = [
  {
    id: "pre-push-operator-sql",
    program: "tsx",
    args: ["scripts/apply-operator-sql.ts", "pre-push"],
  },
  {
    id: "schema-push",
    program: "drizzle",
    args: ["push"],
  },
  {
    id: "post-push-operator-sql",
    program: "tsx",
    args: ["scripts/apply-operator-sql.ts", "post-push"],
  },
  {
    id: "storage-bootstrap",
    program: "tsx",
    args: ["scripts/bootstrap-storage.ts"],
  },
  {
    id: "server-only-rls-verification",
    program: "tsx",
    args: ["scripts/verify-server-only-rls.ts"],
  },
  {
    id: "integrity-verification",
    program: "tsx",
    args: ["scripts/verify-database-integrity.ts"],
  },
  {
    id: "private-storage-verification",
    program: "tsx",
    args: ["scripts/verify-private-storage.ts"],
  },
  {
    id: "final-schema-explain",
    program: "drizzle",
    args: ["push", "--explain"],
  },
];

export function resolveDisposableSchemaTarget(
  values: {
    APP_ENV?: string;
    DATABASE_URL?: string;
    DRIZZLE_DATABASE_URL?: string;
  },
): SafeDatabaseTarget {
  const environment = values.APP_ENV?.trim().toLowerCase();
  if (!environment || !DISPOSABLE_ENVIRONMENTS.has(environment)) {
    throw new Error(
      "Disposable schema workflows require APP_ENV to be development, local, test, preproduction, or staging",
    );
  }

  const applicationUrl = values.DATABASE_URL;
  const schemaUrl = values.DRIZZLE_DATABASE_URL;
  if (!applicationUrl && !schemaUrl) {
    throw new Error("DATABASE_URL or DRIZZLE_DATABASE_URL is required");
  }

  const applicationTarget = parseDatabaseTarget(
    applicationUrl ?? schemaUrl!,
    "DATABASE_URL",
  );
  const schemaTarget = parseDatabaseTarget(
    schemaUrl ?? applicationUrl!,
    "DRIZZLE_DATABASE_URL",
  );

  if (applicationTarget.identity !== schemaTarget.identity) {
    throw new Error(
      `DATABASE_URL and DRIZZLE_DATABASE_URL must identify the same database target (${applicationTarget.identity} versus ${schemaTarget.identity})`,
    );
  }

  return { environment, ...applicationTarget };
}

export function acknowledgeDisposableSchemaTarget(
  target: SafeDatabaseTarget,
  acknowledgedTarget: string | undefined,
) {
  if (!acknowledgedTarget || acknowledgedTarget !== target.identity) {
    throw new Error(
      `Pass --target ${target.identity} to acknowledge the reviewed disposable target and plan`,
    );
  }
}

export function databaseTargetIdentity(databaseUrl: string) {
  return parseDatabaseTarget(databaseUrl, "database URL").identity;
}

export async function runDisposableSchemaPlan(
  runner: WorkflowRunner,
): Promise<WorkflowStageResult> {
  return runner(DISPOSABLE_PLAN_STAGE);
}

export async function runDisposableSchemaApply(
  target: SafeDatabaseTarget,
  acknowledgedTarget: string | undefined,
  runner: WorkflowRunner,
) {
  acknowledgeDisposableSchemaTarget(target, acknowledgedTarget);

  const completed: WorkflowStage["id"][] = [];
  let finalExplanation = "";
  for (const stage of DISPOSABLE_APPLY_STAGES) {
    const result = await runner(stage);
    completed.push(stage.id);
    if (stage.id === "final-schema-explain") {
      finalExplanation = result.output;
    }
  }

  assertZeroSchemaDrift(finalExplanation);
  return { completed };
}

export function assertZeroSchemaDrift(explanation: string) {
  const plainText = explanation.replace(/\u001b\[[0-9;]*m/gu, "");
  if (!/\bNo changes detected\b/iu.test(plainText)) {
    throw new Error(
      "Final schema explanation reported remaining drift; review the output and rerun the guarded apply workflow after fixing it",
    );
  }
}

function parseDatabaseTarget(databaseUrl: string, variableName: string) {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error(`${variableName} must be a valid PostgreSQL URL`);
  }

  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error(`${variableName} must be a PostgreSQL URL`);
  }

  const host = url.hostname.toLowerCase();
  const port = url.port || "5432";
  const database = decodeURIComponent(url.pathname.replace(/^\//u, ""));
  if (!host || !database || database.includes("/")) {
    throw new Error(`${variableName} must identify one database`);
  }

  const displayHost = host.includes(":") ? `[${host}]` : host;
  return {
    host,
    port,
    database,
    identity: `${displayHost}:${port}/${database}`,
  };
}
