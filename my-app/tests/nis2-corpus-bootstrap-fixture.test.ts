import { describe, expect, it } from "vitest";
import { NIS2_CORPUS_BOOTSTRAP_FIXTURE, NIS2_CORPUS_BOOTSTRAP_NOTICE } from "@/src/server/corpus/nis2-bootstrap-fixture";

describe("NIS2 corpus bootstrap fixture", () => {
  it("uses the required EU and German family codes and only official HTTPS PDFs", () => {
    expect(NIS2_CORPUS_BOOTSTRAP_FIXTURE.map((item) => item.family.code)).toEqual([
      "nis2-eu-primary",
      "nis2-de-primary",
    ]);
    for (const item of NIS2_CORPUS_BOOTSTRAP_FIXTURE) {
      expect(item.source.authorityTier).toBe("primary_authority");
      expect(item.import.exactUrl).toMatch(/^https:\/\/(op\.europa\.eu|www\.gesetze-im-internet\.de)\//);
      expect(item.import.language).toMatch(/^(en|de)$/);
    }
  });

  it("uses the Publications Office download handler for the EU PDF", () => {
    const euSource = NIS2_CORPUS_BOOTSTRAP_FIXTURE[0];
    const url = new URL(euSource.import.exactUrl);

    expect(url.hostname).toBe("op.europa.eu");
    expect(url.pathname).toBe("/o/opportal-service/download-handler");
    expect(url.searchParams.get("identifier")).toBe(
      "9b84d482-85bd-11ed-9887-01aa75ed71a1",
    );
    expect(url.searchParams.get("format")).toBe("PDF");
    expect(url.searchParams.get("language")).toBe("en");
    expect(url.searchParams.get("productionSystem")).toBe("cellar");
  });

  it("makes the non-completeness and required review boundary explicit", () => {
    expect(NIS2_CORPUS_BOOTSTRAP_NOTICE).toContain("not a claim of legal completeness");
    expect(NIS2_CORPUS_BOOTSTRAP_NOTICE).toContain("reviewed");
    expect(NIS2_CORPUS_BOOTSTRAP_NOTICE).toContain("activated explicitly");
  });
});
