# Database Structure

This document describes the current organization, compliance-foundation, and
questionnaire-definition database model. Supabase Auth remains the source of
truth for users. The app-owned public schema stores organizations,
memberships, invitations, organization facts, the NIS2 framework/module
registry, and the versioned questionnaire definitions used by the current
Betroffenheitscheck preview.

The remaining assessment, answer, generated artifact, document, and audit-event
schema is still planned separately in `docs/architecture/db-schema-plan.md`.

## Workflow

The TypeScript schema in `src/db/schema.ts` is the source of truth. Apply schema
changes with:

```bash
npm run db:push
```

This project uses Drizzle Kit's push workflow and does not track generated SQL
migrations. The Drizzle config manages only these app tables:

- `organizations`
- `organization_memberships`
- `organization_invitations`
- `organization_fact_definitions`
- `organization_fact_values`
- `compliance_frameworks`
- `compliance_framework_versions`
- `compliance_modules`
- `questionnaires`
- `questionnaire_versions`
- `questions`
- `question_options`
- `question_fact_mappings`

To seed the NIS2 framework, initial NIS2 modules, reusable organization fact
definitions, and the published NIS2 Betroffenheitscheck questionnaire:

```bash
npm run db:seed:compliance
```

The seed creates:

- The `nis2` compliance framework.
- The published `2026-v1` framework version.
- Four NIS2 modules: `betroffenheitscheck`, `gap_analysis`, `action_plan`, and
  `document_analysis`.
- Reusable organization fact definitions.
- The published `2026-v1` `betroffenheitscheck` questionnaire.
- Twelve single-choice Betroffenheitscheck questions, their options, and
  identity mappings to organization facts.

The seed intentionally skips `organization_fact_values`, because values require
a real organization and source revision from an assessment or artifact.

To clear Drizzle-managed app tables in development:

```bash
DB_CLEAR_CONFIRM=clear-app-tables npm run db:clear
```

To discard old development app data and reset to the org-only v1 schema:

```bash
DB_CLEAR_CONFIRM=clear-app-tables npm run db:reset
```

`db:reset` first drops known legacy app tables and enum types from the previous
schema, then runs `db:push`, then clears the current app tables.

Do not clear or mutate Supabase Auth tables as part of this app reset.

## Tables

### `organizations`

Stores stable organization identity data.

Columns:

- `id`: Primary key.
- `name`: Display name.
- `legal_name`: Optional legal name.
- `country`: Two-letter country code, defaults to `DE`.
- `created_at`, `updated_at`: Audit timestamps.

### `organization_memberships`

Connects Supabase Auth users to organizations.

Columns:

- `id`: Primary key.
- `organization_id`: Organization.
- `user_id`: Supabase Auth user UUID.
- `role`: `owner`, `admin`, `member`, or `auditor`.
- `status`: `active` or `suspended`.
- `created_at`, `updated_at`: Audit timestamps.

Constraints:

- A user can only have one membership per organization.
- Deleting an organization cascades its memberships.

### `organization_invitations`

Stores pending and historical invitations.

Columns:

- `id`: Primary key.
- `organization_id`: Organization.
- `email`: Invited email address.
- `role`: Role granted on acceptance; only `admin`, `member`, and `auditor` are assignable through invitations.
- `invited_by_user_id`: Supabase Auth user UUID of the inviter.
- `accepted_by_user_id`: Supabase Auth user UUID of the accepting user.
- `token_hash`: SHA-256 hash of the one-time invitation token.
- `status`: `pending`, `accepted`, `revoked`, or `expired`.
- `expires_at`, `accepted_at`: Invitation lifecycle timestamps.
- `created_at`, `updated_at`: Audit timestamps.

The raw token is returned only when an invitation is created. Accept endpoints
hash the submitted token and compare it with `token_hash`.

### `organization_fact_definitions`

Defines stable semantic organization facts that can be reused across
questionnaires and generated artifacts.

Columns:

- `key`: Primary key such as `employee_count_bucket`.
- `label`: Human-readable label.
- `data_type`: `text`, `number`, `boolean`, `enum`, or `json`.
- `description`: Optional explanation of the fact.
- `created_at`: Audit timestamp.

### `organization_fact_values`

Stores current and historical organization-specific fact values derived from
versioned sources.

Columns:

- `id`: Primary key.
- `organization_id`: Organization.
- `fact_key`: Fact definition key.
- `value`: JSON value.
- `source_type`: Source category such as an assessment revision.
- `source_revision_id`: Exact source revision UUID.
- `confidence`: Optional confidence score.
- `is_current`: Marks the current value for a fact.
- `created_at`: Audit timestamp.

Current fact lookups are indexed by `organization_id` and `fact_key`; JSON
values also have a GIN index for later filtering.

### `compliance_frameworks`

Stores compliance framework identities. The current product seed creates only
the `nis2` framework.

Columns:

- `id`: Primary key.
- `code`: Stable unique code such as `nis2`.
- `name`: Display name.
- `description`: Optional description.
- `created_at`: Audit timestamp.

