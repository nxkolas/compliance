import "dotenv/config";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { PDFParse } from "pdf-parse";

/**
 * Ingests authored guidance and binds it to legal provision keys.
 *
 * Usage:
 *   tsx scripts/provision-guidance.ts [--pdf <path>] [--dry] [--reviewer <name>]
 *
 * The source is ENISA's NIS2 Technical Implementation Guidance, which is
 * licensed CC BY 4.0 under Commission Decision 2011/833/EU. Commercial reuse is
 * permitted with attribution, so the attribution travels in the source row
 * rather than living in a README.
 *
 * Chunks are built from each chapter's GUIDANCE bullets and EXAMPLES OF
 * EVIDENCE entries. Those two blocks are what make generated wording concrete:
 * the first describes what good looks like, the second supplies real artifact
 * names for recommended evidence.
 */

const SOURCE = {
  slug: "enisa-nis2-technical-implementation-guidance",
  title: "NIS2 Technical Implementation Guidance",
  publisher: "ENISA (European Union Agency for Cybersecurity)",
  version: "1.0",
  url: "https://www.enisa.europa.eu/sites/default/files/2025-06/ENISA_Technical_implementation_guidance_on_cybersecurity_risk_management_measures_version_1.0.pdf",
  licence: "CC BY 4.0 (Commission Decision 2011/833/EU)",
  attribution:
    "© European Union Agency for Cybersecurity (ENISA), NIS2 Technical Implementation Guidance v1.0, June 2025. Licensed under CC BY 4.0. Excerpted and reformatted.",
  language: "en",
} as const;

/**
 * Chapter -> provision key, reviewed by hand.
 *
 * The chapters follow the 13 Annex sections of Implementing Regulation (EU)
 * 2024/2690, which map onto Article 21(2)(a)-(j). `position` breaks ties when a
 * category matches several keys: Article 21(2)(i) covers human resources,
 * access control and asset management, which the regulation splits across
 * chapters 10, 11 and 12, so asset management leads for the inventory-oriented
 * category and human resources follows.
 */
const BINDINGS: Array<{ chapter: number; provisionKey: string; position: number }> = [
  { chapter: 1, provisionKey: "eu_nis2.article_20_1", position: 1 },
  { chapter: 2, provisionKey: "eu_nis2.article_21_2_a", position: 1 },
  { chapter: 3, provisionKey: "eu_nis2.article_21_2_b", position: 1 },
  { chapter: 4, provisionKey: "eu_nis2.article_21_2_c", position: 1 },
  { chapter: 5, provisionKey: "eu_nis2.article_21_2_d", position: 1 },
  { chapter: 6, provisionKey: "eu_nis2.article_21_2_e", position: 1 },
  { chapter: 7, provisionKey: "eu_nis2.article_21_2_f", position: 1 },
  { chapter: 8, provisionKey: "eu_nis2.article_21_2_g", position: 1 },
  { chapter: 9, provisionKey: "eu_nis2.article_21_2_h", position: 1 },
  { chapter: 10, provisionKey: "eu_nis2.article_21_2_i", position: 2 },
  { chapter: 11, provisionKey: "eu_nis2.article_21_2_j", position: 1 },
  { chapter: 12, provisionKey: "eu_nis2.article_21_2_i", position: 1 },
  { chapter: 13, provisionKey: "eu_nis2.article_21_2_h", position: 2 },
];

const CHAPTER_TITLES: Record<number, string> = {
  1: "Policy on the security of network and information systems",
  2: "Risk management policy",
  3: "Incident handling",
  4: "Business continuity and crisis management",
  5: "Supply chain security",
  6: "Security in acquisition, development and maintenance",
  7: "Assessing the effectiveness of risk-management measures",
  8: "Basic cyber hygiene practices and security training",
  9: "Cryptography",
  10: "Human resources security",
  11: "Access control",
  12: "Asset management",
  13: "Environmental and physical security",
};

const MAX_CHUNK_CHARACTERS = 1_200;
/**
 * Evidence entries are reserved their own budget. They are the highest-value
 * part for Action Plan generation — real artifact names — and without a reserve
 * the guidance bullets consume the whole chunk and they never appear.
 */
