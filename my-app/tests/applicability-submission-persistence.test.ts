import { describe, expect, it, vi } from "vitest";
import {
  executeSubmissionBatches,
  persistApplicabilitySubmission,
  type ApplicabilitySubmissionPersistenceCommand,
  type SubmissionBatchCommand,
  type SubmissionBatchWriter,
  type SubmissionPersistenceAdapter,
  type SubmissionPersistenceTransaction,
} from "@/src/server/applicability-check/submission-persistence";
import { evaluateRuleSet } from "@/src/server/applicability-check/rules";
import { nis2ReleaseDefinition } from "@/src/server/compliance/nis2/releases/2026-v1/release";
import { compileRelease } from "@/src/server/compliance/publishing/compile-release";

vi.hoisted(() => {
  process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
});

describe("applicability submission persistence", () => {
  it("uses one call for each answer and fact batch regardless of row count", async () => {
    const calls: string[] = [];
    const rowCounts: number[] = [];
    const command = fixtureCommand(12);
    const writer = fixtureWriter(calls, rowCounts, command);

    await executeSubmissionBatches(writer, command);

    expect(calls).toEqual([
      "answer-headers",
      "answer-option-joins",
      "fact-invalidation",
      "fact-inserts",
      "fact-option-lookup",
      "fact-option-joins",
    ]);
    expect(rowCounts).toEqual([12, 12, 12, 12, 12, 12]);
  });

  it("keeps the same fixed call budget as answer and fact counts grow", async () => {
    for (const count of [1, 12, 24]) {
      const calls: string[] = [];
      const command = fixtureCommand(count);
      await executeSubmissionBatches(
        fixtureWriter(calls, [], command),
        command,
      );
      expect(calls).toHaveLength(6);
    }
  });

  it("fails closed before fact-option joins when an exact mapping is missing", async () => {
    const calls: string[] = [];
    const command = fixtureCommand(12);
    const writer = fixtureWriter(calls, [], command);
    writer.loadFactOptions = async (pairs) => {
      calls.push("fact-option-lookup");
      return pairs.slice(1).map((pair, index) => ({
        id: `fact-option-${index + 1}`,
        ...pair,
      }));
    };

    await expect(executeSubmissionBatches(writer, command)).rejects.toThrow(
      /mapping is incomplete/i,
    );
    expect(calls).not.toContain("fact-option-joins");
  });

  it("keeps the complete existing-assessment transaction call budget fixed", async () => {
    const callsByCount: string[][] = [];
    for (const count of [12, 24]) {
      const calls: string[] = [];
      await persistApplicabilitySubmission(
        fixturePersistenceCommand(count),
        fixturePersistenceAdapter(calls),
      );
      callsByCount.push(calls);
    }

    expect(callsByCount[0]).toEqual(callsByCount[1]);
    expect(callsByCount[0]).toEqual([
      "transaction-begin",
      "find-active-assessment",
      "find-latest-assessment-revision",
      "create-assessment-revision",
      "supersede-assessment-revision",
      "set-current-assessment-revision",
      "answer-headers",
      "answer-option-joins",
      "fact-invalidation",
      "fact-inserts",
      "fact-option-lookup",
      "fact-option-joins",
      "find-artifact",
      "find-latest-artifact-revision",
      "create-artifact-revision",
      "find-profile-version",
      "insert-result-projection",
      "insert-artifact-source",
      "set-current-artifact-revision",
      "transaction-commit",
    ]);
  });

  it("rolls the complete transaction back when an option mapping is missing", async () => {
    const calls: string[] = [];

    await expect(
      persistApplicabilitySubmission(
        fixturePersistenceCommand(12),
        fixturePersistenceAdapter(calls, { missingFactOption: true }),
      ),
    ).rejects.toThrow(/mapping is incomplete/i);

    expect(calls.at(-1)).toBe("transaction-rollback");
    expect(calls).not.toContain("transaction-commit");
    expect(calls).not.toContain("find-artifact");
  });

  it("claims a guest check before the same transaction commits", async () => {
    const calls: string[] = [];
    const command = fixturePersistenceCommand(12);
    command.claimGuestCheckId = "guest-check-1";

    await persistApplicabilitySubmission(
      command,
      fixturePersistenceAdapter(calls),
    );

    expect(calls.indexOf("claim-guest-check")).toBeGreaterThan(
      calls.indexOf("set-current-artifact-revision"),
    );
    expect(calls.indexOf("claim-guest-check")).toBeLessThan(
      calls.indexOf("transaction-commit"),
    );
  });

  it("automatically approves a deterministic applicability result", async () => {
    const calls: string[] = [];
    let persistedStatus: string | undefined;
    const adapter = fixturePersistenceAdapter(calls, {
      onCreateArtifactRevision(input) {
        persistedStatus = input.status;
      },
    });

    await persistApplicabilitySubmission(
      fixturePersistenceCommand(12),
      adapter,
    );

    expect(persistedStatus).toBe("approved");
  });
});

