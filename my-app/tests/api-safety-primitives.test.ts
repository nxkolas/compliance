import { describe, expect, it } from "vitest";
import { assertVersionMatches, formatEtag, requireIfMatch } from "@/src/server/api/concurrency";
import { claimIdempotency, completeIdempotency, fingerprintRequest, requireIdempotencyKey, type IdempotencyRecord, type IdempotencyRepository } from "@/src/server/api/idempotency";
import { createCursorCodec } from "@/src/server/api/pagination";
import { enforceRateLimit, type RateLimitStore } from "@/src/server/api/rate-limit";
import { capabilitiesForOrganizationRole, hasOrganizationCapability, platformCapabilities } from "@/src/server/auth/capabilities";

describe("capability policy", () => {
  it("is deny-by-default across organization roles", () => {
    expect(hasOrganizationCapability("member", "documents:write")).toBe(true);
    expect(hasOrganizationCapability("member", "members:manage")).toBe(false);
    expect(hasOrganizationCapability("auditor", "gap:review")).toBe(true);
    expect(hasOrganizationCapability("auditor", "gap:contribute")).toBe(false);
    expect(capabilitiesForOrganizationRole("owner").has("platform-admins:manage" as never)).toBe(false);
    expect(platformCapabilities).toContain("platform-admins:manage");
  });
});

describe("cursor and concurrency protocols", () => {
  it("signs cursors and binds them to a scope", () => {
    const codec = createCursorCodec("a sufficiently long cursor secret for tests");
    const cursor = codec.encode("members:org-1:active", ["2026-07-22", "member-1"]);
    expect(codec.decode(cursor, "members:org-1:active")).toEqual(["2026-07-22", "member-1"]);
    expect(() => codec.decode(cursor, "members:org-2:active")).toThrowError(
      expect.objectContaining({ code: "INVALID_CURSOR" }),
    );
  });

  it("requires and validates optimistic-concurrency versions", () => {
    expect(requireIfMatch(new Request("http://localhost", { headers: { "if-match": 'W/"4"' } }))).toBe(4);
    expect(formatEtag(4)).toBe('"4"');
    expect(() => requireIfMatch(new Request("http://localhost"))).toThrowError(
      expect.objectContaining({ status: 428, code: "IF_MATCH_REQUIRED" }),
    );
    expect(() => assertVersionMatches(3, 4)).toThrowError(
      expect.objectContaining({ status: 412, code: "PRECONDITION_FAILED" }),
    );
  });
});

class MemoryIdempotencyRepository implements IdempotencyRepository {
  records = new Map<string, IdempotencyRecord>();
  private id(record: Pick<IdempotencyRecord, "actorKey" | "scope" | "operation" | "key">) {
    return [record.actorKey, record.scope, record.operation, record.key].join(":");
  }
  async create(record: IdempotencyRecord) {
    const key = this.id(record);
    if (this.records.has(key)) return false;
    this.records.set(key, record);
    return true;
  }
  async find(record: Pick<IdempotencyRecord, "actorKey" | "scope" | "operation" | "key">) {
    return this.records.get(this.id(record)) ?? null;
  }
  async save(record: IdempotencyRecord) {
    this.records.set(this.id(record), record);
  }
}

describe("idempotency and rate limits", () => {
  it("replays matching completed requests and rejects mismatched reuse", async () => {
    const repository = new MemoryIdempotencyRepository();
    const input = {
      actorKey: "user-1",
      scope: "organization:1",
      operation: "create-report",
      key: "key-1",
      requestFingerprint: fingerprintRequest({ b: 2, a: 1 }),
    };
    const claimed = await claimIdempotency(repository, input);
    expect(claimed.kind).toBe("started");
    await completeIdempotency(repository, claimed.record, {
      responseStatus: 202,
      resultReference: { type: "report", id: "report-1" },
    });
    await expect(claimIdempotency(repository, { ...input, requestFingerprint: fingerprintRequest({ a: 1, b: 2 }) })).resolves.toMatchObject({ kind: "replay" });
    await expect(claimIdempotency(repository, { ...input, requestFingerprint: fingerprintRequest({ a: 9 }) })).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });
  });

  it("requires a bounded printable idempotency key", () => {
    expect(requireIdempotencyKey(new Request("http://localhost", { headers: { "idempotency-key": "operation-1" } }))).toBe("operation-1");
    expect(() => requireIdempotencyKey(new Request("http://localhost"))).toThrowError(expect.objectContaining({ code: "IDEMPOTENCY_KEY_REQUIRED" }));
  });

  it("allows a failed claim to restart with the same fingerprint", async () => {
    const repository = new MemoryIdempotencyRepository();
    const input = { actorKey: "user", scope: "scope", operation: "operation", key: "key", requestFingerprint: fingerprintRequest({ value: 1 }) };
    const first = await claimIdempotency(repository, input);
    if (first.kind !== "started") throw new Error("Expected a new claim");
    repository.records.set("user:scope:operation:key", { ...first.record, state: "failed" });
    await expect(claimIdempotency(repository, input)).resolves.toMatchObject({ kind: "started", record: { state: "in_progress" } });
  });

  it("returns a stable rate-limit error with retry timing", async () => {
    let count = 0;
    const store: RateLimitStore = { increment: async () => ++count };
    const input = { store, subject: "user-1", scope: "reports:create", limit: 1, windowSeconds: 60, now: new Date("2026-07-22T10:00:30Z") };
    await expect(enforceRateLimit(input)).resolves.toMatchObject({ remaining: 0, retryAfterSeconds: 30 });
    await expect(enforceRateLimit(input)).rejects.toEqual(expect.objectContaining({ status: 429, code: "RATE_LIMITED" }));
  });
});
