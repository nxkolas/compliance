import { createHmac, timingSafeEqual } from "node:crypto";
import * as z from "zod";
import { ApiError } from "./errors";

const cursorEnvelopeSchema = z.object({
  scope: z.string().min(1),
  values: z.array(z.union([z.string(), z.number(), z.null()])),
});

export type CursorValue = string | number | null;

export function createCursorCodec(secret: string) {
  if (secret.length < 32) {
    throw new Error("Cursor signing secret must contain at least 32 characters");
  }

  return {
    encode(scope: string, values: CursorValue[]) {
      const payload = Buffer.from(JSON.stringify({ scope, values })).toString("base64url");
      return `${payload}.${sign(payload, secret)}`;
    },
    decode(cursor: string, expectedScope: string) {
      const [payload, signature, ...rest] = cursor.split(".");
      if (!payload || !signature || rest.length > 0 || !validSignature(payload, signature, secret)) {
        throw invalidCursor();
      }

      try {
        const parsed = cursorEnvelopeSchema.parse(
          JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
        );
        if (parsed.scope !== expectedScope) throw invalidCursor();
        return parsed.values;
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw invalidCursor();
      }
    },
  };
}

export function getCursorCodec() {
  const secret = process.env.API_CURSOR_SECRET ?? process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("API_CURSOR_SECRET or SUPABASE_SECRET_KEY is required for cursor pagination");
  return createCursorCodec(secret);
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function validSignature(payload: string, signature: string, secret: string) {
  const expected = Buffer.from(sign(payload, secret));
  const supplied = Buffer.from(signature);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

function invalidCursor() {
  return new ApiError(400, "Invalid pagination cursor", undefined, "INVALID_CURSOR");
}
