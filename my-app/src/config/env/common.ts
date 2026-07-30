import * as z from "zod";

export const appEnvironmentSchema = z.enum([
  "local",
  "test",
  "staging",
  "production",
]);

export const nodeEnvironmentSchema = z.enum([
  "development",
  "test",
  "production",
]);

export const optionalString = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0
      ? undefined
      : value,
  z.string().trim().optional(),
);

export const optionalUrl = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0
      ? undefined
      : value,
  z.url().optional(),
);

const integerFromEnvironment = (minimum: number, maximum: number) =>
  z.coerce.number().int().min(minimum).max(maximum);

export const booleanFromEnvironment = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .transform((value) => value === true || value === "true" || value === "1");

export const commonApplicationEnvironmentSchema = z
  .object({
    NODE_ENV: nodeEnvironmentSchema.default("development"),
    APP_ENV: appEnvironmentSchema.default("local"),
    DEPLOYMENT_TOPOLOGY: z
      .enum(["private_self_hosted", "managed_cloud"])
      .optional(),
    DATABASE_URL: z.string().trim().min(1),
    DATABASE_POOL_MAX: integerFromEnvironment(1, 100).default(10),
    DATABASE_POOL_IDLE_TIMEOUT_SECONDS: integerFromEnvironment(1, 3600).default(
      20,
    ),
    AI_DEFAULT_PROVIDER: z
      .enum(["company_hosted", "openai", "self_hosted"])
      .default("openai"),
    AI_EMBEDDING_DIM: integerFromEnvironment(1536, 1536).default(1536),
    AI_PROVIDER_TIMEOUT_MS: integerFromEnvironment(5000, 300000).default(
      120000,
    ),
    AI_GROUNDED_MAX_OUTPUT_TOKENS: z.coerce
      .number()
      .int()
      .min(512)
      .max(12000)
      .default(9000),
    DOCLING_SERVICE_URL: optionalUrl,
    SELF_HOSTED_AI_BASE_URL: optionalUrl,
    SELF_HOSTED_AI_API_KEY: optionalString,
    SELF_HOSTED_AI_MODEL: optionalString,
    SELF_HOSTED_AI_SMALL_MODEL: optionalString,
    SELF_HOSTED_AI_EMBEDDING_MODEL: optionalString,
    SELF_HOSTED_AI_EMBEDDING_REVISION: optionalString,
    SELF_HOSTED_AI_MAX_CONTEXT_TOKENS: integerFromEnvironment(
      1024,
      1_000_000,
    ).default(16000),
    SELF_HOSTED_AI_SUPPORTS_STRUCTURED_OUTPUTS:
      booleanFromEnvironment.default(false),
    SELF_HOSTED_AI_SUPPORTS_TOOL_CALLS: booleanFromEnvironment.default(false),
    SELF_HOSTED_AI_SUPPORTS_STREAMING: booleanFromEnvironment.default(true),
    SELF_HOSTED_AI_CITATION_RELIABILITY: z
      .enum(["low", "medium", "high"])
      .default("medium"),
    SELF_HOSTED_AI_RECOMMENDED_TEMPERATURE: z.coerce
      .number()
      .min(0)
      .max(2)
      .default(0.1),
    OPENAI_API_KEY: optionalString,
    OPENAI_MODEL: optionalString,
    OPENAI_SMALL_MODEL: optionalString,
    OPENAI_EMBEDDING_MODEL: optionalString,
    COMPANY_AI_BASE_URL: optionalUrl,
    COMPANY_AI_API_KEY: optionalString,
    COMPANY_AI_MODEL: optionalString,
    COMPANY_AI_SMALL_MODEL: optionalString,
    COMPANY_AI_EMBEDDING_MODEL: optionalString,
  })
  .superRefine((environment, context) => {
    const requiredByProvider: Record<
      typeof environment.AI_DEFAULT_PROVIDER,
      Array<keyof typeof environment>
    > = {
      self_hosted: [
        "SELF_HOSTED_AI_BASE_URL",
        "SELF_HOSTED_AI_API_KEY",
        "SELF_HOSTED_AI_MODEL",
        "SELF_HOSTED_AI_EMBEDDING_MODEL",
      ],
      openai: ["OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_EMBEDDING_MODEL"],
      company_hosted: [
        "COMPANY_AI_BASE_URL",
        "COMPANY_AI_API_KEY",
        "COMPANY_AI_MODEL",
        "COMPANY_AI_EMBEDDING_MODEL",
      ],
    };

    for (const name of requiredByProvider[environment.AI_DEFAULT_PROVIDER]) {
      if (!environment[name]) {
        context.addIssue({
          code: "custom",
          path: [name],
          message: `is required when AI_DEFAULT_PROVIDER=${environment.AI_DEFAULT_PROVIDER}`,
        });
      }
    }

    if (environment.APP_ENV !== "production") {
      return;
    }

    if (!environment.DEPLOYMENT_TOPOLOGY) {
      context.addIssue({
        code: "custom",
        path: ["DEPLOYMENT_TOPOLOGY"],
        message: "is required in production",
      });
    }

    const databaseUrl = parseUrl(environment.DATABASE_URL);
    if (environment.DEPLOYMENT_TOPOLOGY === "private_self_hosted") {
      if (
        !databaseUrl ||
        !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
        !isPrivateServiceHost(databaseUrl.hostname)
      ) {
        context.addIssue({
          code: "custom",
          path: ["DATABASE_URL"],
          message: "must target an approved private PostgreSQL host in production",
        });
      }
      if (
        environment.AI_DEFAULT_PROVIDER === "self_hosted" &&
        environment.SELF_HOSTED_AI_BASE_URL
      ) {
        const aiUrl = parseUrl(environment.SELF_HOSTED_AI_BASE_URL);
        if (!aiUrl || !isPrivateServiceHost(aiUrl.hostname)) {
          context.addIssue({
            code: "custom",
            path: ["SELF_HOSTED_AI_BASE_URL"],
            message: "must target the private application or WireGuard network",
          });
        }
      }
    }

    if (environment.DEPLOYMENT_TOPOLOGY === "managed_cloud") {
      if (!isEncryptedManagedPostgres(databaseUrl)) {
        context.addIssue({
          code: "custom",
          path: ["DATABASE_URL"],
          message: "must use authenticated TLS PostgreSQL in managed cloud",
        });
      }
      for (const [name, value] of [
        ["SELF_HOSTED_AI_BASE_URL", environment.SELF_HOSTED_AI_BASE_URL],
        ["COMPANY_AI_BASE_URL", environment.COMPANY_AI_BASE_URL],
      ] as const) {
        if (value && !isPublicHttpsUrl(value)) {
          context.addIssue({
            code: "custom",
            path: [name],
            message: "must use a non-local HTTPS endpoint in managed cloud",
          });
        }
      }
    }

    if (environment.DATABASE_POOL_MAX > 20) {
      context.addIssue({
        code: "custom",
        path: ["DATABASE_POOL_MAX"],
        message: "must not exceed 20 in production without a reviewed exception",
      });
    }
  });

