# Complete Docker Deployment

Status: implementation in progress; architecture decisions confirmed on
2026-07-27. The isolated local stack is implemented, but its complete
acceptance suite has not yet produced a successful evidence report. Production
deployment and qualification are outside the current local validation scope.

## Outcome

Dockerize the complete application so that:

1. a developer can start an isolated local stack containing the Next.js web
   application, Node worker, lean self-hosted Supabase, local object storage,
   email capture, and self-hosted AI;
2. the same application images can be promoted through staging and production;
3. production runs stateful application services on one Ubuntu host and AI
   inference on a separate NVIDIA H100 80 GB host;
4. browser traffic reaches only Caddy, while databases, workers, Docling,
   monitoring, and AI runtimes remain private;
5. schema changes are committed, reviewed, forward-only migrations rather than
   production `drizzle-kit push` operations; and
6. an isolated local deployment is tested through real Auth, Storage, database,
   worker, chat, structured-generation, embedding, and retrieval paths before
   the setup is considered complete.

The first implementation must deploy under the Compose project name
`compliancetool-test`. Its volumes, users, buckets, models, and network names
must not overlap an existing developer stack.

## Current repository constraints

The implementation must account for these facts rather than treating the
application as a blank project:

- `package.json` defines separate web (`next start`) and worker
  (`tsx src/worker/main.ts`) processes.
- Next.js does not yet emit a standalone server image.
- `src/db/schema.ts` owns more than one hundred server-only, RLS-enabled tables
  and two `vector(1536)` columns.
- The repository has no committed Drizzle SQL migration history. The current
  fresh-database workflow installs the vector extension and then uses
  `drizzle-kit push`.
- Operator-owned SQL already exists for extensions, retention, integrity
  triggers, append-only audit history, and indexes.
- Drizzle uses `DATABASE_URL`. Supabase client/server code separately uses
  Supabase Auth and Storage through the publishable and secret keys.
- Organization Evidence, Legal Corpus, and Compliance Reports are private
  Supabase Storage buckets.
- document embeddings currently instantiate the OpenAI provider directly and
  assume the provider returns exactly 1,536 values.
- the self-hosted OpenAI-compatible provider does not yet declare structured
  output support to the AI SDK.
- `app/layout.tsx` derives its public origin from `VERCEL_URL` or localhost.
- there is no dedicated liveness or readiness API.
- Docling is an optional legal-source OCR/parser fallback. Ordinary
  organization uploads use the Node PDF, DOCX, and text parsers.

These are implementation tasks, not reasons to weaken the target design.

## Confirmed architecture

### Local stack

The base local stack runs entirely in Docker:

```text
Caddy
  +-- Next.js web
  +-- Supabase Kong gateway

Next.js web --------+
Node worker --------+--> PostgreSQL
                    +--> Supabase Auth
                    +--> Supabase Storage --> RustFS
                    +--> LiteLLM --> Ollama

optional profiles:
  Studio + postgres-meta
  Docling
  Prometheus + Grafana + Loki + Alloy
```

Local AI uses:

- chat: `qwen3.5:9b-q4_K_M`;
- embeddings: `qwen3-embedding:4b-q4_K_M`;
- gateway: LiteLLM;
- runtime: Ollama in Docker; and
- execution baseline: CPU. AMD GPU passthrough is not part of the required
  design.

The developer workflows are:

- `full`: all services, including web and worker, run in Docker;
- `infra`: dependencies run in Docker while web and worker run on the Windows
  host for fast development; and
- `test`: the isolated `compliancetool-test` project uses fresh volumes and
  executes the acceptance suite.

### Production application host

Baseline host:

- Ubuntu Server 24.04 LTS;
- 8 dedicated vCPU;
- 32 GB RAM;
- 500 GB NVMe;
- Docker Engine and Compose plugin from Docker's official repository; and
- host-level WireGuard peer to the AI host.

Services:

- Caddy;
- Next.js web, deployed blue/green;
- Node worker, deployed with drain-and-replace semantics;
- PostgreSQL;
- Supabase Auth, PostgREST, Storage, and Kong;
- optional private Studio and postgres-meta profile;
- dedicated Docling service;
- migration and operator-command jobs;
- WAL-G backup tooling; and
- Prometheus, Grafana, Loki, Alloy, Alertmanager, and exporters.

Staging initially shares this physical host but has a separate Compose project,
domain, network, secret set, database, storage bucket, persistent directory,
and resource limits. Production receives resource priority and staging may be
stopped during pressure or maintenance.

### Production AI host

Baseline host:

- Ubuntu Server 24.04 LTS;
- 16 CPU cores;
- 128 GB RAM;
- 2 TB NVMe;
- one NVIDIA H100 80 GB;
- pinned NVIDIA driver and NVIDIA Container Toolkit; and
- no public AI listener.

Services:

- LiteLLM bound only to the WireGuard address;
- vLLM chat service;
- separate vLLM embedding service;
- node, NVIDIA, DCGM, container, and vLLM metrics exporters; and
- Alloy for private log shipping.

Production models:

- chat: `Qwen/Qwen3.5-27B-FP8`;
- pinned revision:
  `97f5941bf617e31c5e237364a8602ce3f03a551a`;
