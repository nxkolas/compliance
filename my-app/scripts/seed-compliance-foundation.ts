import "dotenv/config";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  complianceFrameworkVersions,
  complianceFrameworks,
  complianceModules,
  organizationFactDefinitions,
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

    for (const nis2Module of nis2Modules) {
      const moduleValues = {
        ...nis2Module,
        frameworkVersionId: frameworkVersion.id,
      };

      await db
        .insert(complianceModules)
        .values(moduleValues)
        .onConflictDoUpdate({
          target: [complianceModules.frameworkVersionId, complianceModules.code],
          set: {
            name: moduleValues.name,
            moduleType: moduleValues.moduleType,
            position: moduleValues.position,
          },
        });
    }

    console.log("Seeded NIS2 framework, modules, and organization facts.");
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
