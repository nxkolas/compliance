import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Locale } from "@/src/i18n/config";
import { db } from "@/src/db";
import { guestApplicabilityChecks } from "@/src/db/schema";
import {
  currentApplicabilityDefinitionHash,
  SUPPORTED_JURISDICTION_CODES,
} from "./release/current";
import { and, eq, gt } from "drizzle-orm";
import { ApiError } from "../../platform/http/errors";
import { withAuthorizedOrganizationCommand, type OrganizationScopeExecutor } from "../../platform/auth/organization-scope";
import { guestSubmittedExpiry } from "./guest-lifecycle";
import { submitApplicabilityCheckSchema, type SubmitApplicabilityCheckInput } from "./validation";
import type { ApplicabilityQuestionnaireDto, ApplicabilityResultDto, ClaimGuestApplicabilityCheckInput, GuestApplicabilityCheckDto, PreparedSubmission, StoredResultSnapshot } from "./model";
import { parseResultSnapshot, toQuestionnaire } from "./queries";
import { BUILD_HASH, persistSubmission, prepareSubmission } from "./submissions";

export async function getApplicabilityQuestionnaireForGuest(
  locale: Locale,
): Promise<ApplicabilityQuestionnaireDto> {
  const questionnaire = toQuestionnaire(locale, {}, null);
  questionnaire.guestSession = {
    id: randomUUID(),
    token: randomBytes(32).toString("base64url"),
  };
  return questionnaire;
}

export async function submitApplicabilityCheckForGuest(
  input: SubmitApplicabilityCheckInput,
): Promise<{ id: string; token: string; result: ApplicabilityResultDto }> {
  const prepared = prepareSubmission(input);
  const id = input.guestSession?.id ?? randomUUID();
  const token = input.guestSession?.token ?? randomBytes(32).toString("base64url");
  const expiresAt = guestSubmittedExpiry(prepared.now);
  const result = guestResultDto(id, prepared);
  try {
    await db.insert(guestApplicabilityChecks).values({
      id,
      claimTokenHash: hashGuestToken(token),
      definitionHash: currentApplicabilityDefinitionHash,
      buildHash: BUILD_HASH,
      locale: prepared.locale,
      answerSnapshot: input.answers,
      resultSnapshot: {
        evidence: prepared.evidence,
        result: prepared.result,
        versionLabel: prepared.definition.releaseVersionLabel,
      } satisfies StoredResultSnapshot,
      submittedAt: prepared.now,
      expiresAt,
    });
  } catch {
    throw new ApiError(409, "This guest applicability check was already submitted");
  }
  return { id, token, result };
}

export async function getGuestApplicabilityCheck(
  token: string | undefined,
  checkId?: string,
): Promise<GuestApplicabilityCheckDto | null> {
  const row = await findGuestCheck(token, checkId);
  if (!row) return null;
  return {
    id: row.id,
    submittedAt: row.submittedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    result: guestStoredResultDto(row),
  };
}

export async function deleteGuestApplicabilityCheck(
  token: string | undefined,
  checkId?: string,
): Promise<void> {
  if (!token) return;
  await db
    .delete(guestApplicabilityChecks)
    .where(
      checkId
        ? and(
            eq(guestApplicabilityChecks.id, checkId),
            eq(guestApplicabilityChecks.claimTokenHash, hashGuestToken(token)),
          )
        : eq(guestApplicabilityChecks.claimTokenHash, hashGuestToken(token)),
    );
}

export async function claimGuestApplicabilityCheckForUser(
  userId: string,
  token: string | undefined,
  checkId: string | undefined,
  input: ClaimGuestApplicabilityCheckInput,
): Promise<ApplicabilityResultDto> {
  return withAuthorizedOrganizationCommand({ actorUserId: userId, organizationId: input.organizationId, capability: "applicability:submit" }, async ({ executor }) => {
  const row = await findGuestCheck(token, checkId ?? input.checkId, executor);
  if (!row || !token) {
    throw new ApiError(404, "Guest applicability check not found");
  }
  if (row.definitionHash !== currentApplicabilityDefinitionHash) {
    throw new ApiError(409, "The guest check uses an obsolete definition and cannot be claimed");
  }
  const answers = submitApplicabilityCheckSchema.shape.answers.safeParse(row.answerSnapshot);
  if (!answers.success) throw new ApiError(409, "Stored guest answers are invalid");
  const prepared = prepareSubmission({ answers: answers.data, locale: row.locale as Locale });
    const [claimed] = await executor
      .delete(guestApplicabilityChecks)
      .where(
        and(
          eq(guestApplicabilityChecks.id, row.id),
          eq(guestApplicabilityChecks.claimTokenHash, hashGuestToken(token)),
          gt(guestApplicabilityChecks.expiresAt, new Date()),
        ),
      )
      .returning({ id: guestApplicabilityChecks.id });
    if (!claimed) throw new ApiError(404, "Guest applicability check not found");
    return persistSubmission(executor, userId, input.organizationId, prepared);
  });
}

export function hashGuestToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function findGuestCheck(token: string | undefined, checkId?: string, executor: OrganizationScopeExecutor = db) {
  if (!token) return null;
  const row = await executor.query.guestApplicabilityChecks.findFirst({
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.claimTokenHash, hashGuestToken(token)),
          gt(table.expiresAt, new Date()),
          ...(checkId ? [eq(table.id, checkId)] : []),
        ) ?? operators.sql`true`,
    },
  });
  if (row) return row;
  await executor
    .delete(guestApplicabilityChecks)
    .where(eq(guestApplicabilityChecks.claimTokenHash, hashGuestToken(token)));
  return null;
}

export function guestResultDto(id: string, prepared: PreparedSubmission): ApplicabilityResultDto {
  return {
    outputRevisionId: id,
    outputRevisionNumber: 1,
    createdAt: prepared.now.toISOString(),
    assessmentRevisionId: null,
    evidence: prepared.evidence,
    result: prepared.result,
    definition: {
      hash: currentApplicabilityDefinitionHash,
      versionLabel: prepared.definition.releaseVersionLabel,
      isOutdated: false,
      supportedJurisdictionCodes: [...SUPPORTED_JURISDICTION_CODES],
    },
  };
}

export function guestStoredResultDto(row: typeof guestApplicabilityChecks.$inferSelect) {
  const snapshot = parseResultSnapshot(row.resultSnapshot);
  return {
    outputRevisionId: row.id,
    outputRevisionNumber: 1,
    createdAt: row.submittedAt.toISOString(),
    assessmentRevisionId: null,
    evidence: snapshot.evidence,
    result: snapshot.result,
    definition: {
      hash: row.definitionHash,
      versionLabel: snapshot.versionLabel,
      isOutdated: row.definitionHash !== currentApplicabilityDefinitionHash,
      supportedJurisdictionCodes: [...SUPPORTED_JURISDICTION_CODES],
    },
  } satisfies ApplicabilityResultDto;
}