### `compliance_framework_versions`

Stores versioned framework releases for modules and questionnaire definitions.

Columns:

- `id`: Primary key.
- `framework_id`: Framework.
- `version_label`: Version label such as `2026-v1`.
- `status`: `draft`, `published`, or `archived`.
- `effective_from`, `effective_to`: Optional validity dates.
- `created_at`: Audit timestamp.

### `compliance_modules`

Stores modules attached to a specific framework version.

Columns:

- `id`: Primary key.
- `framework_version_id`: Framework version.
- `code`: Stable module code.
- `name`: Display name.
- `module_type`: `questionnaire`, `generated_artifact`, or `document_analysis`.
- `position`: Sort order.

### `questionnaires`

Stores questionnaire identities attached to a module. The current seed creates
one questionnaire: `betroffenheitscheck` for the NIS2 Betroffenheitscheck
module.

Columns:

- `id`: Primary key.
- `module_id`: Parent compliance module.
- `code`: Stable questionnaire code.
- `title`: Display title.
- `created_at`: Audit timestamp.

Constraints:

- A module can only have one questionnaire with a given `code`.
- Deleting a module cascades its questionnaires.

### `questionnaire_versions`

Stores immutable questionnaire releases. The active Betroffenheitscheck uses
the same `2026-v1` label as the seeded NIS2 framework version.

Columns:

- `id`: Primary key.
- `questionnaire_id`: Parent questionnaire.
- `version_label`: Stable version label such as `2026-v1`.
- `status`: `draft`, `published`, or `archived`.
- `created_at`, `published_at`: Version lifecycle timestamps.

Constraints:

- A questionnaire can only have one version with a given `version_label`.
- Deleting a questionnaire cascades its versions.

### `questions`

Stores versioned question definitions.

Columns:

- `id`: Primary key.
- `questionnaire_version_id`: Parent questionnaire version.
- `stable_key`: Stable semantic key such as `bc.employee_count`.
- `position`: Sort order within the questionnaire version.
- `question_text`: Default display text.
- `help_text`: Optional help copy.
- `answer_type`: `single_choice`, `multi_choice`, `text`, `long_text`,
  `number`, `boolean`, `date`, `file`, or `json`.
- `required`: Marks whether the question is required.
- `config`: JSON configuration for UI hints and translations.
- `created_at`: Audit timestamp.

Constraints:

- A questionnaire version can only have one question with a given
  `stable_key`.
- Deleting a questionnaire version cascades its questions.

The seeded Betroffenheitscheck stores English translations in
`config.translations.en.questionText`. It also stores `config.ui.control`; the
industry-sector question is seeded with `select`, while the other questions use
button-style choices.

### `question_options`

Stores options for choice-based questions.

Columns:

- `id`: Primary key.
- `question_id`: Parent question.
- `stable_value`: Stable answer value such as `yes`, `no`, `unsure`, or
  `50_249`.
- `label`: Default display label.
- `position`: Sort order within the question.
- `metadata`: JSON metadata, currently used for English option labels.

Constraints:

- A question can only have one option with a given `stable_value`.
- Deleting a question cascades its options.

### `question_fact_mappings`

Maps versioned questions to stable organization fact definitions.

Columns:

- `id`: Primary key.
- `question_id`: Source question.
- `fact_key`: Target organization fact definition key.
- `transform`: JSON transform rule. The current seed uses
  `{ "type": "identity" }`.
- `created_at`: Audit timestamp.

Constraints:

- A question can only map once to a given fact key.
- Deleting a question cascades its fact mappings.

These mappings let the Betroffenheitscheck wording, options, or version change
without changing the internal organization fact keys.

## Common Queries

List organizations for the current user:

```ts
const memberships = await db.query.organizationMemberships.findMany({
  where: and(
    eq(organizationMemberships.userId, user.id),
    eq(organizationMemberships.status, "active"),
  ),
  with: { organization: true },
});
```

Create an organization with an owner membership:

```ts
const organization = await db.transaction(async (tx) => {
  const [created] = await tx
    .insert(organizations)
    .values({
      name: "Example GmbH",
      legalName: "Example GmbH",
      country: "DE",
    })
    .returning();

  await tx.insert(organizationMemberships).values({
    organizationId: created.id,
    userId: user.id,
    role: "owner",
    status: "active",
  });

  return created;
});
```

Load the active NIS2 Betroffenheitscheck questionnaire preview:

```ts
const questionnaire = await getActiveApplicabilityQuestionnaire();
```

The service reads the published `nis2` `2026-v1` framework version, the
`betroffenheitscheck` module, the `betroffenheitscheck` questionnaire, its
published `2026-v1` questionnaire version, ordered questions, and ordered
options.

## Current Placeholders

The old compliance, guest assessment, AI chat, document review, and export data
tables have been removed from the active schema. The Betroffenheitscheck page
now renders the seeded questionnaire definition as an interactive preview, but
it does not yet persist assessment instances or answers. Other compliance pages
remain static placeholders while the versioned assessment, answer, artifact,
document, and audit-event tables are introduced later.
