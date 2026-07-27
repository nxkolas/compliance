CREATE TYPE "action_plan_item_status" AS ENUM('open', 'in_progress', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "action_plan_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "action_plan_status" AS ENUM('active', 'stale', 'archived', 'draft_reconciliation', 'superseded');--> statement-breakpoint
CREATE TYPE "ai_operation_kind" AS ENUM('gap_analysis', 'gap_guidance_regeneration', 'action_plan_generation', 'live_gap_evaluation');--> statement-breakpoint
CREATE TYPE "assessment_revision_status" AS ENUM('draft', 'submitted', 'superseded', 'archived');--> statement-breakpoint
CREATE TYPE "assessment_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "background_job_state" AS ENUM('queued', 'running', 'cancellation_requested', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "compliance_check_release_status" AS ENUM('draft', 'published', 'retired', 'superseded');--> statement-breakpoint
CREATE TYPE "compliance_framework_version_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "compliance_module_type" AS ENUM('questionnaire', 'generated_artifact', 'document_analysis');--> statement-breakpoint
CREATE TYPE "content_format" AS ENUM('plain_text', 'markdown');--> statement-breakpoint
CREATE TYPE "document_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "evidence_sufficiency" AS ENUM('sufficient', 'partial', 'none');--> statement-breakpoint
CREATE TYPE "gap_analysis_release_status" AS ENUM('draft', 'published', 'retired', 'superseded');--> statement-breakpoint
CREATE TYPE "gap_finding_evidence_source_type" AS ENUM('assessment_answer', 'document_chunk', 'legal_source_chunk');--> statement-breakpoint
CREATE TYPE "gap_finding_status" AS ENUM('fulfilled', 'partially_fulfilled', 'not_fulfilled', 'insufficient_evidence');--> statement-breakpoint
CREATE TYPE "gap_item_kind" AS ENUM('missing', 'partial', 'uncertain');--> statement-breakpoint
CREATE TYPE "gap_questionnaire_draft_status" AS ENUM('open', 'locked', 'discarded');--> statement-breakpoint
CREATE TYPE "gap_reassessment_selection_origin" AS ENUM('approved_carryover', 'version_replacement', 'explicit_addition');--> statement-breakpoint
CREATE TYPE "gap_reassessment_status" AS ENUM('open', 'locked', 'generated', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "gap_requirement_criticality" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "generated_artifact_generated_by" AS ENUM('system', 'ai', 'user');--> statement-breakpoint
CREATE TYPE "generated_artifact_revision_status" AS ENUM('draft', 'generated', 'reviewed', 'approved', 'superseded', 'archived');--> statement-breakpoint
CREATE TYPE "generated_artifact_type" AS ENUM('affectedness_result', 'gap_analysis_result', 'action_plan', 'document_analysis');--> statement-breakpoint
CREATE TYPE "grounded_claim_validation" AS ENUM('supported', 'unsupported', 'conflicting', 'insufficient_information');--> statement-breakpoint
CREATE TYPE "grounding_context_channel" AS ENUM('legal', 'organization_document', 'questionnaire_assertion');--> statement-breakpoint
CREATE TYPE "guest_applicability_check_status" AS ENUM('started', 'submitted', 'claimed', 'deleted', 'expired');--> statement-breakpoint
CREATE TYPE "idempotency_state" AS ENUM('in_progress', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "immutable_component_status" AS ENUM('draft', 'published', 'retired');--> statement-breakpoint
CREATE TYPE "legal_authority_tier" AS ENUM('primary_authority', 'official_guidance', 'curated_secondary');--> statement-breakpoint
CREATE TYPE "legal_change_alert_state" AS ENUM('open', 'candidate_created', 'dismissed');--> statement-breakpoint
CREATE TYPE "legal_corpus_evaluation_state" AS ENUM('not_run', 'pending', 'passed', 'failed');--> statement-breakpoint
CREATE TYPE "legal_corpus_release_status" AS ENUM('draft', 'published', 'withdrawn');--> statement-breakpoint
CREATE TYPE "legal_processing_state" AS ENUM('queued', 'running', 'review_required', 'reviewed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "legal_source_version_status" AS ENUM('draft', 'reviewed', 'published', 'withdrawn');--> statement-breakpoint
CREATE TYPE "legal_translation_status" AS ENUM('official', 'reviewed_internal', 'machine_assisted');--> statement-breakpoint
CREATE TYPE "organization_fact_data_type" AS ENUM('text', 'number', 'boolean', 'enum', 'multi_enum', 'structured');--> statement-breakpoint
CREATE TYPE "organization_invitation_status" AS ENUM('pending', 'accepted', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "organization_membership_status" AS ENUM('active', 'removed', 'left');--> statement-breakpoint
CREATE TYPE "organization_role" AS ENUM('owner', 'admin', 'member', 'auditor');--> statement-breakpoint
CREATE TYPE "processing_status" AS ENUM('pending', 'processing', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "question_answer_type" AS ENUM('single_choice', 'multi_choice', 'text', 'long_text', 'number', 'boolean', 'date', 'file', 'json');--> statement-breakpoint
CREATE TYPE "report_state" AS ENUM('queued', 'rendering', 'ready', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "rule_set_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "upload_session_state" AS ENUM('pending', 'verified', 'completed', 'expired', 'failed');--> statement-breakpoint
CREATE TABLE "action_plan_item_gaps" (
	"action_plan_item_id" uuid,
	"gap_item_id" uuid,
	"source_finding_id" uuid NOT NULL,
	CONSTRAINT "action_plan_item_gaps_pkey" PRIMARY KEY("action_plan_item_id","gap_item_id")
);
--> statement-breakpoint
ALTER TABLE "action_plan_item_gaps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "action_plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"action_plan_id" uuid NOT NULL,
	"source_finding_id" uuid NOT NULL,
	"title" text NOT NULL,
	"result" text NOT NULL,
	"suggested_evidence" jsonb NOT NULL,
	"position" integer NOT NULL,
	"execution_notes" text DEFAULT '' NOT NULL,
	"priority" "action_plan_priority" NOT NULL,
	"status" "action_plan_item_status" DEFAULT 'open'::"action_plan_item_status" NOT NULL,
	"owner_user_id" uuid,
	"due_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "action_plan_items_finding_identity_unique" UNIQUE("id","source_finding_id"),
	CONSTRAINT "action_plan_items_generated_content_check" CHECK (
        length(btrim("title")) > 0
        and length(btrim("result")) > 0
        and jsonb_typeof("suggested_evidence") = 'array'
        and jsonb_array_length("suggested_evidence") > 0
        and "position" > 0
      )
);
--> statement-breakpoint
ALTER TABLE "action_plan_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "action_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"source_gap_artifact_revision_id" uuid NOT NULL,
	"output_locale" text NOT NULL,
	"generation_run_id" uuid,
	"generation_job_id" uuid NOT NULL,
	"status" "action_plan_status" DEFAULT 'active'::"action_plan_status" NOT NULL,
	"revision_number" integer NOT NULL,
	"activated_by" uuid,
	"activated_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "action_plans_id_organization_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "action_plans_output_locale_check" CHECK ("output_locale" in ('de', 'en')),
	CONSTRAINT "action_plans_lifecycle_check" CHECK ((
        "status" = 'active'
        and "activated_by" is not null
        and "activated_at" is not null
        and "archived_at" is null
      ) or (
        "status" = 'archived'
        and "activated_by" is not null
        and "activated_at" is not null
        and "archived_at" is not null
      ))
);
--> statement-breakpoint
ALTER TABLE "action_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "active_compliance_check_releases" (
	"check_code" text PRIMARY KEY,
	"check_release_id" uuid NOT NULL,
	"activated_by" text NOT NULL,
	"activated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "active_compliance_check_releases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "active_gap_analysis_releases" (
	"release_code" text PRIMARY KEY,
	"gap_analysis_release_id" uuid NOT NULL,
	"activated_by" uuid NOT NULL,
	"activated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "active_gap_analysis_releases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "active_legal_corpus_releases" (
	"family_id" uuid PRIMARY KEY,
	"release_id" uuid NOT NULL,
	"activated_by" uuid NOT NULL,
	"activated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "active_legal_corpus_releases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_processing_run_artifact_inputs" (
	"run_id" uuid,
	"artifact_revision_id" uuid,
	"source_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_run_artifact_inputs_pk" PRIMARY KEY("run_id","artifact_revision_id")
);
--> statement-breakpoint
ALTER TABLE "ai_processing_run_artifact_inputs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_processing_run_assessment_inputs" (
	"run_id" uuid,
	"assessment_revision_id" uuid,
	"source_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_run_assessment_inputs_pk" PRIMARY KEY("run_id","assessment_revision_id")
);
--> statement-breakpoint
ALTER TABLE "ai_processing_run_assessment_inputs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_processing_run_claim_context" (
	"claim_id" uuid,
	"context_id" uuid,
	CONSTRAINT "ai_processing_run_claim_context_pkey" PRIMARY KEY("claim_id","context_id")
);
--> statement-breakpoint
ALTER TABLE "ai_processing_run_claim_context" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_processing_run_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"run_id" uuid NOT NULL,
	"query_unit_id" text NOT NULL,
	"claim_key" text NOT NULL,
	"claim_text_hash" text NOT NULL,
	"validation" "grounded_claim_validation" NOT NULL,
	"safe_failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_processing_run_claims" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_processing_run_context" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"run_id" uuid NOT NULL,
	"channel" "grounding_context_channel" NOT NULL,
	"citation_id" text NOT NULL,
	"query_unit_id" text NOT NULL,
	"query_hash" text NOT NULL,
	"retrieval_rank" integer NOT NULL,
	"retrieval_score" numeric NOT NULL,
	"retrieval_policy_version" text,
	"lexical_score" numeric,
	"semantic_score" numeric,
	"combined_score" numeric,
	"selection_role" text,
	"preferred_mapped_provision" boolean DEFAULT false NOT NULL,
	"mapped_legal_provision_id" uuid,
	"retrieval_diagnostics" jsonb DEFAULT '{}' NOT NULL,
	"legal_chunk_id" uuid,
	"document_chunk_id" uuid,
	"assessment_answer_id" uuid,
	"excerpt_hash" text NOT NULL,
	"excerpt_snapshot" text NOT NULL,
	"disclosed_externally" boolean DEFAULT false NOT NULL,
	"prompt_position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_run_context_source_check" CHECK (num_nonnulls("legal_chunk_id", "document_chunk_id", "assessment_answer_id") = 1),
	CONSTRAINT "ai_run_context_channel_check" CHECK (("channel" = 'legal' and "legal_chunk_id" is not null) or ("channel" = 'organization_document' and "document_chunk_id" is not null) or ("channel" = 'questionnaire_assertion' and "assessment_answer_id" is not null)),
	CONSTRAINT "ai_run_context_selection_role_check" CHECK ("selection_role" is null or "selection_role" in ('mapped_primary', 'secondary_context', 'admitted_organization_evidence', 'questionnaire_assertion')),
	CONSTRAINT "ai_run_context_retrieval_diagnostics_check" CHECK (jsonb_typeof("retrieval_diagnostics") = 'object')
);
--> statement-breakpoint
ALTER TABLE "ai_processing_run_context" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_processing_run_document_inputs" (
	"run_id" uuid,
	"document_version_id" uuid,
	"source_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_processing_run_document_inputs_pkey" PRIMARY KEY("run_id","document_version_id")
);
--> statement-breakpoint
ALTER TABLE "ai_processing_run_document_inputs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_processing_run_legal_inputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"run_id" uuid NOT NULL,
	"corpus_release_id" uuid NOT NULL,
	"source_version_id" uuid NOT NULL,
	"processing_generation_id" uuid NOT NULL,
	"source_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_processing_run_legal_inputs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_processing_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid,
	"assessment_revision_id" uuid,
	"operation_kind" "ai_operation_kind" NOT NULL,
	"status" "processing_status" DEFAULT 'pending'::"processing_status" NOT NULL,
	"output_locale" text NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"language_validation" jsonb NOT NULL,
	"input_hash" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"provider" text,
	"model" text,
	"prompt_name" text NOT NULL,
	"prompt_version" text NOT NULL,
	"prompt_template_hash" text NOT NULL,
	"rendered_input_hash" text NOT NULL,
	"response_schema_version" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cached_input_tokens" integer,
	"validated_output" jsonb,
	"job_id" uuid,
	"provider_policy_version" integer,
	"corpus_release_set_hash" text,
	"provenance_status" text DEFAULT 'complete' NOT NULL,
	"cancellation_requested_at" timestamp with time zone,
	"output_artifact_revision_id" uuid,
	"error_code" text,
	"error_message" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "ai_processing_runs_provenance_status_check" CHECK ("provenance_status" in ('complete', 'historical_unknown')),
	CONSTRAINT "ai_processing_runs_output_locale_check" CHECK ("output_locale" in ('de', 'en')),
	CONSTRAINT "ai_processing_runs_attempt_count_check" CHECK ("attempt_count" >= 0),
	CONSTRAINT "ai_processing_runs_language_validation_check" CHECK (
        jsonb_typeof("language_validation") = 'object'
        and "language_validation"->>'version' = '1'
        and "language_validation"->>'expectedLocale' = "output_locale"
        and jsonb_typeof("language_validation"->'attempts') = 'array'
      ),
	CONSTRAINT "ai_processing_runs_lifecycle_check" CHECK ((
        "status" = 'pending'
        and "started_at" is null
        and "completed_at" is null
        and "error_code" is null
        and "error_message" is null
      ) or (
        "status" = 'processing'
        and "started_at" is not null
        and "completed_at" is null
        and "error_code" is null
        and "error_message" is null
      ) or (
        "status" = 'succeeded'
        and "started_at" is not null
        and "completed_at" is not null
        and "validated_output" is not null
        and "error_code" is null
        and "error_message" is null
      ) or (
        "status" = 'failed'
        and "completed_at" is not null
        and "error_code" is not null
        and "error_message" is not null
      ))
);
--> statement-breakpoint
ALTER TABLE "ai_processing_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "api_rate_limit_windows" (
	"key" text,
	"window_started_at" timestamp with time zone,
	"count" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_rate_limit_windows_pkey" PRIMARY KEY("key","window_started_at"),
	CONSTRAINT "api_rate_limit_windows_count_check" CHECK ("count" > 0)
);
--> statement-breakpoint
ALTER TABLE "api_rate_limit_windows" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "artifact_revision_artifact_sources" (
	"artifact_revision_id" uuid,
	"source_artifact_revision_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artifact_revision_artifact_sources_pk" PRIMARY KEY("artifact_revision_id","source_artifact_revision_id")
);
--> statement-breakpoint
ALTER TABLE "artifact_revision_artifact_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "artifact_revision_assessment_sources" (
	"artifact_revision_id" uuid,
	"assessment_revision_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artifact_revision_assessment_sources_pk" PRIMARY KEY("artifact_revision_id","assessment_revision_id")
);
--> statement-breakpoint
ALTER TABLE "artifact_revision_assessment_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "artifact_revision_document_sources" (
	"artifact_revision_id" uuid,
	"document_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artifact_revision_document_sources_pk" PRIMARY KEY("artifact_revision_id","document_version_id")
);
--> statement-breakpoint
ALTER TABLE "artifact_revision_document_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "assessment_answer_options" (
	"assessment_answer_id" uuid,
	"question_id" uuid NOT NULL,
	"question_option_id" uuid,
	CONSTRAINT "assessment_answer_options_pk" PRIMARY KEY("assessment_answer_id","question_option_id")
);
--> statement-breakpoint
ALTER TABLE "assessment_answer_options" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "assessment_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"assessment_revision_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"question_stable_key" text NOT NULL,
	"text_value" text,
	"number_value" numeric,
	"boolean_value" boolean,
	"date_value" date,
	"structured_value" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_answers_id_question_unique" UNIQUE("id","question_id"),
	CONSTRAINT "assessment_answers_scalar_representation_check" CHECK (num_nonnulls("text_value", "number_value", "boolean_value", "date_value", "structured_value") <= 1)
);
--> statement-breakpoint
ALTER TABLE "assessment_answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "assessment_requirement_evaluations" (
	"assessment_revision_id" uuid,
	"requirement_version_id" uuid,
	"status" "gap_finding_status" NOT NULL,
	"evaluator_kind" text NOT NULL,
	"evaluator_version" integer NOT NULL,
	"input_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_requirement_evaluations_pk" PRIMARY KEY("assessment_revision_id","requirement_version_id"),
	CONSTRAINT "assessment_requirement_evaluations_version_positive" CHECK ("evaluator_version" > 0)
);
--> statement-breakpoint
ALTER TABLE "assessment_requirement_evaluations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "assessment_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"assessment_id" uuid NOT NULL,
	"questionnaire_version_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"parent_revision_id" uuid,
	"status" "assessment_revision_status" NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	CONSTRAINT "assessment_revisions_owner_identity_unique" UNIQUE("assessment_id","id"),
	CONSTRAINT "assessment_revisions_submission_check" CHECK (("status" = 'draft' and "submitted_at" is null) or ("status" <> 'draft' and "submitted_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "assessment_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"questionnaire_id" uuid NOT NULL,
	"check_release_id" uuid,
	"gap_analysis_release_id" uuid,
	"applicability_artifact_revision_id" uuid,
	"current_revision_id" uuid,
	"status" "assessment_status" DEFAULT 'active'::"assessment_status" NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessments_id_organization_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "assessments_id_gap_release_unique" UNIQUE("id","gap_analysis_release_id"),
	CONSTRAINT "assessments_release_kind_check" CHECK ((
        "check_release_id" IS NOT NULL
        AND "gap_analysis_release_id" IS NULL
        AND "applicability_artifact_revision_id" IS NULL
      ) OR (
        "check_release_id" IS NULL
        AND "gap_analysis_release_id" IS NOT NULL
        AND "applicability_artifact_revision_id" IS NOT NULL
      ))
);
--> statement-breakpoint
ALTER TABLE "assessments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"event_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "background_job_results" (
	"job_id" uuid PRIMARY KEY,
	"generated_artifact_revision_id" uuid,
	"report_id" uuid,
	"legal_source_rendition_id" uuid,
	"legal_processing_generation_id" uuid,
	"legal_source_monitor_id" uuid,
	"legal_corpus_evaluation_id" uuid,
	"action_plan_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "background_job_results_exactly_one_check" CHECK (num_nonnulls(
        "generated_artifact_revision_id",
        "report_id",
        "legal_source_rendition_id",
        "legal_processing_generation_id",
        "legal_source_monitor_id",
        "legal_corpus_evaluation_id",
        "action_plan_id"
      ) = 1)
);
--> statement-breakpoint
ALTER TABLE "background_job_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "background_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid,
	"requested_by_user_id" uuid,
	"kind" text NOT NULL,
	"state" "background_job_state" DEFAULT 'queued'::"background_job_state" NOT NULL,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"cancellable" boolean DEFAULT true NOT NULL,
	"cancellation_capability" text,
	"safe_error_code" text,
	"safe_error_message" text,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_owner" text,
	"lease_expires_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"cancellation_requested_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "background_jobs_progress_check" CHECK ("progress" between 0 and 100),
	CONSTRAINT "background_jobs_attempts_check" CHECK ("attempt_count" >= 0 and "max_attempts" > 0),
	CONSTRAINT "background_jobs_cancellation_capability_check" CHECK ("organization_id" is null or not "cancellable" or "cancellation_capability" is not null),
	CONSTRAINT "background_jobs_lifecycle_check" CHECK ((
        "state" in ('queued', 'running', 'cancellation_requested')
        and "finished_at" is null
      ) or (
        "state" = 'succeeded'
        and "finished_at" is not null
        and "progress" = 100
      ) or (
        "state" = 'failed'
        and "finished_at" is not null
        and "safe_error_code" is not null
        and "safe_error_message" is not null
      ) or (
        "state" = 'cancelled'
        and "finished_at" is not null
      ))
);
--> statement-breakpoint
ALTER TABLE "background_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "compliance_check_release_activations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"check_code" text NOT NULL,
	"previous_release_id" uuid,
	"activated_release_id" uuid NOT NULL,
	"activated_by" text NOT NULL,
	"activated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "compliance_check_release_activations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "compliance_check_release_content_revisions" (
	"check_release_id" uuid,
	"content_revision_id" uuid,
	CONSTRAINT "check_release_content_revisions_pk" PRIMARY KEY("check_release_id","content_revision_id")
);
--> statement-breakpoint
ALTER TABLE "compliance_check_release_content_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "compliance_check_release_corpus_releases" (
	"check_release_id" uuid,
	"family_id" uuid,
	"corpus_release_id" uuid NOT NULL,
	CONSTRAINT "check_release_corpus_releases_pk" PRIMARY KEY("check_release_id","family_id")
);
--> statement-breakpoint
ALTER TABLE "compliance_check_release_corpus_releases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "compliance_check_release_fact_versions" (
	"check_release_id" uuid,
	"fact_definition_version_id" uuid,
	CONSTRAINT "check_release_fact_versions_pk" PRIMARY KEY("check_release_id","fact_definition_version_id")
);
--> statement-breakpoint
ALTER TABLE "compliance_check_release_fact_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "compliance_check_release_profiles" (
	"check_release_id" uuid,
	"country_code" text,
	"jurisdiction_profile_version_id" uuid NOT NULL,
	CONSTRAINT "check_release_profiles_pk" PRIMARY KEY("check_release_id","country_code")
);
--> statement-breakpoint
ALTER TABLE "compliance_check_release_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "compliance_check_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"check_code" text NOT NULL,
	"version_label" text NOT NULL,
	"module_id" uuid NOT NULL,
	"questionnaire_id" uuid NOT NULL,
	"questionnaire_version_id" uuid NOT NULL,
	"scope_model_version_id" uuid NOT NULL,
	"scope_threshold_set_id" uuid NOT NULL,
	"rule_set_id" uuid NOT NULL,
	"evaluator_kind" text NOT NULL,
	"evaluator_version" integer NOT NULL,
	"default_locale" text DEFAULT 'de' NOT NULL,
	"effective_from" date,
	"effective_to" date,
	"status" "compliance_check_release_status" NOT NULL,
	"aggregate_hash" text NOT NULL,
	"corpus_release_set_hash" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "compliance_check_releases_check_id_unique" UNIQUE("check_code","id"),
	CONSTRAINT "compliance_check_releases_id_identity_unique" UNIQUE("id","module_id","questionnaire_id")
);
--> statement-breakpoint
ALTER TABLE "compliance_check_releases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "compliance_framework_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"framework_id" uuid NOT NULL,
	"version_label" text NOT NULL,
	"name_content_revision_id" uuid NOT NULL,
	"description_content_revision_id" uuid NOT NULL,
	"status" "compliance_framework_version_status" NOT NULL,
	"effective_from" date,
	"effective_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "compliance_framework_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "compliance_frameworks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "compliance_frameworks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "compliance_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"framework_version_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name_content_revision_id" uuid NOT NULL,
	"module_type" "compliance_module_type" NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "compliance_modules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "content_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"stable_key" text NOT NULL,
	"format" "content_format" DEFAULT 'plain_text'::"content_format" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "content_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"content_item_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"content_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "content_translations" (
	"content_revision_id" uuid,
	"locale" text,
	"value" text NOT NULL,
	CONSTRAINT "content_translations_pkey" PRIMARY KEY("content_revision_id","locale")
);
--> statement-breakpoint
ALTER TABLE "content_translations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "document_chunk_embeddings" (
	"generation_id" uuid,
	"chunk_id" uuid,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_chunk_embeddings_pkey" PRIMARY KEY("generation_id","chunk_id")
);
--> statement-breakpoint
ALTER TABLE "document_chunk_embeddings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"extraction_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"page_number" integer,
	"section_label" text,
	"token_count" integer,
	"search_vector" tsvector,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_chunks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "document_embedding_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"extraction_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"model_revision" text NOT NULL,
	"dimensions" integer NOT NULL,
	"retrieval_instruction_id" text NOT NULL,
	"chunking_version" text NOT NULL,
	"status" "processing_status" NOT NULL,
	"error_code" text,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_embedding_generations_dimensions_positive" CHECK ("dimensions" > 0)
);
--> statement-breakpoint
ALTER TABLE "document_embedding_generations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "document_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"document_version_id" uuid NOT NULL,
	"parser_kind" text NOT NULL,
	"parser_version" text NOT NULL,
	"status" "processing_status" NOT NULL,
	"extracted_text" text,
	"extracted_text_hash" text,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"error_code" text,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_extractions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"document_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"storage_bucket" text NOT NULL,
	"storage_path" text NOT NULL,
	"content_hash" text NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "document_versions_id_document_unique" UNIQUE("id","document_id"),
	CONSTRAINT "document_versions_owner_identity_unique" UNIQUE("document_id","id"),
	CONSTRAINT "document_versions_byte_size_positive" CHECK ("byte_size" > 0)
);
--> statement-breakpoint
ALTER TABLE "document_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" "document_status" DEFAULT 'active'::"document_status" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"current_version_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "documents_id_organization_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "documents_version_positive" CHECK ("version" > 0)
);
--> statement-breakpoint
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fact_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"fact_definition_key" text NOT NULL,
	"stable_value" text NOT NULL,
	"catalog_code" text DEFAULT 'all' NOT NULL,
	"scope_entity_type_id" uuid,
	"jurisdiction_entity_type_id" uuid,
	CONSTRAINT "fact_options_definition_id_unique" UNIQUE("fact_definition_key","id"),
	CONSTRAINT "fact_options_single_catalog_identity_check" CHECK (num_nonnulls("scope_entity_type_id", "jurisdiction_entity_type_id") <= 1),
	CONSTRAINT "fact_options_catalog_identity_check" CHECK (("scope_entity_type_id" is null or "catalog_code" = 'eu_core') and ("jurisdiction_entity_type_id" is null or "catalog_code" like 'country:%'))
);
--> statement-breakpoint
ALTER TABLE "fact_options" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gap_analysis_release_activations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"release_code" text NOT NULL,
	"previous_release_id" uuid,
	"activated_release_id" uuid NOT NULL,
	"activated_by" uuid NOT NULL,
	"activated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gap_analysis_release_activations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gap_analysis_release_applicability_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"gap_analysis_release_id" uuid NOT NULL,
	"requirement_version_id" uuid NOT NULL,
	"conditions" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gap_analysis_release_applicability_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gap_analysis_release_corpus_releases" (
	"gap_analysis_release_id" uuid,
	"family_id" uuid,
	"corpus_release_id" uuid NOT NULL,
	CONSTRAINT "gap_release_corpus_releases_pk" PRIMARY KEY("gap_analysis_release_id","family_id")
);
--> statement-breakpoint
ALTER TABLE "gap_analysis_release_corpus_releases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gap_analysis_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"release_code" text NOT NULL,
	"version_label" text NOT NULL,
	"module_id" uuid NOT NULL,
	"questionnaire_id" uuid NOT NULL,
	"questionnaire_version_id" uuid NOT NULL,
	"requirement_set_version_id" uuid NOT NULL,
	"compatible_check_release_id" uuid NOT NULL,
	"prompt_name" text NOT NULL,
	"prompt_version" text NOT NULL,
	"prompt_template_hash" text NOT NULL,
	"response_schema_version" text NOT NULL,
	"action_plan_prompt_name" text NOT NULL,
	"action_plan_prompt_version" text NOT NULL,
	"action_plan_prompt_template_hash" text NOT NULL,
	"action_plan_response_schema_version" text NOT NULL,
	"evaluator_kind" text NOT NULL,
	"evaluator_version" integer NOT NULL,
	"default_locale" text DEFAULT 'de' NOT NULL,
	"status" "gap_analysis_release_status" NOT NULL,
	"aggregate_hash" text NOT NULL,
	"corpus_release_set_hash" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gap_analysis_releases_code_id_unique" UNIQUE("release_code","id"),
	CONSTRAINT "gap_analysis_releases_id_identity_unique" UNIQUE("id","module_id","questionnaire_id"),
	CONSTRAINT "gap_analysis_releases_id_questionnaire_version_unique" UNIQUE("id","questionnaire_version_id")
);
--> statement-breakpoint
ALTER TABLE "gap_analysis_releases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gap_finding_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"finding_id" uuid NOT NULL,
	"citation_id" text NOT NULL,
	"source_type" "gap_finding_evidence_source_type" NOT NULL,
	"assessment_answer_id" uuid,
	"document_chunk_id" uuid,
	"legal_source_chunk_id" uuid,
	"excerpt" text NOT NULL,
	"page_number" integer,
	"section_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gap_finding_evidence_source_check" CHECK ((
        "source_type" = 'assessment_answer'
        AND "assessment_answer_id" IS NOT NULL
        AND "document_chunk_id" IS NULL
        AND "legal_source_chunk_id" IS NULL
      ) OR (
        "source_type" = 'document_chunk'
        AND "assessment_answer_id" IS NULL
        AND "document_chunk_id" IS NOT NULL
        AND "legal_source_chunk_id" IS NULL
      ) OR (
        "source_type" = 'legal_source_chunk'
        AND "assessment_answer_id" IS NULL
        AND "document_chunk_id" IS NULL
        AND "legal_source_chunk_id" IS NOT NULL
      ))
);
--> statement-breakpoint
ALTER TABLE "gap_finding_evidence" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gap_finding_review_resolutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"artifact_revision_id" uuid NOT NULL,
	"finding_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"resolved_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gap_finding_review_resolutions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gap_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"artifact_revision_id" uuid NOT NULL,
	"requirement_version_id" uuid NOT NULL,
	"status" "gap_finding_status" NOT NULL,
	"evidence_sufficiency" "evidence_sufficiency" NOT NULL,
	"severity" "action_plan_priority" NOT NULL,
	"statement_basis" jsonb NOT NULL,
	"statement_basis_hash" text NOT NULL,
	"review_notice" text,
	"generation_run_id" uuid NOT NULL,
	"assumptions" jsonb DEFAULT '[]' NOT NULL,
	"requires_review" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gap_findings_revision_identity_unique" UNIQUE("artifact_revision_id","id"),
	CONSTRAINT "gap_findings_review_notice_check" CHECK ((
        ("requires_review" and length(btrim("review_notice")) > 0)
        or (not "requires_review" and "review_notice" is null)
      )),
	CONSTRAINT "gap_findings_statement_basis_check" CHECK (
        jsonb_typeof("statement_basis") = 'object'
        and "statement_basis"->>'version' = '1'
        and jsonb_typeof("statement_basis"->'triggeringQuestions') = 'array'
        and jsonb_typeof("statement_basis"->'satisfiedQuestionStableKeys') = 'array'
        and length(btrim("statement_basis_hash")) > 0
      )
);
--> statement-breakpoint
ALTER TABLE "gap_findings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gap_item_evidence" (
	"gap_item_id" uuid,
	"gap_finding_evidence_id" uuid,
	CONSTRAINT "gap_item_evidence_pkey" PRIMARY KEY("gap_item_id","gap_finding_evidence_id")
);
--> statement-breakpoint
ALTER TABLE "gap_item_evidence" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gap_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"finding_id" uuid NOT NULL,
	"source_assessment_answer_id" uuid NOT NULL,
	"question_stable_key" text NOT NULL,
	"kind" "gap_item_kind" NOT NULL,
	"statement" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gap_items_finding_identity_unique" UNIQUE("finding_id","id"),
	CONSTRAINT "gap_items_statement_check" CHECK (
        length(btrim("statement")) > 0
        and position(E'
' in "statement") = 0
        and "position" > 0
      )
);
--> statement-breakpoint
ALTER TABLE "gap_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gap_question_legal_provisions" (
	"question_id" uuid,
	"legal_provision_id" uuid,
	"position" integer NOT NULL,
	CONSTRAINT "gap_question_legal_provisions_pk" PRIMARY KEY("question_id","legal_provision_id"),
	CONSTRAINT "gap_question_legal_provisions_position_positive" CHECK ("position" > 0)
);
--> statement-breakpoint
ALTER TABLE "gap_question_legal_provisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gap_questionnaire_draft_answers" (
	"draft_id" uuid,
	"question_id" uuid,
	"question_option_id" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gap_questionnaire_draft_answers_pk" PRIMARY KEY("draft_id","question_id")
);
--> statement-breakpoint
ALTER TABLE "gap_questionnaire_draft_answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gap_questionnaire_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"assessment_id" uuid NOT NULL,
	"gap_analysis_release_id" uuid NOT NULL,
	"questionnaire_version_id" uuid NOT NULL,
	"status" "gap_questionnaire_draft_status" DEFAULT 'open'::"gap_questionnaire_draft_status" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"last_submitted_assessment_revision_id" uuid,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gap_questionnaire_drafts_id_organization_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "gap_questionnaire_drafts_version_positive" CHECK ("version" > 0)
);
--> statement-breakpoint
ALTER TABLE "gap_questionnaire_drafts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gap_reassessment_draft_documents" (
	"draft_id" uuid,
	"organization_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"document_version_id" uuid,
	"selection_origin" "gap_reassessment_selection_origin" NOT NULL,
	"selected_by" uuid NOT NULL,
	"selected_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gap_reassessment_draft_documents_pk" PRIMARY KEY("draft_id","document_version_id")
);
--> statement-breakpoint
ALTER TABLE "gap_reassessment_draft_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gap_reassessment_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"assessment_id" uuid NOT NULL,
	"gap_analysis_release_id" uuid NOT NULL,
	"base_accepted_gap_revision_id" uuid,
	"assessment_revision_id" uuid NOT NULL,
	"status" "gap_reassessment_status" DEFAULT 'open'::"gap_reassessment_status" NOT NULL,
	"output_locale" text,
	"lock_version" integer DEFAULT 1 NOT NULL,
	"ai_processing_run_id" uuid,
	"generation_job_id" uuid,
	"output_gap_revision_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "gap_reassessment_drafts_id_organization_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "gap_reassessment_drafts_lock_version_positive" CHECK ("lock_version" > 0),
	CONSTRAINT "gap_reassessment_drafts_output_locale_check" CHECK ((
        ("status" = 'open' and "output_locale" is null)
        or
        ("status" <> 'open' and "output_locale" in ('de', 'en'))
      ))
);
--> statement-breakpoint
ALTER TABLE "gap_reassessment_drafts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gap_requirement_question_mappings" (
	"gap_analysis_release_id" uuid,
	"requirement_version_id" uuid,
	"question_id" uuid,
	"position" integer NOT NULL,
	CONSTRAINT "gap_requirement_question_mappings_pk" PRIMARY KEY("gap_analysis_release_id","requirement_version_id","question_id"),
	CONSTRAINT "gap_requirement_question_mappings_position_positive" CHECK ("position" > 0)
);
--> statement-breakpoint
ALTER TABLE "gap_requirement_question_mappings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gap_requirement_set_members" (
	"requirement_set_version_id" uuid,
	"requirement_version_id" uuid,
	"position" integer NOT NULL,
	CONSTRAINT "gap_requirement_set_members_pk" PRIMARY KEY("requirement_set_version_id","requirement_version_id")
);
--> statement-breakpoint
ALTER TABLE "gap_requirement_set_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gap_requirement_set_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"requirement_set_id" uuid NOT NULL,
	"version_label" text NOT NULL,
	"title_content_revision_id" uuid NOT NULL,
	"status" "immutable_component_status" NOT NULL,
	"content_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "gap_requirement_set_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gap_requirement_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gap_requirement_sets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gap_requirement_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"requirement_id" uuid NOT NULL,
	"version_label" text NOT NULL,
	"criticality" "gap_requirement_criticality" NOT NULL,
	"title_content_revision_id" uuid NOT NULL,
	"requirement_text_content_revision_id" uuid NOT NULL,
	"content_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gap_requirement_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gap_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gap_requirements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "generated_artifact_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"artifact_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"parent_revision_id" uuid,
	"status" "generated_artifact_revision_status" NOT NULL,
	"result" jsonb NOT NULL,
	"output_locale" text,
	"model_name" text,
	"prompt_version" text,
	"rule_set_id" uuid,
	"check_release_id" uuid,
	"gap_analysis_release_id" uuid,
	"evaluator_kind" text,
	"outcome_code" text,
	"evaluated_at" timestamp with time zone,
	"input_hash" text,
	"generated_by" "generated_artifact_generated_by" DEFAULT 'system'::"generated_artifact_generated_by" NOT NULL,
	"created_by" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generated_artifact_revisions_owner_identity_unique" UNIQUE("artifact_id","id"),
	CONSTRAINT "generated_artifact_revisions_output_locale_check" CHECK ((
        ("gap_analysis_release_id" is null and "output_locale" is null)
        or
        (
          "gap_analysis_release_id" is not null
          and "output_locale" in ('de', 'en')
          and "result"->>'outputLocale' = "output_locale"
        )
      )),
	CONSTRAINT "generated_artifact_revisions_gap_metadata_check" CHECK ((
        "gap_analysis_release_id" is null
        or (
          jsonb_typeof("result") = 'object'
          and "result"->>'schemaKind' = 'gap_revision_metadata_v1'
          and "result"->>'outputLocale' = "output_locale"
          and jsonb_typeof("result"->'findingDiagnostics') = 'array'
          and jsonb_typeof("result"->'correctedRequirementVersionIds') = 'array'
          and "result"
            - 'schemaKind'
            - 'outputLocale'
            - 'findingDiagnostics'
            - 'correctedFromRevisionId'
            - 'correctedRequirementVersionIds'
            = '{}'::jsonb
          and not ("result" ? 'findings')
        )
      ))
);
--> statement-breakpoint
ALTER TABLE "generated_artifact_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "generated_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"artifact_type" "generated_artifact_type" NOT NULL,
	"current_revision_id" uuid,
	"accepted_revision_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generated_artifacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "guest_applicability_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"token_hash" text NOT NULL,
	"status" "guest_applicability_check_status" DEFAULT 'started'::"guest_applicability_check_status" NOT NULL,
	"check_release_id" uuid NOT NULL,
	"answers" jsonb,
	"facts" jsonb,
	"result" jsonb,
	"input_hash" text,
	"expires_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"claim_expires_at" timestamp with time zone,
	"claimed_by_user_id" uuid,
	"claimed_organization_id" uuid,
	"claimed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guest_applicability_checks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "idempotency_record_results" (
	"record_id" uuid PRIMARY KEY,
	"platform_administrator_user_id" uuid,
	"legal_corpus_family_id" uuid,
	"background_job_id" uuid,
	"legal_processing_generation_id" uuid,
	"legal_corpus_release_id" uuid,
	"legal_source_rendition_id" uuid,
	"legal_source_id" uuid,
	"generated_artifact_revision_id" uuid,
	"assessment_id" uuid,
	"assessment_revision_id" uuid,
	"gap_reassessment_draft_id" uuid,
	"organization_invitation_id" uuid,
	"organization_id" uuid,
	"action_plan_id" uuid,
	"report_id" uuid,
	"document_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_record_results_exactly_one_check" CHECK (num_nonnulls(
        "platform_administrator_user_id",
        "legal_corpus_family_id",
        "background_job_id",
        "legal_processing_generation_id",
        "legal_corpus_release_id",
        "legal_source_rendition_id",
        "legal_source_id",
        "generated_artifact_revision_id",
        "assessment_id",
        "assessment_revision_id",
        "gap_reassessment_draft_id",
        "organization_invitation_id",
        "organization_id",
        "action_plan_id",
        "report_id",
        "document_version_id"
      ) = 1)
);
--> statement-breakpoint
ALTER TABLE "idempotency_record_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "idempotency_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"actor_key" text NOT NULL,
	"organization_id" uuid,
	"scope" text NOT NULL,
	"operation" text NOT NULL,
	"key" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"state" "idempotency_state" DEFAULT 'in_progress'::"idempotency_state" NOT NULL,
	"response_status" integer,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_records_key_length_check" CHECK (length("key") between 1 and 255)
);
--> statement-breakpoint
ALTER TABLE "idempotency_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "jurisdiction_entity_type_legal_provisions" (
	"jurisdiction_entity_type_version_id" uuid,
	"legal_provision_id" uuid,
	CONSTRAINT "jurisdiction_entity_type_legal_provisions_pk" PRIMARY KEY("jurisdiction_entity_type_version_id","legal_provision_id")
);
--> statement-breakpoint
ALTER TABLE "jurisdiction_entity_type_legal_provisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "jurisdiction_entity_type_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"jurisdiction_entity_type_version_id" uuid NOT NULL,
	"scope_entity_type_id" uuid NOT NULL,
	"relationship_kind" text NOT NULL,
	CONSTRAINT "jurisdiction_entity_type_mappings_kind_check" CHECK ("relationship_kind" in ('exact', 'subset', 'aggregate', 'overlap'))
);
--> statement-breakpoint
ALTER TABLE "jurisdiction_entity_type_mappings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "jurisdiction_entity_type_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"jurisdiction_entity_type_id" uuid NOT NULL,
	"jurisdiction_profile_version_id" uuid NOT NULL,
	"statutory_category_code" text,
	"annex" integer,
	"classification_rule" text NOT NULL,
	"label_content_revision_id" uuid NOT NULL,
	"description_content_revision_id" uuid NOT NULL,
	"definition_hash" text NOT NULL,
	CONSTRAINT "jurisdiction_entity_type_versions_annex_check" CHECK ("annex" is null or "annex" in (1, 2))
);
--> statement-breakpoint
ALTER TABLE "jurisdiction_entity_type_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "jurisdiction_entity_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"jurisdiction_profile_id" uuid NOT NULL,
	"code" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jurisdiction_entity_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "jurisdiction_profile_designations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"jurisdiction_profile_version_id" uuid NOT NULL,
	"designation_code" text NOT NULL,
	"outcome_code" text NOT NULL,
	"legal_provision_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jurisdiction_profile_designations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "jurisdiction_profile_effective_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"jurisdiction_profile_version_id" uuid NOT NULL,
	"code" text NOT NULL,
	"state_value" text NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"reviewed_at" timestamp with time zone NOT NULL,
	"official_source_url" text NOT NULL,
	"legal_provision_id" uuid NOT NULL,
	"declaration_hash" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jurisdiction_profile_effective_states" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "jurisdiction_profile_jurisdiction_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"jurisdiction_profile_version_id" uuid NOT NULL,
	"jurisdiction_entity_type_id" uuid NOT NULL,
	"basis_code" text NOT NULL,
	"legal_provision_id" uuid NOT NULL,
	"authority_decision_required" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jurisdiction_profile_jurisdiction_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "jurisdiction_profile_legal_provisions" (
	"jurisdiction_profile_version_id" uuid,
	"legal_provision_id" uuid,
	CONSTRAINT "jurisdiction_profile_legal_provisions_pk" PRIMARY KEY("jurisdiction_profile_version_id","legal_provision_id")
);
--> statement-breakpoint
ALTER TABLE "jurisdiction_profile_legal_provisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "jurisdiction_profile_threshold_policies" (
	"jurisdiction_profile_version_id" uuid PRIMARY KEY,
	"scope_threshold_set_id" uuid NOT NULL,
	"employee_measure" text NOT NULL,
	"public_body_rule" text NOT NULL,
	"aggregation_rule" text NOT NULL,
	"negligible_activity_rule" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jurisdiction_profile_threshold_policies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "jurisdiction_profile_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"jurisdiction_profile_id" uuid NOT NULL,
	"version_label" text NOT NULL,
	"status" "immutable_component_status" NOT NULL,
	"supported" boolean NOT NULL,
	"allow_negative_conclusion" boolean NOT NULL,
	"effective_from" date,
	"effective_to" date,
	"content_hash" text NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "jurisdiction_profile_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "jurisdiction_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text NOT NULL,
	"country_code" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jurisdiction_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "legal_corpus_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"release_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"fixture_set_version" text NOT NULL,
	"passed" boolean NOT NULL,
	"metrics" jsonb DEFAULT '{}' NOT NULL,
	"failures" jsonb DEFAULT '[]' NOT NULL,
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "legal_corpus_evaluations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "legal_corpus_families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text NOT NULL,
	"framework_code" text NOT NULL,
	"jurisdiction_code" text NOT NULL,
	"title" text NOT NULL,
	"archived_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_corpus_families_version_check" CHECK ("version" > 0)
);
--> statement-breakpoint
ALTER TABLE "legal_corpus_families" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "legal_corpus_release_activations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"family_id" uuid NOT NULL,
	"release_id" uuid NOT NULL,
	"previous_release_id" uuid,
	"evaluation_state" "legal_corpus_evaluation_state" NOT NULL,
	"emergency_override_reason" text,
	"activated_by" uuid NOT NULL,
	"activated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_release_activations_gate_check" CHECK ("evaluation_state" = 'passed' or "emergency_override_reason" is not null)
);
--> statement-breakpoint
ALTER TABLE "legal_corpus_release_activations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "legal_corpus_release_members" (
	"release_id" uuid,
	"source_version_id" uuid,
	"rendition_id" uuid NOT NULL,
	"processing_generation_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "legal_corpus_release_members_pkey" PRIMARY KEY("release_id","source_version_id")
);
--> statement-breakpoint
ALTER TABLE "legal_corpus_release_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "legal_corpus_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"family_id" uuid NOT NULL,
	"version_label" text NOT NULL,
	"content_hash" text,
	"status" "legal_corpus_release_status" DEFAULT 'draft'::"legal_corpus_release_status" NOT NULL,
	"evaluation_state" "legal_corpus_evaluation_state" DEFAULT 'not_run'::"legal_corpus_evaluation_state" NOT NULL,
	"evaluation_job_id" uuid,
	"published_by" uuid,
	"published_at" timestamp with time zone,
	"withdrawn_by" uuid,
	"withdrawn_at" timestamp with time zone,
	"withdrawal_reason" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_corpus_releases_family_id_unique" UNIQUE("family_id","id"),
	CONSTRAINT "legal_corpus_releases_lifecycle_check" CHECK ((
        "status" = 'draft'
        and "published_by" is null
        and "published_at" is null
        and "withdrawn_by" is null
        and "withdrawn_at" is null
        and "withdrawal_reason" is null
      ) or (
        "status" = 'published'
        and "content_hash" is not null
        and "published_by" is not null
        and "published_at" is not null
        and "withdrawn_by" is null
        and "withdrawn_at" is null
        and "withdrawal_reason" is null
      ) or (
        "status" = 'withdrawn'
        and "content_hash" is not null
        and "published_by" is not null
        and "published_at" is not null
        and "withdrawn_by" is not null
        and "withdrawn_at" is not null
        and "withdrawal_reason" is not null
      ))
);
--> statement-breakpoint
ALTER TABLE "legal_corpus_releases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "legal_instrument_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"legal_instrument_id" uuid NOT NULL,
	"version_label" text NOT NULL,
	"official_identifier" text NOT NULL,
	"official_source_url" text NOT NULL,
	"effective_from" date,
	"effective_to" date,
	"title_content_revision_id" uuid NOT NULL,
	"content_hash" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "legal_instrument_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "legal_instruments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text NOT NULL,
	"jurisdiction_code" text NOT NULL,
	"instrument_type" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "legal_instruments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "legal_provisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"legal_instrument_version_id" uuid NOT NULL,
	"provision_code" text NOT NULL,
	"official_source_url" text,
	"citation_content_revision_id" uuid
);
--> statement-breakpoint
ALTER TABLE "legal_provisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "legal_source_change_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"monitor_check_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"old_hash" text,
	"new_hash" text NOT NULL,
	"candidate_version_id" uuid,
	"state" "legal_change_alert_state" DEFAULT 'open'::"legal_change_alert_state" NOT NULL,
	"resolved_by" uuid,
	"resolution_reason" text,
	"resolved_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_change_alerts_resolution_check" CHECK ("state" = 'open' or ("resolved_by" is not null and "resolution_reason" is not null and "resolved_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "legal_source_change_alerts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "legal_source_chunk_embeddings" (
	"generation_id" uuid,
	"chunk_id" uuid,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"model_revision" text NOT NULL,
	"dimensions" integer NOT NULL,
	"retrieval_instruction_id" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_source_chunk_embeddings_pkey" PRIMARY KEY("generation_id","chunk_id"),
	CONSTRAINT "legal_chunk_embeddings_dimensions_check" CHECK ("dimensions" = 1536)
);
--> statement-breakpoint
ALTER TABLE "legal_source_chunk_embeddings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "legal_source_chunk_provisions" (
	"chunk_id" uuid,
	"legal_provision_id" uuid,
	"binding_method" text NOT NULL,
	"bound_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_source_chunk_provisions_pkey" PRIMARY KEY("chunk_id","legal_provision_id"),
	CONSTRAINT "legal_chunk_provisions_method_check" CHECK ("binding_method" = 'reviewed_exact_anchor_v1')
);
--> statement-breakpoint
ALTER TABLE "legal_source_chunk_provisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "legal_source_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"generation_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL,
	"text_hash" text NOT NULL,
	"page_number" integer,
	"section_path" text,
	"provision_code" text,
	"anchor_metadata" jsonb DEFAULT '{}' NOT NULL,
	"token_count" integer NOT NULL,
	"search_vector" tsvector,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_source_chunks_position_check" CHECK ("position" >= 0 and "token_count" > 0)
);
--> statement-breakpoint
ALTER TABLE "legal_source_chunks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "legal_source_monitor_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"monitor_id" uuid NOT NULL,
	"response_status" integer,
	"final_url" text,
	"response_metadata" jsonb DEFAULT '{}' NOT NULL,
	"content_hash" text,
	"change_detected" boolean DEFAULT false NOT NULL,
	"safe_error_code" text,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "legal_source_monitor_checks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "legal_source_monitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"source_id" uuid NOT NULL,
	"exact_url" text NOT NULL,
	"schedule" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"etag" text,
	"last_modified" text,
	"last_checked_at" timestamp with time zone,
	"next_check_at" timestamp with time zone NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "legal_source_monitors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "legal_source_processing_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"rendition_id" uuid NOT NULL,
	"job_id" uuid,
	"embedding_job_id" uuid,
	"generation_number" integer NOT NULL,
	"state" "legal_processing_state" DEFAULT 'queued'::"legal_processing_state" NOT NULL,
	"parser_config" jsonb NOT NULL,
	"ocr_config" jsonb,
	"chunker_config" jsonb NOT NULL,
	"embedding_config" jsonb NOT NULL,
	"extraction_hash" text,
	"normalized_text_hash" text,
	"quality_metrics" jsonb DEFAULT '{}' NOT NULL,
	"reliable_anchors" boolean DEFAULT false NOT NULL,
	"reviewer_id" uuid,
	"reviewed_at" timestamp with time zone,
	"safe_error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_processing_review_check" CHECK ("state" <> 'reviewed' or ("reviewer_id" is not null and "reviewed_at" is not null and "reliable_anchors" and "extraction_hash" is not null and "normalized_text_hash" is not null and "embedding_job_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "legal_source_processing_generations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "legal_source_renditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"source_version_id" uuid NOT NULL,
	"language" text NOT NULL,
	"translation_status" "legal_translation_status" NOT NULL,
	"authoritative_rendition_id" uuid,
	"storage_bucket" text NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"content_hash" text NOT NULL,
	"duplicate_acknowledged" boolean DEFAULT false NOT NULL,
	"upload_session_id" uuid,
	"import_job_id" uuid,
	"imported_from_url" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_source_renditions_id_version_unique" UNIQUE("id","source_version_id"),
	CONSTRAINT "legal_source_renditions_size_check" CHECK ("byte_size" > 0),
	CONSTRAINT "legal_source_renditions_translation_check" CHECK (("translation_status" = 'official' and "authoritative_rendition_id" is null) or ("translation_status" <> 'official' and "authoritative_rendition_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "legal_source_renditions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "legal_source_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"source_id" uuid NOT NULL,
	"version_label" text NOT NULL,
	"official_identifier" text,
	"upstream_published_at" timestamp with time zone,
	"retrieved_at" timestamp with time zone,
	"upstream_url" text,
	"effective_from" date,
	"effective_to" date,
	"content_hash" text NOT NULL,
	"status" "legal_source_version_status" DEFAULT 'draft'::"legal_source_version_status" NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"withdrawn_by" uuid,
	"withdrawn_at" timestamp with time zone,
	"withdrawal_reason" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_source_versions_effective_check" CHECK ("effective_to" is null or "effective_from" is null or "effective_to" >= "effective_from"),
	CONSTRAINT "legal_source_versions_lifecycle_check" CHECK ((
        "status" = 'draft'
        and "reviewed_by" is null
        and "reviewed_at" is null
        and "published_at" is null
        and "withdrawn_by" is null
        and "withdrawn_at" is null
        and "withdrawal_reason" is null
      ) or (
        "status" = 'reviewed'
        and "reviewed_by" is not null
        and "reviewed_at" is not null
        and "published_at" is null
        and "withdrawn_by" is null
        and "withdrawn_at" is null
        and "withdrawal_reason" is null
      ) or (
        "status" = 'published'
        and "reviewed_by" is not null
        and "reviewed_at" is not null
        and "published_at" is not null
        and "withdrawn_by" is null
        and "withdrawn_at" is null
        and "withdrawal_reason" is null
      ) or (
        "status" = 'withdrawn'
        and "reviewed_by" is not null
        and "reviewed_at" is not null
        and "published_at" is not null
        and "withdrawn_by" is not null
        and "withdrawn_at" is not null
        and "withdrawal_reason" is not null
      ))
);
--> statement-breakpoint
ALTER TABLE "legal_source_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "legal_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"family_id" uuid NOT NULL,
	"stable_code" text NOT NULL,
	"title" text NOT NULL,
	"source_kind" text NOT NULL,
	"authority_tier" "legal_authority_tier" NOT NULL,
	"canonical_publisher" text NOT NULL,
	"legal_instrument_id" uuid,
	"legal_provision_id" uuid,
	"withdrawn_at" timestamp with time zone,
	"withdrawal_reason" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_sources_withdrawal_check" CHECK ("withdrawn_at" is null or "withdrawal_reason" is not null)
);
--> statement-breakpoint
ALTER TABLE "legal_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nis2_result_projections" (
	"artifact_revision_id" uuid PRIMARY KEY,
	"country_code" text,
	"size_classification" text NOT NULL,
	"jurisdiction_profile_version_id" uuid
);
--> statement-breakpoint
ALTER TABLE "nis2_result_projections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organization_ai_provider_policies" (
	"organization_id" uuid PRIMARY KEY,
	"allowed_provider_modes" jsonb DEFAULT '[]' NOT NULL,
	"external_disclosure_allowed" boolean DEFAULT false NOT NULL,
	"retention_classification" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_ai_policies_version_check" CHECK ("version" > 0)
);
--> statement-breakpoint
ALTER TABLE "organization_ai_provider_policies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organization_fact_definition_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"fact_key" text NOT NULL,
	"version_label" text NOT NULL,
	"label_content_revision_id" uuid NOT NULL,
	"description_content_revision_id" uuid NOT NULL,
	"content_hash" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_fact_definition_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organization_fact_definitions" (
	"key" text PRIMARY KEY,
	"data_type" "organization_fact_data_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_fact_definitions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organization_fact_value_options" (
	"organization_fact_value_id" uuid,
	"fact_key" text NOT NULL,
	"fact_option_id" uuid,
	CONSTRAINT "organization_fact_value_options_pk" PRIMARY KEY("organization_fact_value_id","fact_option_id")
);
--> statement-breakpoint
ALTER TABLE "organization_fact_value_options" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organization_fact_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"fact_key" text NOT NULL,
	"text_value" text,
	"number_value" numeric,
	"boolean_value" boolean,
	"structured_value" jsonb,
	"source_type" text NOT NULL,
	"source_revision_id" uuid NOT NULL,
	"confidence" numeric(5,4),
	"is_current" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_fact_values_id_fact_unique" UNIQUE("id","fact_key"),
	CONSTRAINT "organization_fact_values_scalar_representation_check" CHECK (num_nonnulls("text_value", "number_value", "boolean_value", "structured_value") <= 1)
);
--> statement-breakpoint
ALTER TABLE "organization_fact_values" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organization_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" "organization_role" DEFAULT 'member'::"organization_role" NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"accepted_by_user_id" uuid,
	"token_hash" text NOT NULL,
	"status" "organization_invitation_status" DEFAULT 'pending'::"organization_invitation_status" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organization_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "organization_role" DEFAULT 'member'::"organization_role" NOT NULL,
	"status" "organization_membership_status" DEFAULT 'active'::"organization_membership_status" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_memberships_version_positive" CHECK ("version" > 0)
);
--> statement-breakpoint
ALTER TABLE "organization_memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(255) NOT NULL,
	"legal_name" varchar(255),
	"country" varchar(2) DEFAULT 'DE' NOT NULL,
	"archived_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_version_positive" CHECK ("version" > 0)
);
--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "platform_administrators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL CONSTRAINT "platform_administrators_user_unique" UNIQUE,
	"granted_by_user_id" uuid,
	"grant_reason" text NOT NULL,
	"revoked_by_user_id" uuid,
	"revoke_reason" text,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_administrators_revocation_complete_check" CHECK (("revoked_at" is null and "revoked_by_user_id" is null and "revoke_reason" is null) or ("revoked_at" is not null and "revoke_reason" is not null))
);
--> statement-breakpoint
ALTER TABLE "platform_administrators" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "platform_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"actor_user_id" uuid,
	"event_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"request_id" text,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_audit_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "question_fact_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"question_id" uuid NOT NULL,
	"fact_key" text NOT NULL,
	"transform" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "question_fact_mappings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "question_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"question_id" uuid NOT NULL,
	"stable_value" text NOT NULL,
	"label_content_revision_id" uuid NOT NULL,
	"fact_option_id" uuid,
	"position" integer NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	CONSTRAINT "question_options_question_id_unique" UNIQUE("question_id","id")
);
--> statement-breakpoint
ALTER TABLE "question_options" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "questionnaire_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"questionnaire_id" uuid NOT NULL,
	"version_label" text NOT NULL,
	"title_content_revision_id" uuid NOT NULL,
	"status" "compliance_framework_version_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "questionnaire_versions_id_questionnaire_unique" UNIQUE("id","questionnaire_id")
);
--> statement-breakpoint
ALTER TABLE "questionnaire_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "questionnaires" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"module_id" uuid NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "questionnaires_id_module_unique" UNIQUE("id","module_id")
);
--> statement-breakpoint
ALTER TABLE "questionnaires" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"questionnaire_version_id" uuid NOT NULL,
	"stable_key" text NOT NULL,
	"position" integer NOT NULL,
	"question_content_revision_id" uuid NOT NULL,
	"help_content_revision_id" uuid,
	"tooltip_content_revision_id" uuid,
	"answer_type" "question_answer_type" NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "questions_id_stable_key_unique" UNIQUE("id","stable_key"),
	CONSTRAINT "questions_id_version_unique" UNIQUE("id","questionnaire_version_id")
);
--> statement-breakpoint
ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "report_action_plan_sources" (
	"report_id" uuid,
	"action_plan_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_action_plan_sources_pkey" PRIMARY KEY("report_id","action_plan_id")
);
--> statement-breakpoint
ALTER TABLE "report_action_plan_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "report_artifact_sources" (
	"report_id" uuid,
	"artifact_revision_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_artifact_sources_pkey" PRIMARY KEY("report_id","artifact_revision_id")
);
--> statement-breakpoint
ALTER TABLE "report_artifact_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "report_document_sources" (
	"report_id" uuid,
	"document_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_document_sources_pkey" PRIMARY KEY("report_id","document_version_id")
);
--> statement-breakpoint
ALTER TABLE "report_document_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"kind" text DEFAULT 'compliance_summary' NOT NULL,
	"locale" text NOT NULL,
	"state" "report_state" DEFAULT 'queued'::"report_state" NOT NULL,
	"input_snapshot" jsonb NOT NULL,
	"input_hash" text NOT NULL,
	"job_id" uuid,
	"storage_bucket" text,
	"storage_path" text,
	"output_hash" text,
	"file_size" integer,
	"safe_error_code" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "reports_output_check" CHECK ("state" <> 'ready' or ("storage_bucket" is not null and "storage_path" is not null and "output_hash" is not null and "file_size" is not null)),
	CONSTRAINT "reports_lifecycle_check" CHECK ((
        "state" in ('queued', 'rendering')
        and "completed_at" is null
      ) or (
        "state" = 'ready'
        and "completed_at" is not null
        and "storage_bucket" is not null
        and "storage_path" is not null
        and "output_hash" is not null
        and "file_size" is not null
      ) or (
        "state" = 'failed'
        and "completed_at" is not null
        and "safe_error_code" is not null
      ) or (
        "state" = 'cancelled'
        and "completed_at" is not null
      ))
);
--> statement-breakpoint
ALTER TABLE "reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rule_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"module_id" uuid NOT NULL,
	"code" text NOT NULL,
	"version_label" text NOT NULL,
	"status" "rule_set_status" NOT NULL,
	"evaluator_kind" text NOT NULL,
	"evaluator_schema_version" integer NOT NULL,
	"rules" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "rule_sets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "scope_entity_type_legal_provisions" (
	"scope_entity_type_version_id" uuid,
	"legal_provision_id" uuid,
	CONSTRAINT "scope_entity_type_legal_provisions_pk" PRIMARY KEY("scope_entity_type_version_id","legal_provision_id")
);
--> statement-breakpoint
ALTER TABLE "scope_entity_type_legal_provisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "scope_entity_type_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"scope_entity_type_id" uuid NOT NULL,
	"scope_model_version_id" uuid NOT NULL,
	"scope_sector_version_id" uuid NOT NULL,
	"annex" integer,
	"rule_kind" text NOT NULL,
	"label_content_revision_id" uuid NOT NULL,
	"description_content_revision_id" uuid NOT NULL,
	"definition_hash" text NOT NULL,
	CONSTRAINT "scope_entity_type_versions_annex_check" CHECK ("annex" is null or "annex" in (1, 2))
);
--> statement-breakpoint
ALTER TABLE "scope_entity_type_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "scope_entity_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scope_entity_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "scope_model_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"scope_model_id" uuid NOT NULL,
	"version_label" text NOT NULL,
	"status" "immutable_component_status" NOT NULL,
	"effective_from" date,
	"effective_to" date,
	"content_hash" text NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "scope_model_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "scope_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scope_models" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "scope_sector_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"scope_sector_id" uuid NOT NULL,
	"scope_model_version_id" uuid NOT NULL,
	"label_content_revision_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scope_sector_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "scope_sectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scope_sectors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "scope_threshold_set_legal_provisions" (
	"scope_threshold_set_id" uuid,
	"legal_provision_id" uuid,
	CONSTRAINT "scope_threshold_set_legal_provisions_pk" PRIMARY KEY("scope_threshold_set_id","legal_provision_id")
);
--> statement-breakpoint
ALTER TABLE "scope_threshold_set_legal_provisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "scope_threshold_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text NOT NULL,
	"version_label" text NOT NULL,
	"status" "immutable_component_status" NOT NULL,
	"medium_employee_threshold" integer NOT NULL,
	"medium_turnover_threshold" numeric NOT NULL,
	"medium_balance_sheet_threshold" numeric NOT NULL,
	"large_employee_threshold" integer NOT NULL,
	"large_turnover_threshold" numeric NOT NULL,
	"large_balance_sheet_threshold" numeric NOT NULL,
	"employee_comparison" text NOT NULL,
	"financial_comparison" text NOT NULL,
	"content_hash" text NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "scope_threshold_sets_positive_check" CHECK ("medium_employee_threshold" > 0 and "large_employee_threshold" > "medium_employee_threshold")
);
--> statement-breakpoint
ALTER TABLE "scope_threshold_sets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "upload_session_results" (
	"session_id" uuid PRIMARY KEY,
	"document_version_id" uuid,
	"legal_source_rendition_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "upload_session_results_exactly_one_check" CHECK (num_nonnulls("document_version_id", "legal_source_rendition_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "upload_session_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "upload_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid,
	"created_by_user_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"bucket" text NOT NULL,
	"object_path" text NOT NULL,
	"file_name" text NOT NULL,
	"expected_mime_type" text NOT NULL,
	"expected_size" integer NOT NULL,
	"expected_sha256" text,
	"actual_mime_type" text,
	"actual_size" integer,
	"actual_sha256" text,
	"state" "upload_session_state" DEFAULT 'pending'::"upload_session_state" NOT NULL,
	"safe_error_code" text,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "upload_sessions_expected_size_check" CHECK ("expected_size" > 0),
	CONSTRAINT "upload_sessions_completion_check" CHECK ("state" <> 'completed' or "completed_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "upload_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_directory" (
	"user_id" uuid PRIMARY KEY,
	"email" varchar(255) NOT NULL,
	"display_name" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_directory" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "action_plan_item_gaps_gap_idx" ON "action_plan_item_gaps" ("gap_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "action_plan_items_plan_finding_position_unique" ON "action_plan_items" ("action_plan_id","source_finding_id","position");--> statement-breakpoint
CREATE INDEX "action_plan_items_plan_order_idx" ON "action_plan_items" ("action_plan_id","source_finding_id","position");--> statement-breakpoint
CREATE INDEX "action_plan_items_status_idx" ON "action_plan_items" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "action_plans_generation_job_unique" ON "action_plans" ("generation_job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "action_plans_active_organization_unique" ON "action_plans" ("organization_id") WHERE "status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "action_plans_organization_revision_unique" ON "action_plans" ("organization_id","revision_number");--> statement-breakpoint
CREATE UNIQUE INDEX "active_compliance_check_releases_release_unique" ON "active_compliance_check_releases" ("check_release_id");--> statement-breakpoint
CREATE UNIQUE INDEX "active_gap_analysis_releases_release_unique" ON "active_gap_analysis_releases" ("gap_analysis_release_id");--> statement-breakpoint
CREATE INDEX "ai_processing_run_artifact_inputs_artifact_idx" ON "ai_processing_run_artifact_inputs" ("artifact_revision_id");--> statement-breakpoint
CREATE INDEX "ai_processing_run_assessment_inputs_assessment_idx" ON "ai_processing_run_assessment_inputs" ("assessment_revision_id");--> statement-breakpoint
CREATE INDEX "ai_claim_context_context_idx" ON "ai_processing_run_claim_context" ("context_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_run_claims_key_unique" ON "ai_processing_run_claims" ("run_id","claim_key");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_run_context_citation_unique" ON "ai_processing_run_context" ("run_id","citation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_run_context_position_unique" ON "ai_processing_run_context" ("run_id","prompt_position");--> statement-breakpoint
CREATE INDEX "ai_run_context_legal_chunk_idx" ON "ai_processing_run_context" ("legal_chunk_id") WHERE "legal_chunk_id" is not null;--> statement-breakpoint
CREATE INDEX "ai_run_context_document_chunk_idx" ON "ai_processing_run_context" ("document_chunk_id") WHERE "document_chunk_id" is not null;--> statement-breakpoint
CREATE INDEX "ai_run_context_answer_idx" ON "ai_processing_run_context" ("assessment_answer_id") WHERE "assessment_answer_id" is not null;--> statement-breakpoint
CREATE INDEX "ai_processing_run_document_inputs_document_idx" ON "ai_processing_run_document_inputs" ("document_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_run_legal_inputs_unique" ON "ai_processing_run_legal_inputs" ("run_id","corpus_release_id","processing_generation_id");--> statement-breakpoint
CREATE INDEX "ai_run_legal_inputs_release_idx" ON "ai_processing_run_legal_inputs" ("corpus_release_id");--> statement-breakpoint
CREATE INDEX "ai_run_legal_inputs_source_idx" ON "ai_processing_run_legal_inputs" ("source_version_id");--> statement-breakpoint
CREATE INDEX "ai_run_legal_inputs_generation_idx" ON "ai_processing_run_legal_inputs" ("processing_generation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_processing_runs_idempotency_unique" ON "ai_processing_runs" ("organization_id","operation_kind","idempotency_key");--> statement-breakpoint
CREATE INDEX "ai_processing_runs_status_idx" ON "ai_processing_runs" ("status");--> statement-breakpoint
CREATE INDEX "ai_processing_runs_org_assessment_operation_created_idx" ON "ai_processing_runs" ("organization_id","assessment_revision_id","operation_kind","created_at");--> statement-breakpoint
CREATE INDEX "api_rate_limit_windows_expiry_idx" ON "api_rate_limit_windows" ("expires_at");--> statement-breakpoint
CREATE INDEX "artifact_revision_artifact_sources_source_idx" ON "artifact_revision_artifact_sources" ("source_artifact_revision_id");--> statement-breakpoint
CREATE INDEX "artifact_revision_assessment_sources_assessment_idx" ON "artifact_revision_assessment_sources" ("assessment_revision_id");--> statement-breakpoint
CREATE INDEX "artifact_revision_document_sources_document_idx" ON "artifact_revision_document_sources" ("document_version_id");--> statement-breakpoint
CREATE INDEX "assessment_answer_options_option_idx" ON "assessment_answer_options" ("question_option_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assessment_answers_revision_question_unique" ON "assessment_answers" ("assessment_revision_id","question_id");--> statement-breakpoint
CREATE INDEX "idx_answers_stable_key" ON "assessment_answers" ("question_stable_key");--> statement-breakpoint
CREATE INDEX "idx_answers_structured_value_gin" ON "assessment_answers" USING gin ("structured_value");--> statement-breakpoint
CREATE UNIQUE INDEX "assessment_revisions_assessment_number_unique" ON "assessment_revisions" ("assessment_id","revision_number");--> statement-breakpoint
CREATE INDEX "assessment_revisions_status_idx" ON "assessment_revisions" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "assessments_active_org_module_release_unique" ON "assessments" ("organization_id","module_id","check_release_id") WHERE "status" = 'active' AND "check_release_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "assessments_active_org_module_gap_release_unique" ON "assessments" ("organization_id","module_id","gap_analysis_release_id") WHERE "status" = 'active' AND "gap_analysis_release_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "assessments_organization_idx" ON "assessments" ("organization_id");--> statement-breakpoint
CREATE INDEX "assessments_module_idx" ON "assessments" ("module_id");--> statement-breakpoint
CREATE INDEX "assessments_current_revision_idx" ON "assessments" ("current_revision_id");--> statement-breakpoint
CREATE INDEX "assessments_check_release_idx" ON "assessments" ("check_release_id");--> statement-breakpoint
CREATE INDEX "assessments_gap_release_idx" ON "assessments" ("gap_analysis_release_id");--> statement-breakpoint
CREATE INDEX "assessments_applicability_artifact_idx" ON "assessments" ("applicability_artifact_revision_id");--> statement-breakpoint
CREATE INDEX "audit_events_organization_created_idx" ON "audit_events" ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "background_job_results_artifact_idx" ON "background_job_results" ("generated_artifact_revision_id");--> statement-breakpoint
CREATE INDEX "background_job_results_report_idx" ON "background_job_results" ("report_id");--> statement-breakpoint
CREATE INDEX "background_job_results_rendition_idx" ON "background_job_results" ("legal_source_rendition_id");--> statement-breakpoint
CREATE INDEX "background_job_results_processing_idx" ON "background_job_results" ("legal_processing_generation_id");--> statement-breakpoint
CREATE INDEX "background_job_results_monitor_idx" ON "background_job_results" ("legal_source_monitor_id");--> statement-breakpoint
CREATE INDEX "background_job_results_evaluation_idx" ON "background_job_results" ("legal_corpus_evaluation_id");--> statement-breakpoint
CREATE INDEX "background_job_results_action_plan_idx" ON "background_job_results" ("action_plan_id");--> statement-breakpoint
CREATE INDEX "background_jobs_queue_idx" ON "background_jobs" ("state","run_after","created_at");--> statement-breakpoint
CREATE INDEX "background_jobs_organization_idx" ON "background_jobs" ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "background_jobs_lease_idx" ON "background_jobs" ("state","lease_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "background_jobs_cleanup_active_unique" ON "background_jobs" ("kind") WHERE "kind" = 'cleanup' and "state" in ('queued', 'running', 'cancellation_requested');--> statement-breakpoint
CREATE UNIQUE INDEX "background_jobs_legal_monitor_active_unique" ON "background_jobs" (("payload" ->> 'monitorId')) WHERE "kind" = 'legal-source-monitor' and "state" in ('queued', 'running', 'cancellation_requested');--> statement-breakpoint
CREATE UNIQUE INDEX "background_jobs_action_plan_generation_active_unique" ON "background_jobs" ("organization_id") WHERE "kind" = 'action-plan-generation' and "state" in ('queued', 'running', 'cancellation_requested');--> statement-breakpoint
CREATE INDEX "compliance_release_activations_check_idx" ON "compliance_check_release_activations" ("check_code","activated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_check_releases_check_version_unique" ON "compliance_check_releases" ("check_code","version_label");--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_check_releases_aggregate_hash_unique" ON "compliance_check_releases" ("aggregate_hash");--> statement-breakpoint
CREATE INDEX "compliance_check_releases_status_idx" ON "compliance_check_releases" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_framework_versions_framework_label_unique" ON "compliance_framework_versions" ("framework_id","version_label");--> statement-breakpoint
CREATE INDEX "compliance_framework_versions_status_idx" ON "compliance_framework_versions" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_frameworks_code_unique" ON "compliance_frameworks" ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_modules_framework_version_code_unique" ON "compliance_modules" ("framework_version_id","code");--> statement-breakpoint
CREATE INDEX "compliance_modules_code_idx" ON "compliance_modules" ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "content_items_stable_key_unique" ON "content_items" ("stable_key");--> statement-breakpoint
CREATE UNIQUE INDEX "content_revisions_item_number_unique" ON "content_revisions" ("content_item_id","revision_number");--> statement-breakpoint
CREATE UNIQUE INDEX "content_revisions_item_hash_unique" ON "content_revisions" ("content_item_id","content_hash");--> statement-breakpoint
CREATE INDEX "content_translations_locale_idx" ON "content_translations" ("locale");--> statement-breakpoint
CREATE INDEX "document_chunk_embeddings_chunk_idx" ON "document_chunk_embeddings" ("chunk_id");--> statement-breakpoint
CREATE INDEX "document_chunk_embeddings_hnsw_idx" ON "document_chunk_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "document_chunks_extraction_index_unique" ON "document_chunks" ("extraction_id","chunk_index");--> statement-breakpoint
CREATE INDEX "document_chunks_search_idx" ON "document_chunks" USING gin ("search_vector");--> statement-breakpoint
CREATE UNIQUE INDEX "document_embedding_generations_config_unique" ON "document_embedding_generations" ("extraction_id","provider","model","model_revision","dimensions","retrieval_instruction_id","chunking_version");--> statement-breakpoint
CREATE INDEX "document_embedding_generations_status_idx" ON "document_embedding_generations" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "document_extractions_parser_unique" ON "document_extractions" ("document_version_id","parser_kind","parser_version");--> statement-breakpoint
CREATE INDEX "document_extractions_status_idx" ON "document_extractions" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "document_versions_document_number_unique" ON "document_versions" ("document_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "document_versions_storage_path_unique" ON "document_versions" ("storage_bucket","storage_path");--> statement-breakpoint
CREATE INDEX "document_versions_hash_idx" ON "document_versions" ("content_hash");--> statement-breakpoint
CREATE INDEX "documents_organization_created_idx" ON "documents" ("organization_id","created_at","id");--> statement-breakpoint
CREATE INDEX "documents_status_idx" ON "documents" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "fact_options_definition_value_unique" ON "fact_options" ("fact_definition_key","stable_value");--> statement-breakpoint
CREATE INDEX "gap_analysis_release_activations_code_idx" ON "gap_analysis_release_activations" ("release_code","activated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "gap_analysis_release_rules_requirement_unique" ON "gap_analysis_release_applicability_rules" ("gap_analysis_release_id","requirement_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gap_analysis_releases_code_version_unique" ON "gap_analysis_releases" ("release_code","version_label");--> statement-breakpoint
CREATE UNIQUE INDEX "gap_analysis_releases_hash_unique" ON "gap_analysis_releases" ("aggregate_hash");--> statement-breakpoint
CREATE INDEX "gap_analysis_releases_status_idx" ON "gap_analysis_releases" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "gap_finding_evidence_citation_unique" ON "gap_finding_evidence" ("finding_id","citation_id");--> statement-breakpoint
CREATE INDEX "gap_finding_evidence_answer_idx" ON "gap_finding_evidence" ("assessment_answer_id") WHERE "assessment_answer_id" is not null;--> statement-breakpoint
CREATE INDEX "gap_finding_evidence_document_chunk_idx" ON "gap_finding_evidence" ("document_chunk_id") WHERE "document_chunk_id" is not null;--> statement-breakpoint
CREATE INDEX "gap_finding_evidence_legal_chunk_idx" ON "gap_finding_evidence" ("legal_source_chunk_id") WHERE "legal_source_chunk_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "gap_finding_review_resolutions_finding_unique" ON "gap_finding_review_resolutions" ("artifact_revision_id","finding_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gap_findings_revision_requirement_unique" ON "gap_findings" ("artifact_revision_id","requirement_version_id");--> statement-breakpoint
CREATE INDEX "gap_findings_status_idx" ON "gap_findings" ("status");--> statement-breakpoint
CREATE INDEX "gap_findings_generation_run_idx" ON "gap_findings" ("generation_run_id");--> statement-breakpoint
CREATE INDEX "gap_item_evidence_source_idx" ON "gap_item_evidence" ("gap_finding_evidence_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gap_items_finding_position_unique" ON "gap_items" ("finding_id","position");--> statement-breakpoint
CREATE INDEX "gap_items_answer_idx" ON "gap_items" ("source_assessment_answer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gap_question_legal_provisions_position_unique" ON "gap_question_legal_provisions" ("question_id","position");--> statement-breakpoint
CREATE INDEX "gap_questionnaire_draft_answers_option_idx" ON "gap_questionnaire_draft_answers" ("question_option_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gap_questionnaire_drafts_open_assessment_unique" ON "gap_questionnaire_drafts" ("assessment_id") WHERE "status" = 'open';--> statement-breakpoint
CREATE INDEX "gap_reassessment_draft_documents_version_idx" ON "gap_reassessment_draft_documents" ("document_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gap_reassessment_drafts_open_assessment_unique" ON "gap_reassessment_drafts" ("assessment_id") WHERE "status" = 'open';--> statement-breakpoint
CREATE INDEX "gap_reassessment_drafts_organization_assessment_created_idx" ON "gap_reassessment_drafts" ("organization_id","assessment_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "gap_reassessment_drafts_generation_job_unique" ON "gap_reassessment_drafts" ("generation_job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gap_requirement_question_mappings_release_question_unique" ON "gap_requirement_question_mappings" ("gap_analysis_release_id","question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gap_requirement_question_mappings_requirement_position_unique" ON "gap_requirement_question_mappings" ("gap_analysis_release_id","requirement_version_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "gap_requirement_set_members_position_unique" ON "gap_requirement_set_members" ("requirement_set_version_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "gap_requirement_set_versions_label_unique" ON "gap_requirement_set_versions" ("requirement_set_id","version_label");--> statement-breakpoint
CREATE UNIQUE INDEX "gap_requirement_set_versions_hash_unique" ON "gap_requirement_set_versions" ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "gap_requirement_sets_code_unique" ON "gap_requirement_sets" ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "gap_requirement_versions_requirement_version_unique" ON "gap_requirement_versions" ("requirement_id","version_label");--> statement-breakpoint
CREATE UNIQUE INDEX "gap_requirement_versions_hash_unique" ON "gap_requirement_versions" ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "gap_requirements_code_unique" ON "gap_requirements" ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "generated_artifact_revisions_artifact_number_unique" ON "generated_artifact_revisions" ("artifact_id","revision_number");--> statement-breakpoint
CREATE INDEX "generated_artifact_revisions_status_idx" ON "generated_artifact_revisions" ("status");--> statement-breakpoint
CREATE INDEX "generated_artifact_revisions_rule_set_idx" ON "generated_artifact_revisions" ("rule_set_id");--> statement-breakpoint
CREATE INDEX "generated_artifact_revisions_release_idx" ON "generated_artifact_revisions" ("check_release_id");--> statement-breakpoint
CREATE INDEX "generated_artifact_revisions_gap_release_idx" ON "generated_artifact_revisions" ("gap_analysis_release_id");--> statement-breakpoint
CREATE INDEX "generated_artifact_revisions_outcome_idx" ON "generated_artifact_revisions" ("outcome_code");--> statement-breakpoint
CREATE INDEX "generated_artifact_revisions_evaluated_at_idx" ON "generated_artifact_revisions" ("evaluated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "generated_artifacts_org_module_type_unique" ON "generated_artifacts" ("organization_id","module_id","artifact_type");--> statement-breakpoint
CREATE INDEX "generated_artifacts_module_idx" ON "generated_artifacts" ("module_id");--> statement-breakpoint
CREATE INDEX "generated_artifacts_current_revision_idx" ON "generated_artifacts" ("current_revision_id");--> statement-breakpoint
CREATE INDEX "generated_artifacts_accepted_revision_idx" ON "generated_artifacts" ("accepted_revision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guest_applicability_checks_token_hash_unique" ON "guest_applicability_checks" ("token_hash");--> statement-breakpoint
CREATE INDEX "guest_applicability_checks_status_idx" ON "guest_applicability_checks" ("status");--> statement-breakpoint
CREATE INDEX "guest_applicability_checks_release_idx" ON "guest_applicability_checks" ("check_release_id");--> statement-breakpoint
CREATE INDEX "guest_applicability_checks_expires_at_idx" ON "guest_applicability_checks" ("expires_at");--> statement-breakpoint
CREATE INDEX "guest_applicability_checks_claimed_user_idx" ON "guest_applicability_checks" ("claimed_by_user_id");--> statement-breakpoint
CREATE INDEX "idempotency_record_results_admin_idx" ON "idempotency_record_results" ("platform_administrator_user_id") WHERE "platform_administrator_user_id" is not null;--> statement-breakpoint
CREATE INDEX "idempotency_record_results_family_idx" ON "idempotency_record_results" ("legal_corpus_family_id") WHERE "legal_corpus_family_id" is not null;--> statement-breakpoint
CREATE INDEX "idempotency_record_results_job_idx" ON "idempotency_record_results" ("background_job_id") WHERE "background_job_id" is not null;--> statement-breakpoint
CREATE INDEX "idempotency_record_results_processing_idx" ON "idempotency_record_results" ("legal_processing_generation_id") WHERE "legal_processing_generation_id" is not null;--> statement-breakpoint
CREATE INDEX "idempotency_record_results_release_idx" ON "idempotency_record_results" ("legal_corpus_release_id") WHERE "legal_corpus_release_id" is not null;--> statement-breakpoint
CREATE INDEX "idempotency_record_results_rendition_idx" ON "idempotency_record_results" ("legal_source_rendition_id") WHERE "legal_source_rendition_id" is not null;--> statement-breakpoint
CREATE INDEX "idempotency_record_results_source_idx" ON "idempotency_record_results" ("legal_source_id") WHERE "legal_source_id" is not null;--> statement-breakpoint
CREATE INDEX "idempotency_record_results_artifact_idx" ON "idempotency_record_results" ("generated_artifact_revision_id") WHERE "generated_artifact_revision_id" is not null;--> statement-breakpoint
CREATE INDEX "idempotency_record_results_assessment_idx" ON "idempotency_record_results" ("assessment_id") WHERE "assessment_id" is not null;--> statement-breakpoint
CREATE INDEX "idempotency_record_results_assessment_revision_idx" ON "idempotency_record_results" ("assessment_revision_id") WHERE "assessment_revision_id" is not null;--> statement-breakpoint
CREATE INDEX "idempotency_record_results_reassessment_idx" ON "idempotency_record_results" ("gap_reassessment_draft_id") WHERE "gap_reassessment_draft_id" is not null;--> statement-breakpoint
CREATE INDEX "idempotency_record_results_invitation_idx" ON "idempotency_record_results" ("organization_invitation_id") WHERE "organization_invitation_id" is not null;--> statement-breakpoint
CREATE INDEX "idempotency_record_results_organization_idx" ON "idempotency_record_results" ("organization_id") WHERE "organization_id" is not null;--> statement-breakpoint
CREATE INDEX "idempotency_record_results_action_plan_idx" ON "idempotency_record_results" ("action_plan_id") WHERE "action_plan_id" is not null;--> statement-breakpoint
CREATE INDEX "idempotency_record_results_report_idx" ON "idempotency_record_results" ("report_id") WHERE "report_id" is not null;--> statement-breakpoint
CREATE INDEX "idempotency_record_results_document_idx" ON "idempotency_record_results" ("document_version_id") WHERE "document_version_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_records_claim_unique" ON "idempotency_records" ("actor_key","scope","operation","key");--> statement-breakpoint
CREATE INDEX "idempotency_records_expiry_idx" ON "idempotency_records" ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jurisdiction_entity_type_mappings_unique" ON "jurisdiction_entity_type_mappings" ("jurisdiction_entity_type_version_id","scope_entity_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "jurisdiction_entity_type_versions_profile_entity_unique" ON "jurisdiction_entity_type_versions" ("jurisdiction_profile_version_id","jurisdiction_entity_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "jurisdiction_entity_types_profile_code_unique" ON "jurisdiction_entity_types" ("jurisdiction_profile_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "jurisdiction_profile_designations_code_unique" ON "jurisdiction_profile_designations" ("jurisdiction_profile_version_id","designation_code");--> statement-breakpoint
CREATE UNIQUE INDEX "jurisdiction_profile_effective_states_code_unique" ON "jurisdiction_profile_effective_states" ("jurisdiction_profile_version_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "jurisdiction_profile_jurisdiction_rules_unique" ON "jurisdiction_profile_jurisdiction_rules" ("jurisdiction_profile_version_id","jurisdiction_entity_type_id","basis_code");--> statement-breakpoint
CREATE UNIQUE INDEX "jurisdiction_profile_versions_label_unique" ON "jurisdiction_profile_versions" ("jurisdiction_profile_id","version_label");--> statement-breakpoint
CREATE UNIQUE INDEX "jurisdiction_profile_versions_hash_unique" ON "jurisdiction_profile_versions" ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "jurisdiction_profiles_code_unique" ON "jurisdiction_profiles" ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "jurisdiction_profiles_country_unique" ON "jurisdiction_profiles" ("country_code");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_corpus_evaluations_job_unique" ON "legal_corpus_evaluations" ("job_id");--> statement-breakpoint
CREATE INDEX "legal_corpus_evaluations_release_idx" ON "legal_corpus_evaluations" ("release_id","evaluated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_corpus_families_code_unique" ON "legal_corpus_families" ("code");--> statement-breakpoint
CREATE INDEX "legal_corpus_families_scope_idx" ON "legal_corpus_families" ("framework_code","jurisdiction_code");--> statement-breakpoint
CREATE INDEX "legal_release_activations_family_idx" ON "legal_corpus_release_activations" ("family_id","activated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_release_members_position_unique" ON "legal_corpus_release_members" ("release_id","position");--> statement-breakpoint
CREATE INDEX "legal_release_members_version_idx" ON "legal_corpus_release_members" ("source_version_id");--> statement-breakpoint
CREATE INDEX "legal_release_members_rendition_idx" ON "legal_corpus_release_members" ("rendition_id");--> statement-breakpoint
CREATE INDEX "legal_release_members_generation_idx" ON "legal_corpus_release_members" ("processing_generation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_corpus_releases_label_unique" ON "legal_corpus_releases" ("family_id","version_label");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_corpus_releases_hash_unique" ON "legal_corpus_releases" ("content_hash");--> statement-breakpoint
CREATE INDEX "legal_corpus_releases_status_idx" ON "legal_corpus_releases" ("family_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_instrument_versions_label_unique" ON "legal_instrument_versions" ("legal_instrument_id","version_label");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_instrument_versions_hash_unique" ON "legal_instrument_versions" ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_instruments_code_unique" ON "legal_instruments" ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_provisions_version_code_unique" ON "legal_provisions" ("legal_instrument_version_id","provision_code");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_change_alerts_check_unique" ON "legal_source_change_alerts" ("monitor_check_id");--> statement-breakpoint
CREATE INDEX "legal_change_alerts_state_idx" ON "legal_source_change_alerts" ("state","created_at");--> statement-breakpoint
CREATE INDEX "legal_chunk_embeddings_chunk_idx" ON "legal_source_chunk_embeddings" ("chunk_id");--> statement-breakpoint
CREATE INDEX "legal_source_chunk_embeddings_hnsw_idx" ON "legal_source_chunk_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "legal_chunk_provisions_provision_idx" ON "legal_source_chunk_provisions" ("legal_provision_id","chunk_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_source_chunks_position_unique" ON "legal_source_chunks" ("generation_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_source_chunks_hash_unique" ON "legal_source_chunks" ("generation_id","text_hash");--> statement-breakpoint
CREATE INDEX "legal_source_chunks_search_idx" ON "legal_source_chunks" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "legal_monitor_checks_monitor_idx" ON "legal_source_monitor_checks" ("monitor_id","checked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_source_monitors_url_unique" ON "legal_source_monitors" ("source_id","exact_url");--> statement-breakpoint
CREATE INDEX "legal_source_monitors_due_idx" ON "legal_source_monitors" ("active","next_check_at");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_processing_generation_unique" ON "legal_source_processing_generations" ("rendition_id","generation_number");--> statement-breakpoint
CREATE INDEX "legal_processing_state_idx" ON "legal_source_processing_generations" ("state","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_source_renditions_storage_unique" ON "legal_source_renditions" ("storage_bucket","storage_path");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_source_renditions_import_job_unique" ON "legal_source_renditions" ("import_job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_source_renditions_unacknowledged_hash_unique" ON "legal_source_renditions" ("content_hash") WHERE not "duplicate_acknowledged";--> statement-breakpoint
CREATE INDEX "legal_source_renditions_version_language_idx" ON "legal_source_renditions" ("source_version_id","language");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_source_versions_label_unique" ON "legal_source_versions" ("source_id","version_label");--> statement-breakpoint
CREATE INDEX "legal_source_versions_effective_idx" ON "legal_source_versions" ("source_id","effective_from","effective_to");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_sources_family_code_unique" ON "legal_sources" ("family_id","stable_code");--> statement-breakpoint
CREATE INDEX "legal_sources_family_tier_idx" ON "legal_sources" ("family_id","authority_tier");--> statement-breakpoint
CREATE INDEX "nis2_result_projections_country_idx" ON "nis2_result_projections" ("country_code");--> statement-breakpoint
CREATE INDEX "nis2_result_projections_size_idx" ON "nis2_result_projections" ("size_classification");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_fact_definition_versions_label_unique" ON "organization_fact_definition_versions" ("fact_key","version_label");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_fact_definition_versions_hash_unique" ON "organization_fact_definition_versions" ("fact_key","content_hash");--> statement-breakpoint
CREATE INDEX "organization_fact_definitions_data_type_idx" ON "organization_fact_definitions" ("data_type");--> statement-breakpoint
CREATE INDEX "organization_fact_value_options_option_idx" ON "organization_fact_value_options" ("fact_option_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_fact_values_current_unique" ON "organization_fact_values" ("organization_id","fact_key") WHERE "is_current" = true;--> statement-breakpoint
CREATE INDEX "idx_org_fact_structured_value_gin" ON "organization_fact_values" USING gin ("structured_value");--> statement-breakpoint
CREATE INDEX "organization_fact_values_org_idx" ON "organization_fact_values" ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_fact_values_fact_key_idx" ON "organization_fact_values" ("fact_key");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_invitations_token_hash_unique" ON "organization_invitations" ("token_hash");--> statement-breakpoint
CREATE INDEX "organization_invitations_org_idx" ON "organization_invitations" ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_invitations_email_idx" ON "organization_invitations" ("email");--> statement-breakpoint
CREATE INDEX "organization_invitations_status_idx" ON "organization_invitations" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_memberships_org_user_unique" ON "organization_memberships" ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "organization_memberships_user_idx" ON "organization_memberships" ("user_id");--> statement-breakpoint
CREATE INDEX "organization_memberships_status_idx" ON "organization_memberships" ("status");--> statement-breakpoint
CREATE INDEX "organizations_name_idx" ON "organizations" ("name");--> statement-breakpoint
CREATE INDEX "organizations_country_idx" ON "organizations" ("country");--> statement-breakpoint
CREATE INDEX "platform_administrators_active_idx" ON "platform_administrators" ("user_id","revoked_at");--> statement-breakpoint
CREATE INDEX "platform_audit_events_created_idx" ON "platform_audit_events" ("created_at");--> statement-breakpoint
CREATE INDEX "platform_audit_events_entity_idx" ON "platform_audit_events" ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "question_fact_mappings_question_fact_unique" ON "question_fact_mappings" ("question_id","fact_key");--> statement-breakpoint
CREATE INDEX "question_fact_mappings_fact_key_idx" ON "question_fact_mappings" ("fact_key");--> statement-breakpoint
CREATE UNIQUE INDEX "question_options_question_value_unique" ON "question_options" ("question_id","stable_value");--> statement-breakpoint
CREATE INDEX "question_options_fact_option_idx" ON "question_options" ("fact_option_id");--> statement-breakpoint
CREATE UNIQUE INDEX "questionnaire_versions_questionnaire_label_unique" ON "questionnaire_versions" ("questionnaire_id","version_label");--> statement-breakpoint
CREATE INDEX "questionnaire_versions_status_idx" ON "questionnaire_versions" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "questionnaires_module_code_unique" ON "questionnaires" ("module_id","code");--> statement-breakpoint
CREATE INDEX "questionnaires_code_idx" ON "questionnaires" ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "questions_version_stable_key_unique" ON "questions" ("questionnaire_version_id","stable_key");--> statement-breakpoint
CREATE INDEX "questions_stable_key_idx" ON "questions" ("stable_key");--> statement-breakpoint
CREATE INDEX "report_action_plan_sources_plan_idx" ON "report_action_plan_sources" ("action_plan_id");--> statement-breakpoint
CREATE INDEX "report_artifact_sources_artifact_idx" ON "report_artifact_sources" ("artifact_revision_id");--> statement-breakpoint
CREATE INDEX "report_document_sources_document_idx" ON "report_document_sources" ("document_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_job_unique" ON "reports" ("job_id");--> statement-breakpoint
CREATE INDEX "reports_organization_created_idx" ON "reports" ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rule_sets_module_code_version_unique" ON "rule_sets" ("module_id","code","version_label");--> statement-breakpoint
CREATE INDEX "rule_sets_status_idx" ON "rule_sets" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "rule_sets_content_hash_unique" ON "rule_sets" ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "scope_entity_type_versions_model_entity_unique" ON "scope_entity_type_versions" ("scope_model_version_id","scope_entity_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scope_entity_types_code_unique" ON "scope_entity_types" ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "scope_model_versions_model_label_unique" ON "scope_model_versions" ("scope_model_id","version_label");--> statement-breakpoint
CREATE UNIQUE INDEX "scope_model_versions_hash_unique" ON "scope_model_versions" ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "scope_models_code_unique" ON "scope_models" ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "scope_sector_versions_model_sector_unique" ON "scope_sector_versions" ("scope_model_version_id","scope_sector_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scope_sectors_code_unique" ON "scope_sectors" ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "scope_threshold_sets_code_version_unique" ON "scope_threshold_sets" ("code","version_label");--> statement-breakpoint
CREATE UNIQUE INDEX "scope_threshold_sets_hash_unique" ON "scope_threshold_sets" ("content_hash");--> statement-breakpoint
CREATE INDEX "upload_session_results_document_idx" ON "upload_session_results" ("document_version_id");--> statement-breakpoint
CREATE INDEX "upload_session_results_rendition_idx" ON "upload_session_results" ("legal_source_rendition_id");--> statement-breakpoint
CREATE UNIQUE INDEX "upload_sessions_object_path_unique" ON "upload_sessions" ("bucket","object_path");--> statement-breakpoint
CREATE INDEX "upload_sessions_owner_idx" ON "upload_sessions" ("created_by_user_id","state");--> statement-breakpoint
CREATE INDEX "upload_sessions_organization_idx" ON "upload_sessions" ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "upload_sessions_expiry_idx" ON "upload_sessions" ("state","expires_at");--> statement-breakpoint
CREATE INDEX "user_directory_email_idx" ON "user_directory" (lower("email"));--> statement-breakpoint
ALTER TABLE "action_plan_item_gaps" ADD CONSTRAINT "action_plan_item_gaps_action_category_fk" FOREIGN KEY ("action_plan_item_id","source_finding_id") REFERENCES "action_plan_items"("id","source_finding_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "action_plan_item_gaps" ADD CONSTRAINT "action_plan_item_gaps_gap_category_fk" FOREIGN KEY ("gap_item_id","source_finding_id") REFERENCES "gap_items"("id","finding_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "action_plan_items" ADD CONSTRAINT "action_plan_items_plan_fk" FOREIGN KEY ("action_plan_id") REFERENCES "action_plans"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "action_plan_items" ADD CONSTRAINT "action_plan_items_finding_fk" FOREIGN KEY ("source_finding_id") REFERENCES "gap_findings"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_source_gap_revision_fk" FOREIGN KEY ("source_gap_artifact_revision_id") REFERENCES "generated_artifact_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_generation_run_fk" FOREIGN KEY ("generation_run_id") REFERENCES "ai_processing_runs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_generation_job_fk" FOREIGN KEY ("generation_job_id") REFERENCES "background_jobs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "active_compliance_check_releases" ADD CONSTRAINT "active_compliance_check_releases_identity_fk" FOREIGN KEY ("check_code","check_release_id") REFERENCES "compliance_check_releases"("check_code","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "active_gap_analysis_releases" ADD CONSTRAINT "active_gap_analysis_releases_identity_fk" FOREIGN KEY ("release_code","gap_analysis_release_id") REFERENCES "gap_analysis_releases"("release_code","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "active_legal_corpus_releases" ADD CONSTRAINT "active_legal_releases_family_fk" FOREIGN KEY ("family_id") REFERENCES "legal_corpus_families"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "active_legal_corpus_releases" ADD CONSTRAINT "active_legal_corpus_releases_identity_fk" FOREIGN KEY ("family_id","release_id") REFERENCES "legal_corpus_releases"("family_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ai_processing_run_artifact_inputs" ADD CONSTRAINT "ai_processing_run_artifact_inputs_run_fk" FOREIGN KEY ("run_id") REFERENCES "ai_processing_runs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ai_processing_run_artifact_inputs" ADD CONSTRAINT "ai_processing_run_artifact_inputs_artifact_fk" FOREIGN KEY ("artifact_revision_id") REFERENCES "generated_artifact_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ai_processing_run_assessment_inputs" ADD CONSTRAINT "ai_processing_run_assessment_inputs_run_fk" FOREIGN KEY ("run_id") REFERENCES "ai_processing_runs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ai_processing_run_assessment_inputs" ADD CONSTRAINT "ai_processing_run_assessment_inputs_assessment_fk" FOREIGN KEY ("assessment_revision_id") REFERENCES "assessment_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ai_processing_run_claim_context" ADD CONSTRAINT "ai_claim_context_claim_fk" FOREIGN KEY ("claim_id") REFERENCES "ai_processing_run_claims"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ai_processing_run_claim_context" ADD CONSTRAINT "ai_claim_context_context_fk" FOREIGN KEY ("context_id") REFERENCES "ai_processing_run_context"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ai_processing_run_claims" ADD CONSTRAINT "ai_run_claims_run_fk" FOREIGN KEY ("run_id") REFERENCES "ai_processing_runs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ai_processing_run_context" ADD CONSTRAINT "ai_run_context_run_fk" FOREIGN KEY ("run_id") REFERENCES "ai_processing_runs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ai_processing_run_context" ADD CONSTRAINT "ai_run_context_legal_chunk_fk" FOREIGN KEY ("legal_chunk_id") REFERENCES "legal_source_chunks"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ai_processing_run_context" ADD CONSTRAINT "ai_run_context_document_chunk_fk" FOREIGN KEY ("document_chunk_id") REFERENCES "document_chunks"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ai_processing_run_context" ADD CONSTRAINT "ai_run_context_answer_fk" FOREIGN KEY ("assessment_answer_id") REFERENCES "assessment_answers"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ai_processing_run_context" ADD CONSTRAINT "ai_run_context_mapped_provision_fk" FOREIGN KEY ("mapped_legal_provision_id") REFERENCES "legal_provisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ai_processing_run_document_inputs" ADD CONSTRAINT "ai_processing_run_document_inputs_run_fk" FOREIGN KEY ("run_id") REFERENCES "ai_processing_runs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ai_processing_run_document_inputs" ADD CONSTRAINT "ai_processing_run_document_inputs_document_fk" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ai_processing_run_legal_inputs" ADD CONSTRAINT "ai_run_legal_inputs_run_fk" FOREIGN KEY ("run_id") REFERENCES "ai_processing_runs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ai_processing_run_legal_inputs" ADD CONSTRAINT "ai_run_legal_inputs_release_fk" FOREIGN KEY ("corpus_release_id") REFERENCES "legal_corpus_releases"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ai_processing_run_legal_inputs" ADD CONSTRAINT "ai_run_legal_inputs_source_fk" FOREIGN KEY ("source_version_id") REFERENCES "legal_source_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ai_processing_run_legal_inputs" ADD CONSTRAINT "ai_run_legal_inputs_generation_fk" FOREIGN KEY ("processing_generation_id") REFERENCES "legal_source_processing_generations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ai_processing_runs" ADD CONSTRAINT "ai_processing_runs_job_id_background_jobs_id_fkey" FOREIGN KEY ("job_id") REFERENCES "background_jobs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ai_processing_runs" ADD CONSTRAINT "ai_processing_runs_output_artifact_revision_fk" FOREIGN KEY ("output_artifact_revision_id") REFERENCES "generated_artifact_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ai_processing_runs" ADD CONSTRAINT "ai_processing_runs_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ai_processing_runs" ADD CONSTRAINT "ai_processing_runs_assessment_revision_fk" FOREIGN KEY ("assessment_revision_id") REFERENCES "assessment_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "artifact_revision_artifact_sources" ADD CONSTRAINT "artifact_revision_artifact_sources_revision_fk" FOREIGN KEY ("artifact_revision_id") REFERENCES "generated_artifact_revisions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "artifact_revision_artifact_sources" ADD CONSTRAINT "artifact_revision_artifact_sources_source_fk" FOREIGN KEY ("source_artifact_revision_id") REFERENCES "generated_artifact_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "artifact_revision_assessment_sources" ADD CONSTRAINT "artifact_revision_assessment_sources_revision_fk" FOREIGN KEY ("artifact_revision_id") REFERENCES "generated_artifact_revisions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "artifact_revision_assessment_sources" ADD CONSTRAINT "artifact_revision_assessment_sources_assessment_fk" FOREIGN KEY ("assessment_revision_id") REFERENCES "assessment_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "artifact_revision_document_sources" ADD CONSTRAINT "artifact_revision_document_sources_revision_fk" FOREIGN KEY ("artifact_revision_id") REFERENCES "generated_artifact_revisions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "artifact_revision_document_sources" ADD CONSTRAINT "artifact_revision_document_sources_document_fk" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "assessment_answer_options" ADD CONSTRAINT "assessment_answer_options_answer_question_fk" FOREIGN KEY ("assessment_answer_id","question_id") REFERENCES "assessment_answers"("id","question_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "assessment_answer_options" ADD CONSTRAINT "assessment_answer_options_question_option_fk" FOREIGN KEY ("question_id","question_option_id") REFERENCES "question_options"("question_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_revision_fk" FOREIGN KEY ("assessment_revision_id") REFERENCES "assessment_revisions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_question_identity_fk" FOREIGN KEY ("question_id","question_stable_key") REFERENCES "questions"("id","stable_key") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "assessment_requirement_evaluations" ADD CONSTRAINT "assessment_requirement_evaluations_revision_fk" FOREIGN KEY ("assessment_revision_id") REFERENCES "assessment_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "assessment_requirement_evaluations" ADD CONSTRAINT "assessment_requirement_evaluations_requirement_fk" FOREIGN KEY ("requirement_version_id") REFERENCES "gap_requirement_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "assessment_revisions" ADD CONSTRAINT "assessment_revisions_parent_fk" FOREIGN KEY ("parent_revision_id") REFERENCES "assessment_revisions"("id");--> statement-breakpoint
ALTER TABLE "assessment_revisions" ADD CONSTRAINT "assessment_revisions_assessment_fk" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "assessment_revisions" ADD CONSTRAINT "assessment_revisions_questionnaire_version_fk" FOREIGN KEY ("questionnaire_version_id") REFERENCES "questionnaire_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_applicability_artifact_fk" FOREIGN KEY ("applicability_artifact_revision_id") REFERENCES "generated_artifact_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_current_revision_owner_fk" FOREIGN KEY ("id","current_revision_id") REFERENCES "assessment_revisions"("assessment_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_module_fk" FOREIGN KEY ("module_id") REFERENCES "compliance_modules"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_questionnaire_fk" FOREIGN KEY ("questionnaire_id") REFERENCES "questionnaires"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_compliance_release_identity_fk" FOREIGN KEY ("check_release_id","module_id","questionnaire_id") REFERENCES "compliance_check_releases"("id","module_id","questionnaire_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_gap_release_identity_fk" FOREIGN KEY ("gap_analysis_release_id","module_id","questionnaire_id") REFERENCES "gap_analysis_releases"("id","module_id","questionnaire_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "background_job_results" ADD CONSTRAINT "background_job_results_job_fk" FOREIGN KEY ("job_id") REFERENCES "background_jobs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "background_job_results" ADD CONSTRAINT "background_job_results_artifact_fk" FOREIGN KEY ("generated_artifact_revision_id") REFERENCES "generated_artifact_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "background_job_results" ADD CONSTRAINT "background_job_results_report_fk" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "background_job_results" ADD CONSTRAINT "background_job_results_rendition_fk" FOREIGN KEY ("legal_source_rendition_id") REFERENCES "legal_source_renditions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "background_job_results" ADD CONSTRAINT "background_job_results_processing_fk" FOREIGN KEY ("legal_processing_generation_id") REFERENCES "legal_source_processing_generations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "background_job_results" ADD CONSTRAINT "background_job_results_monitor_fk" FOREIGN KEY ("legal_source_monitor_id") REFERENCES "legal_source_monitors"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "background_job_results" ADD CONSTRAINT "background_job_results_evaluation_fk" FOREIGN KEY ("legal_corpus_evaluation_id") REFERENCES "legal_corpus_evaluations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "background_job_results" ADD CONSTRAINT "background_job_results_action_plan_fk" FOREIGN KEY ("action_plan_id") REFERENCES "action_plans"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "compliance_check_release_activations" ADD CONSTRAINT "compliance_release_activations_previous_identity_fk" FOREIGN KEY ("check_code","previous_release_id") REFERENCES "compliance_check_releases"("check_code","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "compliance_check_release_activations" ADD CONSTRAINT "compliance_release_activations_active_identity_fk" FOREIGN KEY ("check_code","activated_release_id") REFERENCES "compliance_check_releases"("check_code","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "compliance_check_release_content_revisions" ADD CONSTRAINT "compliance_release_content_release_fk" FOREIGN KEY ("check_release_id") REFERENCES "compliance_check_releases"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "compliance_check_release_content_revisions" ADD CONSTRAINT "compliance_release_content_revision_fk" FOREIGN KEY ("content_revision_id") REFERENCES "content_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "compliance_check_release_corpus_releases" ADD CONSTRAINT "check_corpus_pins_check_fk" FOREIGN KEY ("check_release_id") REFERENCES "compliance_check_releases"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "compliance_check_release_corpus_releases" ADD CONSTRAINT "check_corpus_pins_family_fk" FOREIGN KEY ("family_id") REFERENCES "legal_corpus_families"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "compliance_check_release_corpus_releases" ADD CONSTRAINT "check_corpus_pins_release_fk" FOREIGN KEY ("corpus_release_id") REFERENCES "legal_corpus_releases"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "compliance_check_release_fact_versions" ADD CONSTRAINT "compliance_check_release_fact_versions_release_fk" FOREIGN KEY ("check_release_id") REFERENCES "compliance_check_releases"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "compliance_check_release_fact_versions" ADD CONSTRAINT "compliance_check_release_fact_versions_fact_fk" FOREIGN KEY ("fact_definition_version_id") REFERENCES "organization_fact_definition_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "compliance_check_release_profiles" ADD CONSTRAINT "compliance_check_release_profiles_release_fk" FOREIGN KEY ("check_release_id") REFERENCES "compliance_check_releases"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "compliance_check_release_profiles" ADD CONSTRAINT "compliance_check_release_profiles_profile_fk" FOREIGN KEY ("jurisdiction_profile_version_id") REFERENCES "jurisdiction_profile_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "compliance_check_releases" ADD CONSTRAINT "compliance_check_releases_module_fk" FOREIGN KEY ("module_id") REFERENCES "compliance_modules"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "compliance_check_releases" ADD CONSTRAINT "compliance_check_releases_questionnaire_version_identity_fk" FOREIGN KEY ("questionnaire_version_id","questionnaire_id") REFERENCES "questionnaire_versions"("id","questionnaire_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "compliance_check_releases" ADD CONSTRAINT "compliance_check_releases_questionnaire_module_identity_fk" FOREIGN KEY ("questionnaire_id","module_id") REFERENCES "questionnaires"("id","module_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "compliance_check_releases" ADD CONSTRAINT "compliance_check_releases_scope_model_fk" FOREIGN KEY ("scope_model_version_id") REFERENCES "scope_model_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "compliance_check_releases" ADD CONSTRAINT "compliance_check_releases_threshold_fk" FOREIGN KEY ("scope_threshold_set_id") REFERENCES "scope_threshold_sets"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "compliance_check_releases" ADD CONSTRAINT "compliance_check_releases_rule_set_fk" FOREIGN KEY ("rule_set_id") REFERENCES "rule_sets"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "compliance_framework_versions" ADD CONSTRAINT "compliance_framework_versions_framework_fk" FOREIGN KEY ("framework_id") REFERENCES "compliance_frameworks"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "compliance_framework_versions" ADD CONSTRAINT "compliance_framework_versions_name_content_fk" FOREIGN KEY ("name_content_revision_id") REFERENCES "content_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "compliance_framework_versions" ADD CONSTRAINT "compliance_framework_versions_description_content_fk" FOREIGN KEY ("description_content_revision_id") REFERENCES "content_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "compliance_modules" ADD CONSTRAINT "compliance_modules_framework_version_fk" FOREIGN KEY ("framework_version_id") REFERENCES "compliance_framework_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "compliance_modules" ADD CONSTRAINT "compliance_modules_name_content_fk" FOREIGN KEY ("name_content_revision_id") REFERENCES "content_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_item_fk" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "content_translations" ADD CONSTRAINT "content_translations_revision_fk" FOREIGN KEY ("content_revision_id") REFERENCES "content_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "document_chunk_embeddings" ADD CONSTRAINT "document_chunk_embeddings_generation_fk" FOREIGN KEY ("generation_id") REFERENCES "document_embedding_generations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "document_chunk_embeddings" ADD CONSTRAINT "document_chunk_embeddings_chunk_fk" FOREIGN KEY ("chunk_id") REFERENCES "document_chunks"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_extraction_fk" FOREIGN KEY ("extraction_id") REFERENCES "document_extractions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "document_embedding_generations" ADD CONSTRAINT "document_embedding_generations_extraction_fk" FOREIGN KEY ("extraction_id") REFERENCES "document_extractions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "document_extractions" ADD CONSTRAINT "document_extractions_version_fk" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_fk" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_current_version_owner_fk" FOREIGN KEY ("id","current_version_id") REFERENCES "document_versions"("document_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "fact_options" ADD CONSTRAINT "fact_options_jurisdiction_entity_type_fk" FOREIGN KEY ("jurisdiction_entity_type_id") REFERENCES "jurisdiction_entity_types"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "fact_options" ADD CONSTRAINT "fact_options_definition_fk" FOREIGN KEY ("fact_definition_key") REFERENCES "organization_fact_definitions"("key") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "fact_options" ADD CONSTRAINT "fact_options_entity_type_fk" FOREIGN KEY ("scope_entity_type_id") REFERENCES "scope_entity_types"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_analysis_release_activations" ADD CONSTRAINT "gap_analysis_release_activations_previous_identity_fk" FOREIGN KEY ("release_code","previous_release_id") REFERENCES "gap_analysis_releases"("release_code","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_analysis_release_activations" ADD CONSTRAINT "gap_analysis_release_activations_active_identity_fk" FOREIGN KEY ("release_code","activated_release_id") REFERENCES "gap_analysis_releases"("release_code","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_analysis_release_applicability_rules" ADD CONSTRAINT "gap_analysis_release_rules_release_fk" FOREIGN KEY ("gap_analysis_release_id") REFERENCES "gap_analysis_releases"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_analysis_release_applicability_rules" ADD CONSTRAINT "gap_analysis_release_rules_requirement_fk" FOREIGN KEY ("requirement_version_id") REFERENCES "gap_requirement_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_analysis_release_corpus_releases" ADD CONSTRAINT "gap_corpus_pins_gap_fk" FOREIGN KEY ("gap_analysis_release_id") REFERENCES "gap_analysis_releases"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_analysis_release_corpus_releases" ADD CONSTRAINT "gap_corpus_pins_family_fk" FOREIGN KEY ("family_id") REFERENCES "legal_corpus_families"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_analysis_release_corpus_releases" ADD CONSTRAINT "gap_corpus_pins_release_fk" FOREIGN KEY ("corpus_release_id") REFERENCES "legal_corpus_releases"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_analysis_releases" ADD CONSTRAINT "gap_analysis_releases_module_fk" FOREIGN KEY ("module_id") REFERENCES "compliance_modules"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_analysis_releases" ADD CONSTRAINT "gap_analysis_releases_questionnaire_version_identity_fk" FOREIGN KEY ("questionnaire_version_id","questionnaire_id") REFERENCES "questionnaire_versions"("id","questionnaire_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_analysis_releases" ADD CONSTRAINT "gap_analysis_releases_questionnaire_module_identity_fk" FOREIGN KEY ("questionnaire_id","module_id") REFERENCES "questionnaires"("id","module_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_analysis_releases" ADD CONSTRAINT "gap_analysis_releases_requirement_set_fk" FOREIGN KEY ("requirement_set_version_id") REFERENCES "gap_requirement_set_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_analysis_releases" ADD CONSTRAINT "gap_analysis_releases_check_release_fk" FOREIGN KEY ("compatible_check_release_id") REFERENCES "compliance_check_releases"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_finding_evidence" ADD CONSTRAINT "gap_finding_evidence_legal_source_chunk_fk" FOREIGN KEY ("legal_source_chunk_id") REFERENCES "legal_source_chunks"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_finding_evidence" ADD CONSTRAINT "gap_finding_evidence_finding_fk" FOREIGN KEY ("finding_id") REFERENCES "gap_findings"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "gap_finding_evidence" ADD CONSTRAINT "gap_finding_evidence_answer_fk" FOREIGN KEY ("assessment_answer_id") REFERENCES "assessment_answers"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_finding_evidence" ADD CONSTRAINT "gap_finding_evidence_chunk_fk" FOREIGN KEY ("document_chunk_id") REFERENCES "document_chunks"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_finding_review_resolutions" ADD CONSTRAINT "gap_finding_review_resolutions_finding_revision_fk" FOREIGN KEY ("artifact_revision_id","finding_id") REFERENCES "gap_findings"("artifact_revision_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_findings" ADD CONSTRAINT "gap_findings_artifact_revision_fk" FOREIGN KEY ("artifact_revision_id") REFERENCES "generated_artifact_revisions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "gap_findings" ADD CONSTRAINT "gap_findings_requirement_fk" FOREIGN KEY ("requirement_version_id") REFERENCES "gap_requirement_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_findings" ADD CONSTRAINT "gap_findings_generation_run_fk" FOREIGN KEY ("generation_run_id") REFERENCES "ai_processing_runs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_item_evidence" ADD CONSTRAINT "gap_item_evidence_gap_fk" FOREIGN KEY ("gap_item_id") REFERENCES "gap_items"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "gap_item_evidence" ADD CONSTRAINT "gap_item_evidence_finding_evidence_fk" FOREIGN KEY ("gap_finding_evidence_id") REFERENCES "gap_finding_evidence"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "gap_items" ADD CONSTRAINT "gap_items_finding_fk" FOREIGN KEY ("finding_id") REFERENCES "gap_findings"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "gap_items" ADD CONSTRAINT "gap_items_answer_fk" FOREIGN KEY ("source_assessment_answer_id") REFERENCES "assessment_answers"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_question_legal_provisions" ADD CONSTRAINT "gap_question_legal_provisions_question_fk" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_question_legal_provisions" ADD CONSTRAINT "gap_question_legal_provisions_provision_fk" FOREIGN KEY ("legal_provision_id") REFERENCES "legal_provisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_questionnaire_draft_answers" ADD CONSTRAINT "gap_questionnaire_draft_answers_draft_fk" FOREIGN KEY ("draft_id") REFERENCES "gap_questionnaire_drafts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_questionnaire_draft_answers" ADD CONSTRAINT "gap_questionnaire_draft_answers_question_option_fk" FOREIGN KEY ("question_id","question_option_id") REFERENCES "question_options"("question_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_questionnaire_drafts" ADD CONSTRAINT "gap_questionnaire_drafts_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_questionnaire_drafts" ADD CONSTRAINT "gap_questionnaire_drafts_assessment_org_fk" FOREIGN KEY ("assessment_id","organization_id") REFERENCES "assessments"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_questionnaire_drafts" ADD CONSTRAINT "gap_questionnaire_drafts_assessment_release_fk" FOREIGN KEY ("assessment_id","gap_analysis_release_id") REFERENCES "assessments"("id","gap_analysis_release_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_questionnaire_drafts" ADD CONSTRAINT "gap_questionnaire_drafts_release_questionnaire_fk" FOREIGN KEY ("gap_analysis_release_id","questionnaire_version_id") REFERENCES "gap_analysis_releases"("id","questionnaire_version_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_questionnaire_drafts" ADD CONSTRAINT "gap_questionnaire_drafts_last_revision_fk" FOREIGN KEY ("last_submitted_assessment_revision_id") REFERENCES "assessment_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_reassessment_draft_documents" ADD CONSTRAINT "gap_reassessment_draft_documents_draft_org_fk" FOREIGN KEY ("draft_id","organization_id") REFERENCES "gap_reassessment_drafts"("id","organization_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "gap_reassessment_draft_documents" ADD CONSTRAINT "gap_reassessment_draft_documents_document_org_fk" FOREIGN KEY ("document_id","organization_id") REFERENCES "documents"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_reassessment_draft_documents" ADD CONSTRAINT "gap_reassessment_draft_documents_version_fk" FOREIGN KEY ("document_version_id","document_id") REFERENCES "document_versions"("id","document_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_reassessment_drafts" ADD CONSTRAINT "gap_reassessment_drafts_ai_run_fk" FOREIGN KEY ("ai_processing_run_id") REFERENCES "ai_processing_runs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_reassessment_drafts" ADD CONSTRAINT "gap_reassessment_drafts_lmDxWSgJrTtI_fkey" FOREIGN KEY ("generation_job_id") REFERENCES "background_jobs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_reassessment_drafts" ADD CONSTRAINT "gap_reassessment_drafts_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_reassessment_drafts" ADD CONSTRAINT "gap_reassessment_drafts_assessment_fk" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_reassessment_drafts" ADD CONSTRAINT "gap_reassessment_drafts_release_fk" FOREIGN KEY ("gap_analysis_release_id") REFERENCES "gap_analysis_releases"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_reassessment_drafts" ADD CONSTRAINT "gap_reassessment_drafts_base_revision_fk" FOREIGN KEY ("base_accepted_gap_revision_id") REFERENCES "generated_artifact_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_reassessment_drafts" ADD CONSTRAINT "gap_reassessment_drafts_assessment_revision_fk" FOREIGN KEY ("assessment_revision_id") REFERENCES "assessment_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_reassessment_drafts" ADD CONSTRAINT "gap_reassessment_drafts_output_revision_fk" FOREIGN KEY ("output_gap_revision_id") REFERENCES "generated_artifact_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_requirement_question_mappings" ADD CONSTRAINT "gap_requirement_question_mappings_release_fk" FOREIGN KEY ("gap_analysis_release_id") REFERENCES "gap_analysis_releases"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_requirement_question_mappings" ADD CONSTRAINT "gap_requirement_question_mappings_requirement_fk" FOREIGN KEY ("requirement_version_id") REFERENCES "gap_requirement_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_requirement_question_mappings" ADD CONSTRAINT "gap_requirement_question_mappings_question_fk" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_requirement_set_members" ADD CONSTRAINT "gap_requirement_set_members_set_version_fk" FOREIGN KEY ("requirement_set_version_id") REFERENCES "gap_requirement_set_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_requirement_set_members" ADD CONSTRAINT "gap_requirement_set_members_requirement_fk" FOREIGN KEY ("requirement_version_id") REFERENCES "gap_requirement_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_requirement_set_versions" ADD CONSTRAINT "gap_requirement_set_versions_set_fk" FOREIGN KEY ("requirement_set_id") REFERENCES "gap_requirement_sets"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_requirement_set_versions" ADD CONSTRAINT "gap_requirement_set_versions_title_content_fk" FOREIGN KEY ("title_content_revision_id") REFERENCES "content_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_requirement_versions" ADD CONSTRAINT "gap_requirement_versions_requirement_fk" FOREIGN KEY ("requirement_id") REFERENCES "gap_requirements"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_requirement_versions" ADD CONSTRAINT "gap_requirement_versions_title_content_fk" FOREIGN KEY ("title_content_revision_id") REFERENCES "content_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gap_requirement_versions" ADD CONSTRAINT "gap_requirement_versions_requirement_text_content_fk" FOREIGN KEY ("requirement_text_content_revision_id") REFERENCES "content_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "generated_artifact_revisions" ADD CONSTRAINT "generated_artifact_revisions_parent_fk" FOREIGN KEY ("parent_revision_id") REFERENCES "generated_artifact_revisions"("id");--> statement-breakpoint
ALTER TABLE "generated_artifact_revisions" ADD CONSTRAINT "generated_artifact_revisions_artifact_fk" FOREIGN KEY ("artifact_id") REFERENCES "generated_artifacts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "generated_artifact_revisions" ADD CONSTRAINT "generated_artifact_revisions_rule_set_fk" FOREIGN KEY ("rule_set_id") REFERENCES "rule_sets"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "generated_artifact_revisions" ADD CONSTRAINT "generated_artifact_revisions_release_fk" FOREIGN KEY ("check_release_id") REFERENCES "compliance_check_releases"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "generated_artifact_revisions" ADD CONSTRAINT "generated_artifact_revisions_gap_release_fk" FOREIGN KEY ("gap_analysis_release_id") REFERENCES "gap_analysis_releases"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "generated_artifacts" ADD CONSTRAINT "generated_artifacts_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "generated_artifacts" ADD CONSTRAINT "generated_artifacts_module_fk" FOREIGN KEY ("module_id") REFERENCES "compliance_modules"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "generated_artifacts" ADD CONSTRAINT "generated_artifacts_current_revision_owner_fk" FOREIGN KEY ("id","current_revision_id") REFERENCES "generated_artifact_revisions"("artifact_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "generated_artifacts" ADD CONSTRAINT "generated_artifacts_accepted_revision_owner_fk" FOREIGN KEY ("id","accepted_revision_id") REFERENCES "generated_artifact_revisions"("artifact_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "guest_applicability_checks" ADD CONSTRAINT "guest_applicability_checks_release_fk" FOREIGN KEY ("check_release_id") REFERENCES "compliance_check_releases"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "guest_applicability_checks" ADD CONSTRAINT "guest_applicability_checks_claimed_org_fk" FOREIGN KEY ("claimed_organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "idempotency_record_results" ADD CONSTRAINT "idempotency_record_results_record_fk" FOREIGN KEY ("record_id") REFERENCES "idempotency_records"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "idempotency_record_results" ADD CONSTRAINT "idempotency_record_results_admin_fk" FOREIGN KEY ("platform_administrator_user_id") REFERENCES "platform_administrators"("user_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "idempotency_record_results" ADD CONSTRAINT "idempotency_record_results_family_fk" FOREIGN KEY ("legal_corpus_family_id") REFERENCES "legal_corpus_families"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "idempotency_record_results" ADD CONSTRAINT "idempotency_record_results_job_fk" FOREIGN KEY ("background_job_id") REFERENCES "background_jobs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "idempotency_record_results" ADD CONSTRAINT "idempotency_record_results_processing_fk" FOREIGN KEY ("legal_processing_generation_id") REFERENCES "legal_source_processing_generations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "idempotency_record_results" ADD CONSTRAINT "idempotency_record_results_release_fk" FOREIGN KEY ("legal_corpus_release_id") REFERENCES "legal_corpus_releases"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "idempotency_record_results" ADD CONSTRAINT "idempotency_record_results_rendition_fk" FOREIGN KEY ("legal_source_rendition_id") REFERENCES "legal_source_renditions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "idempotency_record_results" ADD CONSTRAINT "idempotency_record_results_source_fk" FOREIGN KEY ("legal_source_id") REFERENCES "legal_sources"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "idempotency_record_results" ADD CONSTRAINT "idempotency_record_results_artifact_fk" FOREIGN KEY ("generated_artifact_revision_id") REFERENCES "generated_artifact_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "idempotency_record_results" ADD CONSTRAINT "idempotency_record_results_assessment_fk" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "idempotency_record_results" ADD CONSTRAINT "idempotency_record_results_assessment_revision_fk" FOREIGN KEY ("assessment_revision_id") REFERENCES "assessment_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "idempotency_record_results" ADD CONSTRAINT "idempotency_record_results_reassessment_fk" FOREIGN KEY ("gap_reassessment_draft_id") REFERENCES "gap_reassessment_drafts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "idempotency_record_results" ADD CONSTRAINT "idempotency_record_results_invitation_fk" FOREIGN KEY ("organization_invitation_id") REFERENCES "organization_invitations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "idempotency_record_results" ADD CONSTRAINT "idempotency_record_results_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "idempotency_record_results" ADD CONSTRAINT "idempotency_record_results_action_plan_fk" FOREIGN KEY ("action_plan_id") REFERENCES "action_plans"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "idempotency_record_results" ADD CONSTRAINT "idempotency_record_results_report_fk" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "idempotency_record_results" ADD CONSTRAINT "idempotency_record_results_document_fk" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "jurisdiction_entity_type_legal_provisions" ADD CONSTRAINT "jurisdiction_entity_type_legal_entity_fk" FOREIGN KEY ("jurisdiction_entity_type_version_id") REFERENCES "jurisdiction_entity_type_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "jurisdiction_entity_type_legal_provisions" ADD CONSTRAINT "jurisdiction_entity_type_legal_provision_fk" FOREIGN KEY ("legal_provision_id") REFERENCES "legal_provisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "jurisdiction_entity_type_mappings" ADD CONSTRAINT "jurisdiction_entity_type_mappings_national_fk" FOREIGN KEY ("jurisdiction_entity_type_version_id") REFERENCES "jurisdiction_entity_type_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "jurisdiction_entity_type_mappings" ADD CONSTRAINT "jurisdiction_entity_type_mappings_eu_fk" FOREIGN KEY ("scope_entity_type_id") REFERENCES "scope_entity_types"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "jurisdiction_entity_type_versions" ADD CONSTRAINT "jurisdiction_entity_type_versions_entity_fk" FOREIGN KEY ("jurisdiction_entity_type_id") REFERENCES "jurisdiction_entity_types"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "jurisdiction_entity_type_versions" ADD CONSTRAINT "jurisdiction_entity_type_versions_profile_fk" FOREIGN KEY ("jurisdiction_profile_version_id") REFERENCES "jurisdiction_profile_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "jurisdiction_entity_type_versions" ADD CONSTRAINT "jurisdiction_entity_type_versions_label_fk" FOREIGN KEY ("label_content_revision_id") REFERENCES "content_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "jurisdiction_entity_type_versions" ADD CONSTRAINT "jurisdiction_entity_type_versions_description_fk" FOREIGN KEY ("description_content_revision_id") REFERENCES "content_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "jurisdiction_entity_types" ADD CONSTRAINT "jurisdiction_entity_types_profile_fk" FOREIGN KEY ("jurisdiction_profile_id") REFERENCES "jurisdiction_profiles"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "jurisdiction_profile_designations" ADD CONSTRAINT "jurisdiction_profile_designations_profile_fk" FOREIGN KEY ("jurisdiction_profile_version_id") REFERENCES "jurisdiction_profile_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "jurisdiction_profile_designations" ADD CONSTRAINT "jurisdiction_profile_designations_provision_fk" FOREIGN KEY ("legal_provision_id") REFERENCES "legal_provisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "jurisdiction_profile_effective_states" ADD CONSTRAINT "jurisdiction_profile_effective_states_profile_fk" FOREIGN KEY ("jurisdiction_profile_version_id") REFERENCES "jurisdiction_profile_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "jurisdiction_profile_effective_states" ADD CONSTRAINT "jurisdiction_profile_effective_states_provision_fk" FOREIGN KEY ("legal_provision_id") REFERENCES "legal_provisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "jurisdiction_profile_jurisdiction_rules" ADD CONSTRAINT "jurisdiction_profile_jurisdiction_rules_profile_fk" FOREIGN KEY ("jurisdiction_profile_version_id") REFERENCES "jurisdiction_profile_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "jurisdiction_profile_jurisdiction_rules" ADD CONSTRAINT "jurisdiction_profile_jurisdiction_rules_entity_fk" FOREIGN KEY ("jurisdiction_entity_type_id") REFERENCES "jurisdiction_entity_types"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "jurisdiction_profile_jurisdiction_rules" ADD CONSTRAINT "jurisdiction_profile_jurisdiction_rules_provision_fk" FOREIGN KEY ("legal_provision_id") REFERENCES "legal_provisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "jurisdiction_profile_legal_provisions" ADD CONSTRAINT "jurisdiction_profile_legal_profile_fk" FOREIGN KEY ("jurisdiction_profile_version_id") REFERENCES "jurisdiction_profile_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "jurisdiction_profile_legal_provisions" ADD CONSTRAINT "jurisdiction_profile_legal_provision_fk" FOREIGN KEY ("legal_provision_id") REFERENCES "legal_provisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "jurisdiction_profile_threshold_policies" ADD CONSTRAINT "jurisdiction_profile_threshold_policy_profile_fk" FOREIGN KEY ("jurisdiction_profile_version_id") REFERENCES "jurisdiction_profile_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "jurisdiction_profile_threshold_policies" ADD CONSTRAINT "jurisdiction_profile_threshold_policy_threshold_fk" FOREIGN KEY ("scope_threshold_set_id") REFERENCES "scope_threshold_sets"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "jurisdiction_profile_versions" ADD CONSTRAINT "jurisdiction_profile_versions_profile_fk" FOREIGN KEY ("jurisdiction_profile_id") REFERENCES "jurisdiction_profiles"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_corpus_evaluations" ADD CONSTRAINT "legal_corpus_evaluations_release_fk" FOREIGN KEY ("release_id") REFERENCES "legal_corpus_releases"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_corpus_evaluations" ADD CONSTRAINT "legal_corpus_evaluations_job_fk" FOREIGN KEY ("job_id") REFERENCES "background_jobs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_corpus_release_activations" ADD CONSTRAINT "legal_release_activations_family_fk" FOREIGN KEY ("family_id") REFERENCES "legal_corpus_families"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_corpus_release_activations" ADD CONSTRAINT "legal_release_activations_release_identity_fk" FOREIGN KEY ("family_id","release_id") REFERENCES "legal_corpus_releases"("family_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_corpus_release_activations" ADD CONSTRAINT "legal_release_activations_previous_identity_fk" FOREIGN KEY ("family_id","previous_release_id") REFERENCES "legal_corpus_releases"("family_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_corpus_release_members" ADD CONSTRAINT "legal_release_members_release_fk" FOREIGN KEY ("release_id") REFERENCES "legal_corpus_releases"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_corpus_release_members" ADD CONSTRAINT "legal_release_members_version_fk" FOREIGN KEY ("source_version_id") REFERENCES "legal_source_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_corpus_release_members" ADD CONSTRAINT "legal_release_members_rendition_fk" FOREIGN KEY ("rendition_id") REFERENCES "legal_source_renditions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_corpus_release_members" ADD CONSTRAINT "legal_release_members_generation_fk" FOREIGN KEY ("processing_generation_id") REFERENCES "legal_source_processing_generations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_corpus_releases" ADD CONSTRAINT "legal_corpus_releases_family_fk" FOREIGN KEY ("family_id") REFERENCES "legal_corpus_families"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_corpus_releases" ADD CONSTRAINT "legal_corpus_releases_evaluation_job_fk" FOREIGN KEY ("evaluation_job_id") REFERENCES "background_jobs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_instrument_versions" ADD CONSTRAINT "legal_instrument_versions_instrument_fk" FOREIGN KEY ("legal_instrument_id") REFERENCES "legal_instruments"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_instrument_versions" ADD CONSTRAINT "legal_instrument_versions_title_content_fk" FOREIGN KEY ("title_content_revision_id") REFERENCES "content_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_provisions" ADD CONSTRAINT "legal_provisions_instrument_version_fk" FOREIGN KEY ("legal_instrument_version_id") REFERENCES "legal_instrument_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_provisions" ADD CONSTRAINT "legal_provisions_citation_content_fk" FOREIGN KEY ("citation_content_revision_id") REFERENCES "content_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_source_change_alerts" ADD CONSTRAINT "legal_change_alerts_check_fk" FOREIGN KEY ("monitor_check_id") REFERENCES "legal_source_monitor_checks"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_source_change_alerts" ADD CONSTRAINT "legal_change_alerts_source_fk" FOREIGN KEY ("source_id") REFERENCES "legal_sources"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_source_change_alerts" ADD CONSTRAINT "legal_change_alerts_candidate_fk" FOREIGN KEY ("candidate_version_id") REFERENCES "legal_source_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_source_chunk_embeddings" ADD CONSTRAINT "legal_chunk_embeddings_generation_fk" FOREIGN KEY ("generation_id") REFERENCES "legal_source_processing_generations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_source_chunk_embeddings" ADD CONSTRAINT "legal_chunk_embeddings_chunk_fk" FOREIGN KEY ("chunk_id") REFERENCES "legal_source_chunks"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_source_chunk_provisions" ADD CONSTRAINT "legal_chunk_provisions_chunk_fk" FOREIGN KEY ("chunk_id") REFERENCES "legal_source_chunks"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_source_chunk_provisions" ADD CONSTRAINT "legal_chunk_provisions_provision_fk" FOREIGN KEY ("legal_provision_id") REFERENCES "legal_provisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_source_chunks" ADD CONSTRAINT "legal_source_chunks_generation_fk" FOREIGN KEY ("generation_id") REFERENCES "legal_source_processing_generations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_source_monitor_checks" ADD CONSTRAINT "legal_monitor_checks_monitor_fk" FOREIGN KEY ("monitor_id") REFERENCES "legal_source_monitors"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_source_monitors" ADD CONSTRAINT "legal_source_monitors_source_fk" FOREIGN KEY ("source_id") REFERENCES "legal_sources"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_source_processing_generations" ADD CONSTRAINT "legal_processing_rendition_fk" FOREIGN KEY ("rendition_id") REFERENCES "legal_source_renditions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_source_processing_generations" ADD CONSTRAINT "legal_processing_job_fk" FOREIGN KEY ("job_id") REFERENCES "background_jobs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_source_processing_generations" ADD CONSTRAINT "legal_processing_embedding_job_fk" FOREIGN KEY ("embedding_job_id") REFERENCES "background_jobs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_source_renditions" ADD CONSTRAINT "legal_source_renditions_version_fk" FOREIGN KEY ("source_version_id") REFERENCES "legal_source_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_source_renditions" ADD CONSTRAINT "legal_source_renditions_authority_version_fk" FOREIGN KEY ("authoritative_rendition_id","source_version_id") REFERENCES "legal_source_renditions"("id","source_version_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_source_renditions" ADD CONSTRAINT "legal_source_renditions_upload_fk" FOREIGN KEY ("upload_session_id") REFERENCES "upload_sessions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_source_renditions" ADD CONSTRAINT "legal_source_renditions_import_job_fk" FOREIGN KEY ("import_job_id") REFERENCES "background_jobs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_source_versions" ADD CONSTRAINT "legal_source_versions_source_fk" FOREIGN KEY ("source_id") REFERENCES "legal_sources"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_sources" ADD CONSTRAINT "legal_sources_family_fk" FOREIGN KEY ("family_id") REFERENCES "legal_corpus_families"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_sources" ADD CONSTRAINT "legal_sources_instrument_fk" FOREIGN KEY ("legal_instrument_id") REFERENCES "legal_instruments"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_sources" ADD CONSTRAINT "legal_sources_provision_fk" FOREIGN KEY ("legal_provision_id") REFERENCES "legal_provisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "nis2_result_projections" ADD CONSTRAINT "nis2_result_projections_artifact_revision_fk" FOREIGN KEY ("artifact_revision_id") REFERENCES "generated_artifact_revisions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "nis2_result_projections" ADD CONSTRAINT "nis2_result_projections_profile_fk" FOREIGN KEY ("jurisdiction_profile_version_id") REFERENCES "jurisdiction_profile_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "organization_ai_provider_policies" ADD CONSTRAINT "organization_ai_policies_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "organization_fact_definition_versions" ADD CONSTRAINT "organization_fact_definition_versions_fact_fk" FOREIGN KEY ("fact_key") REFERENCES "organization_fact_definitions"("key") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "organization_fact_definition_versions" ADD CONSTRAINT "organization_fact_definition_versions_label_fk" FOREIGN KEY ("label_content_revision_id") REFERENCES "content_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "organization_fact_definition_versions" ADD CONSTRAINT "organization_fact_definition_versions_description_fk" FOREIGN KEY ("description_content_revision_id") REFERENCES "content_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "organization_fact_value_options" ADD CONSTRAINT "organization_fact_value_options_value_fact_fk" FOREIGN KEY ("organization_fact_value_id","fact_key") REFERENCES "organization_fact_values"("id","fact_key") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_fact_value_options" ADD CONSTRAINT "organization_fact_value_options_fact_option_fk" FOREIGN KEY ("fact_key","fact_option_id") REFERENCES "fact_options"("fact_definition_key","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "organization_fact_values" ADD CONSTRAINT "organization_fact_values_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_fact_values" ADD CONSTRAINT "organization_fact_values_definition_fk" FOREIGN KEY ("fact_key") REFERENCES "organization_fact_definitions"("key");--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "question_fact_mappings" ADD CONSTRAINT "question_fact_mappings_question_fk" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "question_fact_mappings" ADD CONSTRAINT "question_fact_mappings_fact_definition_fk" FOREIGN KEY ("fact_key") REFERENCES "organization_fact_definitions"("key");--> statement-breakpoint
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_fk" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_label_content_fk" FOREIGN KEY ("label_content_revision_id") REFERENCES "content_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_fact_option_fk" FOREIGN KEY ("fact_option_id") REFERENCES "fact_options"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "questionnaire_versions" ADD CONSTRAINT "questionnaire_versions_questionnaire_fk" FOREIGN KEY ("questionnaire_id") REFERENCES "questionnaires"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "questionnaire_versions" ADD CONSTRAINT "questionnaire_versions_title_content_fk" FOREIGN KEY ("title_content_revision_id") REFERENCES "content_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "questionnaires" ADD CONSTRAINT "questionnaires_module_fk" FOREIGN KEY ("module_id") REFERENCES "compliance_modules"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_questionnaire_version_fk" FOREIGN KEY ("questionnaire_version_id") REFERENCES "questionnaire_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_question_content_fk" FOREIGN KEY ("question_content_revision_id") REFERENCES "content_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_help_content_fk" FOREIGN KEY ("help_content_revision_id") REFERENCES "content_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_tooltip_content_fk" FOREIGN KEY ("tooltip_content_revision_id") REFERENCES "content_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "report_action_plan_sources" ADD CONSTRAINT "report_action_plan_sources_report_fk" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "report_action_plan_sources" ADD CONSTRAINT "report_action_plan_sources_plan_fk" FOREIGN KEY ("action_plan_id") REFERENCES "action_plans"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "report_artifact_sources" ADD CONSTRAINT "report_artifact_sources_report_fk" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "report_artifact_sources" ADD CONSTRAINT "report_artifact_sources_artifact_fk" FOREIGN KEY ("artifact_revision_id") REFERENCES "generated_artifact_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "report_document_sources" ADD CONSTRAINT "report_document_sources_report_fk" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "report_document_sources" ADD CONSTRAINT "report_document_sources_document_fk" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_job_id_background_jobs_id_fkey" FOREIGN KEY ("job_id") REFERENCES "background_jobs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "rule_sets" ADD CONSTRAINT "rule_sets_module_fk" FOREIGN KEY ("module_id") REFERENCES "compliance_modules"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scope_entity_type_legal_provisions" ADD CONSTRAINT "scope_entity_type_legal_entity_fk" FOREIGN KEY ("scope_entity_type_version_id") REFERENCES "scope_entity_type_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scope_entity_type_legal_provisions" ADD CONSTRAINT "scope_entity_type_legal_provision_fk" FOREIGN KEY ("legal_provision_id") REFERENCES "legal_provisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scope_entity_type_versions" ADD CONSTRAINT "scope_entity_type_versions_entity_fk" FOREIGN KEY ("scope_entity_type_id") REFERENCES "scope_entity_types"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scope_entity_type_versions" ADD CONSTRAINT "scope_entity_type_versions_model_fk" FOREIGN KEY ("scope_model_version_id") REFERENCES "scope_model_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scope_entity_type_versions" ADD CONSTRAINT "scope_entity_type_versions_sector_fk" FOREIGN KEY ("scope_sector_version_id") REFERENCES "scope_sector_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scope_entity_type_versions" ADD CONSTRAINT "scope_entity_type_versions_label_fk" FOREIGN KEY ("label_content_revision_id") REFERENCES "content_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scope_entity_type_versions" ADD CONSTRAINT "scope_entity_type_versions_description_fk" FOREIGN KEY ("description_content_revision_id") REFERENCES "content_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scope_model_versions" ADD CONSTRAINT "scope_model_versions_model_fk" FOREIGN KEY ("scope_model_id") REFERENCES "scope_models"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scope_sector_versions" ADD CONSTRAINT "scope_sector_versions_sector_fk" FOREIGN KEY ("scope_sector_id") REFERENCES "scope_sectors"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scope_sector_versions" ADD CONSTRAINT "scope_sector_versions_model_version_fk" FOREIGN KEY ("scope_model_version_id") REFERENCES "scope_model_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scope_sector_versions" ADD CONSTRAINT "scope_sector_versions_label_content_fk" FOREIGN KEY ("label_content_revision_id") REFERENCES "content_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scope_threshold_set_legal_provisions" ADD CONSTRAINT "scope_threshold_legal_set_fk" FOREIGN KEY ("scope_threshold_set_id") REFERENCES "scope_threshold_sets"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "scope_threshold_set_legal_provisions" ADD CONSTRAINT "scope_threshold_legal_provision_fk" FOREIGN KEY ("legal_provision_id") REFERENCES "legal_provisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "upload_session_results" ADD CONSTRAINT "upload_session_results_session_fk" FOREIGN KEY ("session_id") REFERENCES "upload_sessions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "upload_session_results" ADD CONSTRAINT "upload_session_results_document_fk" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "upload_session_results" ADD CONSTRAINT "upload_session_results_rendition_fk" FOREIGN KEY ("legal_source_rendition_id") REFERENCES "legal_source_renditions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;