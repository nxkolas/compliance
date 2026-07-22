import "dotenv/config";

import { closeDbConnection, db } from "@/src/db";
import {
  activeLegalCorpusReleases,
  legalCorpusFamilies,
  legalCorpusReleaseMembers,
  legalCorpusReleases,
  legalSourceProcessingGenerations,
  legalSourceRenditions,
  legalSources,
  legalSourceVersions,
} from "@/src/db/schema";
import { NIS2_CORPUS_BOOTSTRAP_FIXTURE } from "@/src/server/corpus/nis2-bootstrap-fixture";
import {
  activateCorpusRelease,
  createCorpusRelease,
  enqueueCorpusEvaluation,
  publishCorpusRelease,
  replaceCorpusReleaseMembers,
} from "@/src/server/corpus/release-service";
import { reviewLegalProcessingGeneration } from "@/src/server/corpus/review-service";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const actorUserId = z.uuid().parse(readArgument("--actor"));
const releaseLabel = readArgument("--release-label").trim();
const activatePassed = process.argv.includes("--activate-passed");

type Fixture = (typeof NIS2_CORPUS_BOOTSTRAP_FIXTURE)[number];

async function main() {
  requireReviewConfirmation();
  if (!releaseLabel) throw new Error("--release-label cannot be blank");

  const results = [];
  for (const fixture of NIS2_CORPUS_BOOTSTRAP_FIXTURE) {
    const generationId = z.uuid().parse(
      readArgument(`--${fixture.family.jurisdictionCode.toLowerCase()}-generation`),
    );
    results.push(await approveFixture(fixture, generationId));
  }

  console.log(JSON.stringify(results, null, 2));
}

async function approveFixture(fixture: Fixture, generationId: string) {
  const selected = await loadExactFixtureGeneration(fixture, generationId);
  if (!selected.reliableAnchors) {
    throw new Error(`${fixture.family.code}: processing generation lacks reliable anchors`);
  }
  if (selected.generationState === "review_required") {
    await reviewLegalProcessingGeneration({
      actorUserId,
      generationId,
      requestId: `operator-approved-review:${generationId}`,
    });
  } else if (selected.generationState !== "reviewed") {
    throw new Error(
      `${fixture.family.code}: generation is ${selected.generationState}, not reviewable or reviewed`,
    );
  }

  let release = await db.query.legalCorpusReleases.findFirst({
    where: and(
      eq(legalCorpusReleases.familyId, selected.familyId),
      eq(legalCorpusReleases.versionLabel, releaseLabel),
    ),
  });
  if (!release) {
    release = await createCorpusRelease({
      actorUserId,
      familyId: selected.familyId,
      versionLabel: releaseLabel,
    });
  }
  if (release.status === "withdrawn") {
    throw new Error(`${fixture.family.code}: the named release is withdrawn`);
  }

  const expectedMember = {
    sourceVersionId: selected.sourceVersionId,
    renditionId: selected.renditionId,
    processingGenerationId: selected.generationId,
  };
  const members = await db.query.legalCorpusReleaseMembers.findMany({
    where: eq(legalCorpusReleaseMembers.releaseId, release.id),
  });
  const exactMember = members.length === 1
    && members[0]?.sourceVersionId === expectedMember.sourceVersionId
    && members[0]?.renditionId === expectedMember.renditionId
    && members[0]?.processingGenerationId === expectedMember.processingGenerationId;

  if (release.status === "draft" && !exactMember) {
    release = await replaceCorpusReleaseMembers({
      actorUserId,
      releaseId: release.id,
      expectedVersion: release.version,
      members: [expectedMember],
    });
  } else if (release.status !== "draft" && !exactMember) {
    throw new Error(`${fixture.family.code}: published release membership differs from the approved generation`);
  }

  if (release.status === "draft") {
    release = await publishCorpusRelease({
      actorUserId,
      releaseId: release.id,
      requestId: `operator-publish-corpus:${release.id}`,
    });
  }

  let evaluationJobId = release.evaluationJobId;
  if (release.evaluationState === "not_run" || release.evaluationState === "failed") {
    const job = await enqueueCorpusEvaluation({ actorUserId, releaseId: release.id });
    evaluationJobId = job.id;
    release = (await db.query.legalCorpusReleases.findFirst({
      where: eq(legalCorpusReleases.id, release.id),
    }))!;
  }

  let active = await db.query.activeLegalCorpusReleases.findFirst({
    where: eq(activeLegalCorpusReleases.familyId, selected.familyId),
  });
  if (activatePassed && active?.releaseId !== release.id) {
    if (release.evaluationState !== "passed") {
      throw new Error(
        `${fixture.family.code}: evaluation is ${release.evaluationState}; run the worker before --activate-passed`,
      );
    }
    await activateCorpusRelease({
      actorUserId,
      releaseId: release.id,
      requestId: `operator-activate-corpus:${release.id}`,
    });
    active = await db.query.activeLegalCorpusReleases.findFirst({
      where: eq(activeLegalCorpusReleases.familyId, selected.familyId),
    });
  }

  return {
    familyCode: fixture.family.code,
    generationId,
    releaseId: release.id,
    releaseStatus: release.status,
    evaluationState: release.evaluationState,
    evaluationJobId,
    active: active?.releaseId === release.id,
  };
}

async function loadExactFixtureGeneration(fixture: Fixture, generationId: string) {
  const rows = await db
    .select({
      familyId: legalCorpusFamilies.id,
      familyCode: legalCorpusFamilies.code,
      sourceCode: legalSources.stableCode,
      sourceVersionId: legalSourceVersions.id,
      sourceVersionLabel: legalSourceVersions.versionLabel,
      renditionId: legalSourceRenditions.id,
      generationId: legalSourceProcessingGenerations.id,
      generationState: legalSourceProcessingGenerations.state,
      reliableAnchors: legalSourceProcessingGenerations.reliableAnchors,
    })
    .from(legalSourceProcessingGenerations)
    .innerJoin(
      legalSourceRenditions,
      eq(legalSourceProcessingGenerations.renditionId, legalSourceRenditions.id),
    )
    .innerJoin(
      legalSourceVersions,
      eq(legalSourceRenditions.sourceVersionId, legalSourceVersions.id),
    )
    .innerJoin(legalSources, eq(legalSourceVersions.sourceId, legalSources.id))
    .innerJoin(legalCorpusFamilies, eq(legalSources.familyId, legalCorpusFamilies.id))
    .where(eq(legalSourceProcessingGenerations.id, generationId));
  const selected = rows[0];
  if (!selected) throw new Error(`${fixture.family.code}: processing generation not found`);
  if (
    selected.familyCode !== fixture.family.code
    || selected.sourceCode !== fixture.source.stableCode
    || selected.sourceVersionLabel !== fixture.import.versionLabel
  ) {
    throw new Error(`${fixture.family.code}: generation does not match the documented fixture source/version`);
  }
  return selected;
}

function requireReviewConfirmation() {
  if (!process.argv.includes("--confirm-reviewed-sources")) {
    throw new Error(
      "--confirm-reviewed-sources is required and means a human approved the exact generation IDs supplied",
    );
  }
}

function readArgument(name: string) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`${name} is required`);
  return value;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDbConnection());
