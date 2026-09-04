import * as z from "zod";
import { ApiError } from "./errors";

/**
 * Default ceiling for JSON request bodies. Kept deliberately generous for
 * existing routes while still bounding memory use; routes that legitimately
 * move more data (relayed embedding results) pass an explicit larger cap.
 */
const DEFAULT_MAX_JSON_BODY_BYTES = 8 * 1024 * 1024;

export async function readJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  options: { maxBytes?: number } = {},
): Promise<T> {
  const body = await readRawJsonBody(
    request,
    options.maxBytes ?? DEFAULT_MAX_JSON_BODY_BYTES,
  );

  return parseInput(schema, body, "Invalid request body");
}
export async function readOptionalJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  options: { maxBytes?: number } = {},
): Promise<T> {
  let text: string;
  try {
    text = await readBodyText(
      request,
      options.maxBytes ?? DEFAULT_MAX_JSON_BODY_BYTES,
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "Invalid request body");
  }
  if (!text.trim()) return parseInput(schema, {}, "Invalid request body");
  try {
    return parseInput(schema, JSON.parse(text), "Invalid request body");
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "Invalid JSON body");
  }
}
export function parseInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
  message = "Invalid input",
): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new ApiError(400, message, result.error.issues);
  }

  return result.data;
}

async function readRawJsonBody(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  try {
    const text = await readBodyText(request, maxBytes);
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "Invalid JSON body");
  }
}

async function readBodyText(request: Request, maxBytes: number): Promise<string> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new ApiError(
        413,
        "Request body is too large",
        { maxBytes },
        "PAYLOAD_TOO_LARGE",
      );
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