- served chat alias: `compliance-chat`;
- initial context: 131,072 tokens;
- tensor parallelism: one;
- initial maximum sequences: two;
- embeddings: pinned `Qwen/Qwen3-Embedding-4B`;
- served embedding alias: `compliance-embedding`; and
- stored vector dimension: 1,536.

The exact model analysis and fallback order are recorded in
[Self-hosted production model selection](../../research/self-hosted-production-model-selection-2026-07-27.md).

Production inference has no routine Internet access. A controlled provisioning
job downloads exact model revisions, records per-file SHA-256 hashes, scans the
artifacts, and copies the verified snapshot to the offline model store. vLLM
mounts that store read-only and never resolves a mutable Hub branch.

## Framework and service inventory

| Responsibility | Choice |
| --- | --- |
| Application | Next.js and React |
| Application runtime | Node.js 22 LTS, pinned slim Debian image |
| Package installation | `npm ci` from committed lockfile |
| Background processing | Existing TypeScript Node worker |
| Database access | Drizzle ORM over `postgres` |
| Database | Supabase PostgreSQL 15 coordinated image |
| Auth | Supabase Auth |
| REST gateway | PostgREST behind Kong |
| Object API | Supabase Storage |
| Local object backend | RustFS |
| Production object backend | external EU S3-compatible service |
| Public proxy/TLS | Caddy |
| Local AI runtime | Ollama |
| Production AI runtime | vLLM |
| AI API/routing boundary | LiteLLM |
| OCR/layout extraction | Docling, isolated service |
| SMTP testing | Mailpit |
| Production mail | external transactional SMTP |
| Metrics | Prometheus |
| Dashboards | Grafana |
| Logs | Loki and Alloy |
| Alerts | Alertmanager plus external uptime monitor |
| PostgreSQL backup | WAL-G to backup-only S3-compatible storage |
| Host-to-host transport | WireGuard |
| Image registry | GitHub Container Registry |
| CI/CD | GitHub Actions |

Supabase Realtime, Edge Functions, Analytics/Logflare, and Supavisor are not in
the initial stack. Postgres is reachable only on a private Docker network, so
web, worker, and migrations use direct PostgreSQL connections with conservative
connection pools. Add a pooler only after measured connection pressure.

## Repository layout to create

```text
my-app/
  .dockerignore
  Dockerfile
  drizzle/
    <committed baseline and forward migrations>
    meta/
  infra/
    README.md
    versions.env
    compose/
      local/
        compose.yml
        compose.studio.yml
        compose.docling.yml
        compose.observability.yml
      app-host/
        compose.platform.yml
        compose.release.yml
        compose.studio.yml
        compose.observability.yml
      ai-host/
        compose.yml
        compose.observability.yml
    config/
      caddy/
        Caddyfile.local
        Caddyfile.app-host
      kong/
        kong.yml.template
      litellm/
        local.yaml
        production.yaml
      prometheus/
      alertmanager/
      alloy/
      grafana/
      supabase/
        db-init/
    env/
      examples/
        local.env.example
        app-host.env.example
        ai-host.env.example
        observability.env.example
    scripts/
      local-up.ps1
      local-down.ps1
      local-status.ps1
      local-bootstrap.ps1
      local-acceptance.ps1
      render-config.ps1
      migrate.sh
      deploy-app-host.sh
      deploy-ai-host.sh
      provision-models.sh
      backup.sh
      restore.sh
  src/
    config/
      env/
        common.ts
        web.ts
        worker.ts
        migrate.ts
        test.ts
  app/api/health/
    live/route.ts
    ready/route.ts
  scripts/health/
    worker.ts
  .github/workflows/
    verify.yml
    containers.yml
    deploy-staging.yml
    deploy-production.yml
```

The exact checked-in Supabase configuration must be derived from one dated,
tested upstream self-hosting bundle. Record its upstream commit in
`infra/versions.env`; do not assemble unrelated “latest” images.

## Compose boundaries

### Local Compose

Required services:

- `caddy`;
- `web`;
- `worker`;
- `migrate`, as a completed one-shot dependency;
- `kong`;
- `auth`;
- `rest`;
- `storage`;
- `db`;
- `rustfs`;
- `rustfs-init`, which creates the Storage backend bucket;
- `mailpit`;
- `ollama`;
- `ollama-model-init`, which idempotently pulls the exact local model manifests;
- `litellm`; and
- `supabase-bootstrap`, which reconciles private Storage buckets after schema
  migration.

Optional profiles:

- `admin`: Studio and postgres-meta;
- `docling`: Docling; and
- `observability`: the local monitoring stack.

Only Caddy publishes application and Supabase ports. Mailpit and optional
Studio may publish loopback-only administration ports in local development.
No database, worker, LiteLLM, Ollama, RustFS API, or Docling port binds to all
host interfaces.

### Application-host Compose

Split the production Compose deployment into:

- a long-lived platform project containing stateful infrastructure; and
- a release project containing immutable web and worker images.

The release project joins explicitly created external `edge` and `app`
networks. This permits blue/green releases without recreating Postgres or
Supabase. Only one worker color consumes jobs at a time.

