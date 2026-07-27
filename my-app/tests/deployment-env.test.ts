import { describe, expect, it } from "vitest";
import { getAcceptanceEnvironment } from "@/src/config/env/test";
import { getWebEnvironment } from "@/src/config/env/web";
import { getWorkerEnvironment } from "@/src/config/env/worker";

const productionEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  APP_ENV: "production",
  APP_PUBLIC_URL: "https://app.example.com",
  NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example.com",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  SUPABASE_SECRET_KEY: "sb_secret_example",
  API_CURSOR_SECRET: "cursor-secret-with-enough-entropy",
  DATABASE_URL: "postgresql://app:secret@db:5432/postgres",
  DATABASE_POOL_MAX: "10",
  DATABASE_POOL_IDLE_TIMEOUT_SECONDS: "20",
  AI_DEFAULT_PROVIDER: "self_hosted",
  AI_EMBEDDING_DIM: "1536",
  SELF_HOSTED_AI_BASE_URL: "http://10.40.0.2:4000/v1",
  SELF_HOSTED_AI_API_KEY: "litellm-application-key",
  SELF_HOSTED_AI_MODEL: "compliance-chat",
  SELF_HOSTED_AI_SMALL_MODEL: "compliance-chat",
  SELF_HOSTED_AI_EMBEDDING_MODEL: "compliance-embedding",
  SELF_HOSTED_AI_SUPPORTS_STRUCTURED_OUTPUTS: "true",
  WORKER_ID: "production-blue-1",
  WORKER_DEBUG_ERRORS: "0",
};

describe("deployment environment contracts", () => {
  it("accepts the production web and worker topology", () => {
    expect(getWebEnvironment(productionEnvironment).APP_ENV).toBe(
      "production",
    );
    expect(getWorkerEnvironment(productionEnvironment).WORKER_ID).toBe(
      "production-blue-1",
    );
  });

  it("rejects public production database and AI endpoints", () => {
    const values = {
      ...productionEnvironment,
      DATABASE_URL:
        "postgresql://app:secret@database.example.com:5432/postgres",
      SELF_HOSTED_AI_BASE_URL: "https://ai.example.com/v1",
    };

    expect(() => getWebEnvironment(values)).toThrow(
      "Invalid environment variables: DATABASE_URL, SELF_HOSTED_AI_BASE_URL",
    );
  });

  it("rejects unsafe production web defaults without printing values", () => {
    const unsafeSecret = "do-not-print-this-secret";
    const values = {
      ...productionEnvironment,
      APP_PUBLIC_URL: "http://localhost:3000",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: unsafeSecret,
      SUPABASE_SECRET_KEY: unsafeSecret,
      API_CURSOR_SECRET: "",
    };

    expect(() => getWebEnvironment(values)).toThrow(
      "Invalid environment variables: API_CURSOR_SECRET, APP_PUBLIC_URL, SUPABASE_SECRET_KEY",
    );
    try {
      getWebEnvironment(values);
    } catch (error) {
      expect(String(error)).not.toContain(unsafeSecret);
    }
  });

  it("requires the exact isolated acceptance project", () => {
    expect(() =>
      getAcceptanceEnvironment({
        NODE_ENV: "test",
        APP_ENV: "test",
        COMPOSE_PROJECT_NAME: "existing-developer-stack",
      }),
    ).toThrow("Invalid environment variables: COMPOSE_PROJECT_NAME");
    expect(
      getAcceptanceEnvironment({
        NODE_ENV: "test",
        APP_ENV: "test",
        COMPOSE_PROJECT_NAME: "compliancetool-test",
      }).COMPOSE_PROJECT_NAME,
    ).toBe("compliancetool-test");
  });
});
