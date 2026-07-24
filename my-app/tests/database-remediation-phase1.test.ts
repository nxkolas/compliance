import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  legalUploadCompleteSchema,
  legalUrlImportSchema,
} from "@/src/contracts/admin";
import {
  actionPlanItems,
  actionPlans,
  aiProcessingRuns,
  assessmentRevisions,
  gapAnalysisReleases,
  gapRequirementVersions,
  generatedArtifactRevisions,
  legalSourceVersions,
} from "@/src/db/schema";
import { toLegalSourceVersionReadModel } from "@/src/server/corpus/read-models";

describe("database remediation phase 1", () => {
  it.each([
    [gapRequirementVersions, ["recommendation", "code"]],
    [assessmentRevisions, ["change_reason", "reverted_from_revision_id"]],
    [generatedArtifactRevisions, ["reverted_from_revision_id"]],
    [actionPlans, ["predecessor_plan_id"]],
    [actionPlanItems, ["predecessor_item_id"]],
    [aiProcessingRuns, ["estimated_cost_micros"]],
    [legalSourceVersions, ["supersedes_version_id"]],
    [gapAnalysisReleases, ["model_policy"]],
  ])("removes rejected schema columns", (table, removedColumns) => {
    const actualColumns = getTableConfig(table).columns.map((column) => column.name);

    expect(actualColumns).not.toEqual(expect.arrayContaining(removedColumns));
  });

  it("keeps optional upstream publication provenance distinct from legal effect", () => {
    const columns = getTableConfig(legalSourceVersions).columns.map(
      (column) => column.name,
    );

    expect(columns).toEqual(
      expect.arrayContaining([
        "upstream_published_at",
        "retrieved_at",
        "effective_from",
        "effective_to",
      ]),
    );

    const upstreamPublishedAt = "2026-01-15T10:30:00.000Z";
    const upload = legalUploadCompleteSchema.parse({
      sourceId: "4a5f3a75-f520-4ab6-b312-f63e704205df",
      versionLabel: "2026-01",
      upstreamPublishedAt,
      language: "de",
      translationStatus: "official",
    });
    const urlImport = legalUrlImportSchema.parse({
      exactUrl: "https://example.com/legal-source.pdf",
      versionLabel: "2026-01",
      upstreamPublishedAt,
      language: "de",
    });

    expect(upload).toMatchObject({ upstreamPublishedAt });
    expect(urlImport).toMatchObject({ upstreamPublishedAt });
    expect(upload).not.toHaveProperty("effectiveFrom");
    expect(urlImport).not.toHaveProperty("effectiveFrom");
  });

  it("exposes an explicit unknown publication state in administration reads", () => {
    expect(
      toLegalSourceVersionReadModel({ upstreamPublishedAt: null }),
    ).toMatchObject({
      upstreamPublishedAt: null,
      upstreamPublication: { state: "unknown", publishedAt: null },
    });

    const publishedAt = new Date("2026-01-15T10:30:00.000Z");
    expect(
      toLegalSourceVersionReadModel({ upstreamPublishedAt: publishedAt }),
    ).toMatchObject({
      upstreamPublishedAt: publishedAt,
      upstreamPublication: { state: "known", publishedAt },
    });
  });
});
