import { describe, expect, it } from "vitest";
import * as z from "zod";
import { ApiError } from "@/src/server/api/errors";
import {
  readJsonBody,
  readOptionalJsonBody,
} from "@/src/server/api/request";

const schema = z.object({ ok: z.boolean() });

async function expectApiError(
  promise: Promise<unknown>,
  status: number,
  code: string,
) {
  try {
    await promise;
    throw new Error("Expected an ApiError");
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(status);
    expect((error as ApiError).code).toBe(code);
  }
}

function post(body: string) {
  return new Request("http://localhost/api/test", {
    method: "POST",
    body,
  });
}

describe("JSON request body size limits", () => {
  it("parses a body within the default cap", async () => {
    await expect(
      readJsonBody(post(JSON.stringify({ ok: true })), schema),
    ).resolves.toEqual({ ok: true });
  });

  it("rejects a body over the default cap with 413", async () => {
    const body = JSON.stringify({
      ok: true,
      padding: "x".repeat(9 * 1024 * 1024),
    });
    await expectApiError(
      readJsonBody(post(body), schema),
      413,
      "PAYLOAD_TOO_LARGE",
    );
  });

  it("honours an explicit smaller cap", async () => {
    const body = JSON.stringify({
      ok: true,
      padding: "x".repeat(1024),
    });
    await expectApiError(
      readJsonBody(post(body), schema, { maxBytes: 512 }),
      413,
      "PAYLOAD_TOO_LARGE",
    );
  });

  it("keeps malformed JSON as a 400", async () => {
    await expectApiError(
      readJsonBody(post("{not json"), schema),
      400,
      "INVALID_REQUEST",
    );
  });

  it("applies the cap to optional bodies too", async () => {
    const body = JSON.stringify({
      ok: true,
      padding: "x".repeat(2048),
    });
    await expectApiError(
      readOptionalJsonBody(post(body), schema, { maxBytes: 256 }),
      413,
      "PAYLOAD_TOO_LARGE",
    );
  });
});
