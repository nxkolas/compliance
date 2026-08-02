import type { db } from "@/src/db";
import { legalCorpusFamilies, legalCorpusSnapshots } from "@/src/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { contentHash } from "@/src/server/compliance/domain";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function resolveCurrentCorpusSnapshots(tx: Transaction, requiredFamilyCodes: string[]) {
  const codes = [...new Set(requiredFamilyCodes)].sort();
  if (!codes.length || codes.length !== requiredFamilyCodes.length) {
    throw new Error("Required corpus family codes must be unique and non-empty");
  }
  const pins = await tx.select({
    familyId: legalCorpusFamilies.id,
    familyCode: legalCorpusFamilies.code,
    snapshotId: legalCorpusSnapshots.id,
    snapshotHash: legalCorpusSnapshots.contentHash,
  }).from(legalCorpusFamilies)
    .innerJoin(legalCorpusSnapshots, and(
      eq(legalCorpusSnapshots.id, legalCorpusFamilies.currentSnapshotId),
      eq(legalCorpusSnapshots.familyId, legalCorpusFamilies.id),
    ))
    .where(inArray(legalCorpusFamilies.code, codes))
    .for("share");
  if (pins.length !== codes.length) throw new Error("A required corpus family has no current snapshot");
  pins.sort((left, right) => left.familyCode.localeCompare(right.familyCode));
  return { pins, snapshotSetHash: contentHash(pins) };
}

export async function resolvePublishableCorpusPins(tx: Transaction, requiredFamilyCodes: string[]) {
  const { pins, snapshotSetHash } = await resolveCurrentCorpusSnapshots(tx, requiredFamilyCodes);
  return {
    pins: pins.map((pin) => ({
      familyId: pin.familyId,
      familyCode: pin.familyCode,
      releaseId: pin.snapshotId,
      releaseHash: pin.snapshotHash,
    })),
    releaseSetHash: snapshotSetHash,
  };
}
