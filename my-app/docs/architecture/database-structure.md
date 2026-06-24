# Database Structure

This document explains the Drizzle/Supabase database model for the NIS2
Compliance Checker. The schema is defined in `src/db/schema.ts`, the database
client is exported from `src/db/index.ts`. Schema changes are applied directly
with `drizzle-kit push`.

The model is organization-centric. Almost every operational table has an
`organization_id` so future row level security policies can restrict data to the
organizations where the current Supabase Auth user is a member.

## Query Setup

Use the shared Drizzle client from `src/db/index.ts` in server-side code only.
Do not import it into client components.

```ts
import { db } from "@/src/db";
import {
  organizations,
  organizationMembers,
  selfCheckAssessments,
} from "@/src/db/schema";
```

The client uses the Supabase transaction pooler setting `prepare: false`, which
is required for the pooler mode configured by the project.

```ts
const client = postgres(process.env.DATABASE_URL!, {
  prepare: false,
});
```

## Development Reset

## Drizzle Schema Workflow

This project uses Drizzle's codebase-first push workflow, matching Option 2 in
the Drizzle migrations documentation: the TypeScript schema is the source of
truth and Drizzle pushes the diff directly to the database.

Always apply schema changes with `drizzle-kit push` through the project script:

```bash
npm run db:push
```

For Supabase, the app can use the transaction pooler at port `6543`, but
Drizzle Kit schema introspection must use the session pooler at port `5432`.
`drizzle.config.ts` converts a Supabase pooler `DATABASE_URL` from `6543` to
`5432` automatically for `db:push`. This avoids the known Drizzle Kit crash while
pulling CHECK constraints through the transaction pooler.

Do not run `drizzle-kit generate`, `drizzle-kit migrate`, or any workflow that
creates SQL migration files/snapshots under `drizzle/`. This repository does not
track generated Drizzle migration files; keep `drizzle/meta/_journal.json` empty
unless the project explicitly switches away from the push workflow.

To clear Drizzle-managed app tables in a development database, run:

```bash
DB_CLEAR_CONFIRM=clear-app-tables npm run db:clear
```

The reset script calls `drizzle-seed`'s `reset(db, schema)` with the local
Drizzle schema exports. It is intended for app tables only and refuses to run
when `NODE_ENV=production`.

## Enum Types

Enums keep frequently filtered status/category values consistent.

| Enum | Values | Purpose |
| --- | --- | --- |
| `organization_role` | `owner`, `admin`, `member`, `auditor` | Access role inside an organization. |
| `organization_size` | `micro`, `small`, `medium`, `large` | Company size classification used by the NIS2 size-cap logic. |
| `nis2_entity_category` | `not_affected`, `important`, `essential`, `special_case`, `unknown` | Self-check result. |
| `nis2_sector_criticality` | `annex_1_high_criticality`, `annex_2_other_criticality`, `not_listed` | Sector grouping for NIS2/BSIG logic. |
| `assessment_status` | `draft`, `in_review`, `completed`, `archived` | Workflow state for self-check and supplier assessments. |
| `requirement_status` | `not_started`, `planned`, `in_progress`, `implemented`, `verified`, `not_applicable` | Implementation state for TOM requirements. |
| `risk_level` | `low`, `medium`, `high`, `critical` | Shared severity/risk scale. |
| `incident_report_stage` | `early_warning_24h`, `notification_72h`, `final_report_1_month`, `progress_report` | NIS2 incident reporting stages. |
| `task_status` | `open`, `in_progress`, `done`, `blocked`, `not_applicable` | Registration/task workflow state. |
| `questionnaire_type` | `applicability_check`, `gap_analysis` | Separates Betroffenheitscheck and Gap-Analyse questionnaires. |
| `questionnaire_question_type` | `single_choice`, `multi_choice`, `number`, `money`, `boolean`, `text`, `date` | Input type for structured questionnaire questions. |
| `questionnaire_result` | `unknown`, `affected`, `possibly_affected`, `not_affected`, `action_required`, `partially_implemented`, `baseline_fulfilled` | Result labels for Betroffenheitscheck and Gap-Analyse runs. |
| `document_review_status` | `queued`, `in_progress`, `completed`, `failed` | Lifecycle for AI document review jobs. |
| `document_finding_status` | `present`, `incomplete`, `missing` | Finding result for required document content. |
| `report_export_status` | `queued`, `generating`, `ready`, `failed` | PDF export lifecycle. |
| `report_export_type` | `nis2_status_report`, `management_summary`, `advisor_package`, `internal_documentation` | Report package type. |
| `report_audience` | `management`, `external_consultant`, `internal_documentation` | Intended PDF report audience. |

