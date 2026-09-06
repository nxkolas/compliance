import { describe, expect, it } from "vitest";
import {
  buildActionPlanCategoryResponseSchema,
  normalizeActionPlanCategoryResponse,
  type ActionPlanCategoryPolicy,
} from "@/src/server/modules/action-plans/generation-schema";
import * as z from "zod";
import {
  ACTION_PLAN_GROUNDING_INSTRUCTION,
  ACTION_PLAN_PROMPT_VERSION,
  actionPlanPrompt,
  actionPlanRepairPrompt,
} from "@/src/server/modules/action-plans/prompt-contract";
import { GAP_GROUNDING_INSTRUCTION } from "@/src/server/modules/gap-analysis/grounding-instruction";

const actionPolicy: ActionPlanCategoryPolicy = {
  requirementCode: "NIS2-GOV-01",
  sourceFindingId: "finding-1",
  priority: "high",
  outputLocale: "en",
  gaps: [
    { key: "G1", kind: "uncertain" },
    { key: "G2", kind: "missing" },
  ],
  admittedOrganizationCitations: [],
  mandatoryCitationIdsByGapKey: {
    G1: ["Q:1", "LEGAL:1"],
    G2: ["Q:2", "LEGAL:1"],
  },
};

describe("Action Plan contract prompt", () => {
  it("requires concise operational prose without legal exposition", () => {
    const prompt = actionPlanPrompt("en");

    expect(prompt).toContain("at most 12 words");
    expect(prompt).toContain("one or two sentences");
    expect(prompt).toContain("at most 40 words");
    expect(prompt).toContain(
      "Do not name or discuss laws, directives, statutes, articles, sections, obligations, regulators, or citations",
    );
    expect(prompt).toContain("writing constraints");
  });

  it("prevents raw identifiers in the initial response", () => {
    const prompt = actionPlanPrompt("en");

    expect(prompt).toContain("Do not put URLs or opaque internal identifiers");
    expect(prompt).toContain("UUID");
  });

  it("keeps server-owned conditional wording out of both model fields", () => {
    const prompt = actionPlanPrompt("en");

    expect(prompt).toContain(
      "verificationResult contains only the completed verification work and its documented outcome",
    );
    expect(prompt).toContain(
      "Do not put if, when, unless, conditional, or equivalent wording in verificationResult",
    );
    expect(prompt).toContain(
      "conditionalRemediation contains only the remediation work, without a condition or conditional lead-in",
    );
    expect(prompt).toContain(
      "The server adds the localized condition exactly once",
    );
  });

  it("budgets verification fields for the rendered result bound", () => {
    const prompt = actionPlanPrompt("en");

    expect(prompt).toContain("verificationResult at most 18 words");
    expect(prompt).toContain("conditionalRemediation at most 16 words");
    expect(ACTION_PLAN_PROMPT_VERSION).toBe("9");
  });

  it("explains the objective raw-identifier issue without style gates", () => {
    const prompt = actionPlanRepairPrompt({
      locale: "en",
      categoryCode: "NIS2-SC-06",
      issues: [{ code: "action_raw_identifier", path: ["actions", 0, "result"] }],
    });

    expect(prompt).toContain(
      "action_raw_identifier means remove every URL, UUID, or opaque internal identifier",
    );
    expect(prompt).not.toContain("action_title_style means");
    expect(prompt).not.toContain("action_word_count means");
  });
});

describe("grounding instructions match what each schema can express", () => {
  // The Action Plan schema exposes one citable field, an enum over organization
  // documents. An instruction to cite legal authority is unsatisfiable there, and
  // a model that takes it literally writes the citation into prose instead.
  it("never asks the Action Plan to cite legal authority", () => {
    expect(ACTION_PLAN_GROUNDING_INSTRUCTION).not.toMatch(/cite/iu);
    expect(ACTION_PLAN_GROUNDING_INSTRUCTION).toContain(
      "never name, quote, or reference it",
    );
  });

  it("never asks Gap to cite legal authority either", () => {
    expect(GAP_GROUNDING_INSTRUCTION).not.toMatch(/cite supplied legal/iu);
    expect(GAP_GROUNDING_INSTRUCTION).toContain(
      "assigned by the server",
    );
  });

  // Guidance must never become evidence about the customer: the organization
  // channel already means untrusted evidence whose contradictions force review.
  it.each([
    ["gap", GAP_GROUNDING_INSTRUCTION],
    ["action plan", ACTION_PLAN_GROUNDING_INSTRUCTION],
  ])("frames guidance as good practice, not evidence, for %s", (_name, instruction) => {
    expect(instruction).toContain("Guidance describes general good practice");
    expect(instruction).toContain("never evidence about this organization");
    expect(instruction).toMatch(/never be quoted or referenced/u);
    // Same rule as citations: no handle, so never invite one.
    expect(instruction).not.toMatch(/guidance label|cite guidance/iu);
  });

  // These described the pre-v7 batch root `{findings: {CODE: …}}`. Both contracts
  // are category-scoped now and every call passes a single query unit.
  it.each([
    ["gap", GAP_GROUNDING_INSTRUCTION],
    ["action plan", ACTION_PLAN_GROUNDING_INSTRUCTION],
  ])("drops the stale batch-shape wording from %s", (_name, instruction) => {
    expect(instruction).not.toContain("result property name");
    expect(instruction).not.toContain("every query-unit ID");
  });
});

