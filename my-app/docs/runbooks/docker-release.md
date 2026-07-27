# Docker release runbook

## Staging

1. Confirm a successful backup less than 24 hours old.
2. Confirm the release manifest contains one Git revision and digest-addressed
   web, worker, database, Storage, Studio, and postgres-meta images.
3. Run application-host preflight.
4. Deploy the inactive color:

   ```bash
   infra/scripts/deploy-app-host.sh green /etc/compliancetool/staging/application.env
   ```

5. The script starts the new web color, takes the migration advisory lock,
   applies checksummed forward migrations/operator SQL, reconciles buckets,
   drains the old worker, starts the new worker, atomically switches Caddy, and
   records a release manifest.
6. Run production-safe Auth, Storage, readiness, queue, and AI smoke checks.

Staging has its own Compose projects, domain, environment file, database,
external S3 bucket, network names, `/srv` root, and LiteLLM application key.

## Production

Production runs only from a version tag or protected manual approval. Repeat
the staging procedure with the production environment. Stop staging if the
shared host approaches its production resource reserve.

Application rollback switches Caddy to the preceding compatible web digest and
restores its worker color. A migrated database is never automatically
downgraded. If old code is incompatible, forward-fix or execute the verified
restore procedure.

## Verification

- `/api/health/live` proves process liveness.
- `/api/health/ready` proves bounded database access.
- `scripts/health/worker.ts` proves worker/database readiness.
- Caddy, Kong, PostgreSQL, Storage, LiteLLM, and vLLM must be healthy.
- Only ports 80/443 are public on the application host; AI port 4000 accepts
  only the application peer over `wg0`.

Keep the preceding image digests and configuration until the observation
window closes. Record the revision, image digests, migration checksums, active
color, smoke results, and operator identity.