## Tables

### `organizations`

Stores one company or legal entity that is being checked for NIS2 compliance.

Important columns:
- `id`: Primary key.
- `name`: Display name.
- `legal_name`: Optional full legal name.
- `industry_description`: Free-text business description.
- `employee_count`, `annual_revenue_eur`, `balance_sheet_total_eur`: Inputs for size-cap checks.
- `size`: Derived/manual company size.
- `country_code`: Defaults to `DE`.
- `created_at`, `updated_at`: Audit timestamps.

Relations:
- Has many `organization_members`.
- Has many `organization_sectors`.
- Has many `self_check_assessments`.
- Has many `organization_requirements`.
- Has many `suppliers`.
- Has many `registration_tasks`.
- Has many `security_incidents`.
- Has many `management_trainings`.

Typical use:
- Create an organization after sign-up or onboarding.
- Use `id` as the tenant key for all compliance data.

```ts
const [organization] = await db
  .insert(organizations)
  .values({
    name: "Example GmbH",
    legalName: "Example GmbH",
    employeeCount: 85,
    annualRevenueEur: "12000000.00",
    balanceSheetTotalEur: "8000000.00",
    size: "medium",
  })
  .returning();
```

### `organization_members`

Connects Supabase Auth users to organizations.

Important columns:
- `organization_id`: Organization membership belongs to.
- `user_id`: Supabase Auth user UUID.
- `role`: User role inside the organization.

Constraints:
- A user can only be added once per organization via
  `organization_members_org_user_unique`.

Typical use:
- Authorization checks.
- RLS policies later.
- MSP/multi-tenant dashboards.

```ts
await db.insert(organizationMembers).values({
  organizationId,
  userId,
  role: "owner",
});
```

### `organization_invitations`

Stores pending, accepted, revoked, and expired invitations to join an
organization.

Important columns:
- `organization_id`: Organization the invited person should join.
- `email`: Email address that is allowed to accept the invitation.
- `role`: Role granted after acceptance. Invitations intentionally do not grant
  `owner` by default.
- `invited_by_user_id`: Supabase Auth user UUID of the inviter.
- `accepted_by_user_id`: Supabase Auth user UUID of the accepting user.
- `token_hash`: SHA-256 hash of the invitation token. The raw token is only
  returned once by the create-invitation API.
- `status`: `pending`, `accepted`, `revoked`, or `expired`.
- `expires_at`: Expiration deadline.
- `accepted_at`: Set when the invitation is accepted.

Typical use:
- Owners/admins create invitations after login.
- The frontend sends the raw token to the accept endpoint.
- The backend hashes the token, validates status/expiry/email, and creates an
  `organization_members` row.

```ts
const invitation = await createOrganizationInvitation(user.id, organizationId, {
  email: "teammate@example.com",
  role: "member",
  expiresInDays: 14,
});
```

### `nis2_sectors`

Reference table for NIS2 sectors.

Important columns:
- `code`: Stable internal identifier such as `energy` or `healthcare`.
- `name`: Human-readable sector name.
- `criticality`: Whether the sector belongs to Annex 1, Annex 2, or is not listed.
- `description`: Optional explanation.

Typical use:
- Seed once with all relevant sectors.
- Use from self-check and organization profile logic.

```ts
const sectors = await db.query.nis2Sectors.findMany({
  orderBy: (sector, { asc }) => [asc(sector.name)],
});
```

### `organization_sectors`

Join table between organizations and NIS2 sectors.

Important columns:
- `organization_id`: Organization.
- `sector_id`: Matching sector.
- `is_primary`: Marks the main sector.
- `notes`: Optional explanation.

Constraints:
- One sector can only be assigned once per organization.

Typical use:
- Store all sectors selected during the self-check.
- Mark the strongest/primary sector for classification.

