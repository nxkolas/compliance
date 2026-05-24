import "dotenv/config";

import { eq } from "drizzle-orm";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/src/db";
import { aiDocuments } from "@/src/db/schema";
import { ingestAiDocument } from "@/lib/ai/rag";

type ReferenceFile = {
  body: string;
  metadata: {
    title: string;
    sourceUrl: string;
    jurisdiction?: string;
    publishedAt?: string;
    version?: string;
  };
};

const referenceDir = path.join(process.cwd(), "docs", "ai-references");

async function main() {
  const entries = await readdir(referenceDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter(
      (fileName) =>
        (fileName.endsWith(".md") || fileName.endsWith(".txt")) &&
        !fileName.toLowerCase().startsWith("readme"),
    );

  for (const fileName of files) {
    const filePath = path.join(referenceDir, fileName);
    const parsed = parseReferenceFile(await readFile(filePath, "utf8"), fileName);

    await db
      .delete(aiDocuments)
      .where(eq(aiDocuments.sourceUrl, parsed.metadata.sourceUrl));

    const document = await ingestAiDocument({
      title: parsed.metadata.title,
      sourceUrl: parsed.metadata.sourceUrl,
      text: parsed.body,
      scope: "reference",
      mimeType: fileName.endsWith(".md") ? "text/markdown" : "text/plain",
      metadata: {
        jurisdiction: parsed.metadata.jurisdiction ?? null,
        publishedAt: parsed.metadata.publishedAt ?? null,
        version: parsed.metadata.version ?? null,
        fileName,
      },
    });

    console.log(`Indexed ${document.title}`);
  }
}

function parseReferenceFile(content: string, fileName: string): ReferenceFile {
  const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontMatterMatch) {
    throw new Error(`${fileName} is missing YAML-style front matter`);
  }

  const metadata = Object.fromEntries(
    frontMatterMatch[1]
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separatorIndex = line.indexOf(":");

        if (separatorIndex === -1) {
          throw new Error(`${fileName} has invalid front matter line: ${line}`);
        }

        const key = line.slice(0, separatorIndex).trim();
        const value = line
          .slice(separatorIndex + 1)
          .trim()
          .replace(/^["']|["']$/g, "");

        return [key, value];
      }),
  );

  if (!metadata.title || !metadata.sourceUrl) {
    throw new Error(`${fileName} requires title and sourceUrl metadata`);
  }

  return {
    body: frontMatterMatch[2].trim(),
    metadata: {
      title: metadata.title,
      sourceUrl: metadata.sourceUrl,
      jurisdiction: metadata.jurisdiction,
      publishedAt: metadata.publishedAt,
      version: metadata.version,
    },
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