### AI-host Compose

LiteLLM is the only service reachable across WireGuard. vLLM services have
private container listeners only. The chat and embedding processes receive
separate GPU memory budgets whose sum leaves safety headroom. Begin with one
active structured generation and one interactive request; enforce excess work
through the durable application queue and LiteLLM limits rather than relying
on vLLM OOM admission.

## Network design

Use these logical networks:

| Network | Members | Exposure |
| --- | --- | --- |
| `edge` | Caddy, web, Kong | Caddy alone publishes host ports |
| `app` | web, worker, Kong, LiteLLM client path, Docling | private |
| `data` | PostgreSQL and internal Supabase services | internal |
| `observability` | collectors, stores, exporters | private |

On the AI host, LiteLLM binds to the WireGuard IP. Host firewalls allow its
port only from the application host's WireGuard address. vLLM is not bound to
the host. Public firewall rules deny AI, database, monitoring, and management
ports.

Local defaults:

- application: `http://localhost:3000`;
- Supabase gateway: `http://localhost:8000`;
- Mailpit UI: loopback-only `http://localhost:8025`; and
- optional Studio: loopback-only, on a documented non-public port.

Production defaults:

- `https://app.example.com` routes to the active Next.js color; and
- `https://supabase.example.com` routes to Kong.

## Persistence

Local and isolated-test stacks use named Docker volumes for:

- PostgreSQL;
- RustFS;
- Ollama;
- Grafana;
- Prometheus; and
- Loki.

The test project receives its own Compose-generated volume prefix.

Staging and production use explicit bind mounts:

```text
/srv/compliancetool/<environment>/
  postgres/
  supabase/
  models/
  prometheus/
  grafana/
  loki/
  backups/
  releases/
```

Document the numeric UID/GID and mode for each directory. Startup preflight
must reject an unexpected owner, world-readable secret/model directory, low
disk space, or a mount that resolves outside the environment root.

Model files are not baked into runtime images:

- local Ollama weights persist in an Ollama volume populated by a one-shot
  model initialization service; and
- production vLLM weights reside in the verified, read-only offline model
  store.

## Image design

Create one multi-stage application Dockerfile with immutable targets:

### `web`

1. install dependencies with `npm ci`;
2. run the Next.js build;
3. use `output: "standalone"` in `next.config.ts`;
4. copy only `.next/standalone`, `.next/static`, and `public`;
5. run as a fixed non-root UID/GID;
6. expose the internal application port; and
7. use the liveness route for the container health check.

### `worker`

The current worker uses TypeScript path aliases and `tsx`, so the first safe
implementation should retain the locked production dependencies required by
the worker rather than assuming the standalone Next server contains them.
After it works, optionally bundle the worker with `tsup`/`esbuild` and prove
behavioral parity before reducing the image.

The worker image:

1. uses the same source revision and dependency lock as web;
2. contains only runtime files required by the worker and report renderer;
3. runs as non-root;
4. uses a process/DB readiness command rather than exposing an HTTP port; and
5. receives a stable `WORKER_ID` derived from environment and release color.

Add OCI revision/source labels. Build Linux `amd64` images only for the first
release because both production hosts are standardized on that architecture.
Pin base images by digest in release branches.

## Environment contract

Add Zod-based environment validation with distinct web, worker, migration, and
test entry points. Validation must run before opening a listener or processing
a job. Error output names invalid variables but never prints their values.

