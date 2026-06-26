import "dotenv/config";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  complianceFrameworkVersions,
  complianceFrameworks,
  complianceModules,
  organizationFactDefinitions,
  questionFactMappings,
  questionOptions,
  questionnaireVersions,
  questionnaires,
  questions,
} from "../src/db/schema";

const databaseUrl = process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DRIZZLE_DATABASE_URL or DATABASE_URL is required");
}

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to seed production DB");
}

const client = postgres(databaseUrl, {
  prepare: false,
});
const db = drizzle(client);

const factDefinitions: Array<
  typeof organizationFactDefinitions.$inferInsert
> = [
  {
    key: "employee_count_bucket",
    label: "Employee count bucket",
    dataType: "enum",
    description: "Reusable company-size bucket derived from assessment input.",
  },
  {
    key: "annual_revenue_bucket",
    label: "Annual revenue bucket",
    dataType: "enum",
    description: "Reusable annual revenue bucket derived from assessment input.",
  },
  {
    key: "balance_sheet_total_bucket",
    label: "Balance sheet total bucket",
    dataType: "enum",
    description:
      "Reusable balance sheet total bucket derived from assessment input.",
  },
  {
    key: "industry_sector",
    label: "Industry sector",
    dataType: "enum",
    description: "Primary sector used for compliance applicability checks.",
  },
  {
    key: "has_german_market_presence",
    label: "German market presence",
    dataType: "boolean",
    description: "Whether the organization has relevant activity in Germany.",
  },
  {
    key: "belongs_to_group",
    label: "Belongs to a group",
    dataType: "boolean",
    description:
      "Whether the organization should be considered as part of a corporate group.",
  },
  {
    key: "provides_critical_services",
    label: "Provides critical services",
    dataType: "boolean",
    description: "Whether the organization provides services in critical areas.",
  },
  {
    key: "provides_it_services",
    label: "Provides IT services",
    dataType: "boolean",
    description: "Whether the organization provides IT or digital services.",
  },
  {
    key: "serves_critical_customers",
    label: "Serves critical customers",
    dataType: "boolean",
    description:
      "Whether the organization serves customers in critical or regulated sectors.",
  },
  {
    key: "failure_causes_major_impact",
    label: "Failure causes major impact",
    dataType: "boolean",
    description:
      "Whether service failure could cause major operational or societal impact.",
  },
  {
    key: "processes_sensitive_data",
    label: "Processes sensitive data",
    dataType: "boolean",
    description: "Whether the organization processes sensitive or protected data.",
  },
  {
    key: "has_customer_security_evidence_requests",
    label: "Customer security evidence requests",
    dataType: "boolean",
    description:
      "Whether customers request security documentation or compliance evidence.",
  },
];

const nis2Modules: Array<typeof complianceModules.$inferInsert> = [
  {
    frameworkVersionId: "",
    code: "betroffenheitscheck",
    name: "Betroffenheitscheck",
    moduleType: "questionnaire",
    position: 10,
  },
  {
    frameworkVersionId: "",
    code: "gap_analysis",
    name: "Gap-Analyse",
    moduleType: "questionnaire",
    position: 20,
  },
  {
    frameworkVersionId: "",
    code: "action_plan",
    name: "Massnahmenplan",
    moduleType: "generated_artifact",
    position: 30,
  },
  {
    frameworkVersionId: "",
    code: "document_analysis",
    name: "Dokumentenanalyse",
    moduleType: "document_analysis",
    position: 40,
  },
];

type SeedOption = {
  stableValue: string;
  label: string;
  labelEn: string;
};

type SeedQuestion = {
  stableKey: string;
  position: number;
  questionText: string;
  questionTextEn: string;
  options: SeedOption[];
  factKey: string;
  uiControl?: "buttons" | "select";
};

const yesNoUnsureOptions: SeedOption[] = [
  { stableValue: "yes", label: "Ja", labelEn: "Yes" },
  { stableValue: "no", label: "Nein", labelEn: "No" },
  { stableValue: "unsure", label: "Unsicher", labelEn: "Unsure" },
];