```ts
await db.insert(organizationSectors).values({
  organizationId,
  sectorId,
  isPrimary: true,
});
```

### `nis2_critical_services`

Reference table for critical services that can affect NIS2 applicability, such
as energy supply, healthcare services, managed IT services, or digital
infrastructure.

Important columns:
- `code`: Stable internal identifier.
- `sector_id`: Optional link to the matching NIS2 sector.
- `name`, `description`: Human-readable content for the self-check UI.

Typical use:
- Seed once with critical service options.
- Use in Betroffenheitscheck alongside sector, size, revenue, and balance sheet
  inputs.

### `organization_critical_services`

Join table between organizations and selected critical services.

Important columns:
- `organization_id`: Organization being assessed.
- `critical_service_id`: Selected reference service.
- `is_critical`: Whether the organization considers this service critical.
- `notes`: Optional explanation.

Constraints:
- One critical service can only be assigned once per organization.

### `lex_specialis_rules`

Reference table for rules that may override or modify NIS2 applicability, such
as DORA or telecom-specific regulation.

Important columns:
- `code`: Stable rule key.
- `name`: Rule name.
- `description`: Explanation of the special regulation.

Typical use:
- Seed once.
- Link matched rules to a self-check assessment.

```ts
const rules = await db.query.lexSpecialisRules.findMany();
```

### `self_check_assessments`

Stores one NIS2 applicability assessment for an organization.

Important columns:
- `organization_id`: Organization being assessed.
- `title`: Human-readable name for the assessment run.
- `performed_by_user_id`: Supabase Auth user UUID of the person who ran it.
- `status`: Draft/review/completed lifecycle.
- `category`: Final classification: not affected, important, essential, special case, or unknown.
- `size_cap_applies`: Whether size thresholds apply.
- `lex_specialis_applies`: Whether another regulation may take priority.
- `reasoning`: Human-readable explanation of the result.
- `answers`: JSON payload with questionnaire answers.
- `completed_at`: Set when status becomes `completed`.

Typical use:
- Save every self-check run for auditability.
- Keep raw answers and final result together.

```ts
const [assessment] = await db
  .insert(selfCheckAssessments)
  .values({
    organizationId,
    title: "NIS2 assessment Q2",
    performedByUserId: userId,
    status: "completed",
    category: "important",
    sizeCapApplies: true,
    lexSpecialisApplies: false,
    reasoning: "Medium organization in an Annex 2 sector.",
    answers: {
      employees: 85,
      sectorCodes: ["manufacturing"],
    },
    completedAt: new Date(),
  })
  .returning();
```

### `assessment_lex_specialis_matches`

Join table between self-check assessments and matched lex specialis rules.

Important columns:
- `assessment_id`: Self-check assessment.
- `rule_id`: Matching lex specialis rule.
- `notes`: Optional explanation.

Typical use:
- Store why DORA, TKG, or another special rule might matter.

```ts
await db.insert(assessmentLexSpecialisMatches).values({
  assessmentId,
  ruleId,
  notes: "Financial entity, DORA should be checked before final NIS2 classification.",
});
```

### Questionnaire Tables

Structured questionnaires power Betroffenheitscheck and Gap-Analyse without
hiding answers inside one opaque JSON blob.

Tables:
- `questionnaire_templates`: Versioned questionnaire definition with type
  `applicability_check` or `gap_analysis`.
- `questionnaire_sections`: Ordered section groups such as Zugriffskontrolle,
  Backup & Recovery, Incident Response, or Lieferkettensicherheit.
- `questionnaire_questions`: Ordered reusable questions with input type,
  options, help text, and optional scoring metadata.
- `questionnaire_runs`: One organization's questionnaire execution, including
  status, progress, score, result, summary, reasoning, and optional link to a
  `self_check_assessments` row.
- `questionnaire_answers`: One answer per run/question pair.

Typical use:
- Store Betroffenheitscheck answers in `questionnaire_answers`, then write the
  derived NIS2 category and explanation to `self_check_assessments`.
- Store Gap-Analyse answers and result in `questionnaire_runs`.
- Derive dashboard progress from `questionnaire_runs.progress` and answer
  counts.