### Application variables

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NODE_ENV` | web, worker | runtime mode |
| `APP_ENV` | all app processes | `local`, `test`, `staging`, `production` |
| `APP_PUBLIC_URL` | web, Auth config | canonical application origin |
| `NEXT_PUBLIC_SUPABASE_URL` | browser, web | public Kong URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser, web | public Supabase key |
| `SUPABASE_SECRET_KEY` | web, worker, bootstrap | server Auth/Storage administration |
| `DATABASE_URL` | web, worker | direct private PostgreSQL URL |
| `DRIZZLE_DATABASE_URL` | migrate/operator only | privileged migration URL |
| `DATABASE_POOL_MAX` | web, worker | per-process pool size |
| `DATABASE_POOL_IDLE_TIMEOUT_SECONDS` | web, worker | idle connection lifetime |
| `API_CURSOR_SECRET` | web | cursor signing secret |
| `AI_DEFAULT_PROVIDER` | web, worker | set to `self_hosted` |
| `SELF_HOSTED_AI_BASE_URL` | web, worker | LiteLLM `/v1` endpoint |
| `SELF_HOSTED_AI_API_KEY` | web, worker | LiteLLM application key |
| `SELF_HOSTED_AI_MODEL` | web, worker | `compliance-chat` alias |
| `SELF_HOSTED_AI_SMALL_MODEL` | web, worker | initially the chat alias |
| `SELF_HOSTED_AI_EMBEDDING_MODEL` | worker, web retrieval | `compliance-embedding` alias |
| `AI_EMBEDDING_DIM` | web, worker, migrate | fixed at `1536` |
| `SELF_HOSTED_AI_MAX_CONTEXT_TOKENS` | web, worker | local tested limit or production `131072` |
| `SELF_HOSTED_AI_SUPPORTS_STRUCTURED_OUTPUTS` | web, worker | `true` after qualification |
| `SELF_HOSTED_AI_SUPPORTS_TOOL_CALLS` | web, worker | qualification-controlled |
| `SELF_HOSTED_AI_SUPPORTS_STREAMING` | web, worker | `true` |
| `SELF_HOSTED_AI_CITATION_RELIABILITY` | web, worker | `medium` |
| `SELF_HOSTED_AI_RECOMMENDED_TEMPERATURE` | web, worker | model-adapter default |
| `AI_GROUNDED_MAX_OUTPUT_TOKENS` | worker | initial `9000` |
| `AI_PROVIDER_TIMEOUT_MS` | web, worker | initial `120000` |
| `DOCLING_SERVICE_URL` | worker | optional private endpoint |
| `WORKER_ID` | worker | stable instance identity |
| `WORKER_DEBUG_ERRORS` | worker | disabled in production |

Remove runtime dependence on `VERCEL_URL`; `APP_PUBLIC_URL` becomes the only
canonical origin. Production validation rejects localhost, plain HTTP, missing
secrets, matching publishable/secret keys, unsafe pool sizes, and external
database/AI URLs that violate the approved topology.

OpenAI and company-hosted variables remain optional unless their provider is
enabled. They are not included in the default Docker environment.

### Supabase variables

Keep the complete official self-host bundle contract, grouped by ownership:

- database: `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`,
  `POSTGRES_USER`, `POSTGRES_PASSWORD`;
- legacy internal JWT compatibility: `JWT_SECRET`, `ANON_KEY`,
  `SERVICE_ROLE_KEY`;
- modern application keys: `SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SECRET_KEY`, asymmetric signing JWK/public-key variables required
  by the pinned bundle;
- URLs: `SUPABASE_PUBLIC_URL`, `API_EXTERNAL_URL`, `SITE_URL`,
  `ADDITIONAL_REDIRECT_URLS`;
- Auth: signup, email-confirmation, password, token-expiry, and external-provider
  settings;
- SMTP: `SMTP_ADMIN_EMAIL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
  `SMTP_PASS`, `SMTP_SENDER_NAME`;
- Storage database and tenant variables; and
- S3 backend: `STORAGE_BACKEND`, `GLOBAL_S3_BUCKET`,
  `GLOBAL_S3_ENDPOINT`, `GLOBAL_S3_PROTOCOL`,
  `GLOBAL_S3_FORCE_PATH_STYLE`, `AWS_ACCESS_KEY_ID`,
  `AWS_SECRET_ACCESS_KEY`, `REGION`.

The application consumes only the modern publishable and secret keys. Legacy
JWT values exist solely where the coordinated Supabase service set still
requires them.

### AI-host variables

- LiteLLM master/application keys and configuration path;
- chat and embedding served aliases;
- verified model mount paths and revision metadata;
- vLLM context, batch, sequence, memory-utilization, reasoning-parser, and tool
  parser settings;
- Hugging Face offline flags;
- CUDA/NVIDIA device configuration; and
- WireGuard bind address.

### Secret handling

- Commit example files containing names and safe non-secret defaults only.
- Ignore local populated environment files.
- Store staging/production files outside the repository under
  `/etc/compliancetool/<environment>/`.
- Make files root-owned and readable only by the deployment group.
- Mount secret files read-only where software supports file-based secrets.
- Use environment variables only for upstream services that require them.
- Keep an encrypted recovery copy in the selected password manager.
- Never echo expanded Compose configuration or secrets into CI logs.

## Required application changes

### Environment and health

1. Add typed environment schemas and import the appropriate schema at each
   process entry point.
2. replace `VERCEL_URL` in `app/layout.tsx` with validated `APP_PUBLIC_URL`;
3. add `/api/health/live`, which proves only that the process is responsive;
4. add `/api/health/ready`, which performs a bounded database check and reports
   a generic failure without leaking connection details; and
5. add a worker health command that proves the process configuration and
   database are reachable.

### AI provider compatibility

1. Configure `createOpenAICompatible` to advertise structured-output support.
2. Keep LiteLLM aliases stable so application configuration does not contain
   runtime-specific model names.
3. Add model-specific thinking and sampling options instead of applying one
   OpenAI temperature policy to Qwen and Ollama.
4. Keep non-thinking mode as the initial interactive default.
5. Test thinking and non-thinking modes for grounded jobs; enable thinking per
   request only if it improves the acceptance suite within the timeout.
6. Ensure reasoning content is never stored or shown as the schema-constrained
   business result.

### Embedding adapter

Replace the direct OpenAI dependency in
`src/server/documents/embeddings.ts` with the selected provider abstraction.
One shared adapter must:

1. request embeddings through LiteLLM;
2. validate the native vector;
3. normalize it;
4. truncate the Matryoshka vector to the first 1,536 dimensions;
5. normalize the truncated vector again;
6. reject non-finite or zero-norm results; and
7. return provider, model revision/alias, dimension, and retrieval-instruction
   identity for generation provenance.