const industrySectorOptions: SeedOption[] = [
  { stableValue: "energy", label: "Energie", labelEn: "Energy" },
  { stableValue: "transport", label: "Verkehr", labelEn: "Transport" },
  { stableValue: "banking", label: "Banken", labelEn: "Banking" },
  {
    stableValue: "financial_market_infrastructures",
    label: "Finanzmarktinfrastrukturen",
    labelEn: "Financial market infrastructures",
  },
  { stableValue: "health", label: "Gesundheit", labelEn: "Health" },
  {
    stableValue: "drinking_water",
    label: "Trinkwasser",
    labelEn: "Drinking water",
  },
  { stableValue: "waste_water", label: "Abwasser", labelEn: "Waste water" },
  {
    stableValue: "digital_infrastructure",
    label: "Digitale Infrastruktur",
    labelEn: "Digital infrastructure",
  },
  {
    stableValue: "ict_service_management",
    label: "ICT-Service-Management",
    labelEn: "ICT service management",
  },
  {
    stableValue: "public_administration",
    label: "Öffentliche Verwaltung",
    labelEn: "Public administration",
  },
  { stableValue: "space", label: "Weltraum", labelEn: "Space" },
  {
    stableValue: "postal_courier",
    label: "Post- und Kurierdienste",
    labelEn: "Postal and courier services",
  },
  {
    stableValue: "waste_management",
    label: "Abfallwirtschaft",
    labelEn: "Waste management",
  },
  {
    stableValue: "chemicals",
    label: "Chemikalien",
    labelEn: "Chemicals",
  },
  {
    stableValue: "food",
    label: "Lebensmittel",
    labelEn: "Food",
  },
  {
    stableValue: "manufacturing",
    label: "Verarbeitendes Gewerbe",
    labelEn: "Manufacturing",
  },
  {
    stableValue: "digital_providers",
    label: "Digitale Anbieter",
    labelEn: "Digital providers",
  },
  { stableValue: "research", label: "Forschung", labelEn: "Research" },
  { stableValue: "other", label: "Andere Branche", labelEn: "Other sector" },
  { stableValue: "unsure", label: "Unsicher", labelEn: "Unsure" },
];

