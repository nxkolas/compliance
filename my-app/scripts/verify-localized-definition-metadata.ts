import "dotenv/config";

import postgres from "postgres";
import { closeDbConnection } from "@/src/db";
import { directRuntimeReleaseReader } from "@/src/server/compliance/runtime-release/direct-reader";
import { getActiveGapAnalysisRelease } from "@/src/server/gap-analysis/release-loader";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(databaseUrl, { prepare: false });

async function main() {
  const removedColumns = await sql<{ table_name: string; column_name: string }[]>`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and (
        (table_name = 'compliance_frameworks' and column_name in ('name', 'description'))
        or (table_name = 'compliance_modules' and column_name = 'name')
        or (table_name = 'questionnaires' and column_name = 'title')
        or (table_name = 'gap_requirement_sets' and column_name = 'title')
      )
  `;
  assert(removedColumns.length === 0, "Fixed-language definition columns still exist");

  const pinned = await sql<{
    label: string;
    content_revision_id: string;
    locales: string[];
  }[]>`
    with pinned as (
      select 'compliance.framework.name' as label,
        framework_version.name_content_revision_id as content_revision_id
      from active_compliance_check_releases active
      join compliance_check_releases release on release.id = active.check_release_id
      join compliance_modules module on module.id = release.module_id
      join compliance_framework_versions framework_version
        on framework_version.id = module.framework_version_id
      where active.check_code = 'nis2_applicability'
      union all
      select 'compliance.framework.description',
        framework_version.description_content_revision_id
      from active_compliance_check_releases active
      join compliance_check_releases release on release.id = active.check_release_id
      join compliance_modules module on module.id = release.module_id
      join compliance_framework_versions framework_version
        on framework_version.id = module.framework_version_id
      where active.check_code = 'nis2_applicability'
      union all
      select 'compliance.module.name', module.name_content_revision_id
      from active_compliance_check_releases active
      join compliance_check_releases release on release.id = active.check_release_id
      join compliance_modules module on module.id = release.module_id
      where active.check_code = 'nis2_applicability'
      union all
      select 'compliance.questionnaire.title',
        questionnaire_version.title_content_revision_id
      from active_compliance_check_releases active
      join compliance_check_releases release on release.id = active.check_release_id
      join questionnaire_versions questionnaire_version
        on questionnaire_version.id = release.questionnaire_version_id
      where active.check_code = 'nis2_applicability'
      union all
      select 'gap.module.name', module.name_content_revision_id
      from active_gap_analysis_releases active
      join gap_analysis_releases release
        on release.id = active.gap_analysis_release_id
      join compliance_modules module on module.id = release.module_id
      where active.release_code = 'nis2-gap'
      union all
      select 'gap.questionnaire.title',
        questionnaire_version.title_content_revision_id
      from active_gap_analysis_releases active
      join gap_analysis_releases release
        on release.id = active.gap_analysis_release_id
      join questionnaire_versions questionnaire_version
        on questionnaire_version.id = release.questionnaire_version_id
      where active.release_code = 'nis2-gap'
      union all
      select 'gap.requirement_set.title',
        requirement_set_version.title_content_revision_id
      from active_gap_analysis_releases active
      join gap_analysis_releases release
        on release.id = active.gap_analysis_release_id
      join gap_requirement_set_versions requirement_set_version
        on requirement_set_version.id = release.requirement_set_version_id
      where active.release_code = 'nis2-gap'
    )
    select pinned.label, pinned.content_revision_id,
      array_agg(translation.locale order by translation.locale) as locales
    from pinned
    join content_translations translation
      on translation.content_revision_id = pinned.content_revision_id
    group by pinned.label, pinned.content_revision_id
    order by pinned.label
  `;
  assert(pinned.length === 7, `Expected seven metadata pins, received ${pinned.length}`);
  for (const row of pinned) {
    assert(
      JSON.stringify(row.locales) === JSON.stringify(["de", "en"]),
      `${row.label} does not have exactly de and en translations`,
    );
  }

  const [complianceDe, complianceEn, gapDe, gapEn] = await Promise.all([
    directRuntimeReleaseReader.getActive({
      checkCode: "nis2_applicability",
      locale: "de",
    }),
    directRuntimeReleaseReader.getActive({
      checkCode: "nis2_applicability",
      locale: "en",
    }),
    getActiveGapAnalysisRelease("nis2-gap", "de"),
    getActiveGapAnalysisRelease("nis2-gap", "en"),
  ]);
  assert(complianceDe && complianceEn, "Localized compliance release did not load");
  assert(gapDe && gapEn, "Localized Gap release did not load");

  const compliance = {
    de: {
      frameworkName: complianceDe.published.frameworkName,
      frameworkDescription: complianceDe.published.frameworkDescription,
      moduleName: complianceDe.published.moduleName,
      questionnaireTitle: complianceDe.published.questionnaireTitle,
    },
    en: {
      frameworkName: complianceEn.published.frameworkName,
      frameworkDescription: complianceEn.published.frameworkDescription,
      moduleName: complianceEn.published.moduleName,
      questionnaireTitle: complianceEn.published.questionnaireTitle,
    },
  };
  const gap = {
    de: {
      moduleTitle: gapDe.moduleTitle,
      questionnaireTitle: gapDe.questionnaireTitle,
      requirementSetTitle: gapDe.requirementSetTitle,
    },
    en: {
      moduleTitle: gapEn.moduleTitle,
      questionnaireTitle: gapEn.questionnaireTitle,
      requirementSetTitle: gapEn.requirementSetTitle,
    },
  };
  assertLocalizedValues(compliance.de, compliance.en, "compliance");
  assertLocalizedValues(gap.de, gap.en, "Gap");

  console.log(JSON.stringify({ pinned, compliance, gap }, null, 2));
}

function assertLocalizedValues(
  de: Record<string, string>,
  en: Record<string, string>,
  label: string,
) {
  for (const key of Object.keys(de)) {
    assert(de[key]?.trim(), `Missing German ${label} value for ${key}`);
    assert(en[key]?.trim(), `Missing English ${label} value for ${key}`);
  }
}

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([sql.end(), closeDbConnection()]);
  });
