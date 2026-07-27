#!/usr/bin/env bash
set -euo pipefail
umask 077

environment_file="${1:?usage: restore.sh <environment-file> <empty-target-directory> --confirm-empty-target}"
target_input="${2:?usage: restore.sh <environment-file> <empty-target-directory> --confirm-empty-target}"
confirmation="${3:-}"
[[ "$confirmation" == "--confirm-empty-target" ]] || {
  echo "Refusing restore without --confirm-empty-target" >&2
  exit 2
}
[[ "$(id -u)" -eq 0 ]] || { echo "Run restore rehearsal as root." >&2; exit 1; }

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd "$script_dir/../.." && pwd)"

read_env() {
  local name="$1"
  awk -F= -v key="$name" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$environment_file"
}

[[ -f "$environment_file" ]] || { echo "Environment file not found" >&2; exit 1; }
target="$(realpath -m "$target_input")"
[[ "$target" == /srv/compliancetool/restore-rehearsals/* ]] || {
  echo "Restore target must be below /srv/compliancetool/restore-rehearsals" >&2
  exit 1
}
[[ -d "$target" ]] || { echo "Restore target must already exist" >&2; exit 1; }
[[ -z "$(find "$target" -mindepth 1 -maxdepth 1 -print -quit)" ]] || {
  echo "Restore target is not empty" >&2
  exit 1
}

restore_id="compliancetool-restore-$(date -u +%Y%m%d%H%M%S)-$$"
container_name="${restore_id}-db"
network_name="${restore_id}-network"
temporary_env="$(mktemp)"
temporary_object="$(mktemp)"
cleanup() {
  docker rm -f "$container_name" >/dev/null 2>&1 || true
  docker network rm "$network_name" >/dev/null 2>&1 || true
  rm -f "$temporary_env" "$temporary_object"
}
trap cleanup EXIT

cat > "$temporary_env" <<EOF
WALG_S3_PREFIX=$(read_env WALG_S3_PREFIX)
AWS_ENDPOINT=$(read_env BACKUP_S3_ENDPOINT)
AWS_REGION=$(read_env BACKUP_REGION)
AWS_ACCESS_KEY_ID=$(read_env BACKUP_AWS_ACCESS_KEY_ID)
AWS_SECRET_ACCESS_KEY=$(read_env BACKUP_AWS_SECRET_ACCESS_KEY)
AWS_S3_FORCE_PATH_STYLE=$(read_env BACKUP_S3_FORCE_PATH_STYLE)
WALG_COMPRESSION_METHOD=zstd
EOF
chmod 0600 "$temporary_env"

db_image="$(read_env COMPLIANCETOOL_DB_IMAGE)"
[[ "$db_image" =~ @sha256:[0-9a-f]{64}$ ]] || {
  echo "COMPLIANCETOOL_DB_IMAGE must use an immutable digest" >&2
  exit 1
}
docker run --rm \
  --env-file "$temporary_env" \
  --entrypoint /usr/local/bin/wal-g \
  --mount "type=bind,source=$target,target=/restore" \
  "$db_image" backup-fetch /restore LATEST
chown -R 999:999 "$target"
chmod 0700 "$target"

docker network create --internal "$network_name" >/dev/null
docker run -d \
  --name "$container_name" \
  --network "$network_name" \
  --mount "type=bind,source=$target,target=/var/lib/postgresql/data" \
  -e POSTGRES_PASSWORD="$(read_env POSTGRES_PASSWORD)" \
  -e POSTGRES_DB="$(read_env POSTGRES_DB)" \
  "$db_image" postgres -c archive_mode=off >/dev/null

for _ in $(seq 1 60); do
  if docker exec "$container_name" pg_isready -U postgres -h localhost >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
docker exec "$container_name" pg_isready -U postgres -h localhost >/dev/null
docker exec "$container_name" psql -U postgres -d "$(read_env POSTGRES_DB)" \
  -v ON_ERROR_STOP=1 \
  -c "select extversion from pg_extension where extname = 'vector';" \
  -c "select count(*) as applied_sql_count from app_private.deployment_sql_history;" \
  -c "select count(*) as public_table_count from information_schema.tables where table_schema = 'public';"

canary_key="$(read_env STORAGE_RESTORE_CANARY_OBJECT)"
canary_version="$(read_env STORAGE_RESTORE_CANARY_VERSION_ID)"
canary_sha="$(read_env STORAGE_RESTORE_CANARY_SHA256)"
if [[ -n "$canary_key" && "$canary_key" != replace* && -n "$canary_version" && "$canary_version" != replace* && "$canary_sha" =~ ^[0-9a-f]{64}$ ]]; then
  worker_image="$(read_env WORKER_IMAGE)"
  [[ "$worker_image" =~ @sha256:[0-9a-f]{64}$ ]] || {
    echo "WORKER_IMAGE must use an immutable digest" >&2
    exit 1
  }
  docker run --rm \
    --entrypoint node \
    -e S3_ENDPOINT="$(read_env GLOBAL_S3_ENDPOINT)" \
    -e S3_REGION="$(read_env REGION)" \
    -e S3_FORCE_PATH_STYLE="$(read_env GLOBAL_S3_FORCE_PATH_STYLE)" \
    -e S3_ACCESS_KEY_ID="$(read_env STORAGE_INVENTORY_ACCESS_KEY_ID)" \
    -e S3_SECRET_ACCESS_KEY="$(read_env STORAGE_INVENTORY_SECRET_ACCESS_KEY)" \
    "$worker_image" node_modules/tsx/dist/cli.mjs scripts/s3-operator.ts \
    get-object "$(read_env GLOBAL_S3_BUCKET)" "$canary_key" "$canary_version" \
    > "$temporary_object"
  printf '%s  %s\n' "$canary_sha" "$temporary_object" | sha256sum --check --status
else
  echo "Storage canary verification skipped: configure an exact object key and SHA-256." >&2
  exit 1
fi

printf 'restored_at=%s\nsource_environment=%s\nrestore_id=%s\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  "$(read_env APP_ENV)" \
  "$restore_id" > "$target/RESTORE-REHEARSAL"
chmod 0640 "$target/RESTORE-REHEARSAL"
echo "Isolated database and object canary restore rehearsal passed: $restore_id."