const betroffenheitscheckQuestions: SeedQuestion[] = [
  {
    stableKey: "bc.german_market_presence",
    position: 1,
    questionText:
      "Hat Ihr Unternehmen seinen Sitz in Deutschland oder bietet es Dienstleistungen in Deutschland an?",
    questionTextEn:
      "Is your company based in Germany or does it offer services in Germany?",
    options: yesNoUnsureOptions,
    factKey: "has_german_market_presence",
  },
  {
    stableKey: "bc.employee_count",
    position: 2,
    questionText: "Wie viele Mitarbeitende hat Ihr Unternehmen ungefähr?",
    questionTextEn: "Approximately how many employees does your company have?",
    options: [
      {
        stableValue: "under_50",
        label: "Unter 50",
        labelEn: "Fewer than 50",
      },
      { stableValue: "50_249", label: "50-249", labelEn: "50-249" },
      {
        stableValue: "250_plus",
        label: "250 oder mehr",
        labelEn: "250 or more",
      },
      { stableValue: "unsure", label: "Unsicher", labelEn: "Unsure" },
    ],
    factKey: "employee_count_bucket",
  },
  {
    stableKey: "bc.annual_revenue",
    position: 3,
    questionText: "Wie hoch ist Ihr Jahresumsatz ungefähr?",
    questionTextEn: "Approximately how high is your annual revenue?",
    options: [
      {
        stableValue: "revenue_under_10m",
        label: "Unter 10 Mio. €",
        labelEn: "Less than EUR 10 million",
      },
      {
        stableValue: "revenue_10m_50m",
        label: "10–50 Mio. €",
        labelEn: "EUR 10-50 million",
      },
      {
        stableValue: "revenue_over_50m",
        label: "Über 50 Mio. €",
        labelEn: "More than EUR 50 million",
      },
      { stableValue: "unsure", label: "Unsicher", labelEn: "Unsure" },
    ],
    factKey: "annual_revenue_bucket",
  },
  {
    stableKey: "bc.balance_sheet_total",
    position: 4,
    questionText:
      "Wie hoch ist die Bilanzsumme Ihres Unternehmens ungefähr?",
    questionTextEn:
      "Approximately how high is your company's balance sheet total?",
    options: [
      {
        stableValue: "balance_under_10m",
        label: "Unter 10 Mio. €",
        labelEn: "Less than EUR 10 million",
      },
      {
        stableValue: "balance_10m_43m",
        label: "10–43 Mio. €",
        labelEn: "EUR 10-43 million",
      },
      {
        stableValue: "balance_over_43m",
        label: "Über 43 Mio. €",
        labelEn: "More than EUR 43 million",
      },
      { stableValue: "unsure", label: "Unsicher", labelEn: "Unsure" },
    ],
    factKey: "balance_sheet_total_bucket",
  },
  {
    stableKey: "bc.belongs_to_group",
    position: 5,
    questionText:
      "Gehört Ihr Unternehmen zu einem größeren Konzern oder einer Unternehmensgruppe?",
    questionTextEn:
      "Does your company belong to a larger corporation or corporate group?",
    options: yesNoUnsureOptions,
    factKey: "belongs_to_group",
  },
  {
    stableKey: "bc.industry_sector",
    position: 6,
    questionText: "In welchem Bereich arbeitet Ihr Unternehmen hauptsächlich?",
    questionTextEn: "In which sector does your company mainly operate?",
    options: industrySectorOptions,
    factKey: "industry_sector",
    uiControl: "select",
  },
  {
    stableKey: "bc.critical_services",
    position: 7,
    questionText:
      "Versorgt Ihr Unternehmen viele Menschen oder andere Unternehmen mit wichtigen Leistungen? Zum Beispiel Energie, Wasser, Gesundheit, Verkehr, IT oder Lebensmittel.",
    questionTextEn:
      "Does your company provide important services to many people or other companies, such as energy, water, health, transport, IT, or food?",
    options: yesNoUnsureOptions,
    factKey: "provides_critical_services",
  },
  {
    stableKey: "bc.it_services",
    position: 8,
    questionText:
      "Bietet Ihr Unternehmen IT-Dienstleistungen an? Zum Beispiel Cloud, Rechenzentrum, Software, IT-Support, Cybersecurity, Netzwerkbetrieb oder Hosting.",
    questionTextEn:
      "Does your company provide IT services, such as cloud, data centre, software, IT support, cybersecurity, network operations, or hosting?",
    options: yesNoUnsureOptions,
    factKey: "provides_it_services",
  },
  {
    stableKey: "bc.critical_customers",
    position: 9,
    questionText:
      "Arbeitet Ihr Unternehmen für Kunden aus wichtigen Bereichen wie Gesundheit, Energie, Wasser, Verkehr, Banken, Behörden oder Lebensmittelversorgung?",
    questionTextEn:
      "Does your company work for customers in important sectors such as health, energy, water, transport, banking, public authorities, or food supply?",
    options: yesNoUnsureOptions,
    factKey: "serves_critical_customers",
  },
  {
    stableKey: "bc.failure_impact",
    position: 10,
    questionText:
      "Könnte ein Ausfall Ihres Unternehmens größere Probleme bei Kunden, Bürgern oder der Versorgung verursachen?",
    questionTextEn:
      "Could an outage at your company cause major problems for customers, citizens, or supply?",
    options: yesNoUnsureOptions,
    factKey: "failure_causes_major_impact",
  },
  {
    stableKey: "bc.sensitive_data",
    position: 11,
    questionText:
      "Verarbeitet Ihr Unternehmen viele sensible Daten? Zum Beispiel Gesundheitsdaten, Kundendaten, Zahlungsdaten oder interne Daten anderer Unternehmen.",
    questionTextEn:
      "Does your company process a lot of sensitive data, such as health data, customer data, payment data, or internal data from other companies?",
    options: yesNoUnsureOptions,
    factKey: "processes_sensitive_data",
  },
  {
    stableKey: "bc.security_evidence_requested",
    position: 12,
    questionText:
      "Wurden Sie von Kunden schon nach Nachweisen zur IT-Sicherheit gefragt? Zum Beispiel ISO 27001, BSI-Grundschutz, Sicherheitskonzept oder Notfallplan.",
    questionTextEn:
      "Have customers already asked you for IT security evidence, such as ISO 27001, BSI baseline protection, a security concept, or an emergency plan?",
    options: yesNoUnsureOptions,
    factKey: "has_customer_security_evidence_requests",
  },
];

