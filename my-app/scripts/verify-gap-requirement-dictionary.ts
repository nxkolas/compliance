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
  const releaseReference = readArgument("--release");
  if (releaseReference) {
    await verifyPublishedMappedAuthority(releaseReference);
    return;
  }
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
  assert(
    german.versionLabel === "guided-v5" &&
      german.prompt.version === "6" &&
      german.prompt.responseSchemaVersion === "6",
    "The active Gap release is not guided-v5 contract 6",
  );
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

  const missingMappedAuthority = await sql<
    {
      question_stable_key: string;
      provision_key: string;
    }[]
  >`
    with active_release as (
      select release.*
      from active_gap_analysis_releases active
      join gap_analysis_releases release
        on release.id = active.gap_analysis_release_id
      where active.release_code = 'nis2-gap'
        and release.version_label = 'guided-v5'
    ),
    mapped as (
      select question.stable_key as question_stable_key,
        mapping.legal_provision_id,
        instrument.code || '.' || provision.provision_code
          as provision_key
      from active_release release
      join questions question
        on question.questionnaire_version_id =
          release.questionnaire_version_id
      join gap_question_legal_provisions mapping
        on mapping.question_id = question.id
      join legal_provisions provision
        on provision.id = mapping.legal_provision_id
      join legal_instrument_versions instrument_version
        on instrument_version.id =
          provision.legal_instrument_version_id
      join legal_instruments instrument
        on instrument.id = instrument_version.legal_instrument_id
    )
    select mapped.question_stable_key, mapped.provision_key
    from mapped
    where not exists (
      select 1
      from active_release release
      join gap_analysis_release_corpus_releases pin
        on pin.gap_analysis_release_id = release.id
      join legal_corpus_release_members member
        on member.release_id = pin.corpus_release_id
      join legal_source_versions source_version
        on source_version.id = member.source_version_id
      join legal_sources source
        on source.id = source_version.source_id
       and source.authority_tier = 'primary_authority'
      join legal_source_renditions rendition
        on rendition.id = member.rendition_id
       and rendition.translation_status = 'official'
      join legal_source_processing_generations generation
        on generation.id = member.processing_generation_id
       and generation.state = 'reviewed'
      join legal_source_chunks chunk
        on chunk.generation_id = generation.id
      join legal_source_chunk_provisions chunk_provision
        on chunk_provision.chunk_id = chunk.id
       and chunk_provision.legal_provision_id =
          mapped.legal_provision_id
      join legal_source_chunk_embeddings embedding
        on embedding.generation_id = generation.id
       and embedding.chunk_id = chunk.id
    )
    order by mapped.question_stable_key, mapped.provision_key
  `;
  assert(
    missingMappedAuthority.length === 0,
    `Mapped primary authority coverage is incomplete: ${missingMappedAuthority
      .map(
        (row) =>
          `${row.question_stable_key}/${row.provision_key}`,
      )
      .join(", ")}`,
  );

}

async function verifyPublishedMappedAuthority(releaseReference: string) {
  const separator = releaseReference.lastIndexOf("/");
  assert(separator > 0, "Gap release must use <code>/<version>");
  const releaseCode = releaseReference.slice(0, separator);
  const versionLabel = releaseReference.slice(separator + 1);
  const releases = await sql<
    {
      id: string;
      prompt_version: string;
      response_schema_version: string;
      status: string;
      question_count: number;
      requirement_count: number;
    }[]
  >`
    select release.id,
      release.prompt_version,
      release.response_schema_version,
      release.status,
      (
        select count(*)::int
        from questions question
        where question.questionnaire_version_id =
          release.questionnaire_version_id
      ) as question_count,
      (
        select count(*)::int
        from gap_requirement_set_members member
        where member.requirement_set_version_id =
          release.requirement_set_version_id
      ) as requirement_count
    from gap_analysis_releases release
    where release.release_code = ${releaseCode}
      and release.version_label = ${versionLabel}
  `;
  const release = releases[0];
  assert(release, `Published Gap release ${releaseReference} is missing`);
  assert(
    release.status === "published" &&
      release.prompt_version === "6" &&
      release.response_schema_version === "6" &&
      release.question_count === 31 &&
      release.requirement_count === 10,
    `Published Gap release ${releaseReference} does not match guided-v5 contract 6`,
  );
  const missing = await sql<
    { question_stable_key: string; provision_key: string }[]
  >`
    with mapped as (
      select question.stable_key as question_stable_key,
        mapping.legal_provision_id,
        instrument.code || '.' || provision.provision_code
          as provision_key
      from gap_analysis_releases release
      join questions question
        on question.questionnaire_version_id =
          release.questionnaire_version_id
      join gap_question_legal_provisions mapping
        on mapping.question_id = question.id
      join legal_provisions provision
        on provision.id = mapping.legal_provision_id
      join legal_instrument_versions instrument_version
        on instrument_version.id =
          provision.legal_instrument_version_id
      join legal_instruments instrument
        on instrument.id = instrument_version.legal_instrument_id
      where release.id = ${release.id}
    )
    select mapped.question_stable_key, mapped.provision_key
    from mapped
    where not exists (
      select 1
      from gap_analysis_release_corpus_releases pin
      join legal_corpus_release_members member
        on member.release_id = pin.corpus_release_id
      join legal_source_versions source_version
        on source_version.id = member.source_version_id
      join legal_sources source
        on source.id = source_version.source_id
       and source.authority_tier = 'primary_authority'
      join legal_source_renditions rendition
        on rendition.id = member.rendition_id
       and rendition.translation_status = 'official'
      join legal_source_processing_generations generation
        on generation.id = member.processing_generation_id
       and generation.state = 'reviewed'
      join legal_source_chunks chunk
        on chunk.generation_id = generation.id
      join legal_source_chunk_provisions chunk_provision
        on chunk_provision.chunk_id = chunk.id
       and chunk_provision.legal_provision_id =
          mapped.legal_provision_id
      join legal_source_chunk_embeddings embedding
        on embedding.generation_id = generation.id
       and embedding.chunk_id = chunk.id
      where pin.gap_analysis_release_id = ${release.id}
    )
    order by mapped.question_stable_key, mapped.provision_key
  `;
  assert(
    missing.length === 0,
    `Mapped primary authority coverage is incomplete: ${missing
      .map(
        (row) =>
          `${row.question_stable_key}/${row.provision_key}`,
      )
      .join(", ")}`,
  );
  console.log(
    JSON.stringify(
      {
        releaseReference,
        releaseId: release.id,
        questionCount: release.question_count,
        requirementCount: release.requirement_count,
        mappedPrimaryAuthorityCoverage: "complete",
        activationReady: true,
      },
      null,
      2,
    ),
  );
}

function readArgument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
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
