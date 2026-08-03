import { describe, expect, it, vi } from "vitest";
import {
  DISPOSABLE_APPLY_STAGES,
  resolveDisposableSchemaTarget,
  runDisposableSchemaApply,
  runDisposableSchemaPlan,
  type WorkflowRunner,
} from "@/src/server/operator-commands/disposable-schema-workflow";

const databaseUrl =
  "postgresql://operator:super-secret@db.example.test:5432/compliance_preprod";

describe("guarded disposable schema workflow", () => {
  it("resolves only a matching, non-production safe target without credentials", () => {
    expect(
      resolveDisposableSchemaTarget({
        APP_ENV: "preproduction",
        DATABASE_URL: databaseUrl,
        DRIZZLE_DATABASE_URL: databaseUrl.replace("operator:super-secret", "schema:other-secret"),
      }),
    ).toMatchObject({
      environment: "preproduction",
      identity: "db.example.test:5432/compliance_preprod",
    });

    expect(() =>
      resolveDisposableSchemaTarget({
        APP_ENV: "production",
        DATABASE_URL: databaseUrl,
        DRIZZLE_DATABASE_URL: databaseUrl,
      }),
    ).toThrow(/disposable/i);
    expect(() =>
      resolveDisposableSchemaTarget({
        DATABASE_URL: databaseUrl,
        DRIZZLE_DATABASE_URL: databaseUrl,
      }),
    ).toThrow(/APP_ENV/u);
    expect(() =>
      resolveDisposableSchemaTarget({
        APP_ENV: "staging",
        DATABASE_URL: databaseUrl,
        DRIZZLE_DATABASE_URL: databaseUrl.replace(":5432/", ":5433/"),
      }),
    ).toThrow(/same database target/i);
  });

  it("plans by explanation only", async () => {
    const runner = vi.fn<WorkflowRunner>().mockResolvedValue({ output: "planned SQL" });
    await expect(runDisposableSchemaPlan(runner)).resolves.toEqual({
      output: "planned SQL",
    });
    expect(runner.mock.calls.map(([stage]) => stage.id)).toEqual([
      "schema-explain",
    ]);
  });

  it("requires target acknowledgement and applies every stage in order through zero drift", async () => {
    const target = resolveDisposableSchemaTarget({
      APP_ENV: "test",
      DATABASE_URL: databaseUrl,
      DRIZZLE_DATABASE_URL: databaseUrl,
    });
    const runner = vi.fn<WorkflowRunner>().mockImplementation(async (stage) => ({
      output: stage.id === "final-schema-explain" ? "[i] No changes detected" : "ok",
    }));

    await expect(
      runDisposableSchemaApply(target, undefined, runner),
    ).rejects.toThrow(/--target/);
    expect(runner).not.toHaveBeenCalled();

    await expect(
      runDisposableSchemaApply(target, target.identity, runner),
    ).resolves.toEqual({
      completed: DISPOSABLE_APPLY_STAGES.map((stage) => stage.id),
    });
    expect(runner.mock.calls.map(([stage]) => stage.id)).toEqual(
      DISPOSABLE_APPLY_STAGES.map((stage) => stage.id),
    );
  });

  it("stops on failure and rejects a nonzero final explanation", async () => {
    const target = resolveDisposableSchemaTarget({
      APP_ENV: "local",
      DATABASE_URL: databaseUrl,
      DRIZZLE_DATABASE_URL: databaseUrl,
    });
    const failedRunner = vi.fn<WorkflowRunner>().mockImplementation(async (stage) => {
      if (stage.id === "storage-bootstrap") throw new Error("storage failed");
      return { output: "ok" };
    });

    await expect(
      runDisposableSchemaApply(target, target.identity, failedRunner),
    ).rejects.toThrow("storage failed");
    expect(failedRunner.mock.calls.map(([stage]) => stage.id)).toEqual([
      "pre-push-operator-sql",
      "schema-push",
      "post-push-operator-sql",
      "storage-bootstrap",
    ]);

    const resumedRunner: WorkflowRunner = async (stage) => ({
      output: stage.id === "final-schema-explain" ? "[i] No changes detected" : "ok",
    });
    await expect(
      runDisposableSchemaApply(target, target.identity, resumedRunner),
    ).resolves.toEqual({
      completed: DISPOSABLE_APPLY_STAGES.map((stage) => stage.id),
    });

    const driftRunner: WorkflowRunner = async () => ({ output: "CREATE TABLE pending" });
    await expect(
      runDisposableSchemaApply(target, target.identity, driftRunner),
    ).rejects.toThrow(/remaining drift/i);
  });
});
