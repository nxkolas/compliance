import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  schemaFilter: 'public',
  tablesFilter: [
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
    url: process.env.DATABASE_URL!,
  },
});
