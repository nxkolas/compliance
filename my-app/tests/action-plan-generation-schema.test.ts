import { describe, expect, it } from "vitest";
import {
  buildActionPlanResponseSchema,
  normalizeActionPlanResponse,
} from "@/src/server/action-plans/generation-schema";
import { ACTION_PLAN_GENERATION_JOB_POLICY } from "@/src/server/action-plans/domain";

describe("independent Action Plan response contract", () => {
  it("allows bounded retries for whole-plan structured generation", () => {
    expect(ACTION_PLAN_GENERATION_JOB_POLICY).toEqual({
      maxAttempts: 5,
      cancellable: true,
      cancellationCapability: "plans:activate",
    });
  });

  it("allows one action to cover several same-category gaps", () => {
    const policies = [
      {
        requirementCode: "IAM",
        sourceFindingId: "finding-iam",
        priority: "high" as const,
        outputLocale: "en" as const,
        gaps: [
          { key: "G1", kind: "missing" as const },
          { key: "G2", kind: "partial" as const },
        ],
        permittedCitationIds: ["Q:mfa", "Q:reviews", "LEGAL:iam"],
      },
    ];
    const value = {
      categories: {
        IAM: {
          actions: [
            {
              title: "Strengthen privileged access controls",
              result:
                "Privileged access requires MFA and is reviewed every quarter.",
              suggestedEvidence: [
                "MFA configuration export",
                "Completed access review record",
              ],
              gapKeys: ["G1", "G2"],
              citations: ["Q:mfa", "Q:reviews", "LEGAL:iam"],
            },
          ],
        },
      },
    };

    expect(buildActionPlanResponseSchema(policies).parse(value)).toEqual(value);
    expect(normalizeActionPlanResponse({ value, policies })).toEqual({
      categories: [
        {
          requirementCode: "IAM",
          sourceFindingId: "finding-iam",
          actions: [
            {
              title: "Strengthen privileged access controls",
              result:
                "Privileged access requires MFA and is reviewed every quarter.",
              suggestedEvidence: [
                "MFA configuration export",
                "Completed access review record",
              ],
              priority: "high",
              position: 1,
              gapKeys: ["G1", "G2"],
              citationIds: ["Q:mfa", "Q:reviews", "LEGAL:iam"],
            },
          ],
        },
      ],
    });
  });

  it("allows one gap to be split across ordered actions", () => {
    const policies = [policy([{ key: "G1", kind: "missing" }])];
    const value = response([
      action({
        title: "Configure privileged MFA",
        gapKeys: ["G1"],
      }),
      action({
        title: "Validate privileged MFA",
        gapKeys: ["G1"],
      }),
    ]);

    expect(
      normalizeActionPlanResponse({ value, policies }).categories[0]
        ?.actions.map((item) => item.position),
    ).toEqual([1, 2]);
  });

  it("rejects uncovered gaps, orphan actions, cross-category links, and eleven actions", () => {
    const policies = [
      policy([
        { key: "G1", kind: "missing" },
        { key: "G2", kind: "partial" },
      ]),
    ];
    expect(() =>
      buildActionPlanResponseSchema(policies).parse(
        response([action({ gapKeys: ["G1"] })]),
      ),
    ).toThrow(/coverage/i);
    expect(() =>
      buildActionPlanResponseSchema(policies).parse(
        response([action({ gapKeys: [] })]),
      ),
    ).toThrow();
    expect(() =>
      buildActionPlanResponseSchema(policies).parse(
        response([action({ gapKeys: ["OTHER"] })]),
      ),
    ).toThrow();
    expect(() =>
      buildActionPlanResponseSchema(policies).parse(
        response(
          Array.from({ length: 11 }, () =>
            action({ gapKeys: ["G1", "G2"] }),
          ),
        ),
      ),
    ).toThrow();
  });

  it("enforces verification-first actions for uncertain gaps", () => {
    const policies = [policy([{ key: "G1", kind: "uncertain" }])];
    expect(() =>
      buildActionPlanResponseSchema(policies).parse(
        response([
          action({
            title: "Introduce MFA",
            result: "Privileged access requires MFA.",
          }),
        ]),
      ),
    ).toThrow(/verification/i);
  });
});

function policy(
  gaps: Array<{
    key: string;
    kind: "missing" | "partial" | "uncertain";
  }>,
) {
  return {
    requirementCode: "IAM",
    sourceFindingId: "finding-iam",
    priority: "high" as const,
    outputLocale: "en" as const,
    gaps,
    permittedCitationIds: ["LEGAL:iam"],
  };
}

function action(
  overrides: Partial<{
    title: string;
    result: string;
    suggestedEvidence: string[];
    gapKeys: string[];
    citations: string[];
  }> = {},
) {
  return {
    title: "Introduce MFA",
    result: "Privileged access requires MFA.",
    suggestedEvidence: ["MFA export"],
    gapKeys: ["G1"],
    citations: ["LEGAL:iam"],
    ...overrides,
  };
}

function response(actions: ReturnType<typeof action>[]) {
  return { categories: { IAM: { actions } } };
}