Local and production data are isolated. Never combine vectors made by
different model snapshots, quantizations, dimensions, or retrieval
instructions in one generation. Any such change requires an explicit
re-embedding migration.

## Database migration baseline

This is the first implementation dependency.

### Establish the baseline

1. Create a fresh disposable Supabase PostgreSQL database.
2. Apply only the pre-schema extension SQL required to create
   `extensions.vector`.
3. Generate a Drizzle baseline migration from the current
   `src/db/schema.ts`.
4. Review every table, enum, constraint, index, RLS statement, and vector
   column against the schema.
5. Apply the baseline with the migration runner, never `push`.
6. Apply the idempotent operator SQL in its documented order.
7. Run all schema, RLS, integrity, and zero-drift checks.
8. Recreate another empty database solely from committed migrations and
   operator SQL.
9. Compare the resulting schema to the current known-good disposable database.

### Migration service

Create a one-shot migration image/command that:

- uses a privileged direct database URL;
- obtains a PostgreSQL advisory lock;
- verifies the target `APP_ENV` and database identity;
- runs committed Drizzle migrations;
- records ordered operator-SQL filenames and SHA-256 checksums;
- refuses a previously applied filename whose checksum changed;
- releases the lock and exits zero only after verification; and
- does not create users, publish releases, or activate legal content.

Web and worker never run migrations. Production `drizzle-kit push`, `--force`,
and automatic destructive repair are prohibited.

Auth-user creation, Platform Administrator bootstrap, Legal Corpus review, and
release publication/activation remain explicit audited operator actions.

## Supabase bootstrap

Use the official self-hosted configuration as the source of database roles,
schemas, Kong routes, Auth behavior, Storage migrations, modern keys, and
health checks. Trim only the agreed services:

- keep PostgreSQL, Auth, PostgREST, Storage, and Kong;
- keep Studio and postgres-meta in an optional private admin profile;
- omit Realtime, Edge Functions, Analytics, and the platform API;
- omit imgproxy unless a tested Storage path requires it; and
- omit Supavisor until measured connection pressure justifies it.

After migrations, an idempotent bootstrap command:

1. verifies modern Supabase keys through Kong;
2. creates or reconciles `organization-evidence`, `legal-corpus`, and
   `compliance-reports`;
3. enforces private visibility, MIME, and size limits;
4. verifies signed upload and download support; and
5. exits without creating business or governance data.

Local Auth sends mail to Mailpit. Production Auth uses the external
transactional SMTP account. Redirect allowlists use `APP_PUBLIC_URL` and never
wildcard arbitrary origins.

## Storage

Local Supabase Storage uses a dedicated RustFS bucket through the S3 backend
configuration. A one-shot RustFS initialization service creates the backend
bucket and scoped credentials before Storage becomes ready.

Production uses separate EU S3-compatible buckets and credentials for staging
and production. The application continues using only the Supabase Storage API;
it never receives raw backend S3 credentials.

Required production controls:

- bucket versioning;
- server-side encryption;
- lifecycle rules compatible with application retention;
- least-privilege Storage credentials;
- off-host durability;
- capacity and error-rate alerts; and
- restore tests for both metadata and object bytes.

## Caddy and public routing

Local Caddy routes loopback ports to web and Kong. Production Caddy:

- terminates TLS;
- redirects HTTP to HTTPS;
- routes the two approved domains;
- applies request/body/time limits appropriate to each upstream;
- preserves forwarded protocol/host headers required by Auth and signed URLs;
- emits structured access logs with sensitive query/header redaction;
- exposes no admin API publicly; and
- switches web upstream color atomically during release.

Uploads should continue using signed Supabase Storage URLs rather than proxying
large document bodies through Next.js.

## Container security

Apply this baseline to first-party images:

- non-root fixed UID/GID;
- read-only root filesystem;
- explicit writable temporary directories using `tmpfs`;
- `cap_drop: [ALL]`;
- `security_opt: [no-new-privileges:true]`;
- no Docker socket;
- bounded PIDs, CPU, and memory;
- init process for signal forwarding;
- graceful stop periods for web and worker; and
- no embedded secrets or model files.

For third-party images, document narrow exceptions per service. Do not weaken a
whole Compose project because an upstream container requires one writable path
or capability.

Pin every image to an explicit tested version and production digest. Generate
an SBOM, scan first-party images and the coordinated dependency set, and sign
published first-party images. Block known critical vulnerabilities unless a
time-bounded, documented exception is approved.

## Observability

### Metrics and alerts

Collect:

- Caddy request rate, status, and latency;
- Next.js readiness and request health;
- worker queue depth, age, attempts, failures, lease expiry, and duration;
- PostgreSQL connections, locks, replication/WAL, disk, and query health;
- Supabase Auth and Storage error rates;
- host CPU, memory, filesystem, network, and container health;
- LiteLLM request, queue, error, and latency metrics;
- vLLM time-to-first-token, tokens/second, queue, KV cache, and failures;
- NVIDIA utilization, memory, temperature, and ECC state;
- backup age and last restore-test result; and
- certificate and external endpoint status.

Alert on user-visible outage, database/storage unavailability, stale backups,
disk pressure, repeated job failure, AI timeout/OOM, expiring certificates, and
WireGuard peer loss.

