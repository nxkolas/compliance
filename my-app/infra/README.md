# Compliance Tool deployment

This directory is the deployment source of truth for the production application
host. Upstream image coordinates are immutable digests in `versions.env`; local
derivative names are replaced by signed GHCR digests in the release manifest.
Populated environment files, private keys, and recovery credentials stay outside
Git.

There is no Docker stack for local development. See
[Local development](#local-development) below.

## Local development

Development runs on the host against a hosted Supabase project:

```powershell
npm run dev          # Next.js
npm run worker:local # background worker
```

Configuration lives in `.env.local`, which is git-ignored. Database schema
changes go through `npm run db:push` against a development database.

Optional local model testing is documented in
[Local model testing](../docs/runbooks/local-model-testing.md). It runs Ollama
natively on the host; no container is involved.

## Production topology

The application host has a long-lived platform Compose project and a separate
blue/green release project. Its `data` and `app` networks are internal;
database backup, Auth SMTP, and Storage S3 use a separate un-published egress
network. Servers pull application images by digest and never build source.

The application reaches an OpenAI-compatible inference endpoint over the egress
network. Select the provider with `AI_DEFAULT_PROVIDER`.

Provisioning order:

1. Install Ubuntu 24.04, Docker Engine/Compose, and UFW.
2. Run `provision-app-host.sh`.
3. Place root-owned environment and secret files under
   `/etc/compliancetool/<environment>/`.
4. Deploy with `deploy-app-host.sh <blue|green> <env-file>`.

### Persistent ownership

| Path below `/srv/compliancetool/<environment>` | UID:GID | Mode |
| --- | --- | --- |
| `postgres/data`, `postgres/config` | `999:999` | `0700` |
| `caddy/data`, `caddy/config`, `caddy/logs` | `1000:1000` | `0750` |
| `prometheus` | `65534:65534` | `0750` |
| `grafana` | `472:472` | `0750` |
| `loki`, `backups` | `10001:10001` | `0750` |
| `backups/metrics` | `65534:65534` | `0750` |
| `releases` | `0:0` | `0750` |

Preflight rejects an unexpected root, owner, secret-file mode, webhook-file
mode, or less than 100 GB free on the application host.

### Security exceptions

First-party web and worker containers are non-root, read-only, capability-free,
PID/memory/CPU bounded, and use tmpfs for temporary writes. Signed derivative
database, Storage, Studio, and postgres-meta images add a verified WAL-G build
or remove unused vulnerable package-manager trees; postgres-meta also receives
the exact security-fixed GnuTLS package. Caddy alone retains
`NET_BIND_SERVICE`. Stateful upstream services retain only their documented
writable bind mounts. Node/Alloy exporters receive read-only host views. No
service mounts the Docker socket.

### Known coverage gap

The production topology is first exercised in staging. There is no local
rehearsal environment, so Kong routing, the self-hosted JWT/key model,
read-only rootfs behaviour, and the bootstrap path are validated by the staging
deployment rather than before it. This was an accepted trade in
[docker-scope-reduction](../docs/plans/pending/docker-scope-reduction.md).

## Operations

- [Local and release operations](../docs/runbooks/docker-release.md)
- [Backup and restore](../docs/runbooks/docker-backup-restore.md)
- [Incident response](../docs/runbooks/docker-incident-response.md)
- [Coordinated upgrades](../docs/runbooks/docker-upgrade.md)
- [Local model testing](../docs/runbooks/local-model-testing.md)

Production `drizzle-kit push`, mutable image tags, direct database exposure,
and public monitoring endpoints are prohibited.