describe("Action Plan contract schema", () => {
  it("exposes recommendedArtifacts, not an evidence-named field", () => {
    const schema = z.toJSONSchema(
      buildActionPlanCategoryResponseSchema(actionPolicy),
      { io: "input" },
    );
    const serialized = JSON.stringify(schema);

    expect(serialized).toContain("recommendedArtifacts");
    expect(serialized).not.toContain("suggestedEvidence");
  });

  it("accepts natural verification and remediation prose without lexical style gates", () => {
    const result = normalizeActionPlanCategoryResponse({
      policy: actionPolicy,
      value: {
        actions: [
          {
            mode: "verification",
            gapKeys: ["G1"],
            verificationTitle: "Map the present access landscape",
            verificationResult:
              "A defensible picture of privileged access now exists.",
            conditionalRemediation: null,
            recommendedArtifacts: ["Access landscape record", "Access review log"],
            supportingOrganizationCitationIds: [],
          },
          {
            mode: "remediation",
            gapKeys: ["G2"],
            title: "Shape a durable response process",
            result:
              "Teams share one operational path for handling security events.",
            recommendedArtifacts: ["Response process record", "Response runbook"],
            supportingOrganizationCitationIds: [],
          },
        ],
      },
    });

    expect(result.value.actions).toHaveLength(2);
    expect(result.value.actions[0]?.gapKeys).toEqual(["G1"]);
    expect(result.value.actions[1]?.gapKeys).toEqual(["G2"]);
  });

  it("enforces server-owned modes and complete coverage", () => {
    const schema = buildActionPlanCategoryResponseSchema(actionPolicy);

    expect(
      schema.safeParse({
        actions: [
          {
            mode: "remediation",
            gapKeys: ["G1"],
            title: "Map access",
            result: "The access landscape exists.",
            recommendedArtifacts: ["Access record", "Access approval log"],
            supportingOrganizationCitationIds: [],
          },
        ],
      }).success,
    ).toBe(false);

    expect(() =>
      normalizeActionPlanCategoryResponse({
        policy: actionPolicy,
        value: {
          actions: [
            {
              mode: "verification",
              gapKeys: ["G1"],
              verificationTitle: "Map access",
              verificationResult: "The access landscape now exists.",
              conditionalRemediation: null,
              recommendedArtifacts: ["Access record", "Access approval log"],
              supportingOrganizationCitationIds: [],
            },
          ],
        },
      }),
    ).toThrow(
      expect.objectContaining({
        issues: [{ code: "coverage_incomplete", path: ["actions"] }],
      }),
    );
  });

  it("projects mandatory citations onto every action", () => {
    const result = normalizeActionPlanCategoryResponse({
      policy: { ...actionPolicy, gaps: [{ key: "G2", kind: "missing" }] },
      value: {
        actions: [
          {
            mode: "remediation",
            gapKeys: ["G2"],
            title: "Shape a durable response process",
            result: "Teams share one operational path.",
            recommendedArtifacts: ["Response process record", "Response runbook"],
            supportingOrganizationCitationIds: [],
          },
        ],
      },
    });

    expect(result.value.actions[0]?.citationIds).toEqual(["Q:2", "LEGAL:1"]);
  });

  it("rejects a raw identifier in customer-visible prose", () => {
    expect(() =>
      normalizeActionPlanCategoryResponse({
        policy: { ...actionPolicy, gaps: [{ key: "G2", kind: "missing" }] },
        value: {
          actions: [
            {
              mode: "remediation",
              gapKeys: ["G2"],
              title: "Shape a durable response process",
              result:
                "Review 00000000-0000-4000-8000-000000000099 before closing.",
              recommendedArtifacts: ["Response process record", "Response runbook"],
              supportingOrganizationCitationIds: [],
            },
          ],
        },
      }),
    ).toThrow(
      expect.objectContaining({
        issues: [{ code: "action_raw_identifier", path: ["actions", 0, "result"] }],
      }),
    );
  });

  it("preserves German noun capitalization in conditional remediation", () => {
    const result = normalizeActionPlanCategoryResponse({
      policy: {
        ...actionPolicy,
        requirementCode: "NIS2-BC-05",
        outputLocale: "de",
        gaps: [{ key: "G1", kind: "uncertain" }],
      },
      value: {
        actions: [
          {
            mode: "verification",
            gapKeys: ["G1"],
            verificationTitle: "Backup-Wiederherstellung prüfen",
            verificationResult:
              "Die Wiederherstellbarkeit ist dokumentiert bewertet.",
            conditionalRemediation: "Backup-Strategie dokumentieren",
            recommendedArtifacts: ["Wiederherstellungstest", "Testprotokoll"],
            supportingOrganizationCitationIds: [],
          },
        ],
      },
    });

    expect(result.value.actions[0]?.result).toContain(
      "ergibt, Backup-Strategie dokumentieren.",
    );
  });

  it("lowercases the English conditional lead-in exactly once", () => {
    const result = normalizeActionPlanCategoryResponse({
      policy: { ...actionPolicy, gaps: [{ key: "G1", kind: "uncertain" }] },
      value: {
        actions: [
          {
            mode: "verification",
            gapKeys: ["G1"],
            verificationTitle: "Map the present access landscape",
            verificationResult: "Privileged access is documented.",
            conditionalRemediation: "Restrict the remaining accounts",
            recommendedArtifacts: ["Access landscape record", "Access review log"],
            supportingOrganizationCitationIds: [],
          },
        ],
      },
    });

    expect(result.value.actions[0]?.result).toContain(
      "If verification identifies a deficiency, restrict the remaining accounts.",
    );
  });
});
