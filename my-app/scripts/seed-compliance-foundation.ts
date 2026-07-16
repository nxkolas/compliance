import "dotenv/config";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  complianceFrameworkVersions,
  complianceFrameworks,
  complianceModules,
  organizationFactDefinitionTranslations,
  organizationFactDefinitions,
  questionFactMappings,
  questionOptionTranslations,
  questionOptions,
  questionTranslations,
  questionnaireVersions,
  questionnaires,
  questions,
  ruleSets,
} from "../src/db/schema";
import {
  nis2Questions,
  nis2ScopeRuleSet,
} from "../src/server/applicability-check/nis2-scope-definition";

const databaseUrl = process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DRIZZLE_DATABASE_URL or DATABASE_URL is required");
}

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to seed production DB");
}

const client = postgres(databaseUrl, { prepare: false });
const db = drizzle(client);

type SeedFactDefinition = typeof organizationFactDefinitions.$inferInsert & {
  labelEn: string;
  descriptionEn: string;
};

const factDefinitions: SeedFactDefinition[] = [
  fact("eu_activity", "Tätigkeit in der EU", "Activity in the EU", "Ob relevante Dienste oder Tätigkeiten innerhalb der EU erbracht werden.", "Whether relevant services or activities are provided within the EU."),
  fact("jurisdiction_country", "Zuständiger Mitgliedstaat", "Competent Member State", "Mitgliedstaat, dessen Zuständigkeit nach Artikel 26 geprüft wird.", "Member State whose jurisdiction is assessed under Article 26."),
  fact("jurisdiction_basis", "Grundlage der Zuständigkeit", "Jurisdiction basis", "Niederlassung, Dienstleistungsort, Hauptniederlassung oder EU-Vertreter.", "Establishment, service location, main establishment or EU representative."),
  fact("nis2_entity_types", "NIS2-Einrichtungsarten", "NIS2 entity types", "Konkrete Einrichtungsarten nach Anhang I oder II sowie Sonderfälle.", "Exact entity types under Annex I or II and special cases.", "json"),
  fact("member_state_designation", "Behördliche Einstufung", "Authority classification", "Formale Einstufung oder Benennung durch einen Mitgliedstaat.", "Formal classification or designation by a Member State."),
  fact("employee_count_bucket", "Mitarbeiterzahl", "Employee count", "Mitarbeiterzahl nach der KMU-Empfehlung.", "Employee count under the SME Recommendation."),
  fact("annual_revenue_bucket", "Jahresumsatz", "Annual turnover", "Jahresumsatz mit rechtlich exakten Schwellenwerten.", "Annual turnover using the exact legal thresholds."),
  fact("balance_sheet_total_bucket", "Jahresbilanzsumme", "Annual balance-sheet total", "Jahresbilanzsumme mit rechtlich exakten Schwellenwerten.", "Annual balance-sheet total using the exact legal thresholds."),
  fact("sme_figures_verified", "KMU-Größenwerte geprüft", "SME figures verified", "Ob Partner- und verbundene Unternehmen korrekt berücksichtigt wurden.", "Whether partner and linked enterprises were handled correctly."),
  fact("sector_specific_regime", "Sektorspezifisches Regelwerk", "Sector-specific regime", "Zusätzliche oder vorrangige Regelwerke wie DORA oder sektorspezifische deutsche Vorschriften.", "Additional or prevailing regimes such as DORA or German sector-specific provisions."),
  fact("serves_critical_customers", "Leistungen für regulierte Kunden", "Services for regulated customers", "Indikator für indirekte Lieferkettenbetroffenheit.", "Indicator of indirect supply-chain exposure."),
  fact("has_customer_security_evidence_requests", "Vertragliche Sicherheitsnachweise", "Contractual security evidence", "Ob Kunden Sicherheitsmaßnahmen oder Nachweise verlangen.", "Whether customers require security measures or evidence."),
];

const modules: Array<typeof complianceModules.$inferInsert> = [
  { frameworkVersionId: "", code: "betroffenheitscheck", name: "Betroffenheitscheck", moduleType: "questionnaire", position: 10 },
  { frameworkVersionId: "", code: "gap_analysis", name: "Gap-Analyse", moduleType: "questionnaire", position: 20 },
  { frameworkVersionId: "", code: "action_plan", name: "Maßnahmenplan", moduleType: "generated_artifact", position: 30 },
  { frameworkVersionId: "", code: "document_analysis", name: "Dokumentenanalyse", moduleType: "document_analysis", position: 40 },
];

function fact(
  key: string,
  label: string,
  labelEn: string,
  description: string,
  descriptionEn: string,
  dataType: "enum" | "json" = "enum",
): SeedFactDefinition {
  return { key, label, labelEn, dataType, description, descriptionEn };
}

