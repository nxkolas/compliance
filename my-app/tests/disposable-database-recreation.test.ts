import { describe, expect, it } from "vitest";
import {
  authorizeDisposableDatabaseRecreation,
  databaseTargetIdentity,
} from "@/src/server/operations/recreate-disposable-database";

const url = "postgresql://operator:secret@db.example.test:5432/compliance_preprod";

describe("disposable database recreation guard", () => {
  it("requires the explicit normalized target, environment, and confirmation", () => {
    expect(databaseTargetIdentity(url)).toBe(
      "db.example.test:5432/compliance_preprod",
    );
    expect(
      authorizeDisposableDatabaseRecreation({
        databaseUrl: url,
        target: "db.example.test:5432/compliance_preprod",
        environment: "preproduction",
        configuredEnvironment: "preproduction",
        confirmation: "recreate-disposable-database",
      }),
    ).toEqual({ target: "db.example.test:5432/compliance_preprod" });
  });

  it.each([
    { target: "different.example.test:5432/compliance_preprod" },
    { environment: "production", configuredEnvironment: "production" },
    { environment: "preproduction", configuredEnvironment: "development" },
    { confirmation: "yes" },
  ])("rejects an unsafe or mismatched request: %o", (override) => {
    expect(() =>
      authorizeDisposableDatabaseRecreation({
        databaseUrl: url,
        target: "db.example.test:5432/compliance_preprod",
        environment: "preproduction",
        configuredEnvironment: "preproduction",
        confirmation: "recreate-disposable-database",
        ...override,
      }),
    ).toThrow();
  });
});