const GUIDANCE_BUDGET = 700;
const EVIDENCE_BUDGET = 420;

async function main() {
  const pdfPath = readArgument("--pdf");
  const dry = process.argv.includes("--dry");
  const reviewer = readArgument("--reviewer") ?? "provision-guidance";

  const parser = new PDFParse({
    data: pdfPath ? readFileSync(pdfPath) : await downloadOfficialPdf(),
  });
  const extracted = await parser.getText();
  await parser.destroy();
  const text = stripPageFurniture(extracted.text);
  const chapters = splitChapters(text);

  const chunks = BINDINGS.map((binding) => binding.chapter)
    .filter((chapter, index, all) => all.indexOf(chapter) === index)
    .sort((left, right) => left - right)
    .map((chapter) => {
      const body = chapters.get(chapter);
      if (!body) throw new Error(`Chapter ${chapter} was not found in the PDF`);
      return { chapter, text: buildChunk(chapter, body) };
    });

  for (const chunk of chunks) {
    console.log(`\n--- chapter ${chunk.chapter} (${chunk.text.length} chars) ---`);
    console.log(chunk.text);
  }
  if (dry) {
    console.log("\n[dry] nothing written");
    return;
  }

  const sql = postgres(requireEnvironment("DATABASE_URL"), { max: 1 });
  // Explicit transaction control: postgres.js types `TransactionSql` as
  // non-callable in this version, and the client is pinned to one connection.
  try {
    await sql`begin`;
    try {
      const contentHash = hash(chunks.map((chunk) => chunk.text).join("\n"));
      // Re-provisioning replaces the source; chunks and bindings cascade.
      await sql`delete from guidance_sources where slug = ${SOURCE.slug}`;
      const [source] = await sql`
        insert into guidance_sources
          (slug, title, publisher, version, url, licence, attribution, language, retrieved_at, content_hash)
        values (${SOURCE.slug}, ${SOURCE.title}, ${SOURCE.publisher}, ${SOURCE.version},
                ${SOURCE.url}, ${SOURCE.licence}, ${SOURCE.attribution}, ${SOURCE.language},
                now(), ${contentHash})
        returning id`;
      const chunkIdByChapter = new Map<number, string>();
      for (const [index, chunk] of chunks.entries()) {
        const [row] = await sql`
          insert into guidance_chunks (source_id, position, section_path, text, content_hash)
          values (${source!.id as string}, ${index + 1},
                  ${`${chunk.chapter}. ${CHAPTER_TITLES[chunk.chapter]}`},
                  ${chunk.text}, ${hash(chunk.text)})
          returning id`;
        chunkIdByChapter.set(chunk.chapter, row!.id as string);
      }
      for (const binding of BINDINGS) {
        await sql`
          insert into guidance_provision_bindings
            (stable_provision_key, chunk_id, position, reviewed_by)
          values (${binding.provisionKey}, ${chunkIdByChapter.get(binding.chapter)!},
                  ${binding.position}, ${reviewer})`;
      }
      await sql`commit`;
    } catch (error) {
      await sql`rollback`;
      throw error;
    }
    console.log(`\nwrote 1 source, ${chunks.length} chunks, ${BINDINGS.length} bindings`);
  } finally {
    await sql.end();
  }
}

async function downloadOfficialPdf() {
  const response = await fetch(SOURCE.url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Official guidance returned HTTP ${response.status}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") {
    throw new Error("Official guidance response is not a PDF");
  }
  return bytes;
}

/** Removes running headers, page markers and footnote lines. */
function stripPageFurniture(text: string) {
  return text
    .split(/\r?\n/u)
    .filter(
      (line) =>
        !/^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/u.test(line) &&
        !/^\s*TECHNICAL IMPLEMENTATION GUIDANCE\s*$/u.test(line) &&
        !/^\s*June 2025, version 1\.0\s*$/u.test(line) &&
        !/^\s*\d{1,3}\s*$/u.test(line) &&
        !/^\s*\(\s*\d+\s*\)\s/u.test(line),
    )
    .join("\n");
}

