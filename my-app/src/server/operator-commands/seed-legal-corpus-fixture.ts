import { createHash } from "node:crypto";
import { closeDbConnection } from "@/src/db";
import {
  LEGAL_CORPUS_BUCKET,
  MAX_LEGAL_SOURCE_BYTES,
  NIS2_CORPUS_BOOTSTRAP_FIXTURE,
  NIS2_CORPUS_BOOTSTRAP_NOTICE,
} from "@/src/server/corpus";
import { provisionLegalCorpus } from "@/src/server/operator-commands/provision-legal-corpus";
import { getSupabaseAdminClient } from "@/src/server/supabase-admin";

async function main() {
  const operatorIdentity = process.env.CORPUS_OPERATOR_IDENTITY?.trim();
  if (!operatorIdentity) {
    throw new Error("CORPUS_OPERATOR_IDENTITY is required");
  }

  console.log(NIS2_CORPUS_BOOTSTRAP_NOTICE);
  for (const fixture of NIS2_CORPUS_BOOTSTRAP_FIXTURE) {
    const bytes = await downloadOfficialPdf(fixture.import.exactUrl);
    const hash = createHash("sha256").update(bytes).digest("hex");
    const storageKey = [
      fixture.family.code,
      fixture.source.stableCode,
      fixture.import.versionLabel,
      `${hash}.pdf`,
    ].join("/");
    const { error } = await getSupabaseAdminClient().storage
      .from(LEGAL_CORPUS_BUCKET)
      .upload(storageKey, bytes, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (error) throw error;

    const result = await provisionLegalCorpus({
      operatorIdentity,
      family: {
        code: fixture.family.code,
        title: fixture.family.title,
      },
      sources: [{
        code: fixture.source.stableCode,
        title: fixture.source.title,
        jurisdictionCode: fixture.family.jurisdictionCode,
        authorityTier: "official",
        officialSourceUrl: fixture.import.exactUrl,
        version: {
          versionLabel: fixture.import.versionLabel,
          contentHash: hash,
          effectiveFrom: `${fixture.import.effectiveFrom}T00:00:00.000Z`,
          sourceRetrievedAt: new Date().toISOString(),
        },
        rendition: {
          locale: fixture.import.language,
          translationStatus: "official",
          storageBucket: LEGAL_CORPUS_BUCKET,
          storageKey,
          contentHash: hash,
        },
        processing: {
          parser: "pdf-parse",
        },
      }],
    });
    const generation = result.generations[0]!;
    console.log(
      `${fixture.family.code}/${fixture.source.stableCode}: generation ${generation.processingGenerationId}, job ${generation.jobId ?? "already processed"}.`,
    );
  }
  console.log("No corpus snapshot was activated by this script.");
}

async function downloadOfficialPdf(url: string) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Official legal source returned HTTP ${response.status}: ${url}`);
  }
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_LEGAL_SOURCE_BYTES) {
    throw new Error(`Official legal source exceeds ${MAX_LEGAL_SOURCE_BYTES} bytes`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_LEGAL_SOURCE_BYTES) {
    throw new Error(`Official legal source has an invalid size: ${bytes.byteLength}`);
  }
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") {
    throw new Error(`Official legal source is not a PDF: ${url}`);
  }
  return bytes;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDbConnection);
