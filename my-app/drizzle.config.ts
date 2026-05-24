import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DRIZZLE_DATABASE_URL or DATABASE_URL is required');
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
    'ai_messages',
    'assessment_lex_specialis_matches',
    'incident_reports',
    'lex_specialis_rules',
    'management_trainings',
    'nis2_sectors',
    'organization_invitations',
    'organization_members',
    'organization_requirements',
    'organization_sectors',
    'organizations',
    'registration_tasks',
    'requirement_evidence',
    'security_incidents',
    'self_check_assessments',
    'supplier_assessments',
    'suppliers',
    'tom_areas',
  ],
  dbCredentials: {
    url: databaseUrl,
  },
});