```ts
const run = await db.query.questionnaireRuns.findFirst({
  where: (questionnaireRun, { eq }) => eq(questionnaireRun.id, runId),
  with: {
    template: true,
    answers: {
      with: {
        question: true,
      },
    },
  },
});
```

### `tom_areas`

Reference table for the 12 technical and organizational measure areas from
BSIG/NIS2 risk management.

Important columns:
- `bsig_number`: Number from the legal list.
- `title`: Short title.
- `description`: Explanation of the area.

Typical use:
- Seed once with all 12 TOM areas.
- Generate organization-specific requirements from this table.

```ts
const tomAreasList = await db.query.tomAreas.findMany({
  orderBy: (area, { asc }) => [asc(area.bsigNumber)],
});
```

### `organization_requirements`

Tracks one organization's implementation state for each TOM area.

Important columns:
- `organization_id`: Organization.
- `tom_area_id`: TOM area.
- `status`: Implementation state.
- `risk_level`: Risk if the area is weak or incomplete.
- `owner_user_id`: Responsible Supabase Auth user UUID.
- `current_state`: Existing measures.
- `target_state`: Desired implementation.
- `evidence_summary`: Short summary of evidence.
- `due_date`: Internal deadline.

Constraints:
- One requirement per organization and TOM area.

Typical use:
- Compliance roadmap.
- Risk-management dashboard.
- Audit preparation.

```ts
await db
  .update(organizationRequirements)
  .set({
    status: "in_progress",
    riskLevel: "high",
    currentState: "Backup exists, restore test not documented.",
    targetState: "Quarterly restore tests with evidence.",
    dueDate: "2026-03-31",
  })
  .where(eq(organizationRequirements.id, requirementId));
```

### `requirement_evidence`

Stores files, external links, and notes that prove a requirement is implemented.

Important columns:
- `requirement_id`: Requirement this evidence belongs to.
- `title`: Evidence title.
- `description`: Optional details.
- `file_path`: Supabase Storage path or internal file reference.
- `external_url`: External document or system link.
- `uploaded_by_user_id`: Supabase Auth user UUID.

Typical use:
- Attach policies, screenshots, audit reports, training certificates, or links.

```ts
await db.insert(requirementEvidence).values({
  requirementId,
  title: "Backup restore test Q1",
  filePath: "orgs/example/backup-restore-q1.pdf",
  uploadedByUserId: userId,
});
```

### `suppliers`

Stores direct suppliers and service providers for supply-chain risk management.

Important columns:
- `organization_id`: Organization that uses the supplier.
- `name`: Supplier name.
- `contact_email`: Contact address.
- `service_description`: What the supplier provides.
- `is_critical`: Whether the supplier is business/security critical.
- `risk_level`: Current risk rating.
- `last_reviewed_at`: Last supplier review date.

Typical use:
- Supply-chain overview.
- Supplier risk dashboard.
- Trigger recurring review tasks.

```ts
const criticalSuppliers = await db.query.suppliers.findMany({
  where: (supplier, { and, eq }) =>
    and(
      eq(supplier.organizationId, organizationId),
      eq(supplier.isCritical, true),
    ),
  orderBy: (supplier, { desc }) => [desc(supplier.riskLevel)],
});
```

### `supplier_assessments`

Stores one risk/security assessment for a supplier.

Important columns:
- `supplier_id`: Supplier being assessed.
- `performed_by_user_id`: Supabase Auth user UUID.
- `status`: Assessment lifecycle.
- `risk_level`: Resulting risk level.
- `answers`: JSON questionnaire answers.
- `summary`: Human-readable result.
- `completed_at`: Set when completed.

Typical use:
- Supplier questionnaires.
- Yearly review history.
- Evidence for supply-chain controls.

```ts
await db.insert(supplierAssessments).values({
  supplierId,
  performedByUserId: userId,
  status: "completed",
  riskLevel: "high",
  answers: {
    hasIso27001: false,
    hasIncidentProcess: true,
  },
  summary: "Critical hosting provider without external certification.",
  completedAt: new Date(),
});
```

### `registration_tasks`

Tracks registration workflow tasks for MUK/ELSTER and BSI portal registration.

Important columns:
- `organization_id`: Organization.
- `title`: Task title.
- `description`: Task details.
- `authority`: Example values: `MUK_ELSTER`, `BSI_PORTAL`.
- `status`: Task state.
- `due_date`: Deadline.
- `completed_at`: Completion timestamp.