async function main() {
  try {
    for (const definition of factDefinitions) {
      await db
        .insert(organizationFactDefinitions)
        .values(definition)
        .onConflictDoUpdate({
          target: organizationFactDefinitions.key,
          set: {
            label: definition.label,
            dataType: definition.dataType,
            description: definition.description,
          },
        });
    }

    const [framework] = await db
      .insert(complianceFrameworks)
      .values({
        code: "nis2",
        name: "NIS2",
        description:
          "NIS2 compliance framework used by the current product workflow.",
      })
      .onConflictDoUpdate({
        target: complianceFrameworks.code,
        set: {
          name: "NIS2",
          description:
            "NIS2 compliance framework used by the current product workflow.",
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
        set: {
          status: "published",
          effectiveFrom: null,
          effectiveTo: null,
        },
      })
      .returning();

    let betroffenheitscheckModule:
      | typeof complianceModules.$inferSelect
      | undefined;

    for (const nis2Module of nis2Modules) {
      const moduleValues = {
        ...nis2Module,
        frameworkVersionId: frameworkVersion.id,
      };

      const [module] = await db
        .insert(complianceModules)
        .values(moduleValues)
        .onConflictDoUpdate({
          target: [complianceModules.frameworkVersionId, complianceModules.code],
          set: {
            name: moduleValues.name,
            moduleType: moduleValues.moduleType,
            position: moduleValues.position,
          },
        })
        .returning();

      if (module.code === "betroffenheitscheck") {
        betroffenheitscheckModule = module;
      }
    }

    if (!betroffenheitscheckModule) {
      throw new Error("NIS2 betroffenheitscheck module was not seeded");
    }

    const [questionnaire] = await db
      .insert(questionnaires)
      .values({
        moduleId: betroffenheitscheckModule.id,
        code: "betroffenheitscheck",
        title: "NIS2 Betroffenheitscheck",
      })
      .onConflictDoUpdate({
        target: [questionnaires.moduleId, questionnaires.code],
        set: {
          title: "NIS2 Betroffenheitscheck",
        },
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
        set: {
          status: "published",
        },
      })
      .returning();

    for (const seedQuestion of betroffenheitscheckQuestions) {
      const [question] = await db
        .insert(questions)
        .values({
          questionnaireVersionId: questionnaireVersion.id,
          stableKey: seedQuestion.stableKey,
          position: seedQuestion.position,
          questionText: seedQuestion.questionText,
          answerType: "single_choice",
          required: true,
          config: {
            ui: {
              control: seedQuestion.uiControl ?? "buttons",
            },
            translations: {
              en: {
                questionText: seedQuestion.questionTextEn,
              },
            },
          },
        })
        .onConflictDoUpdate({
          target: [questions.questionnaireVersionId, questions.stableKey],
          set: {
            position: seedQuestion.position,
            questionText: seedQuestion.questionText,
            helpText: null,
            answerType: "single_choice",
            required: true,
            config: {
              ui: {
                control: seedQuestion.uiControl ?? "buttons",
              },
              translations: {
                en: {
                  questionText: seedQuestion.questionTextEn,
                },
              },
            },
          },
        })
        .returning();

      for (const [optionIndex, option] of seedQuestion.options.entries()) {
        await db
          .insert(questionOptions)
          .values({
            questionId: question.id,
            stableValue: option.stableValue,
            label: option.label,
            position: optionIndex + 1,
            metadata: {
              translations: {
                en: {
                  label: option.labelEn,
                },
              },
            },
          })
          .onConflictDoUpdate({
            target: [questionOptions.questionId, questionOptions.stableValue],
            set: {
              label: option.label,
              position: optionIndex + 1,
              metadata: {
                translations: {
                  en: {
                    label: option.labelEn,
                  },
                },
              },
            },
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
          target: [
            questionFactMappings.questionId,
            questionFactMappings.factKey,
          ],
          set: {
            transform: { type: "identity" },
          },
        });
    }

    console.log(
      "Seeded NIS2 framework, modules, organization facts, and Betroffenheitscheck questionnaire.",
    );
    console.log(
      "Skipped organization_fact_values because values require an organization and source revision.",
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
