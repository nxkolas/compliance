import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/src/db", () => ({
  db: { transaction: mocks.transaction },
}));

vi.mock("@/src/server/auth/capability-service", () => ({
  requireOrganizationCapability: mocks.authorize,
}));

import {
  analysisOutputRevisions,
  analysisOutputs,
  assessmentRevisions,
} from "@/src/db/schema";
import { submitApplicabilityCheckForUser } from "@/src/server/applicability-check";
import { getCurrentApplicabilityDefinition } from "@/src/server/definitions";

describe("applicability submission lineage", () => {
  const assessmentRevisionId = "00000000-0000-4000-8000-000000000003";
  const outputRevisionId = "00000000-0000-4000-8000-000000000005";
  const insertedValues = new Map<unknown, unknown>();

  beforeEach(() => {
    vi.clearAllMocks();
    insertedValues.clear();
    mocks.authorize.mockResolvedValue({});

    const tx = {
      select: vi.fn(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        for: vi.fn().mockResolvedValue([]),
      })),
      query: {
        assessments: {
          findFirst: vi.fn().mockResolvedValue({
            id: "00000000-0000-4000-8000-000000000002",
            currentRevisionId: null,
          }),
        },
        analysisOutputs: {
          findFirst: vi.fn().mockResolvedValue({
            id: "00000000-0000-4000-8000-000000000004",
            currentRevisionId: null,
          }),
        },
      },
      insert: vi.fn((table: unknown) => ({
        values: vi.fn((values: unknown) => {
          insertedValues.set(table, values);
          return {
            onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
            returning: vi.fn().mockImplementation(async () => {
              if (table === assessmentRevisions) {
                return [{ id: assessmentRevisionId }];
              }
              if (table === analysisOutputRevisions) {
                return [{
                  ...(values as Record<string, unknown>),
                  id: outputRevisionId,
                  createdAt: new Date("2026-08-02T12:00:00.000Z"),
                }];
              }
              return [];
            }),
          };
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      })),
    };

    mocks.transaction.mockImplementation(
      async (callback: (transaction: typeof tx) => unknown) => callback(tx),
    );
  });

  it("does not point an applicability output at its assessment revision", async () => {
    const definition = getCurrentApplicabilityDefinition("en");
    const entryQuestion = definition.questions.find(
      (question) => question.stableKey === "bc.germany_connection",
    );
    if (!entryQuestion) throw new Error("Applicability entry question is missing");

    await submitApplicabilityCheckForUser(
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000006",
      {
        locale: "en",
        answers: [{ questionId: entryQuestion.id, value: "none" }],
      },
    );

    expect(insertedValues.get(analysisOutputRevisions)).toMatchObject({
      assessmentRevisionId,
      outputId: "00000000-0000-4000-8000-000000000004",
      sourceApplicabilityRevisionId: null,
    });
    expect(insertedValues.has(analysisOutputs)).toBe(true);
  });
});
