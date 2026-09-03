# syntax=docker/dockerfile:1.8

ARG NODE_IMAGE=node:22.22.0-bookworm-slim@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94
ARG GOLANG_IMAGE=golang:1.25.11-alpine3.23@sha256:60e626bbde32def8694687d03536ea4341b19e5f068e9a630225a1dfbd0505c9
ARG GNUTLS_VERSION=3.7.9-2+deb12u7
ARG SUPABASE_DB_BASE_IMAGE=supabase/postgres:15.14.1.156@sha256:8bc9d837eb74a74025424ac7604fd7900fc216ce1daaa2ef17fc5f09c6c22d9b
ARG SUPABASE_STORAGE_BASE_IMAGE=supabase/storage-api:v1.60.4@sha256:c8eb9858eafec891a97c27125470aaad54703c3f4eb4d55ca7f1bf6c6411febf
ARG SUPABASE_STUDIO_BASE_IMAGE=supabase/studio:2026.07.27-sha-cbb076d@sha256:91e8cf3857103605b354d29873fb36cd3173f700e3c57cb45d04a901d65feff7
ARG SUPABASE_META_BASE_IMAGE=supabase/postgres-meta:v0.96.6@sha256:a84cc713585eea7b401e4a2561ec4a1e48c87083d1c7ecb4502f204bb4391300

FROM ${NODE_IMAGE} AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

FROM base AS production-dependencies
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev && npm cache clean --force

FROM base AS builder
ARG VCS_REF=unknown
ARG NEXT_PUBLIC_SUPABASE_URL=http://supabase.invalid
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=build-only-publishable-key
ENV NODE_ENV=production \
    NEXT_BUILD_ID=${VCS_REF} \
    APP_ENV=local \
    APP_PUBLIC_URL=http://localhost:3000 \
    DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY} \
    SUPABASE_SECRET_KEY=build-only-secret-key \
    API_CURSOR_SECRET=build-only-cursor-secret \
    AI_DEFAULT_PROVIDER=openai \
    OPENAI_API_KEY=build-only-openai-key \
    OPENAI_MODEL=build-only-chat \
    OPENAI_EMBEDDING_MODEL=text-embedding-3-small
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runtime
ARG GNUTLS_VERSION
RUN apt-get update && \
    apt-get install --yes --no-install-recommends "libgnutls30=${GNUTLS_VERSION}" && \
    rm -rf /var/lib/apt/lists/* /usr/local/lib/node_modules/npm && \
    rm -f /usr/local/bin/npm /usr/local/bin/npx

FROM runtime AS web
ARG VCS_REF=unknown
ARG SOURCE_URL=unknown
LABEL org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.source="${SOURCE_URL}"
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN groupadd --gid 10001 comply && \
    useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin comply
COPY --from=builder --chown=10001:10001 /app/.next/standalone ./
COPY --from=builder --chown=10001:10001 /app/.next/static ./.next/static
COPY --from=builder --chown=10001:10001 /app/public ./public
# pdf-parse loads its native canvas peer dynamically, so Next's file tracer
# cannot discover it even when the package is externalized.
COPY --from=dependencies --chown=10001:10001 /app/node_modules/@napi-rs/canvas ./node_modules/@napi-rs/canvas
COPY --from=dependencies --chown=10001:10001 /app/node_modules/@napi-rs/canvas-linux-x64-gnu ./node_modules/@napi-rs/canvas-linux-x64-gnu
USER 10001:10001
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]

FROM runtime AS operator
ARG VCS_REF=unknown
ARG SOURCE_URL=unknown
LABEL org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.source="${SOURCE_URL}"
ENV NODE_ENV=production
RUN groupadd --gid 10001 comply && \
    useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin comply
COPY --from=production-dependencies --chown=10001:10001 /app/node_modules ./node_modules
COPY --chown=10001:10001 package.json package-lock.json tsconfig.json drizzle.config.ts ./
COPY --chown=10001:10001 src ./src
COPY --chown=10001:10001 lib ./lib
COPY --chown=10001:10001 components ./components
COPY --chown=10001:10001 public ./public
COPY --chown=10001:10001 scripts ./scripts
COPY --chown=10001:10001 infra/config/supabase/db-init ./infra/config/supabase/db-init
USER 10001:10001

# The coordinated Storage image runs Node directly but retains npm globally.
# Removing that unused package-manager tree eliminates its runtime tar CVE
# without changing the pinned Storage application.
FROM ${SUPABASE_STORAGE_BASE_IMAGE} AS storage
ARG VCS_REF=unknown
ARG SOURCE_URL=unknown
LABEL org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.source="${SOURCE_URL}"
RUN rm -rf /usr/local/lib/node_modules/npm && \
    rm -f /usr/local/bin/npm /usr/local/bin/npx

# Studio and postgres-meta also run Node directly. Their global npm trees are
# not runtime dependencies and contain a vulnerable node-tar copy.
FROM ${SUPABASE_STUDIO_BASE_IMAGE} AS studio
ARG VCS_REF=unknown
ARG SOURCE_URL=unknown
LABEL org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.source="${SOURCE_URL}"
RUN rm -rf /usr/local/lib/node_modules/npm && \
    rm -f /usr/local/bin/npm /usr/local/bin/npx

FROM ${SUPABASE_META_BASE_IMAGE} AS postgres-meta
ARG GNUTLS_VERSION
ARG VCS_REF=unknown
ARG SOURCE_URL=unknown
LABEL org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.source="${SOURCE_URL}"
RUN apt-get update && \
    apt-get install --yes --no-install-recommends "libgnutls30=${GNUTLS_VERSION}" && \
    rm -rf /var/lib/apt/lists/* /usr/local/lib/node_modules/npm && \
    rm -f /usr/local/bin/npm /usr/local/bin/npx

# WAL-G's latest release predates fixes in Go and two dependencies. Build the
# pinned upstream security-fix commit as a static binary from a checksum-locked
# source archive, without optional CGO compression libraries.
FROM ${GOLANG_IMAGE} AS wal-g-builder
ADD --checksum=sha256:63b255098742037bc3dd6e96ae4c5ea7453a20c791069acd5bfe5c8eb04bd926 \
    https://github.com/wal-g/wal-g/archive/283e11bfcfba885086edea7aec105e670f8c002a.tar.gz \
    /tmp/wal-g.tar.gz
RUN mkdir -p /src /out && \
    tar -xzf /tmp/wal-g.tar.gz --strip-components=1 -C /src && \
    cd /src && \
    CGO_ENABLED=0 GOEXPERIMENT=jsonv2 go build \
      -trimpath -mod=readonly \
      -ldflags="-s -w -buildid= -X github.com/wal-g/wal-g/cmd/pg.buildDate=2026.07.26_22:00:54 -X github.com/wal-g/wal-g/cmd/pg.gitRevision=283e11bfcfba885086edea7aec105e670f8c002a -X github.com/wal-g/wal-g/cmd/pg.walgVersion=3.0.8-security-283e11b" \
      -o /out/wal-g ./main/pg

# Recent security-fixed Supabase PostgreSQL images no longer bundle WAL-G.
FROM ${SUPABASE_DB_BASE_IMAGE} AS database
ARG VCS_REF=unknown
ARG SOURCE_URL=unknown
COPY --from=wal-g-builder --chmod=0755 /out/wal-g /usr/local/bin/wal-g
LABEL org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.source="${SOURCE_URL}" \
      org.opencontainers.image.wal-g.version="3.0.8-security-283e11b" \
      org.opencontainers.image.wal-g.revision="283e11bfcfba885086edea7aec105e670f8c002a"