function fixtureCommand(count: number): SubmissionBatchCommand {
  return {
    organizationId: "organization-1",
    assessmentRevisionId: "revision-1",
    answers: Array.from({ length: count }, (_, index) => ({
      questionId: `question-${index}`,
      questionStableKey: `question.${index}`,
      optionIds: [`question-option-${index}`],
    })),
    facts: Object.fromEntries(
      Array.from({ length: count }, (_, index) => [
        `fact-${index}`,
        `value-${index}`,
      ]),
    ),
  };
}

function fixtureWriter(
  calls: string[],
  rowCounts: number[],
  command: SubmissionBatchCommand,
): SubmissionBatchWriter {
  return {
    async insertAnswerHeaders(rows) {
      calls.push("answer-headers");
      rowCounts.push(rows.length);
      return rows.map((row, index) => ({
        id: `answer-${index}`,
        questionId: row.questionId,
      }));
    },
    async insertAnswerOptionJoins(rows) {
      calls.push("answer-option-joins");
      rowCounts.push(rows.length);
    },
    async invalidateCurrentFacts({ factKeys }) {
      calls.push("fact-invalidation");
      rowCounts.push(factKeys.length);
    },
    async insertFactValues(rows) {
      calls.push("fact-inserts");
      rowCounts.push(rows.length);
      return rows.map((row, index) => ({
        id: `fact-value-${index}`,
        factKey: row.factKey,
      }));
    },
    async loadFactOptions(pairs) {
      calls.push("fact-option-lookup");
      rowCounts.push(pairs.length);
      return pairs.map((pair, index) => ({
        id: `fact-option-${index}`,
        ...pair,
      }));
    },
    async insertFactOptionJoins(rows) {
      calls.push("fact-option-joins");
      rowCounts.push(rows.length);
      expect(rows).toHaveLength(Object.keys(command.facts).length);
    },
  };
}

