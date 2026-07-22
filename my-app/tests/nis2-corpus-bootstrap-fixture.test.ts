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
      expect(item.import.exactUrl).toMatch(/^https:\/\/(eur-lex\.europa\.eu|www\.gesetze-im-internet\.de)\//);
      expect(item.import.language).toMatch(/^(en|de)$/);
    }
  });

  it("makes the non-completeness and required review boundary explicit", () => {
    expect(NIS2_CORPUS_BOOTSTRAP_NOTICE).toContain("not a claim of legal completeness");
    expect(NIS2_CORPUS_BOOTSTRAP_NOTICE).toContain("reviewed");
    expect(NIS2_CORPUS_BOOTSTRAP_NOTICE).toContain("activated explicitly");
  });
});
