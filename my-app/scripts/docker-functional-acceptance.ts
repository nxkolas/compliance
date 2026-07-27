import "dotenv/config";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { getInternalSupabaseEnvironment } from "@/src/config/env/supabase";
import { retrieveDocumentEvidence } from "@/src/server/documents";

type StoredCookie = { name: string; value: string; options?: CookieOptions };

const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const email = `docker-acceptance-${runId}@example.test`;
const password = `Docker-Acceptance-${randomUUID()}!`;
const webUrl = process.env.ACCEPTANCE_WEB_INTERNAL_URL ?? "http://web:3000";
const mailpitUrl = process.env.ACCEPTANCE_MAILPIT_URL ?? "http://mailpit:8025";
const supabase = getInternalSupabaseEnvironment();
const databaseUrl = required("DATABASE_URL");
const publishableKey = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const secretKey = required("SUPABASE_SECRET_KEY");
const aiBaseUrl = required("SELF_HOSTED_AI_BASE_URL").replace(/\/$/, "");
const aiKey = required("SELF_HOSTED_AI_API_KEY");
const db = postgres(databaseUrl, { max: 1, prepare: false });

async function main() {
  const publicClient = createClient(supabase.url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signUpError } = await publicClient.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${required("APP_PUBLIC_URL")}/auth/callback` },
  });
  if (signUpError) throw signUpError;

  const confirmationLink = await waitForConfirmationLink(email);
  const confirmationUrl = new URL(confirmationLink.replaceAll("&amp;", "&"));
  const internalOrigin = new URL(supabase.url);
  confirmationUrl.protocol = internalOrigin.protocol;
  confirmationUrl.host = internalOrigin.host;
  const confirmation = await fetch(confirmationUrl, { redirect: "manual" });
  if (confirmation.status < 300 || confirmation.status >= 400) {
    throw new Error("Auth email confirmation did not redirect successfully");
  }

  const cookies: StoredCookie[] = [];
  const authenticatedClient = createServerClient(supabase.url, publishableKey, {
    cookies: {
      getAll: () => cookies,
      setAll: (updates) => {
        for (const update of updates) {
          const existing = cookies.findIndex(({ name }) => name === update.name);
          if (existing >= 0) cookies[existing] = update;
          else cookies.push(update);
        }
      },
    },
  });
  const { data: signIn, error: signInError } =
    await authenticatedClient.auth.signInWithPassword({ email, password });
  if (signInError || !signIn.user) {
    throw signInError ?? new Error("Auth sign-in returned no user");
  }
  const cookieHeader = cookies
    .filter(({ value }) => value)
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");

  const organizationResponse = await applicationRequest("/api/organizations", {
    method: "POST",
    cookieHeader,
    body: {
      name: `Docker acceptance ${runId}`,
      legalName: `Docker acceptance ${runId} GmbH`,
      country: "DE",
    },
    idempotencyKey: randomUUID(),
  });
  const organizationId = stringAt(
    organizationResponse,
    "data.organization.id",
  );

  const evidenceText =
    "The disposable acceptance fixture requires encrypted backups every day and a documented restore rehearsal.";
  const evidenceBytes = new TextEncoder().encode(evidenceText);
  const uploadResponse = await applicationRequest(
    `/api/organizations/${organizationId}/documents/upload-sessions`,
    {
      method: "POST",
      cookieHeader,
      body: {
        fileName: "docker-acceptance.txt",
        mimeType: "text/plain",
        size: evidenceBytes.byteLength,
      },
    },
  );
  const upload = objectAt(uploadResponse, "data.upload");
  const uploadId = stringAt(uploadResponse, "data.upload.id");
  const objectPath = stringAt(uploadResponse, "data.upload.objectPath");
  const uploadToken = stringAt(uploadResponse, "data.upload.uploadToken");
  const { error: uploadError } = await authenticatedClient.storage
    .from("organization-evidence")
    .uploadToSignedUrl(objectPath, uploadToken, evidenceBytes, {
      contentType: "text/plain",
    });
  if (uploadError) throw uploadError;

  const completion = await applicationRequest(
    `/api/organizations/${organizationId}/document-upload-sessions/${uploadId}/complete`,
    {
      method: "POST",
      cookieHeader,
      body: { title: "Docker acceptance evidence" },
      idempotencyKey: randomUUID(),
    },
  );
  const documentVersionId = stringAt(
    completion,
    "data.document.documentVersionId",
  );
  const embeddingGenerationId = stringAt(
    completion,
    "data.document.embeddingGenerationId",
  );

  const [embedding] = await db<
    Array<{ dimensions: number; norm: number; status: string }>
  >`
    select
      extensions.vector_dims(chunk_embedding.embedding)::int as dimensions,
      extensions.vector_norm(chunk_embedding.embedding)::float8 as norm,
      generation.status
    from document_chunk_embeddings chunk_embedding
    inner join document_embedding_generations generation
      on generation.id = chunk_embedding.generation_id
    where generation.id = ${embeddingGenerationId}::uuid
    limit 1
  `;
  if (
    !embedding ||
    embedding.status !== "succeeded" ||
    embedding.dimensions !== 1536 ||
    !Number.isFinite(embedding.norm) ||
    Math.abs(embedding.norm - 1) > 0.001
  ) {
    throw new Error("Persisted embedding violates the 1,536-dimensional contract");
  }

  const retrieved = await retrieveDocumentEvidence({
    userId: signIn.user.id,
    organizationId,
    selectedDocumentVersionIds: [documentVersionId],
    query: "How often must backups be taken?",
    limit: 3,
  });
  if (
    retrieved.length === 0 ||
    !retrieved.some(({ documentVersionId: id }) => id === documentVersionId)
  ) {
    throw new Error("Semantic retrieval did not return the uploaded evidence");
  }

  await verifyAiPaths();
  await verifyPrivateStorageAndRls(objectPath);
  await verifyWorkerProgress();
  const reportId = await verifyReport(organizationId, cookieHeader);

  console.info(
    JSON.stringify({
      status: "passed",
      fixtureId: runId,
      userId: signIn.user.id,
      organizationId,
      documentVersionId,
      reportId,
      embeddingGenerationId,
      embeddingDimensions: embedding.dimensions,
      retrievalCitationIds: retrieved.map(({ citationId }) => citationId),
      uploadState: upload.state,
    }),
  );
}

async function verifyReport(organizationId: string, cookieHeader: string) {
  const created = await applicationRequest(
    `/api/organizations/${organizationId}/reports`,
    {
      method: "POST",
      cookieHeader,
      body: { kind: "compliance_summary", locale: "en" },
      idempotencyKey: randomUUID(),
    },
  );
  const reportId = stringAt(created, "data.report.id");
  let state = stringAt(created, "data.report.state");
  for (let attempt = 0; attempt < 90 && state !== "ready"; attempt += 1) {
    if (["failed", "cancelled"].includes(state)) {
      throw new Error(`Acceptance report entered terminal state: ${state}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    const detail = await applicationRequest(
      `/api/organizations/${organizationId}/reports/${reportId}`,
      { method: "GET", cookieHeader },
    );
    state = stringAt(detail, "data.report.state");
  }
  if (state !== "ready") {
    throw new Error("Acceptance report did not become ready");
  }

  const download = await applicationRequest(
    `/api/organizations/${organizationId}/reports/${reportId}/download`,
    { method: "POST", cookieHeader },
  );
  const response = await fetch(stringAt(download, "data.download.url"));
  if (!response.ok) throw new Error("Signed report download failed");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (
    bytes.byteLength < 5 ||
    new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-"
  ) {
    throw new Error("Rendered report is not a non-empty PDF");
  }
  return reportId;
}