async function main() {
  try {
    for (const definition of factDefinitions) {
      const { labelEn, descriptionEn, ...values } = definition;
      await db
        .insert(organizationFactDefinitions)
        .values(values)
        .onConflictDoUpdate({
          target: organizationFactDefinitions.key,
          set: {
            label: definition.label,
            dataType: definition.dataType,
            description: definition.description,
          },
        });

      await db
        .insert(organizationFactDefinitionTranslations)
        .values({
          factKey: definition.key,
          locale: "en",
          label: labelEn,
          description: descriptionEn,
        })
        .onConflictDoUpdate({
          target: [
            organizationFactDefinitionTranslations.factKey,
            organizationFactDefinitionTranslations.locale,
          ],
          set: { label: labelEn, description: descriptionEn },
        });
    }

    const [framework] = await db
      .insert(complianceFrameworks)
      .values({
        code: "nis2",
        name: "NIS2",
        description: "NIS2 compliance framework used by the current product workflow.",
      })
      .onConflictDoUpdate({
        target: complianceFrameworks.code,
        set: {
          name: "NIS2",
          description: "NIS2 compliance framework used by the current product workflow.",
        },
      })
      .returning();

    const [frameworkVersion] = await db
      .insert(complianceFrameworkVersions)
      .values({
        frameworkId: framework.id,
        versionLabel: "2026-v1",
        status: "published",
      })
      .onConflictDoUpdate({
        target: [
          complianceFrameworkVersions.frameworkId,
          complianceFrameworkVersions.versionLabel,
        ],
        set: { status: "published", effectiveFrom: null, effectiveTo: null },
      })
      .returning();

    let applicabilityModule: typeof complianceModules.$inferSelect | undefined;
    for (const moduleDefinition of modules) {
      const values = {
        ...moduleDefinition,
        frameworkVersionId: frameworkVersion.id,
      };
      const [module] = await db
        .insert(complianceModules)
        .values(values)
        .onConflictDoUpdate({
          target: [complianceModules.frameworkVersionId, complianceModules.code],
          set: {
            name: values.name,
            moduleType: values.moduleType,
            position: values.position,
          },
        })
        .returning();

      if (module.code === "betroffenheitscheck") {
        applicabilityModule = module;
      }
    }

    if (!applicabilityModule) {
      throw new Error("NIS2 applicability module was not seeded");
    }

    const [questionnaire] = await db
      .insert(questionnaires)
      .values({
        moduleId: applicabilityModule.id,
        code: "betroffenheitscheck",
        title: "NIS2 Betroffenheitscheck",
      })
      .onConflictDoUpdate({
        target: [questionnaires.moduleId, questionnaires.code],
        set: { title: "NIS2 Betroffenheitscheck" },
      })
      .returning();

    const [questionnaireVersion] = await db
      .insert(questionnaireVersions)
      .values({
        questionnaireId: questionnaire.id,
        versionLabel: "2026-v1",
        status: "published",
        publishedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          questionnaireVersions.questionnaireId,
          questionnaireVersions.versionLabel,
        ],
        set: { status: "published", publishedAt: new Date() },
      })
      .returning();

    for (const seedQuestion of nis2Questions) {
      const [question] = await db
        .insert(questions)
        .values({
          questionnaireVersionId: questionnaireVersion.id,
          stableKey: seedQuestion.stableKey,
          position: seedQuestion.position,
          questionText: seedQuestion.questionText,
          helpText: seedQuestion.helpText ?? null,
          answerType: seedQuestion.answerType,
          required: seedQuestion.required,
          config: seedQuestion.config,
        })
        .onConflictDoUpdate({
          target: [questions.questionnaireVersionId, questions.stableKey],
          set: {
            position: seedQuestion.position,
            questionText: seedQuestion.questionText,
            helpText: seedQuestion.helpText ?? null,
            answerType: seedQuestion.answerType,
            required: seedQuestion.required,
            config: seedQuestion.config,
          },
        })
        .returning();

      await db
        .insert(questionTranslations)
        .values({
          questionId: question.id,
          locale: "en",
          questionText: seedQuestion.questionTextEn,
          helpText: seedQuestion.helpTextEn ?? null,
        })
        .onConflictDoUpdate({
          target: [questionTranslations.questionId, questionTranslations.locale],
          set: {
            questionText: seedQuestion.questionTextEn,
            helpText: seedQuestion.helpTextEn ?? null,
          },
        });

      for (const [index, option] of seedQuestion.options.entries()) {
        const [seededOption] = await db
          .insert(questionOptions)
          .values({
            questionId: question.id,
            stableValue: option.stableValue,
            label: option.label,
            position: index + 1,
            metadata: option.metadata ?? {},
          })
          .onConflictDoUpdate({
            target: [questionOptions.questionId, questionOptions.stableValue],
            set: {
              label: option.label,
              position: index + 1,
              metadata: option.metadata ?? {},
            },
          })
          .returning();

        await db
          .insert(questionOptionTranslations)
          .values({
            questionOptionId: seededOption.id,
            locale: "en",
            label: option.labelEn,
          })
          .onConflictDoUpdate({
            target: [
              questionOptionTranslations.questionOptionId,
              questionOptionTranslations.locale,
            ],
            set: { label: option.labelEn },
          });
      }

      await db
        .insert(questionFactMappings)
        .values({
          questionId: question.id,
          factKey: seedQuestion.factKey,
          transform: { type: "identity" },
        })
        .onConflictDoUpdate({
          target: [questionFactMappings.questionId, questionFactMappings.factKey],
          set: { transform: { type: "identity" } },
        });
    }

    await db
      .insert(ruleSets)
      .values({
        moduleId: applicabilityModule.id,
        code: "affectedness_check",
        versionLabel: "2026-v1",
        status: "published",
        rules: nis2ScopeRuleSet,
        publishedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [ruleSets.moduleId, ruleSets.code, ruleSets.versionLabel],
        set: {
          status: "published",
          rules: nis2ScopeRuleSet,
          publishedAt: new Date(),
        },
      });

    console.log(
      `Seeded NIS2 scope checker with ${nis2Questions.length} questions and ${nis2ScopeRuleSet.entityTypes.length} exact entity types.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
