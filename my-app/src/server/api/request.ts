import * as z from "zod";
import { ApiError } from "./errors";

export async function readJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  const body = await readRawJsonBody(request);

  return parseInput(schema, body, "Invalid request body");
}
export async function readOptionalJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  let text: string;
  try {
    text = await request.text();
  } catch {
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

async function readRawJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
}