Typical use:
- Registration assistant.
- Dashboard reminders.
- Audit trail for registration progress.

```ts
await db.insert(registrationTasks).values({
  organizationId,
  title: "Create MUK/ELSTER organization account",
  authority: "MUK_ELSTER",
  status: "open",
  dueDate: "2025-12-31",
});
```

### `security_incidents`

Stores security incidents relevant to NIS2 reporting duties.

Important columns:
- `organization_id`: Affected organization.
- `title`: Incident title.
- `description`: Incident summary.
- `severity`: Incident severity.
- `detected_at`: Detection timestamp.
- `resolved_at`: Resolution timestamp if available.

Typical use:
- Incident register.
- Create reporting deadlines for significant incidents.

```ts
const [incident] = await db
  .insert(securityIncidents)
  .values({
    organizationId,
    title: "Ransomware attempt on file server",
    severity: "critical",
    detectedAt: new Date(),
  })
  .returning();
```

### `incident_reports`

Tracks reports that must be sent for a security incident.

Important columns:
- `incident_id`: Incident being reported.
- `stage`: 24h warning, 72h notification, final report, or progress report.
- `due_at`: Legal/internal deadline.
- `submitted_at`: When it was submitted.
- `submitted_by_user_id`: Supabase Auth user UUID.
- `notes`: Submission notes.

Constraints:
- One report per incident and stage.

Typical use:
- Automatically create the 24h, 72h, and 1-month report records after a reportable incident is created.

```ts
await db.insert(incidentReports).values([
  {
    incidentId: incident.id,
    stage: "early_warning_24h",
    dueAt: addHours(incident.detectedAt, 24),
  },
  {
    incidentId: incident.id,
    stage: "notification_72h",
    dueAt: addHours(incident.detectedAt, 72),
  },
  {
    incidentId: incident.id,
    stage: "final_report_1_month",
    dueAt: addMonths(incident.detectedAt, 1),
  },
]);
```

### `management_trainings`

Stores cybersecurity training records for management.

Important columns:
- `organization_id`: Organization.
- `manager_user_id`: Supabase Auth user UUID if the manager is an app user.
- `title`: Training title.
- `provider`: Training provider.
- `completed_on`: Completion date.
- `valid_until`: Optional expiration/renewal date.
- `evidence_path`: Certificate or evidence path.

Typical use:
- Management dashboard.
- Proof for leadership training and oversight duties.

```ts
await db.insert(managementTrainings).values({
  organizationId,
  managerUserId: userId,
  title: "NIS2 cybersecurity management training",
  provider: "Internal Security Team",
  completedOn: "2026-01-15",
  validUntil: "2027-01-15",
  evidencePath: "orgs/example/management-training-2026.pdf",
});
```

### Document Review Tables

AI document review builds on the existing `ai_documents` and
`ai_document_chunks` RAG tables.

Tables:
- `document_requirement_types`: Seeded reference list of expected document
  types/content, for example password policy, MFA policy, incident-response
  document, and backup concept.
- `document_review_runs`: One review job for an organization and optionally one
  uploaded document/chat.
- `document_review_findings`: Requirement-level findings with status
  `present`, `incomplete`, or `missing`, evidence summary, recommendation,
  confidence, and cited chunk IDs.

Typical use:
- Upload a document through `ai_documents`.
- Create a `document_review_runs` row.
- Store one `document_review_findings` row per required document type or
  detected gap.
- Generate action-plan items from missing or incomplete findings.

### `action_plan_items`

Stores concrete next steps for the Maßnahmenplan and dashboard reminders.

Important columns:
- `organization_id`: Tenant key.
- `requirement_id`, `questionnaire_run_id`, `document_review_finding_id`,
  `document_id`: Optional links to the source that created the action.
- `title`, `description`: User-facing task text.
- `priority`: Uses the shared `risk_level` enum.
- `status`: Uses the shared `task_status` enum.
- `progress`, `due_date`, `owner_user_id`, `completed_at`: Planning and
  tracking fields.

Typical use:
- List open tasks by priority for "Was muss ich jetzt konkret tun?"
- Create tasks from Gap-Analyse results or document review findings.

