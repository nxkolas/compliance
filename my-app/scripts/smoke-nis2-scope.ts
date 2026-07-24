import "dotenv/config";

import postgres from "postgres";
import {
  evaluateRuleSet,
  getApplicabilityQuestionnaireForGuest,
  submitApplicabilityCheckForGuest,
} from "@/src/server/applicability-check";
import type { ApplicabilityAnswerValue } from "@/src/server/applicability-check";
import { directRuntimeReleaseReader } from "@/src/server/compliance";

const databaseUrl = process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DRIZZLE_DATABASE_URL or DATABASE_URL is required");
}

const sql = postgres(databaseUrl, { prepare: false });
const smokeGuestIds: string[] = [];

async function main() {
  try {
    const [counts] = await sql<{
      questions: number;
      options: number;
    }[]>`
      select
        (select count(*)::int from questions q where q.questionnaire_version_id = r.questionnaire_version_id) as questions,
        (select count(*)::int from question_options qo join questions q on q.id = qo.question_id where q.questionnaire_version_id = r.questionnaire_version_id) as options
      from active_compliance_check_releases a
      join compliance_check_releases r on r.id = a.check_release_id
      where a.check_code = 'nis2_applicability'
    `;
    const [row] = await sql<{ rules: unknown }[]>`
      select rs.rules
      from active_compliance_check_releases a
      join compliance_check_releases r on r.id = a.check_release_id
      join rule_sets rs on rs.id = r.rule_set_id
      where a.check_code = 'nis2_applicability'
        and rs.status = 'published'
    `;

    if (!row) {
      throw new Error("Published affectedness_check rule set is missing");
    }

    const questionRows = await sql<{ id: string; stableKey: string }[]>`
      select q.id, q.stable_key as "stableKey"
      from active_compliance_check_releases a
      join compliance_check_releases r on r.id = a.check_release_id
      join questions q on q.questionnaire_version_id = r.questionnaire_version_id
      where a.check_code = 'nis2_applicability'
      order by q.position
    `;
    const questionIdByStableKey = new Map(
      questionRows.map((question) => [question.stableKey, question.id]),
    );

    const baseFacts = {
      eu_activity: "yes",
      jurisdiction_country: "DE",
      jurisdiction_basis: "de_establishment",
      member_state_designation: "none",
      employee_count_bucket: "under_50",
      annual_revenue_bucket: "revenue_at_most_10m",
      balance_sheet_total_bucket: "balance_at_most_10m",
      sme_figures_verified: "verified_de_without_it_exception",
      sector_specific_regime: "none",
      serves_critical_customers: "no",
      has_customer_security_evidence_requests: "no",
    };
    const fixtures = [
      {
        ...baseFacts,
        jurisdiction_basis: "de_main_eu_establishment",
        nis2_entity_types: ["de_bsig_dns_service_provider"],
      },
      {
        ...baseFacts,
        nis2_entity_types: ["de_bsig_electricity_supplier"],
        employee_count_bucket: "50_249",
      },
      { ...baseFacts, nis2_entity_types: ["none_of_these"] },
      {
        ...baseFacts,
        jurisdiction_basis: "de_main_eu_establishment",
        nis2_entity_types: ["de_bsig_domain_name_registry_service_provider"],
      },
    ];
    const outcomes = fixtures.map(
      (facts) => evaluateRuleSet(row.rules, { facts }).outcome,
    );
    const expected = [
      "essential_entity",
      "important_entity",
      "not_directly_in_scope",
      "clarification_required",
    ];

    if (JSON.stringify(outcomes) !== JSON.stringify(expected)) {
      throw new Error(
        `Unexpected smoke-test outcomes: ${JSON.stringify(outcomes)}`,
      );
    }

    const submissionOutcomes: string[] = [];
    const stableKeyByFactKey: Record<string, string> = {
      eu_activity: "bc.eu_activity",
      jurisdiction_country: "bc.jurisdiction_country",
      jurisdiction_basis: "bc.jurisdiction_basis",
      nis2_entity_types: "bc.entity_types",
      member_state_designation: "bc.member_state_designation",
      employee_count_bucket: "bc.employee_count",
      annual_revenue_bucket: "bc.annual_revenue",
      balance_sheet_total_bucket: "bc.balance_sheet_total",
      sme_figures_verified: "bc.sme_figures_verified",
      sector_specific_regime: "bc.sector_specific_regime",
      serves_critical_customers: "bc.critical_customers",
      has_customer_security_evidence_requests:
        "bc.security_evidence_requested",
    };
    for (const fixture of fixtures) {
      const questionnaire = await getApplicabilityQuestionnaireForGuest("en", {
        runtimeReleaseReader: directRuntimeReleaseReader,
      });
      if (!questionnaire?.guestSession) {
        throw new Error("Guest questionnaire session is unavailable");
      }
      smokeGuestIds.push(questionnaire.guestSession.id);

      const answers = Object.entries(fixture).map(([stableKey, value]) => {
        const questionId = questionIdByStableKey.get(
          stableKeyByFactKey[stableKey] ?? "",
        );
        if (!questionId) {
          throw new Error(`Question for ${stableKey} is missing`);
        }

        return {
          questionId,
          value: value as ApplicabilityAnswerValue,
        };
      });
      const submission = await submitApplicabilityCheckForGuest(
        {
          answers,
          guestSession: questionnaire.guestSession,
        },
        { runtimeReleaseReader: directRuntimeReleaseReader },
      );
      submissionOutcomes.push(submission.result.result.outcome);
    }

    if (JSON.stringify(submissionOutcomes) !== JSON.stringify(expected)) {
      throw new Error(
        `Unexpected persisted submission outcomes: ${JSON.stringify(submissionOutcomes)}`,
      );
    }

    const parsedRuleSet = row.rules as {
      kind?: unknown;
      entityTypes?: unknown[];
    };
    if (
      parsedRuleSet.kind !== "nis2_scope_v3" ||
      parsedRuleSet.entityTypes?.length !== 70 ||
      counts.questions !== 12
    ) {
      throw new Error("Seeded NIS2 definition does not match expectations");
    }

    console.log(
      JSON.stringify({
        questions: counts.questions,
        options: counts.options,
        entityTypes: parsedRuleSet.entityTypes.length,
        outcomes,
        submissionOutcomes,
      }),
    );
  } finally {
    for (const id of smokeGuestIds) {
      await sql`delete from guest_applicability_checks where id = ${id}`;
    }
    await sql.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
