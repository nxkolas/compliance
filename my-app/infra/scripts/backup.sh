#!/usr/bin/env bash
set -euo pipefail
umask 077

environment_file="${1:?usage: backup.sh <environment-file>}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd "$script_dir/../.." && pwd)"
"$script_dir/preflight-app-host.sh" "$environment_file"

read_env() {
  local name="$1"
  awk -F= -v key="$name" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$environment_file"
}

require_env() {
  local name="$1" value
  value="$(read_env "$name")"
  [[ -n "$value" && "$value" != replace* ]] || {
    echo "Required backup variable is unset: $name" >&2
    exit 1
  }
}

for name in \
  APP_DATA_ROOT PLATFORM_PROJECT_NAME GLOBAL_S3_BUCKET GLOBAL_S3_ENDPOINT \
  GLOBAL_S3_FORCE_PATH_STYLE REGION WORKER_IMAGE \
  STORAGE_INVENTORY_ACCESS_KEY_ID STORAGE_INVENTORY_SECRET_ACCESS_KEY; do
  require_env "$name"
done

versions="$repository_root/infra/versions.env"
platform_file="$repository_root/infra/compose/app-host/compose.platform.yml"
compose=(
  docker compose
  --env-file "$versions"
  --env-file "$environment_file"
  -f "$platform_file"
)
"${compose[@]}" config --quiet
"${compose[@]}" exec -T db pg_isready -U postgres -h localhost >/dev/null

data_root="$(read_env APP_DATA_ROOT)"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
evidence_dir="$data_root/backups/$timestamp"
install -d -o 10001 -g 10001 -m 0700 "$evidence_dir"

"${compose[@]}" exec -T db wal-g backup-push /var/lib/postgresql/data
"${compose[@]}" exec -T db wal-g backup-list --json > "$evidence_dir/postgresql-backups.json"

worker_image="$(read_env WORKER_IMAGE)"
[[ "$worker_image" =~ @sha256:[0-9a-f]{64}$ ]] || {
  echo "WORKER_IMAGE must use an immutable digest" >&2
  exit 1
}
storage_endpoint="$(read_env GLOBAL_S3_ENDPOINT)"
storage_bucket="$(read_env GLOBAL_S3_BUCKET)"
inventory_access_key="$(read_env STORAGE_INVENTORY_ACCESS_KEY_ID)"
inventory_secret_key="$(read_env STORAGE_INVENTORY_SECRET_ACCESS_KEY)"
docker run --rm \
  --entrypoint node \
  -e S3_ENDPOINT="$storage_endpoint" \
  -e S3_REGION="$(read_env REGION)" \
  -e S3_FORCE_PATH_STYLE="$(read_env GLOBAL_S3_FORCE_PATH_STYLE)" \
  -e S3_ACCESS_KEY_ID="$inventory_access_key" \
  -e S3_SECRET_ACCESS_KEY="$inventory_secret_key" \
  "$worker_image" node_modules/tsx/dist/cli.mjs scripts/s3-operator.ts \
  inventory "$storage_bucket" > "$evidence_dir/storage-inventory.jsonl"

sha256sum \
  "$evidence_dir/postgresql-backups.json" \
  "$evidence_dir/storage-inventory.jsonl" \
  > "$evidence_dir/SHA256SUMS"
printf 'completed_at=%s\nwal_g_version=%s\n' \
  "$timestamp" \
  "$("${compose[@]}" exec -T db wal-g --version | tr '\t' ' ')" \
  > "$evidence_dir/MANIFEST"

marker_temp="$data_root/backups/.last-successful.$$"
printf '%s\n' "$timestamp" > "$marker_temp"
chown 10001:10001 "$marker_temp"
chmod 0640 "$marker_temp"
mv -f "$marker_temp" "$data_root/backups/last-successful"

metric_temp="$data_root/backups/metrics/.backup.prom.$$"
printf 'compliancetool_backup_last_success_timestamp_seconds %s\n' "$(date +%s)" > "$metric_temp"
chown 65534:65534 "$metric_temp"
chmod 0644 "$metric_temp"
mv -f "$metric_temp" "$data_root/backups/metrics/backup.prom"

echo "Backup and storage inventory completed at $timestamp."