### Logging

Use structured logs and request/job/run identifiers. Never log:

- passwords, API keys, cookies, bearer tokens, or signed URLs;
- complete prompts or model responses;
- uploaded document text;
- legal-source bytes;
- organization evidence; or
- personal data beyond approved audit identifiers.

Audit events remain in the application's append-only database model. Loki is
operational telemetry, not the legal audit source of truth.

## Backup and recovery

PostgreSQL:

- WAL-G continuous WAL archiving to a backup-only S3-compatible target;
- daily base backup;
- weekly and monthly retained recovery points;
- target RPO of 15 minutes or less;
- target RTO of four hours or less; and
- monthly restore into an isolated network followed by schema and application
  checks.

Storage:

- backend versioning and retention;
- inventory/checksum evidence;
- metadata and object restoration tested together; and
- credentials isolated from primary Storage credentials.

Back up configuration metadata and encrypted secrets separately. Do not treat
Docker volumes, snapshots on the same host, or untested archives as recovery.

## CI/CD and releases

### Pull-request verification

GitHub Actions must run:

```text
npm ci
npm run lint
npm run typecheck
npm test
npm run check:i18n
npm run test:worker
npm run test:routes
npm run test:ai
npm run build
docker build --target web
docker build --target worker
docker compose config for every checked-in Compose combination
configuration/template validation
image scan and SBOM generation
```

Do not run live model evaluations on every pull request. Run deterministic fake
provider tests by default and use an explicit, protected live-AI workflow for
model qualification.

### Image publication

On the protected main branch:

1. build web and worker once from the same Git revision;
2. push revision-addressed images to GHCR;
3. sign images and attach SBOM/provenance;
4. record immutable digests in the release manifest; and
5. deploy staging by digest.

Production deployment requires a version tag or manual protected-environment
approval. Servers pull images; they never build source.

### Blue/green application deployment

1. Verify backup freshness and migration compatibility.
2. Start the new web color without public traffic.
3. Run the one-shot migration.
4. Check the new web readiness endpoint.
5. stop new claims on the old worker and allow its leased job to finish;
6. start the new worker and verify database/queue access;
7. switch Caddy to the new web color;
8. execute production-safe smoke checks; and
9. retain the preceding image digests and configuration for immediate
   application rollback.

Database rollback is forward-fix or verified restore. Never point old code at
an incompatible migrated schema merely because the old image still exists.

## Local isolated deployment and test plan

No step in this section may target an existing project or volume.

### 1. Preflight

- Confirm Docker Desktop uses Linux containers and Compose is available.
- Confirm at least 24 GB memory for standard mode, or at least 15 GB for the
  constrained local mode, and adequate free disk. Constrained mode phases
  Docling separately from local AI and must not alter the configured Docker or
  WSL memory ceiling.
- Verify ports are free.
- Verify the project name is exactly `compliancetool-test`.
- Render configuration and reject unresolved variables.
- Print only service names, image versions, ports, and non-secret target
  identities.
- Confirm every volume/network name begins with the isolated project prefix.

### 2. Static application gate

Run the existing repository checks before container startup:

```text
npm ci
npm run verify
npm run test:worker
npm run test:routes
npm run test:ai
npm run build
```

Then build both Docker targets and validate all Compose/profile combinations.

### 3. Infrastructure bootstrap

1. Start PostgreSQL, RustFS, Mailpit, Ollama, and required Supabase services.
2. Wait on real health checks, not fixed sleeps.
3. initialize RustFS;
4. populate the isolated Ollama volume with the exact chat and embedding model
   manifests;
5. run the committed migration and operator-SQL sequence;
6. reconcile private Storage buckets;
7. start LiteLLM and verify both aliases; and
8. start web and worker only after required dependencies are healthy.

### 4. Service health gate

Prove:

- PostgreSQL accepts the expected private connection;
- Auth health is ready through Kong;
- PostgREST is reachable only through Kong/Caddy;
- Storage health and backend access pass;
- LiteLLM reaches Ollama;
- both model aliases report ready;
- web liveness and readiness pass;
- worker process and database readiness pass; and
- no required container is restarting or unhealthy.

### 5. Functional acceptance

Automate an isolated smoke fixture that:

1. creates a test user through Supabase Auth;
2. retrieves the confirmation message from Mailpit and completes confirmation;
3. signs in and establishes the browser/server session;
4. creates an organization through the application API;
5. verifies Drizzle persisted the organization and membership;
6. creates a signed upload session;
7. uploads a small supported document through Supabase Storage;
8. completes extraction/chunking/embedding through the worker;
9. verifies a 1,536-dimensional finite normalized embedding;
10. retrieves the uploaded evidence semantically;
11. calls interactive chat through LiteLLM and Ollama;
12. runs one small German and one English structured-output fixture;
13. verifies schema validity and admitted citation IDs;
14. queues and completes a worker-backed job;
15. renders and downloads a report through a signed private URL;
16. verifies storage deletion/cleanup behavior on a disposable object; and
17. proves browser roles cannot directly read server-only application tables.

Use minimal fixtures. The local 9B model validates integration and schema
transport, not production legal quality.

