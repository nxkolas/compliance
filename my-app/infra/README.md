# Compliance Tool deployment

This directory is the deployment source of truth for the isolated local stack,
the production application host, and the private AI host. Upstream image
coordinates are immutable digests in `versions.env`; local derivative names are
replaced by signed GHCR digests in the release manifest. Populated environment
files, private keys, model weights, and recovery credentials stay outside Git.

## Local workflows

From PowerShell in `my-app`:

```powershell
.\infra\scripts\local-bootstrap.ps1 -Mode full
.\infra\scripts\local-bootstrap.ps1 -Mode full -ConstrainedMemory
.\infra\scripts\local-bootstrap.ps1 -Mode infra
.\infra\scripts\local-status.ps1 -Mode full
.\infra\scripts\local-down.ps1 -Mode full
```

`full` runs the application and dependencies in Docker. `infra` exposes only
loopback PostgreSQL and Kong for host-run web/worker processes. Generated
`.env.docker.local` and `.env.docker.test` files are ignored.

The release gate is:

```powershell
.\infra\scripts\local-acceptance.ps1
```

Standard mode refuses less than 24 GB of Docker memory. A 16 GB WSL/Docker
installation can run the same functional acceptance assertions with
heavyweight models and optional Docling phased rather than resident together:

```powershell
.\infra\scripts\local-acceptance.ps1 -ConstrainedMemory -Docling
```

Constrained mode requires at least 15 GB of Docker memory, at least 30 GB free
disk, and forces Ollama to keep only one model resident. Standard mode requires
at least 40 GB free disk. Both modes require a fresh `compliancetool-test`
project and resources inside the exact project prefix. The command writes
non-secret evidence to `docs/qa/`. Volumes are preserved unless an operator
separately invokes the exact test-project cleanup command.

Local published ports are loopback-only:

| Service | Address |
| --- | --- |
| Application through Caddy | `127.0.0.1:3000` |
| Supabase through Caddy | `127.0.0.1:8000` |
| Mailpit UI | `127.0.0.1:8025` |
| Optional Studio | documented in `compose.studio.yml` |
| Optional Grafana | `127.0.0.1:3001` |

PostgreSQL, worker, RustFS, Ollama, LiteLLM, and Docling have no public bind.

## Production topology

The application host has a long-lived platform Compose project and a separate
blue/green release project. Its `data` and `app` networks are internal;
database backup, Auth SMTP, and Storage S3 use a separate un-published egress
network. The AI host has a private inference project.
LiteLLM is the only AI port bound to the host, and it binds only to the
WireGuard address. Servers pull application images by digest and never build
source.

Provisioning order:

1. Install Ubuntu 24.04, Docker Engine/Compose, WireGuard, UFW, and NVIDIA
   tooling where applicable.
2. Run `provision-app-host.sh` or `provision-ai-host.sh`.
3. Place root-owned environment and secret files under
   `/etc/compliancetool/<environment>/`.
4. Run `provision-wireguard.sh <app|ai> <env-file> --apply` from a recoverable
   console.
5. Provision exact offline model snapshots with `provision-models.sh`.
6. Deploy AI with `deploy-ai-host.sh`, then deploy the application with
   `deploy-app-host.sh <blue|green>`.

### Persistent ownership

| Path below `/srv/compliancetool/<environment>` | UID:GID | Mode |
| --- | --- | --- |
| `postgres/data`, `postgres/config` | `999:999` | `0700` |
| `caddy/data`, `caddy/config`, `caddy/logs` | `1000:1000` | `0750` |
| `prometheus` | `65534:65534` | `0750` |
| `metrics` (AI host) | `65534:65534` | `0750` |
| `grafana` | `472:472` | `0750` |
| `loki`, `backups` | `10001:10001` | `0750` |
| `backups/metrics` | `65534:65534` | `0750` |
| `releases` | `0:0` | `0750` |

Preflight rejects an unexpected root, owner, secret-file mode, webhook-file
mode, less than 100 GB free on the application host, or less than 300 GB free
on the model-bearing AI host.

### Security exceptions

First-party web and worker containers are non-root, read-only, capability-free,
PID/memory/CPU bounded, and use tmpfs for temporary writes. Signed derivative
database, Storage, Studio, and postgres-meta images add a verified WAL-G build
or remove unused vulnerable package-manager trees; postgres-meta also receives
the exact security-fixed GnuTLS package. Caddy alone retains
`NET_BIND_SERVICE`. Stateful upstream services retain only their documented
writable bind mounts. Node/Alloy exporters receive read-only host views. No
service mounts the Docker socket.

## Operations

- [Local and release operations](../docs/runbooks/docker-release.md)
- [Backup and restore](../docs/runbooks/docker-backup-restore.md)
- [Incident response](../docs/runbooks/docker-incident-response.md)
- [Coordinated upgrades](../docs/runbooks/docker-upgrade.md)
- [AI qualification](../docs/runbooks/docker-ai-qualification.md)

Production `drizzle-kit push`, mutable image tags, model branch names, direct
database exposure, and public monitoring endpoints are prohibited.
