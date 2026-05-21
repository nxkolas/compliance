CREATE TYPE "public"."assessment_status" AS ENUM('draft', 'in_review', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."incident_report_stage" AS ENUM('early_warning_24h', 'notification_72h', 'final_report_1_month', 'progress_report');--> statement-breakpoint
CREATE TYPE "public"."nis2_entity_category" AS ENUM('not_affected', 'important', 'essential', 'special_case', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."nis2_sector_criticality" AS ENUM('annex_1_high_criticality', 'annex_2_other_criticality', 'not_listed');--> statement-breakpoint
CREATE TYPE "public"."organization_role" AS ENUM('owner', 'admin', 'member', 'auditor');--> statement-breakpoint
CREATE TYPE "public"."organization_size" AS ENUM('micro', 'small', 'medium', 'large');--> statement-breakpoint
CREATE TYPE "public"."requirement_status" AS ENUM('not_started', 'planned', 'in_progress', 'implemented', 'verified', 'not_applicable');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('open', 'in_progress', 'done', 'blocked', 'not_applicable');--> statement-breakpoint
CREATE TABLE "assessment_lex_specialis_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"rule_id" uuid NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "incident_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"stage" "incident_report_stage" NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone,
	"submitted_by_user_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lex_specialis_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "management_trainings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"manager_user_id" uuid,
	"title" varchar(255) NOT NULL,
	"provider" varchar(255),
	"completed_on" date NOT NULL,
	"valid_until" date,
	"evidence_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nis2_sectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"criticality" "nis2_sector_criticality" NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "organization_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"tom_area_id" uuid NOT NULL,
	"status" "requirement_status" DEFAULT 'not_started' NOT NULL,
	"risk_level" "risk_level" DEFAULT 'medium' NOT NULL,
	"owner_user_id" uuid,
	"current_state" text,
	"target_state" text,
	"evidence_summary" text,
	"due_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_sectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"sector_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"legal_name" varchar(255),
	"industry_description" text,
	"employee_count" integer,
	"annual_revenue_eur" numeric(14, 2),
	"balance_sheet_total_eur" numeric(14, 2),
	"size" "organization_size",
	"country_code" varchar(2) DEFAULT 'DE',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registration_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"authority" varchar(120) NOT NULL,
	"status" "task_status" DEFAULT 'open' NOT NULL,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requirement_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requirement_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"file_path" text,
	"external_url" text,
	"uploaded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"severity" "risk_level" DEFAULT 'medium' NOT NULL,
	"detected_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "self_check_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"performed_by_user_id" uuid,
	"status" "assessment_status" DEFAULT 'draft' NOT NULL,
	"category" "nis2_entity_category" DEFAULT 'unknown' NOT NULL,
	"size_cap_applies" boolean,
	"lex_specialis_applies" boolean,
	"reasoning" text,
	"answers" jsonb,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"performed_by_user_id" uuid,
	"status" "assessment_status" DEFAULT 'draft' NOT NULL,
	"risk_level" "risk_level" DEFAULT 'medium' NOT NULL,
	"answers" jsonb,
	"summary" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"contact_email" varchar(255),
	"service_description" text,
	"is_critical" boolean DEFAULT false NOT NULL,
	"risk_level" "risk_level" DEFAULT 'medium' NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tom_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bsig_number" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text
);
--> statement-breakpoint
ALTER TABLE "assessment_lex_specialis_matches" ADD CONSTRAINT "assessment_lex_specialis_matches_assessment_id_self_check_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."self_check_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_lex_specialis_matches" ADD CONSTRAINT "assessment_lex_specialis_matches_rule_id_lex_specialis_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."lex_specialis_rules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_incident_id_security_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."security_incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_trainings" ADD CONSTRAINT "management_trainings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_requirements" ADD CONSTRAINT "organization_requirements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_requirements" ADD CONSTRAINT "organization_requirements_tom_area_id_tom_areas_id_fk" FOREIGN KEY ("tom_area_id") REFERENCES "public"."tom_areas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_sectors" ADD CONSTRAINT "organization_sectors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_sectors" ADD CONSTRAINT "organization_sectors_sector_id_nis2_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."nis2_sectors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_tasks" ADD CONSTRAINT "registration_tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_evidence" ADD CONSTRAINT "requirement_evidence_requirement_id_organization_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."organization_requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_incidents" ADD CONSTRAINT "security_incidents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "self_check_assessments" ADD CONSTRAINT "self_check_assessments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_assessments" ADD CONSTRAINT "supplier_assessments_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assessment_lex_specialis_unique" ON "assessment_lex_specialis_matches" USING btree ("assessment_id","rule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "incident_reports_incident_stage_unique" ON "incident_reports" USING btree ("incident_id","stage");--> statement-breakpoint
CREATE UNIQUE INDEX "lex_specialis_rules_code_unique" ON "lex_specialis_rules" USING btree ("code");--> statement-breakpoint
CREATE INDEX "management_trainings_org_idx" ON "management_trainings" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "nis2_sectors_code_unique" ON "nis2_sectors" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_members_org_user_unique" ON "organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "organization_members_user_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_requirements_org_tom_unique" ON "organization_requirements" USING btree ("organization_id","tom_area_id");--> statement-breakpoint
CREATE INDEX "organization_requirements_status_idx" ON "organization_requirements" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_sectors_org_sector_unique" ON "organization_sectors" USING btree ("organization_id","sector_id");--> statement-breakpoint
CREATE INDEX "organizations_name_idx" ON "organizations" USING btree ("name");--> statement-breakpoint
CREATE INDEX "registration_tasks_org_idx" ON "registration_tasks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "registration_tasks_status_idx" ON "registration_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "requirement_evidence_requirement_idx" ON "requirement_evidence" USING btree ("requirement_id");--> statement-breakpoint
CREATE INDEX "security_incidents_org_idx" ON "security_incidents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "security_incidents_severity_idx" ON "security_incidents" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "self_check_assessments_org_idx" ON "self_check_assessments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "self_check_assessments_status_idx" ON "self_check_assessments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "supplier_assessments_supplier_idx" ON "supplier_assessments" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "suppliers_org_idx" ON "suppliers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "suppliers_risk_level_idx" ON "suppliers" USING btree ("risk_level");--> statement-breakpoint
CREATE UNIQUE INDEX "tom_areas_bsig_number_unique" ON "tom_areas" USING btree ("bsig_number");