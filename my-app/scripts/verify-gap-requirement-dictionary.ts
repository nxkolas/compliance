import "dotenv/config";

import postgres from "postgres";
import { closeDatabaseConnection } from "@/src/server/database-lifecycle";
import { getActiveGapAnalysisRelease } from "@/src/server/gap-analysis";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(databaseUrl, { prepare: false });

type RequirementRow = {
  requirement_version_id: string;
  code: string;
  title_content_revision_id: string;
  requirement_text_content_revision_id: string;
  title_locales: string[];
  requirement_text_locales: string[];
  title_values: Record<string, string>;
  requirement_text_values: Record<string, string>;
  title_values_non_empty: boolean;
  requirement_text_values_non_empty: boolean;
};

async function main() {
  const columns = await sql<
    { column_name: string; is_nullable: "YES" | "NO" }[]
  >`
    select column_name, is_nullable
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'gap_requirement_versions'
      and column_name in (
        'title',
        'requirement_text',
        'title_content_revision_id',
        'requirement_text_content_revision_id'
      )
  `;
  assert(
    !columns.some((column) =>
      ["title", "requirement_text"].includes(column.column_name),
    ),
    "Legacy Gap requirement title/text JSON columns still exist",
  );
  for (const columnName of [
    "title_content_revision_id",
    "requirement_text_content_revision_id",
  ]) {
    assert(
      columns.some(
        (column) =>
          column.column_name === columnName && column.is_nullable === "NO",
      ),
      `Required Gap requirement column ${columnName} is missing or nullable`,
    );
  }

  const foreignKeys = await sql<
    { constraint_name: string; delete_action: string }[]
  >`
    select constraint_name, delete_rule as delete_action
    from information_schema.referential_constraints
    where constraint_schema = 'public'
      and constraint_name in (
        'gap_requirement_versions_title_content_fk',
        'gap_requirement_versions_requirement_text_content_fk'
      )
    order by constraint_name
  `;
  assert(foreignKeys.length === 2, "Gap requirement content foreign keys are missing");
  for (const foreignKey of foreignKeys) {
    assert(
      foreignKey.delete_action === "RESTRICT",
      `${foreignKey.constraint_name} does not use ON DELETE RESTRICT`,
    );
  }

  const requirements = await sql<RequirementRow[]>`
    with active_requirements as (
      select requirement_version.id as requirement_version_id,
        requirement.code,
        requirement_version.title_content_revision_id,
        requirement_version.requirement_text_content_revision_id
      from active_gap_analysis_releases active
      join gap_analysis_releases release
        on release.id = active.gap_analysis_release_id
      join gap_requirement_set_members member
        on member.requirement_set_version_id = release.requirement_set_version_id
      join gap_requirement_versions requirement_version
        on requirement_version.id = member.requirement_version_id
      join gap_requirements requirement
        on requirement.id = requirement_version.requirement_id
      where active.release_code = 'nis2-gap'
    )
    select active.requirement_version_id,
      active.code,
      active.title_content_revision_id,
      active.requirement_text_content_revision_id,
      array_remove(
        array_agg(distinct title.locale order by title.locale),
        null
      ) as title_locales,
      array_remove(
        array_agg(
          distinct requirement_text.locale
          order by requirement_text.locale
        ),
        null
      ) as requirement_text_locales,
      coalesce(
        jsonb_object_agg(title.locale, title.value)
          filter (where title.locale is not null),
        '{}'::jsonb
      ) as title_values,
      coalesce(
        jsonb_object_agg(requirement_text.locale, requirement_text.value)
          filter (where requirement_text.locale is not null),
        '{}'::jsonb
      ) as requirement_text_values,
      coalesce(
        bool_and(length(trim(title.value)) > 0),
        false
      ) as title_values_non_empty,
      coalesce(
        bool_and(length(trim(requirement_text.value)) > 0),
        false
      ) as requirement_text_values_non_empty
    from active_requirements active
    left join content_translations title
      on title.content_revision_id = active.title_content_revision_id
    left join content_translations requirement_text
      on requirement_text.content_revision_id =
        active.requirement_text_content_revision_id
    group by active.requirement_version_id,
      active.code,
      active.title_content_revision_id,
      active.requirement_text_content_revision_id
    order by active.code
  `;
  assert(requirements.length > 0, "The active Gap release has no requirements");
  for (const requirement of requirements) {
    assert(
      requirement.title_content_revision_id &&
        requirement.requirement_text_content_revision_id,
      `Requirement ${requirement.code} is missing a content revision pin`,
    );
    assertExactlyBilingual(
      requirement.title_locales,
      requirement.title_values_non_empty,
      `${requirement.code} title`,
    );
    assertExactlyBilingual(
      requirement.requirement_text_locales,
      requirement.requirement_text_values_non_empty,
      `${requirement.code} text`,
    );
  }

  const [german, english] = await Promise.all([
    getActiveGapAnalysisRelease("nis2-gap", "de"),
    getActiveGapAnalysisRelease("nis2-gap", "en"),
  ]);
  assert(german && english, "The active Gap release did not load bilingually");
  const germanById = new Map(
    german.requirements.map((requirement) => [requirement.id, requirement]),
  );
  const englishById = new Map(
    english.requirements.map((requirement) => [requirement.id, requirement]),
  );
  for (const row of requirements) {
    const germanRequirement = germanById.get(row.requirement_version_id);
    const englishRequirement = englishById.get(row.requirement_version_id);
    assert(
      germanRequirement && englishRequirement,
      `Requirement ${row.code} is absent from a localized release load`,
    );
    assert(
      germanRequirement.title === row.title_values.de &&
        englishRequirement.title === row.title_values.en,
      `Requirement ${row.code} title did not resolve from its exact pinned translations`,
    );
    assert(
      germanRequirement.requirementText === row.requirement_text_values.de &&
        englishRequirement.requirementText === row.requirement_text_values.en,
      `Requirement ${row.code} text did not resolve from its exact pinned translations`,
    );
  }

  console.log(
    JSON.stringify(
      {
        activeReleaseId: german.id,
        requirements: requirements.map((row) => ({
          id: row.requirement_version_id,
          code: row.code,
          titleContentRevisionId: row.title_content_revision_id,
          requirementTextContentRevisionId:
            row.requirement_text_content_revision_id,
        })),
      },
      null,
      2,
    ),
  );
}

function assertExactlyBilingual(
  locales: string[],
  valuesNonEmpty: boolean,
  label: string,
) {
  assert(
    JSON.stringify(locales) === JSON.stringify(["de", "en"]),
    `${label} does not have exactly de and en translations`,
  );
  assert(valuesNonEmpty, `${label} contains an empty translation`);
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
    await Promise.all([sql.end(), closeDatabaseConnection()]);
  });