/** Chapter 1 has no anchor line, so it runs from the body start to Chapter 2. */
function splitChapters(text: string) {
  const anchors = [...text.matchAll(/^Chapter (\d{1,2})\s*$/gmu)];
  const chapters = new Map<number, string>();
  const firstAnchor = anchors[0];
  if (firstAnchor?.index !== undefined) {
    // Chapter 1 has no anchor line. Start at its first numbered requirement so
    // the cover page and introduction are not mistaken for guidance.
    const bodyStart = text.search(/^1\.1\.1\.\s/mu);
    if (bodyStart >= 0 && bodyStart < firstAnchor.index) {
      chapters.set(1, text.slice(bodyStart, firstAnchor.index));
    }
  }
  for (const [index, anchor] of anchors.entries()) {
    const start = anchor.index ?? 0;
    const end = anchors[index + 1]?.index ?? text.length;
    chapters.set(Number(anchor[1]), text.slice(start, end));
  }
  return chapters;
}

/**
 * Keeps the GUIDANCE bullets and the EXAMPLES OF EVIDENCE entries, which is the
 * material that makes wording concrete. Requirement paragraphs are dropped:
 * the legal channel already carries the obligation.
 */
function buildChunk(chapter: number, body: string) {
  const lines = body.split(/\r?\n/u);
  const guidance: string[] = [];
  const evidence: string[] = [];
  let mode: "none" | "guidance" | "evidence" = "none";
  for (const raw of lines) {
    const line = raw.replace(/\s+/gu, " ").trim();
    if (!line) continue;
    if (/^GUIDANCE$/u.test(line)) { mode = "guidance"; continue; }
    if (/^EXAMPLES OF EVIDENCE$/u.test(line)) { mode = "evidence"; continue; }
    if (/^\d{1,2}(\.\d{1,2})*\.?\s/u.test(line) || /^[A-Z][A-Z ]{6,}$/u.test(line)) {
      mode = "none";
      continue;
    }
    if (mode === "none") continue;
    const bullet = line.replace(/^[•o]\s*/u, "").trim();
    if (bullet.length < 12) continue;
    // A URL reaching generated prose trips `url_forbidden`, and footnote
    // citations get spliced mid-sentence by the PDF's text order. Neither adds
    // anything to "what good looks like".
    if (/https?:\/\/|www\./iu.test(bullet)) continue;
    if (/^(ISO|IEC|NIST|ITIL|ETSI|CEN|Regulation|Directive)\b/u.test(bullet)) continue;
    (mode === "guidance" ? guidance : evidence).push(bullet);
  }
  const header = `${CHAPTER_TITLES[chapter]} — good practice (ENISA).`;
  const parts = [header];
  const practice = take(dedupe(guidance), GUIDANCE_BUDGET);
  if (practice) parts.push(`Practice: ${practice}`);
  const typical = take(dedupe(evidence), EVIDENCE_BUDGET);
  // Deliberately not headed "evidence". That word already names the Action Plan
  // output field, and a list under a matching heading reads as ready-made
  // answers: the model copied from this half verbatim and from the practice half
  // never.
  if (typical) parts.push(`Auditors typically request: ${typical}`);
  return truncate(parts.join("\n"), MAX_CHUNK_CHARACTERS);
}

/** Fills a budget with whole entries rather than cutting one mid-sentence. */
function take(entries: string[], budget: number) {
  const kept: string[] = [];
  let used = 0;
  for (const entry of entries) {
    if (used + entry.length + 1 > budget) continue;
    kept.push(entry);
    used += entry.length + 1;
  }
  return kept.join(" ");
}

function dedupe(values: string[]) {
  return [...new Set(values)];
}

function truncate(value: string, maximum: number) {
  const normalized = value.trim();
  if (normalized.length <= maximum) return normalized;
  const cut = normalized.slice(0, maximum);
  const boundary = cut.lastIndexOf(" ");
  return `${boundary > maximum * 0.6 ? cut.slice(0, boundary) : cut}…`;
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function readArgument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requireEnvironment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
