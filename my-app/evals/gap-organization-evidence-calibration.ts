import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  admitOrganizationEvidence,
  GAP_ORGANIZATION_EVIDENCE_POLICY,
  type OrganizationEvidenceCandidate,
} from "@/src/server/ai/grounding/organization-evidence-policy";
import {
  CHUNKING_VERSION,
  createDocumentEmbeddingProvider,
} from "@/src/server/documents/domain";

type CalibrationFixture = {
  id: string;
  class:
    | "exact"
    | "contradiction"
    | "bilingual"
    | "adjacent_wrong_control"
    | "generic"
    | "unrelated"
    | "short";
  shouldAdmit: boolean;
  query: string;
  sample: string;
};

const fixtures: CalibrationFixture[] = [
  {
    id: "exact-mfa-en",
    class: "exact",
    shouldAdmit: true,
    query:
      "Is multi-factor authentication implemented for privileged and remote access?",
    sample:
      "Multi-factor authentication is enforced for every privileged administrator and all remote access. Quarterly access reviews verify enrollment.",
  },
  {
    id: "exact-incident-de",
    class: "exact",
    shouldAdmit: true,
    query:
      "Werden Sicherheitsvorfälle nach einem dokumentierten Verfahren erkannt, eskaliert und behandelt?",
    sample:
      "Das dokumentierte Incident-Response-Verfahren benennt Erkennung, Eskalation, Rollen, Meldewege und die Nachbereitung jedes Sicherheitsvorfalls.",
  },
  {
    id: "contradictory-restore-en",
    class: "contradiction",
    shouldAdmit: true,
    query:
      "Are backups restored and recovery procedures tested regularly?",
    sample:
      "Backups are scheduled, but no restoration test has ever been performed. There are no restore-test results and recovery capability remains unverified.",
  },
  {
    id: "bilingual-restore-de-en",
    class: "bilingual",
    shouldAdmit: true,
    query:
      "Werden Wiederherstellungsverfahren regelmäßig getestet und dokumentiert?",
    sample:
      "End-to-end restoration tests are performed every quarter. Results, failed recovery objectives, owners, and corrective actions are documented.",
  },
  {
    id: "wrong-control-backup-vs-mfa",
    class: "adjacent_wrong_control",
    shouldAdmit: false,
    query:
      "Is multi-factor authentication implemented for privileged and remote access?",
    sample:
      "Encrypted backups are created daily and retained offline. Restore jobs are tested each quarter against recovery objectives.",
  },
  {
    id: "unrelated-backup-vs-governance",
    class: "unrelated",
    shouldAdmit: false,
    query:
      "Does management approve and oversee cybersecurity risk-management measures?",
    sample:
      "Database backups run nightly with a thirty-day retention period. A restore copy is stored in a separate region.",
  },
  {
    id: "generic-security-policy",
    class: "generic",
    shouldAdmit: false,
    query:
      "Are supply-chain security risks assessed and contractually controlled?",
    sample:
      "The organization takes security seriously and maintains a general information-security policy for all staff.",
  },
  {
    id: "very-short",
    class: "short",
    shouldAdmit: false,
    query:
      "Are vulnerabilities identified, prioritized, remediated, and verified?",
    sample: "Security.",
  },
];

async function main() {
  const provider = createDocumentEmbeddingProvider();
  const values = fixtures.flatMap((fixture) => [
    fixture.query,
    fixture.sample,
  ]);
  const embeddings = await provider.embed(values);
  const rows = fixtures.map((fixture, index) => {
    const semanticScore = cosine(
      embeddings[index * 2]!,
      embeddings[index * 2 + 1]!,
    );
    const lexicalScore = lexicalOverlap(
      fixture.query,
      fixture.sample,
    );
    const combinedScore =
      lexicalScore * 0.35 + semanticScore * 0.65;
    const candidate: OrganizationEvidenceCandidate = {
      chunkId: fixture.id,
      documentId: `calibration-${fixture.id}`,
      documentVersionId: `calibration-version-${fixture.id}`,
      documentTitle: fixture.id,
      content: fixture.sample,
      pageNumber: null,
      sectionLabel: fixture.class,
      lexicalScore,
      semanticScore,
      combinedScore,
    };
    const decision = admitOrganizationEvidence({
      operation: "gap_analysis",
      provider: provider.provider,
      model: provider.model,
      dimensions: provider.dimensions,
      chunkingVersion: CHUNKING_VERSION,
      candidates: [candidate],
    });
    const admitted = decision.admitted.length === 1;
    return {
      id: fixture.id,
      class: fixture.class,
      shouldAdmit: fixture.shouldAdmit,
      admitted,
      passed: admitted === fixture.shouldAdmit,
      lexicalScore,
      semanticScore,
      combinedScore,
    };
  });
  const summary = {
    generatedAt: new Date().toISOString(),
    policy: GAP_ORGANIZATION_EVIDENCE_POLICY,
    embedding: {
      provider: provider.provider,
      model: provider.model,
      dimensions: provider.dimensions,
      chunkingVersion: CHUNKING_VERSION,
    },
    scoringNote:
      "Calibration combined scores use deterministic token overlap plus the production 0.35/0.65 weights. Database rehearsal separately verifies PostgreSQL lexical ranking and end-to-end admission.",
    passed: rows.every((row) => row.passed),
    distributions: {
      expectedRelevant: range(
        rows
          .filter((row) => row.shouldAdmit)
          .map((row) => row.semanticScore),
      ),
      expectedRejected: range(
        rows
          .filter((row) => !row.shouldAdmit)
          .map((row) => row.semanticScore),
      ),
    },
    fixtures: rows,
  };
  const outputPath = resolve(
    readArgument("--output") ??
      "docs/qa/gap-evidence-threshold-calibration.json",
  );
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );
  if (!summary.passed) process.exitCode = 1;
}

function cosine(left: number[], right: number[]) {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }
  return dot / Math.sqrt(leftMagnitude * rightMagnitude);
}

function lexicalOverlap(query: string, sample: string) {
  const queryTokens = tokens(query);
  const sampleTokens = tokens(sample);
  if (queryTokens.size === 0 || sampleTokens.size === 0) return 0;
  const shared = [...queryTokens].filter((token) =>
    sampleTokens.has(token),
  ).length;
  return shared / new Set([...queryTokens, ...sampleTokens]).size;
}

function tokens(value: string) {
  return new Set(
    value
      .normalize("NFKD")
      .toLocaleLowerCase("en")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length >= 4),
  );
}

function range(values: number[]) {
  return {
    minimum: Math.min(...values),
    maximum: Math.max(...values),
    average:
      values.reduce((total, value) => total + value, 0) /
      values.length,
  };
}

function readArgument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

void main();
