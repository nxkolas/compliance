import { writeFile } from "node:fs/promises";
import { adaptEmbeddings } from "@/src/server/documents/domain";

const baseUrl = required("AI_QUALIFICATION_BASE_URL").replace(/\/$/, "");
const apiKey = required("AI_QUALIFICATION_API_KEY");
const chatModel = required("AI_QUALIFICATION_CHAT_MODEL");
const embeddingModel = required("AI_QUALIFICATION_EMBEDDING_MODEL");
const outputPath =
  process.env.AI_QUALIFICATION_OUTPUT ?? "ai-qualification-evidence.json";
const requestTimeoutMs = Number(
  process.env.AI_QUALIFICATION_TIMEOUT_MS ?? 120_000,
);

async function main() {
  const startedAt = new Date();
  const models = await request("/models", { method: "GET" });
  const modelIds = arrayAt(models, "data")
    .map((entry) => stringAt(entry, "id"));
  for (const expected of [chatModel, embeddingModel]) {
    if (!modelIds.includes(expected)) {
      throw new Error(`Required model alias is unavailable: ${expected}`);
    }
  }

  const checks: Array<Record<string, unknown>> = [];
  for (const language of ["en", "de"] as const) {
    const citationId = `QUALIFICATION-${language.toUpperCase()}-1`;
    const before = performance.now();
    const response = await request("/chat/completions", {
      method: "POST",
      body: {
        model: chatModel,
        messages: [
          {
            role: "user",
            content:
              language === "de"
                ? `Antworte als JSON auf Deutsch. Nutze ausschließlich die Quellen-ID ${citationId}.`
                : `Reply as JSON in English. Use only citation ID ${citationId}.`,
          },
        ],
        temperature: 0.1,
        max_tokens: 256,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "qualification_fixture",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["language", "summary", "citation_ids"],
              properties: {
                language: { type: "string", enum: [language] },
                summary: { type: "string", minLength: 1 },
                citation_ids: {
                  type: "array",
                  items: { type: "string", enum: [citationId] },
                },
              },
            },
          },
        },
      },
    });
    const parsed = JSON.parse(stringAt(response, "choices.0.message.content"));
    if (
      parsed.language !== language ||
      typeof parsed.summary !== "string" ||
      !Array.isArray(parsed.citation_ids) ||
      parsed.citation_ids.some((id: unknown) => id !== citationId)
    ) {
      throw new Error(`Live structured-output contract failed for ${language}`);
    }
    checks.push({
      check: `structured-${language}`,
      status: "passed",
      durationMs: Math.round(performance.now() - before),
      admittedCitationCount: 1,
    });
  }

  const embeddingStarted = performance.now();
  const embeddingResponse = await request("/embeddings", {
    method: "POST",
    body: {
      model: embeddingModel,
      input: ["Retrieve passages about verified backup restoration."],
    },
  });
  const native = arrayAt(embeddingResponse, "data.0.embedding").map(Number);
  const [adapted] = adaptEmbeddings([native], 1_536);
  if (
    adapted.length !== 1_536 ||
    adapted.some((value) => !Number.isFinite(value)) ||
    Math.abs(Math.hypot(...adapted) - 1) > 0.001
  ) {
    throw new Error("Live embedding violates the persisted vector contract");
  }
  checks.push({
    check: "embedding",
    status: "passed",
    durationMs: Math.round(performance.now() - embeddingStarted),
    nativeDimensions: native.length,
    persistedDimensions: adapted.length,
  });

  const evidence = {
    status: "passed",
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    chatModel,
    embeddingModel,
    vllmImage: required("AI_QUALIFICATION_VLLM_IMAGE"),
    chatModelRevision: required("AI_QUALIFICATION_CHAT_REVISION"),
    embeddingModelRevision: required(
      "AI_QUALIFICATION_EMBEDDING_REVISION",
    ),
    checks,
    manualReviewRequired: true,
  };
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, {
    mode: 0o600,
  });
}

async function request(
  path: string,
  input: { method: string; body?: unknown },
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: input.method,
      headers: {
        authorization: `Bearer ${apiKey}`,
        ...(input.body === undefined
          ? {}
          : { "content-type": "application/json" }),
      },
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`AI qualification request failed with ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing qualification variable: ${name}`);
  return value;
}

function at(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      return current[Number(segment)];
    }
    if (current && typeof current === "object") {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, value);
}

function stringAt(value: unknown, path: string) {
  const result = at(value, path);
  if (typeof result !== "string" || !result) {
    throw new Error(`Qualification response is missing string: ${path}`);
  }
  return result;
}

function arrayAt(value: unknown, path: string) {
  const result = at(value, path);
  if (!Array.isArray(result)) {
    throw new Error(`Qualification response is missing array: ${path}`);
  }
  return result;
}

main().catch((error) => {
  console.error("Live AI qualification failed", {
    errorType: error instanceof Error ? error.name : "unknown",
    message: error instanceof Error ? error.message : "Unknown error",
  });
  process.exitCode = 1;
});