### `report_exports`

Stores PDF export history and metadata.

Important columns:
- `organization_id`: Organization the report belongs to.
- `generated_by_user_id`: Supabase Auth user UUID.
- `export_type`: Status report, management summary, advisor package, or
  internal documentation.
- `audience`: Management, external consultant, or internal documentation.
- `status`, `storage_path`, `included_sections`, `summary_snapshot`,
  `error_message`, `generated_at`: Export lifecycle and audit data.

Typical use:
- Generate the PDF from current database state.
- Persist the resulting file path and a lightweight snapshot for audit history.

### Settings Tables

Company profile fields stay on `organizations`. Additional preferences are kept
in small settings tables.

Tables:
- `user_preferences`: Per-user language, notification, privacy, and UI settings.
- `organization_settings`: Organization-wide notification defaults, privacy
  choices, compliance settings, and optional retention period.

Hilfe & Glossar intentionally has no database tables. Glossary, FAQ, help text,
and tooltip content should stay static HTML/content or React components.

## Common Query Patterns

### Get Organizations for the Current User

Use `organization_members` as the access boundary. In server code, get the
current Supabase Auth user ID first, then ask Drizzle for memberships.

```ts
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { organizationMembers } from "@/src/db/schema";

const memberships = await db.query.organizationMembers.findMany({
  where: eq(organizationMembers.userId, user.id),
  with: {
    organization: true,
  },
});

const organizationsForUser = memberships.map(
  (membership) => membership.organization,
);
```

### Load a Complete Organization Dashboard

Use Drizzle relational queries when you want a nested result.

```ts
const organizationDashboard = await db.query.organizations.findFirst({
  where: (organization, { eq }) => eq(organization.id, organizationId),
  with: {
    sectors: {
      with: {
        sector: true,
      },
    },
    criticalServices: {
      with: {
        criticalService: true,
      },
    },
    selfCheckAssessments: {
      orderBy: (assessment, { desc }) => [desc(assessment.createdAt)],
      limit: 1,
    },
    questionnaireRuns: {
      orderBy: (run, { desc }) => [desc(run.createdAt)],
    },
    requirements: {
      with: {
        tomArea: true,
        evidence: true,
        actionPlanItems: true,
      },
    },
    documentReviewRuns: {
      with: {
        findings: {
          with: {
            requirementType: true,
          },
        },
      },
    },
    actionPlanItems: true,
    reportExports: true,
    settings: true,
    suppliers: true,
    registrationTasks: true,
    securityIncidents: {
      with: {
        reports: true,
      },
    },
    managementTrainings: true,
  },
});
```

### Create an Organization During Onboarding

Use a transaction so the organization and owner membership are created together.

```ts
const result = await db.transaction(async (tx) => {
  const [organization] = await tx
    .insert(organizations)
    .values({
      name: "Example GmbH",
      employeeCount: 85,
      size: "medium",
    })
    .returning();

  await tx.insert(organizationMembers).values({
    organizationId: organization.id,
    userId: user.id,
    role: "owner",
  });

  return organization;
});
```

### Save a Self-Check Result

Store the derived classification and the raw questionnaire answers.

```ts
await db.insert(selfCheckAssessments).values({
  organizationId,
  title: "Initial NIS2 applicability check",
  performedByUserId: user.id,
  status: "completed",
  category: "essential",
  sizeCapApplies: true,
  lexSpecialisApplies: false,
  reasoning: "Large organization in an Annex 1 high-criticality sector.",
  answers: {
    employeeCount: 320,
    annualRevenueEur: 76000000,
    sectorCodes: ["energy"],
  },
  completedAt: new Date(),
});
```

### Find Open Requirements

```ts
import { and, eq, ne } from "drizzle-orm";

const openRequirements = await db.query.organizationRequirements.findMany({
  where: and(
    eq(organizationRequirements.organizationId, organizationId),
    ne(organizationRequirements.status, "verified"),
    ne(organizationRequirements.status, "not_applicable"),
  ),
  with: {
    tomArea: true,
    evidence: true,
  },
  orderBy: (requirement, { asc }) => [
    asc(requirement.dueDate),
    asc(requirement.riskLevel),
  ],
});
```

### Calculate Requirement Status Counts

For dashboard charts, use grouped SQL-style queries.

