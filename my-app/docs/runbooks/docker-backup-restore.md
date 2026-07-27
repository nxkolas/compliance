# Docker backup and restore runbook

## Backup

PostgreSQL continuously archives WAL with the static WAL-G binary built into
the signed Compliance Tool database image. The Dockerfile verifies the pinned
upstream source archive, records its commit, and builds it without optional
CGO compression libraries. `archive_timeout=900` bounds idle WAL age.
Schedule a daily base backup:

```bash
infra/scripts/backup.sh /etc/compliancetool/production/application.env
```

The command performs a WAL-G base backup, records the remote backup list,
captures a version-aware object inventory, hashes both evidence files, updates
the deployment freshness marker, and publishes the node-exporter freshness
metric. Database backup credentials are backup-only and distinct from Storage
credentials.

The backup provider must enforce immutable/versioned retention: daily recovery
points for 35 days, weekly for 13 weeks, monthly for 13 months, and WAL long
enough to cover every retained base backup. Do not prune from the host until
provider retention and legal requirements are approved.

## Monthly restore rehearsal

Create a new empty path beneath `/srv/compliancetool/restore-rehearsals/`.
Never use a production or staging data directory.

```bash
install -d -o 0 -g 0 -m 0700 /srv/compliancetool/restore-rehearsals/2026-08
infra/scripts/restore.sh \
  /etc/compliancetool/production/application.env \
  /srv/compliancetool/restore-rehearsals/2026-08 \
  --confirm-empty-target
```

The script rejects non-empty or out-of-root targets, restores the latest base
backup, boots it on an internal temporary Docker network with no published
port, checks vector and deployment history, and verifies the configured
versioned Storage canary SHA-256. It never starts the source database.

Record start/end timestamps, restored backup identity, database checks,
Storage canary version/hash, achieved RPO/RTO, and cleanup approval. The target
RPO is at most 15 minutes and target RTO is at most four hours.

Snapshots or Docker volumes on the primary host are not backups. A database
restore without object-byte verification is not a successful rehearsal.