async function verifyAiPaths() {
  const chat = await aiRequest("/chat/completions", {
    model: required("SELF_HOSTED_AI_MODEL"),
    messages: [{ role: "user", content: "Reply with exactly: ready" }],
    max_tokens: 16,
    temperature: 0,
  });
  const text = stringAt(chat, "choices.0.message.content").toLowerCase();
  if (!text.includes("ready")) throw new Error("Interactive AI smoke failed");

  for (const language of ["en", "de"] as const) {
    const admittedCitation = `FIXTURE-${language.toUpperCase()}-1`;
    const structured = await aiRequest("/chat/completions", {
      model: required("SELF_HOSTED_AI_MODEL"),
      messages: [
        {
          role: "user",
          content:
            language === "de"
              ? `Antworte als JSON auf Deutsch. Nutze nur die Quellen-ID ${admittedCitation}.`
              : `Reply as JSON in English. Use only citation ID ${admittedCitation}.`,
        },
      ],
      max_tokens: 256,
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "docker_acceptance",
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
                items: { type: "string", enum: [admittedCitation] },
              },
            },
          },
        },
      },
    });
    const parsed = JSON.parse(stringAt(structured, "choices.0.message.content"));
    if (
      parsed.language !== language ||
      typeof parsed.summary !== "string" ||
      !Array.isArray(parsed.citation_ids) ||
      parsed.citation_ids.some((id: unknown) => id !== admittedCitation)
    ) {
      throw new Error(`Structured AI contract failed for ${language}`);
    }
  }

  const invalidKey = await fetch(`${aiBaseUrl}/models`, {
    headers: { authorization: "Bearer intentionally-invalid" },
  });
  if (![401, 403].includes(invalidKey.status)) {
    throw new Error("LiteLLM accepted an invalid application key");
  }
}