```ts
import { count, eq } from "drizzle-orm";

const requirementCounts = await db
  .select({
    status: organizationRequirements.status,
    total: count(),
  })
  .from(organizationRequirements)
  .where(eq(organizationRequirements.organizationId, organizationId))
  .groupBy(organizationRequirements.status);
```

### List High-Risk Suppliers

```ts
import { and, eq, inArray } from "drizzle-orm";

const highRiskSuppliers = await db.query.suppliers.findMany({
  where: and(
    eq(suppliers.organizationId, organizationId),
    inArray(suppliers.riskLevel, ["high", "critical"]),
  ),
  with: {
    assessments: true,
  },
});
```

### Mark a Registration Task as Done

```ts
import { eq } from "drizzle-orm";

await db
  .update(registrationTasks)
  .set({
    status: "done",
    completedAt: new Date(),
  })
  .where(eq(registrationTasks.id, taskId));
```

### Create Incident Reporting Deadlines

The database stores deadlines, but the date calculation should happen in
application code. This keeps the schema simple and testable.

```ts
const detectedAt = new Date();

const [incident] = await db
  .insert(securityIncidents)
  .values({
    organizationId,
    title: "Significant security incident",
    severity: "high",
    detectedAt,
  })
  .returning();

await db.insert(incidentReports).values([
  {
    incidentId: incident.id,
    stage: "early_warning_24h",
    dueAt: addHours(detectedAt, 24),
  },
  {
    incidentId: incident.id,
    stage: "notification_72h",
    dueAt: addHours(detectedAt, 72),
  },
  {
    incidentId: incident.id,
    stage: "final_report_1_month",
    dueAt: addMonths(detectedAt, 1),
  },
]);
```

### Submit an Incident Report

```ts
await db
  .update(incidentReports)
  .set({
    submittedAt: new Date(),
    submittedByUserId: user.id,
    notes: "Submitted through the BSI portal.",
  })
  .where(eq(incidentReports.id, reportId));
```

## Recommended Data Flow

1. User signs up through Supabase Auth.
2. App creates an `organizations` row and an `organization_members` row with role `owner`.
3. User completes the self-check.
4. App stores structured answers in `questionnaire_answers` and the final
   classification in `self_check_assessments`.
5. App links sectors through `organization_sectors` and critical services
   through `organization_critical_services`.
6. App creates one `organization_requirements` row per `tom_areas` row.
7. User completes the Gap-Analyse in `questionnaire_runs`.
8. User adds evidence in `requirement_evidence` and uploads documents through
   `ai_documents`.
9. App stores document review results in `document_review_runs` and
   `document_review_findings`.
10. App creates concrete next steps in `action_plan_items`.
11. PDF exports are tracked in `report_exports`.
12. User and organization preferences are stored in `user_preferences` and
   `organization_settings`.
13. User documents suppliers in `suppliers` and reviews them through `supplier_assessments`.
14. Registration progress is tracked in `registration_tasks`.
15. Incidents are stored in `security_incidents`, with deadlines in `incident_reports`.
16. Management training proof is stored in `management_trainings`.

## Notes for Future RLS Policies

The key access rule should be:

```sql
exists (
  select 1
  from organization_members
  where organization_members.organization_id = <table>.organization_id
    and organization_members.user_id = auth.uid()
)
```

Tables without `organization_id`, such as `nis2_sectors`, `lex_specialis_rules`,
and `tom_areas`, are reference tables and can usually be read by authenticated
users. Writes to those tables should be admin-only or migration-only.

## Seeding Reference Data

The following tables should be seeded before the app is used:

- `nis2_sectors`: NIS2 sectors from Annex 1 and Annex 2.
- `nis2_critical_services`: Critical services used by Betroffenheitscheck.
- `lex_specialis_rules`: Rules such as DORA or telecom-specific regulation.
- `tom_areas`: The 12 BSIG/NIS2 risk-management measure areas.
- `questionnaire_templates`, `questionnaire_sections`, `questionnaire_questions`: Betroffenheitscheck and Gap-Analyse definitions.
- `document_requirement_types`: Required policy/concept/document checks.

Keep seed data deterministic by using stable `code` or `bsig_number` values and
upserts instead of blind inserts.