### 6. Failure and recovery acceptance

- Restart web and prove sessions/data remain.
- Restart worker during a leased disposable job and prove lease retry/idempotent
  completion.
- Restart Storage and prove RustFS objects remain.
- Restart the whole project without removing volumes and prove data/models
  remain.
- Send an invalid LiteLLM key and verify rejection.
- stop Ollama and verify bounded AI timeout plus safe job failure;
- verify an invalid embedding dimension is rejected before persistence; and
- confirm private service ports are not reachable from the host/public
  interface.

### 7. Optional profiles

Run Studio only through its loopback/private administration path. Start
Docling separately and exercise one controlled legal-source extraction fixture.
Failure of an optional profile does not invalidate the base stack, but its
profile cannot be marked supported until its smoke test passes.

### 8. Evidence

Write a dated report under `docs/qa/` containing:

- Git revision;
- Compose project name;
- image names and digests;
- non-secret configuration summary;
- model manifests;
- migration/operator-SQL checksums;
- test commands and exit status;
- service health summary;
- functional fixture identifiers;
- restart/failure results;
- timings; and
- known limitations.

Do not include secrets, prompt/document contents, cookies, signed URLs, or
personal data.

Cleanup may remove only resources whose resolved names start with the exact
isolated Compose project prefix. Keep the evidence file. Destructive cleanup of
any other project requires separate explicit authorization.

## Production AI qualification

The local model cannot approve the production model. Before production:

1. run the exact pinned Qwen snapshot, vLLM digest, LiteLLM route, prompt
   versions, and application schemas in staging;
2. run all existing AI tests and manual Gap/Action Plan evaluations in German
   and English;
3. require first-attempt schema validity because the current provider uses
   `maxRetries: 0`;
4. require zero invented or cross-channel citation identifiers;
5. review legal meaning, unsupported claims, abstention, contradiction, and
   prompt-injection behavior;
6. require p95 end-to-end completion below the configured 120-second timeout
   for the largest accepted workload;
7. require zero OOMs and truncated structured responses; and
8. record model, container, driver, prompt, schema, sampling, and evaluation
   identities as release evidence.

If `Qwen3.5-27B-FP8` fails the agreed quality or latency envelope after bounded
tuning, test `Qwen3.5-35B-A3B-FP8`. If the Qwen/vLLM integration itself is
unreliable, test the documented GPT-OSS-120B fallback. Every fallback repeats
the complete acceptance gate.

## Implementation sequence

### Phase 0: Freeze and document the baseline

1. Record current application checks and known environment behavior.
2. Add the version manifest and example environment inventory.
3. Select one dated official Supabase self-host bundle and record its commit.
4. Record all upstream image tags and production digest-resolution procedure.

Exit criteria:

- every service and version source is identified;
- no secret value is committed; and
- current non-Docker behavior is reproducible.

### Phase 1: Establish migrations

1. Generate and review the current-schema Drizzle baseline.
2. implement the locked one-shot migration runner;
3. add operator-SQL checksum tracking;
4. rehearse two from-empty database builds;
5. compare schemas and run security/integrity verification; and
6. update the existing database runbooks to prohibit production push.

Exit criteria:

- a fresh database is reproducible from committed files;
- no production step uses `drizzle-kit push`; and
- migration drift and edited applied SQL fail closed.

### Phase 2: Add configuration and health boundaries

1. Implement typed environment schemas.
2. add `APP_PUBLIC_URL`;
3. add web liveness/readiness;
4. add worker readiness;
5. centralize embedding dimension; and
6. add unsafe-production-default tests.

Exit criteria:

- every process rejects invalid configuration before work;
- health checks reveal no secrets; and
- local, test, staging, and production schemas are explicit.

### Phase 3: Build application images

1. Enable Next standalone output.
2. add `.dockerignore`;
3. implement web and worker targets;
4. apply non-root/read-only controls;
5. build both images twice to check reproducibility; and
6. run application tests inside/against the images.

Exit criteria:

- web and worker start from immutable images;
- they share one Git revision; and
- neither image contains environment files, development caches, or model data.

### Phase 4: Build the lean local platform

1. Vendor the pinned Supabase configuration.
2. trim only explicitly omitted services;
3. configure Kong, Auth, PostgREST, Storage, PostgreSQL, RustFS, and Mailpit;
4. implement initialization dependencies and health checks;
5. add optional Studio and Docling profiles; and
6. verify private network exposure.

Exit criteria:

- Supabase Auth and Storage work through Kong;
- all required buckets are private; and
- database/internal service ports are not publicly bound.

### Phase 5: Add the local AI path

1. Add Ollama and persistent model initialization.
2. configure LiteLLM aliases;
3. implement the provider structured-output setting;
4. implement the 1,536-dimension embedding adapter;
5. add chat, structured-output, and embedding smoke tests; and
6. document expected CPU startup/inference time.

Exit criteria:

- application code calls only LiteLLM;
- chat and embedding aliases work after restart; and
- stored embeddings satisfy the fixed vector contract.

### Phase 6: Compose the complete local application

