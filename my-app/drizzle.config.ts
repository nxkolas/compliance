import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const databaseUrl = getDrizzleDatabaseUrl();

if (!databaseUrl) {
  throw new Error('DATABASE_URL or DRIZZLE_DATABASE_URL is required');
}

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  schemaFilter: 'public',
  tablesFilter: [
    'ai_chats',
    'ai_document_chunks',
    'ai_documents',
    'ai_chat_summaries',
    'ai_messages',
    'ai_prompt_versions',
    'assessment_lex_specialis_matches',
    'action_plan_items',
    'document_requirement_types',
    'document_review_findings',
    'document_review_runs',
    'guest_creation_rate_limits',
    'guest_assessment_sessions',
    'incident_reports',
    'lex_specialis_rules',
    'management_trainings',
    'nis2_critical_services',
    'nis2_sectors',
    'organization_invitations',
    'organization_critical_services',
    'organization_members',
    'organization_requirements',
    'organization_sectors',
    'organization_settings',
    'organizations',
    'questionnaire_answers',
    'questionnaire_questions',
    'questionnaire_runs',
    'questionnaire_sections',
    'questionnaire_templates',
    'registration_tasks',
    'report_exports',
    'requirement_evidence',
    'security_incidents',
    'self_check_assessments',
    'supplier_assessments',
    'suppliers',
    'tom_areas',
    'user_preferences',
  ],
  dbCredentials: {
    url: databaseUrl,
  },
});

function getDrizzleDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    return toSupabaseSessionPoolerUrl(databaseUrl);
  }

  return process.env.DRIZZLE_DATABASE_URL;
}

function toSupabaseSessionPoolerUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);

  if (url.hostname.endsWith('.pooler.supabase.com') && url.port === '6543') {
    url.port = '5432';
  }

  return url.toString();
}
