import { describe, expect, it, vi } from "vitest";
import * as z from "zod";
import { request } from "@/src/client/api-client";
import { ApiError } from "@/src/server/api/errors";
import { apiRoute } from "@/src/server/api/handler";
import { readOptionalJsonBody } from "@/src/server/api/request";
import { invokeRouteContract } from "./support/route-contract";

describe("API contract foundation", () => {
  it("wraps output and lets the typed client validate and parse it", async () => {
    const handler = apiRoute(async () => ({
      data: { value: "ok" },
      status: 201,
      meta: { version: 4 },
      headers: { etag: '"4"' },
    }));

    const { response, parsed } = await invokeRouteContract({
      handler,
      context: undefined,
      request: new Request("http://localhost/api/example", {
        headers: { "x-request-id": "req-contract-1" },
      }),
      outputSchema: z.object({ value: z.literal("ok") }),
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("x-request-id")).toBe("req-contract-1");
    expect(response.headers.get("etag")).toBe('"4"');
    expect(parsed).toEqual({
      data: { value: "ok" },
      meta: { requestId: "req-contract-1", version: 4 },
      status: 201,
    });
  });

  it("returns stable safe errors with the same request ID", async () => {
    const handler = apiRoute(async () => {
      throw new ApiError(409, "The resource changed", { version: 3 }, "RESOURCE_STALE");
    });
    const response = await handler(
      new Request("http://localhost/api/example", {
        headers: { "x-request-id": "req-contract-2" },
      }),
      undefined,
    );

    await expect(
      request("http://localhost/api/example", {
        outputSchema: z.never(),
        fetch: async () => response,
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        status: 409,
        code: "RESOURCE_STALE",
        message: "The resource changed",
        details: { version: 3 },
        requestId: "req-contract-2",
      }),
    );
  });

  it("does not expose unexpected exception details", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const handler = apiRoute(async () => {
      throw new Error("database password was rejected");
    });
    const response = await handler(
      new Request("http://localhost/api/example", {
        headers: { "x-request-id": "req-contract-3" },
      }),
      undefined,
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
        requestId: "req-contract-3",
      },
    });
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it("replaces unsafe caller-supplied request IDs", async () => {
    const handler = apiRoute(async ({ requestId }) => ({ data: { requestId } }));
    const response = await handler(
      new Request("http://localhost/api/example", {
        headers: { "x-request-id": "unsafe request id" },
      }),
      undefined,
    );
    const body = (await response.json()) as {
      meta: { requestId: string };
    };

    expect(body.meta.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("preserves safe error headers", async () => {
    const handler = apiRoute(async () => {
      throw new ApiError(429, "Too many requests", undefined, "RATE_LIMITED", {
        "retry-after": "30",
      });
    });
    const response = await handler(new Request("http://localhost/api/example"), undefined);
    expect(response.headers.get("retry-after")).toBe("30");
  });

  it("validates optional JSON bodies while accepting an empty body", async () => {
    const schema = z.object({ checkId: z.uuid().optional() });
    await expect(readOptionalJsonBody(
      new Request("http://localhost/api/example", { method: "DELETE" }),
      schema,
    )).resolves.toEqual({});
    await expect(readOptionalJsonBody(
      new Request("http://localhost/api/example", { method: "DELETE", body: "not-json" }),
      schema,
    )).rejects.toMatchObject({ status: 400 });
  });

  it("accepts static-route context whose params resolve to undefined", async () => {
    const handler = apiRoute(async () => ({ data: { ok: true } }));
    const response = await handler(
      new Request("http://localhost/api/organizations", { method: "POST" }),
      { params: Promise.resolve(undefined) } as never,
    );

    expect(response.status, await response.clone().text()).toBe(200);
  });
});