export function parseEnvironment<T extends z.ZodType>(
  schema: T,
  values: NodeJS.ProcessEnv = process.env,
): z.output<T> {
  const result = schema.safeParse(values);
  if (result.success) {
    return result.data;
  }

  const variableNames = [
    ...new Set(
      result.error.issues.map((issue) =>
        issue.path.length > 0 ? String(issue.path[0]) : "environment",
      ),
    ),
  ].sort();

  throw new Error(
    `Invalid environment variables: ${variableNames.join(", ")}`,
  );
}

export function isPrivateServiceHost(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "0.0.0.0"
  ) {
    return false;
  }

  if (!normalized.includes(".")) {
    return true;
  }

  if (
    normalized.endsWith(".internal") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".private")
  ) {
    return true;
  }

  const octets = normalized.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) {
    return false;
  }

  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

function parseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function isEncryptedManagedPostgres(url: URL | undefined) {
  if (
    !url ||
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.username ||
    !url.password ||
    isLocalServiceHost(url.hostname)
  ) {
    return false;
  }
  return ["require", "verify-ca", "verify-full"].includes(
    url.searchParams.get("sslmode") ?? "",
  );
}

function isPublicHttpsUrl(value: string) {
  const url = parseUrl(value);
  return Boolean(
    url && url.protocol === "https:" && !isLocalServiceHost(url.hostname),
  );
}

function isLocalServiceHost(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return ["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(normalized);
}