function fixturePersistenceCommand(
  count: number,
): ApplicabilitySubmissionPersistenceCommand {
  const batch = fixtureCommand(count);
  const evaluation = evaluateRuleSet(
    compileRelease(nis2ReleaseDefinition).artifact,
    {
      facts: {
        eu_activity: "yes",
        jurisdiction_country: "DE",
        jurisdiction_basis: "de_establishment",
        nis2_entity_types: ["none_of_these"],
        member_state_designation: "none",
        employee_count_bucket: "under_50",
        annual_revenue_bucket: "revenue_at_most_10m",
        balance_sheet_total_bucket: "balance_at_most_10m",
        sme_figures_verified: "verified_de_without_it_exception",
        sector_specific_regime: "none",
        serves_critical_customers: "no",
        has_customer_security_evidence_requests: "no",
      },
    },
  );
  return {
    userId: "user-1",
    organizationId: batch.organizationId,
    release: {
      checkCode: "nis2_applicability",
      checkReleaseId: "release-1",
      moduleId: "module-1",
      questionnaireId: "questionnaire-1",
      questionnaireVersionId: "questionnaire-version-1",
      versionLabel: "2026-v1",
      isActive: true,
      activeReleaseVersionLabel: "2026-v1",
      evaluatorKind: evaluation.evaluatorKind,
    },
    ruleSet: { id: "rule-set-1", versionLabel: "2026-v1" },
    answers: batch.answers,
    facts: batch.facts,
    evaluation,
    localizedResult: {
      outcome: evaluation.outcome,
      label: "Ergebnis",
      labelEn: "Result",
      reasons: [],
      reasonsEn: [],
      sizeClassification: evaluation.sizeClassification,
      jurisdiction: {
        countryCode: evaluation.jurisdiction.countryCode,
        countryProfileVersion: evaluation.profileVersionKey,
      },
      matchedEntityTypes: [],
      scopeBases: [],
      unresolvedFacts: [],
      unresolvedFactsEn: [],
      obligationOverlays: [],
      indirectExposure: {
        status: evaluation.indirectExposure.status,
        reasons: [],
        reasonsEn: [],
      },
      disclaimer: "Hinweis",
      disclaimerEn: "Disclaimer",
    },
    inputHash: "a".repeat(64),
    now: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function fixturePersistenceAdapter(
  calls: string[],
  options: FixturePersistenceOptions = {},
): SubmissionPersistenceAdapter {
  return {
    async transaction(work) {
      calls.push("transaction-begin");
      try {
        const result = await work(
          fixturePersistenceTransaction(calls, options),
        );
        calls.push("transaction-commit");
        return result;
      } catch (error) {
        calls.push("transaction-rollback");
        throw error;
      }
    },
  };
}

function fixturePersistenceTransaction(
  calls: string[],
  options: FixturePersistenceOptions,
): SubmissionPersistenceTransaction {
  return {
    async findActiveAssessment() {
      calls.push("find-active-assessment");
      return { id: "assessment-1", currentRevisionId: "revision-1" };
    },
    async findPreviousActiveAssessmentIds() {
      calls.push("find-previous-active-assessments");
      return [];
    },
    async archiveAssessments() {
      calls.push("archive-assessments");
    },
    async createAssessment() {
      calls.push("create-assessment");
      return { id: "assessment-1", currentRevisionId: null };
    },
    async findLatestAssessmentRevision() {
      calls.push("find-latest-assessment-revision");
      return { id: "revision-1", revisionNumber: 1 };
    },
    async createAssessmentRevision(input) {
      calls.push("create-assessment-revision");
      return { id: "revision-2", revisionNumber: input.revisionNumber };
    },
    async supersedeAssessmentRevision() {
      calls.push("supersede-assessment-revision");
    },
    async setCurrentAssessmentRevision() {
      calls.push("set-current-assessment-revision");
    },
    async persistBatches(command) {
      const writer = fixtureWriter(calls, [], command);
      if (options.missingFactOption) {
        writer.loadFactOptions = async (pairs) => {
          calls.push("fact-option-lookup");
          return pairs.slice(1).map((pair, index) => ({
            id: `fact-option-${index}`,
            ...pair,
          }));
        };
      }
      await executeSubmissionBatches(writer, command);
    },
    async findArtifact() {
      calls.push("find-artifact");
      return { id: "artifact-1", currentRevisionId: "artifact-revision-1" };
    },
    async createArtifact() {
      calls.push("create-artifact");
      return { id: "artifact-1", currentRevisionId: null };
    },
    async findLatestArtifactRevision() {
      calls.push("find-latest-artifact-revision");
      return {
        id: "artifact-revision-1",
        revisionNumber: 1,
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
      };
    },
    async createArtifactRevision(input) {
      calls.push("create-artifact-revision");
      options.onCreateArtifactRevision?.(input);
      return {
        id: "artifact-revision-2",
        revisionNumber: input.revisionNumber,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      };
    },
    async findProfileVersion() {
      calls.push("find-profile-version");
      return "profile-version-1";
    },
    async insertResultProjection() {
      calls.push("insert-result-projection");
    },
    async insertArtifactSource() {
      calls.push("insert-artifact-source");
    },
    async setCurrentArtifactRevision() {
      calls.push("set-current-artifact-revision");
    },
    async claimGuestCheck() {
      calls.push("claim-guest-check");
    },
  };
}

type FixturePersistenceOptions = {
  missingFactOption?: boolean;
  onCreateArtifactRevision?: (
    input: Parameters<
      SubmissionPersistenceTransaction["createArtifactRevision"]
    >[0],
  ) => void;
};
