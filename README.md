# compliance

## Database Schema Workflow

The app uses Drizzle's codebase-first push workflow, matching Option 2 in the
Drizzle migrations docs. Use `npm run db:push` from `my-app` to apply
`src/db/schema.ts` directly to the configured database.

Do not use `drizzle-kit generate`, `drizzle-kit migrate`, or any flow that
creates SQL migration files or snapshots under `my-app/drizzle/`.
