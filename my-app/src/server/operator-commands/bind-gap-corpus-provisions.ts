import { and, eq } from "drizzle-orm";
import { closeDbConnection, db } from "@/src/db";
import {
  legalCorpusFamilies,
  legalSourceChunks,
  legalSourceProcessingGenerations,
  legalSourceRenditions,
  legalSources,
  legalSourceVersions,
} from "@/src/db/schema";
import { bindLegalProvisions } from "./provision-legal-corpus";

type BindingDefinition = {
  familyCode: "nis2-eu-primary" | "nis2-de-primary";
  instrumentCode: "eu_nis2" | "de_bsig";
  provisionCode: string;
  fragments: string[];
};

const bindings: BindingDefinition[] = [
  binding("nis2-eu-primary", "eu_nis2", "article_20_1", [
    "Article 20\nGovernance",
    "approve the cybersecurity",
  ]),
  binding("nis2-eu-primary", "eu_nis2", "article_20_2", [
    "required to follow training",
    "Article 21",
  ]),
  binding("nis2-eu-primary", "eu_nis2", "article_21_1", [
    "Article 21\nCybersecurity risk-management measures",
    "appropriate and proportionate technical",
  ]),
  binding("nis2-eu-primary", "eu_nis2", "article_21_2", [
    "all-hazards approach",
    "shall include at least the following",
  ]),
  binding("nis2-eu-primary", "eu_nis2", "article_21_2_a", [
    "(a) policies on risk analysis",
  ]),
  binding("nis2-eu-primary", "eu_nis2", "article_21_2_b", [
    "(b) incident handling",
  ]),
  binding("nis2-eu-primary", "eu_nis2", "article_21_2_c", [
    "(c) business continuity, such as backup management",
  ]),
  binding("nis2-eu-primary", "eu_nis2", "article_21_2_d", [
    "(d) supply chain security",
  ]),
  binding("nis2-eu-primary", "eu_nis2", "article_21_2_e", [
    "(e) security in network and information systems acquisition",
  ]),
  binding("nis2-eu-primary", "eu_nis2", "article_21_2_f", [
    "policies and procedures to assess the effectiveness",
  ]),
  binding("nis2-eu-primary", "eu_nis2", "article_21_2_g", [
    "basic cyber hygiene practices",
    "human resources security, access control policies",
  ]),
  binding("nis2-eu-primary", "eu_nis2", "article_21_2_h", [
    "use of cryptography and, where appropriate, encryption",
  ]),
  binding("nis2-eu-primary", "eu_nis2", "article_21_2_i", [
    "human resources security, access control policies",
  ]),
  binding("nis2-eu-primary", "eu_nis2", "article_21_2_j", [
    "use of multi-factor authentication",
  ]),
  binding("nis2-eu-primary", "eu_nis2", "article_21_3", [
    "vulnerabilities specific to each direct supplier",
  ]),
  binding("nis2-eu-primary", "eu_nis2", "article_21_4", [
    "finds that it does not comply with the measures",
  ]),
  binding("nis2-eu-primary", "eu_nis2", "article_23", [
    "Article 23\nReporting obligations",
  ]),
  binding("nis2-de-primary", "de_bsig", "section_30_1", [
    "§ 30 Risikomanagementmaßnahmen",
    "(1) Besonders wichtige Einrichtungen",
  ]),
  binding("nis2-de-primary", "de_bsig", "section_30_2", [
    "Maßnahmen nach Absatz 1",
    "gefahrenübergreifenden Ansatz",
  ]),
  binding("nis2-de-primary", "de_bsig", "section_30_2_1", [
    "1. Konzepte in Bezug auf die Risikoanalyse",
  ]),
  binding("nis2-de-primary", "de_bsig", "section_30_2_2", [
    "2. Bewältigung von Sicherheitsvorfällen",
  ]),
  binding("nis2-de-primary", "de_bsig", "section_30_2_3", [
    "3. Aufrechterhaltung des Betriebs, wie Backup-Management",
  ]),
  binding("nis2-de-primary", "de_bsig", "section_30_2_4", [
    "4. Sicherheit der Lieferkette",
  ]),
  binding("nis2-de-primary", "de_bsig", "section_30_2_5", [
    "5. Sicherheitsmaßnahmen bei Erwerb, Entwicklung und Wartung",
  ]),
  binding("nis2-de-primary", "de_bsig", "section_30_2_6", [
    "6. Konzepte und Verfahren zur Bewertung der Wirksamkeit",
  ]),
  binding("nis2-de-primary", "de_bsig", "section_30_2_7", [
    "7. grundlegende Schulungen und Sensibilisierungsmaßnahmen",
  ]),
  binding("nis2-de-primary", "de_bsig", "section_30_2_8", [
    "8. Konzepte und Prozesse für den Einsatz von kryptographischen",
  ]),
  binding("nis2-de-primary", "de_bsig", "section_30_2_9", [
    "9. Erstellung von Konzepten für die Sicherheit des Personals",
  ]),
  binding("nis2-de-primary", "de_bsig", "section_30_2_10", [
    "10. Verwendung von Lösungen zur Multi-Faktor-Authentifizierung",
  ]),
  binding("nis2-de-primary", "de_bsig", "section_32", [
    "§ 32 Meldepflichten",
    "innerhalb von 24 Stunden",
  ]),
  binding("nis2-de-primary", "de_bsig", "section_38_1", [
    "§ 38 Umsetzungs-, Überwachungs- und Schulungspflicht",
    "(1) Geschäftsleitungen",
  ]),
  binding("nis2-de-primary", "de_bsig", "section_38_3", [
    "(3) Die Geschäftsleitungen",
    "regelmäßig an\nSchulungen teilnehmen",
  ]),
];

