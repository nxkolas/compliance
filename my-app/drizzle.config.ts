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
    'artifact_revision_sources',
    'assessment_answers',
    'assessment_revisions',
    'assessments',
    'compliance_framework_versions',
    'compliance_frameworks',
    'compliance_modules',
    'generated_artifact_revisions',
    'generated_artifacts',
    'organization_fact_definitions',
    'organization_fact_values',
    'organization_invitations',
    'organization_memberships',
    'organizations',
    'question_fact_mappings',
    'question_options',
    'questionnaire_versions',
    'questionnaires',
    'questions',
    'rule_sets',
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