1. Add Caddy.
2. add web, worker, migrate, and bootstrap dependencies;
3. add `full`, `infra`, and isolated `test` workflows;
4. add safe PowerShell helpers for Windows;
5. validate all Compose combinations; and
6. document startup, status, logs, and non-destructive shutdown.

Exit criteria:

- `compliancetool-test` reaches healthy state from empty volumes; and
- normal shutdown preserves its isolated data and models.

### Phase 7: Execute local acceptance

1. Run the static gate.
2. deploy the isolated stack;
3. run service, functional, persistence, failure, and exposure checks;
4. run optional-profile checks separately;
5. record QA evidence; and
6. fix and repeat until every required gate passes.

Exit criteria:

- real Auth, Storage, Drizzle, worker, AI, embedding, retrieval, and report
  paths pass; and
- remaining limitations are explicit and do not contradict the acceptance
  criteria.

### Phase 8: Implement the production application host

1. Add platform and release Compose files.
2. add production Caddy routing;
3. add external S3 and SMTP configuration;
4. add `/srv` directory provisioning and preflight;
5. add blue/green web and worker deployment;
6. add staging isolation/resource limits; and
7. rehearse rollback.

Exit criteria:

- staging deploys only immutable digests;
- production services have no unintended public ports; and
- application rollback and migration incompatibility behavior are proven.

### Phase 9: Implement the production AI host

1. Provision pinned NVIDIA dependencies.
2. configure WireGuard/firewalls;
3. implement verified offline model provisioning;
4. deploy LiteLLM and separate vLLM services;
5. tune memory/concurrency conservatively;
6. run the production AI qualification; and
7. test WireGuard loss and inference recovery.

Exit criteria:

- only LiteLLM is reachable from the application host;
- inference needs no outbound Internet; and
- the exact pinned model passes the release gate.

### Phase 10: Backups, monitoring, and delivery automation

1. Deploy metrics/logging/alerts.
2. configure WAL-G and object-store controls;
3. perform an isolated database/object restore;
4. add CI image, SBOM, scan, signature, and Compose checks;
5. add staging and protected production workflows; and
6. document incident, upgrade, backup, restore, and release runbooks.

Exit criteria:

- backup and alert freshness are observable;
- a restore meets the RPO/RTO objective in rehearsal; and
- production promotion is digest-based, gated, and auditable.

## Upgrade policy

- Never use `latest`.
- Update the coordinated Supabase set as one reviewed unit.
- Dependabot may open version PRs, but staging qualification is mandatory.
- Use a monthly normal maintenance window.
- Expedite critical security updates through the same abbreviated staging gate.
- Keep the immediately preceding known-good images and configuration.
- Schema and model changes require their dedicated migration/evaluation gates.

## Acceptance criteria

The Docker implementation is complete only when:

- the repository contains the planned Docker, Compose, environment, migration,
  health, automation, and runbook files;
- no secret or model weight is embedded in Git or an application image;
- a database can be built from empty storage using committed migrations and
  checksummed operator SQL;
- `drizzle-kit push` is absent from production procedures;
- the isolated `compliancetool-test` stack passes the complete local acceptance
  suite;
- Auth, signed private Storage, Drizzle, worker jobs, chat, structured output,
  1,536-dimensional embeddings, retrieval, and reports are proven;
- restarts preserve expected data and models;
- only approved proxy/admin ports are exposed;
- staging and production use isolated data, secrets, buckets, and domains;
- app and AI hosts communicate only over the private WireGuard path;
- production AI runs the pinned qualified model without routine Internet
  access;
- blue/green application release and worker draining are rehearsed;
- monitoring, alerts, backups, and an isolated restore are verified;
- CI publishes signed, scanned, immutable web and worker images; and
- a dated evidence report records the exact successful configuration without
  sensitive data.

## Explicit non-goals for the first release

- Kubernetes or Docker Swarm;
- multi-node database or AI high availability;
- Supabase Realtime, Edge Functions, or Analytics;
- public Studio, Grafana, Prometheus, Docling, LiteLLM, Ollama, vLLM, or
  PostgreSQL;
- production AMD GPU support;
- baking model files into images;
- automatic legal-corpus approval or release activation;
- automatic database downgrade; and
- claiming local model output quality is equivalent to the production model.

## Primary references

- [Supabase self-hosting with Docker](https://supabase.com/docs/guides/self-hosting/docker)
- [Supabase S3 Storage backend](https://supabase.com/docs/guides/self-hosting/self-hosted-s3)
- [Supabase asymmetric keys](https://supabase.com/docs/guides/self-hosting/self-hosted-auth-keys)
- [Docker Desktop GPU support](https://docs.docker.com/desktop/features/gpu/)
- [Ollama Qwen3.5 models](https://ollama.com/library/qwen3.5/tags)
- [Ollama Qwen3 Embedding models](https://ollama.com/library/qwen3-embedding/tags)
- [Qwen3.5-27B-FP8](https://huggingface.co/Qwen/Qwen3.5-27B-FP8)
- [Qwen3-Embedding-4B](https://huggingface.co/Qwen/Qwen3-Embedding-4B)
- [vLLM structured outputs](https://docs.vllm.ai/en/v0.23.0/features/structured_outputs/)