async function verifyPrivateStorageAndRls(documentObjectPath: string) {
  const admin = createClient(supabase.url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: signed, error: signedError } = await admin.storage
    .from("organization-evidence")
    .createSignedUrl(documentObjectPath, 60);
  if (signedError || !signed?.signedUrl) {
    throw signedError ?? new Error("Could not create signed private download");
  }
  const signedDownload = await fetch(signed.signedUrl);
  if (!signedDownload.ok || (await signedDownload.text()).length === 0) {
    throw new Error("Signed private download failed");
  }

  const disposablePath = `acceptance/${runId}/delete-me.txt`;
  const { error: createError } = await admin.storage
    .from("organization-evidence")
    .upload(disposablePath, "delete-me", { contentType: "text/plain" });
  if (createError) throw createError;
  const { error: removeError } = await admin.storage
    .from("organization-evidence")
    .remove([disposablePath]);
  if (removeError) throw removeError;
  const { data: removedObject } = await admin.storage
    .from("organization-evidence")
    .download(disposablePath);
  if (removedObject) throw new Error("Disposable Storage object was not deleted");

  const anonymous = createClient(supabase.url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data } = await anonymous.from("organizations").select("id").limit(1);
  if (data && data.length > 0) {
    throw new Error("Anonymous browser role read a server-only organization");
  }
}

async function verifyWorkerProgress() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const [job] = await db<Array<{ state: string }>>`
      select state
      from background_jobs
      where kind = 'cleanup'
      order by created_at desc
      limit 1
    `;
    if (job?.state === "succeeded" || job?.state === "queued") return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("Worker cleanup scheduling did not reach a valid state");
}

async function waitForConfirmationLink(recipient: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const search = await fetch(
      `${mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:${recipient}`)}`,
    );
    if (search.ok) {
      const body = (await search.json()) as {
        messages?: Array<{ ID?: string }>;
      };
      const id = body.messages?.[0]?.ID;
      if (id) {
        const messageResponse = await fetch(`${mailpitUrl}/api/v1/message/${id}`);
        if (messageResponse.ok) {
          const message = (await messageResponse.json()) as {
            HTML?: string;
            Text?: string;
          };
          const content = `${message.HTML ?? ""}\n${message.Text ?? ""}`;
          const links = content.match(/https?:\/\/[^\s"'<>]+/g) ?? [];
          const confirmation = links.find((link) =>
            link.includes("/auth/v1/verify?"),
          );
          if (confirmation) return confirmation;
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("Mailpit did not receive a Supabase confirmation message");
}

async function applicationRequest(
  path: string,
  input: {
    method: string;
    cookieHeader: string;
    body?: unknown;
    idempotencyKey?: string;
  },
) {
  const response = await fetch(`${webUrl}${path}`, {
    method: input.method,
    headers: {
      cookie: input.cookieHeader,
      "content-type": "application/json",
      ...(input.idempotencyKey
        ? { "idempotency-key": input.idempotencyKey }
        : {}),
    },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Application request failed: ${path} (${response.status})`);
  }
  return body;
}

async function aiRequest(path: string, body: unknown) {
  const response = await fetch(`${aiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${aiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const parsed = await response.json();
  if (!response.ok) {
    throw new Error(`AI acceptance request failed (${response.status})`);
  }
  return parsed;
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Required acceptance variable is missing: ${name}`);
  return value;
}

function objectAt(value: unknown, path: string) {
  const result = at(value, path);
  if (!result || typeof result !== "object") {
    throw new Error(`Acceptance response is missing object: ${path}`);
  }
  return result as Record<string, unknown>;
}

function stringAt(value: unknown, path: string) {
  const result = at(value, path);
  if (typeof result !== "string" || !result) {
    throw new Error(`Acceptance response is missing string: ${path}`);
  }
  return result;
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

main()
  .catch((error) => {
    console.error("Docker functional acceptance failed", {
      errorType: error instanceof Error ? error.name : "unknown",
      message: safeErrorMessage(error),
    });
    process.exitCode = 1;
  })
  .finally(() => db.end());

function safeErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return "Unknown error";
  const cause = (error as Error & { cause?: unknown }).cause;
  const message = cause instanceof Error ? cause.message : error.message;
  return message.split("\n", 1)[0]!.slice(0, 500);
}
