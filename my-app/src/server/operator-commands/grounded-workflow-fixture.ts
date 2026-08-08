import {
  CHUNKING_VERSION,
  EMBEDDING_DIMENSIONS,
  embeddingIdentityKey,
} from "@/src/server/documents/document-config";
import type { GroundingExecutionDependencies } from "@/src/server/ai/grounding/gateway";
import type { GroundedProvider } from "@/src/server/ai/grounding/types";
import type { ApplicabilityAnswerValue } from "@/src/server/applicability-check";

/**
 * Deterministic answers that make the applicability check land on an
 * "essential" outcome, so the seeded organization is eligible for a Gap
 * Analysis. Kept in one place so the qualification script and the demo-org
 * seeder agree on what "a complete org" means.
 */
export const DETERMINISTIC_APPLICABILITY_ANSWERS: Record<
  string,
  ApplicabilityAnswerValue
> = {
  "bc.germany_connection": "de_critical_installation",
};

/**
 * The grounded providers used by the deterministic workflow qualification and
 * the demo-org seeder. Every generation and embedding goes through these
 * in-memory implementations, so no external AI provider is contacted and the
 * produced orgs are byte-for-byte reproducible.
 */
export async function deterministicGroundingDependencies(
  mode: "openai" | "self_hosted",
): Promise<GroundingExecutionDependencies> {
  // The fixture embedder declares its own width; the deployment default is
  // only a convenient starting value.
  const dimensions = EMBEDDING_DIMENSIONS;
  const provider: GroundedProvider = {
    mode,
    provider: "deterministic-fixture",
    model: "deterministic-grounded-v1",
    async run(input) {
      const payload = parseQueryUnitPayload(input.prompt);
      return {
        output: input.system.includes("Create operational actions")
          ? deterministicActionPlanOutput(payload)
          : deterministicGapOutput(payload),
        usage: { inputTokens: 1, outputTokens: 1, cachedInputTokens: 0 },
      };
    },
  };
  return {
    providers: { [mode]: provider },
    embeddingProvider: {
      provider: "deterministic-fixture",
      model: "text-embedding-3-small",
      modelRevision: "deterministic-v1",
      dimensions,
      retrievalInstructionId: "deterministic-query-v1",
      chunkingVersion: CHUNKING_VERSION,
      key: embeddingIdentityKey({
        provider: "openai",
        model: "text-embedding-3-small",
        modelRevision: "deterministic-v1",
        dimensions,
        retrievalInstructionId: "deterministic-query-v1",
        chunkingVersion: CHUNKING_VERSION,
      }),
      async embed(values) {
        return values.map((value) => {
          const vector = Array.from({ length: dimensions }, () => 0);
          vector[Math.abs(hashCode(value)) % dimensions] = 1;
          return vector;
        });
      },
    },
    languageDetector: {
      implementation: "deterministic-fixture",
      version: "1",
      async classify(_document, expectedLocale) {
        return { kind: "match" as const, detected: expectedLocale, confidence: 1 };
      },
    },
  };
}

function parseQueryUnitPayload(prompt: string) {
  const firstLine = prompt.split("\n", 1)[0] ?? "";
  const separator = firstLine.indexOf(": ");
  if (separator < 0) throw new Error("Deterministic qualification prompt has no query-unit payload");
  return JSON.parse(firstLine.slice(separator + 2)) as Record<string, unknown>;
}

function deterministicGapOutput(payload: Record<string, unknown>) {
  const policy = payload.serverOwnedPolicy as {
    triggeringQuestions: Array<{ stableKey: string; kind: "missing" | "partial" | "uncertain" }>;
  };
  return {
    gaps: Object.fromEntries(policy.triggeringQuestions.map((trigger) => [
      trigger.stableKey,
      [{
        statement: trigger.kind === "missing"
          ? "Die erforderliche Kontrolle fehlt."
          : trigger.kind === "partial"
            ? "Die erforderliche Kontrolle ist nur teilweise umgesetzt."
            : "Der Umsetzungsstand der erforderlichen Kontrolle ist unklar.",
        supportingOrganizationCitationIds: [],
      }],
    ])),
    reviewNotice: null,
    assumptions: [],
    contradictions: [],
    requiresReview: false,
    conflictingOrganizationCitationIds: [],
  };
}

function deterministicActionPlanOutput(payload: Record<string, unknown>) {
  const gaps = payload.gaps as Array<{ key: string; kind: "missing" | "partial" | "uncertain" }>;
  const confirmed = gaps.filter((gap) => gap.kind !== "uncertain");
  const uncertain = gaps.filter((gap) => gap.kind === "uncertain");
  return {
    actions: [
      ...(confirmed.length ? [{
        mode: "remediation" as const,
        gapKeys: confirmed.map((gap) => gap.key),
        title: "Erforderliche Kontrolle umsetzen",
        result: "Setzen Sie die erforderliche Kontrolle vollständig um und dokumentieren Sie das Ergebnis.",
        recommendedArtifacts: [
          "Freigegebene Kontrolldokumentation",
          "Interner Umsetzungsnachweis",
        ],
        supportingOrganizationCitationIds: [],
      }] : []),
      ...(uncertain.length ? [{
        mode: "verification" as const,
        gapKeys: uncertain.map((gap) => gap.key),
        verificationTitle: "Kontrollstatus verifizieren",
        verificationResult: "Prüfen und dokumentieren Sie den aktuellen Kontrollstatus.",
        conditionalRemediation: "Fehlende Kontrolle vollständig umsetzen",
        recommendedArtifacts: [
          "Dokumentiertes Prüfergebnis",
          "Aktualisierter Kontrollstatus",
        ],
        supportingOrganizationCitationIds: [],
      }] : []),
    ],
  };
}

function hashCode(value: string) {
  let hash = 0;
  for (const character of value) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return hash;
}
