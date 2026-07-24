import type { db } from "@/src/db";
import {
  activeLegalCorpusReleases,
  legalCorpusFamilies,
  legalCorpusReleases,
} from "@/src/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { contentHash } from "@/src/server/compliance/domain";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function resolvePublishableCorpusPins(
  tx: Transaction,
  requiredFamilyCodes: string[],
) {
  const codes = [...new Set(requiredFamilyCodes)].sort();
  if (codes.length !== requiredFamilyCodes.length || codes.length === 0) {
    throw new Error("Required corpus family codes must be unique and non-empty");
  }
  const pins = await tx.select({
    familyId: legalCorpusFamilies.id,
    familyCode: legalCorpusFamilies.code,
    releaseId: legalCorpusReleases.id,
    releaseHash: legalCorpusReleases.contentHash,
    releaseStatus: legalCorpusReleases.status,
    evaluationState: legalCorpusReleases.evaluationState,
  }).from(legalCorpusFamilies)
    .innerJoin(activeLegalCorpusReleases, eq(activeLegalCorpusReleases.familyId, legalCorpusFamilies.id))
    .innerJoin(legalCorpusReleases, and(
      eq(legalCorpusReleases.id, activeLegalCorpusReleases.releaseId),
      eq(legalCorpusReleases.familyId, legalCorpusFamilies.id),
    ))
    .where(inArray(legalCorpusFamilies.code, codes))
    .for("share");
  if (pins.length !== codes.length) throw new Error("A required corpus family has no active release");
  for (const pin of pins) {
    if (pin.releaseStatus !== "published" || pin.evaluationState !== "passed" || !pin.releaseHash) {
      throw new Error(`Corpus family ${pin.familyCode} has no evaluated published release`);
    }
  }
  pins.sort((left, right) => left.familyCode.localeCompare(right.familyCode));
  return {
    pins,
    releaseSetHash: contentHash(pins.map((pin) => ({
      familyCode: pin.familyCode,
      familyId: pin.familyId,
      releaseId: pin.releaseId,
      releaseHash: pin.releaseHash,
    }))),
  };
}