async function main() {
  const operatorIdentity = process.env.CORPUS_OPERATOR_IDENTITY?.trim();
  if (!operatorIdentity) throw new Error("CORPUS_OPERATOR_IDENTITY is required");

  const rows = await db.select({
    familyCode: legalCorpusFamilies.code,
    chunkId: legalSourceChunks.id,
    chunkPosition: legalSourceChunks.position,
    text: legalSourceChunks.text,
  }).from(legalSourceChunks)
    .innerJoin(
      legalSourceProcessingGenerations,
      and(
        eq(legalSourceChunks.processingGenerationId, legalSourceProcessingGenerations.id),
        eq(legalSourceProcessingGenerations.status, "succeeded"),
      ),
    )
    .innerJoin(
      legalSourceRenditions,
      eq(legalSourceProcessingGenerations.renditionId, legalSourceRenditions.id),
    )
    .innerJoin(
      legalSourceVersions,
      eq(legalSourceRenditions.sourceVersionId, legalSourceVersions.id),
    )
    .innerJoin(legalSources, eq(legalSourceVersions.sourceId, legalSources.id))
    .innerJoin(legalCorpusFamilies, eq(legalSources.familyId, legalCorpusFamilies.id));

  const resolved = bindings.map((definition) => {
    const matches = rows
      .filter((row) =>
        row.familyCode === definition.familyCode &&
        definition.fragments.every((fragment) => row.text.includes(fragment)))
      .sort((left, right) =>
        left.chunkPosition - right.chunkPosition ||
        left.chunkId.localeCompare(right.chunkId));
    if (!matches[0]) {
      throw new Error(
        `${definition.instrumentCode}.${definition.provisionCode} matched no processed chunk`,
      );
    }
    return {
      stableProvisionKey: `${definition.instrumentCode}.${definition.provisionCode}`,
      chunkId: matches[0].chunkId,
      position: 0,
    };
  });

  const result = await bindLegalProvisions({ operatorIdentity, bindings: resolved });
  console.log(`Bound ${result.count} legal provisions using the recovered exact anchors.`);
}

function binding(
  familyCode: BindingDefinition["familyCode"],
  instrumentCode: BindingDefinition["instrumentCode"],
  provisionCode: string,
  fragments: string[],
): BindingDefinition {
  return { familyCode, instrumentCode, provisionCode, fragments };
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDbConnection);
