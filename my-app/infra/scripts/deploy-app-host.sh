#!/usr/bin/env bash
set -euo pipefail

color="${1:?usage: deploy-app-host.sh <blue|green> <environment-file>}"
environment_file="${2:?usage: deploy-app-host.sh <blue|green> <environment-file>}"
[[ "$color" == "blue" || "$color" == "green" ]] || {
  echo "Release color must be blue or green" >&2; exit 2;
}

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd "$script_dir/../.." && pwd)"
"$script_dir/preflight-app-host.sh" "$environment_file"

read_env() {
  local name="$1"
  awk -F= -v key="$name" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$environment_file"
}

app_environment="$(read_env APP_ENV)"
data_root="$(read_env APP_DATA_ROOT)"
web_image="$(read_env WEB_IMAGE)"
operator_image="$(read_env OPERATOR_IMAGE)"
database_image="$(read_env COMPLIANCETOOL_DB_IMAGE)"
storage_image="$(read_env COMPLIANCETOOL_STORAGE_IMAGE)"
studio_image="$(read_env COMPLIANCETOOL_STUDIO_IMAGE)"
meta_image="$(read_env COMPLIANCETOOL_META_IMAGE)"
revision="$(read_env RELEASE_REVISION)"
digest_pattern='@sha256:[0-9a-f]{64}$'
[[ "$web_image" =~ $digest_pattern && "$operator_image" =~ $digest_pattern &&
   "$database_image" =~ $digest_pattern && "$storage_image" =~ $digest_pattern &&
   "$studio_image" =~ $digest_pattern && "$meta_image" =~ $digest_pattern ]] || {
  echo "All release and hardened platform images must be immutable digests" >&2
  exit 1
}

versions="$repository_root/infra/versions.env"
platform_file="$repository_root/infra/compose/app-host/compose.platform.yml"
observability_file="$repository_root/infra/compose/app-host/compose.observability.yml"
studio_file="$repository_root/infra/compose/app-host/compose.studio.yml"
release_file="$repository_root/infra/compose/app-host/compose.release.yml"
platform=(docker compose --env-file "$versions" --env-file "$environment_file" -f "$platform_file")
if [[ "$(read_env ENABLE_OBSERVABILITY)" == "true" ]]; then
  platform+=(-f "$observability_file")
fi
if [[ "$(read_env ENABLE_STUDIO)" == "true" ]]; then
  platform+=(-f "$studio_file" --profile admin)
fi
release=(docker compose --env-file "$versions" --env-file "$environment_file" -f "$release_file")

"${platform[@]}" config --quiet
"${release[@]}" --profile "$color" config --quiet

backup_marker="$data_root/backups/last-successful"
if [[ "${ALLOW_INITIAL_DEPLOYMENT_WITHOUT_BACKUP:-0}" != "1" ]]; then
  [[ -f "$backup_marker" ]] || { echo "No successful backup marker found" >&2; exit 1; }
  age_seconds=$(( $(date +%s) - $(stat -c %Y "$backup_marker") ))
  (( age_seconds <= 86400 )) || { echo "Last successful backup is stale" >&2; exit 1; }
fi

"${platform[@]}" up -d --wait
"${release[@]}" --profile "$color" up -d "web-$color"
if [[ "$app_environment" == "staging" ]]; then
  "${release[@]}" run --rm database-plan
  "${release[@]}" run --rm database-bootstrap
else
  echo "Skipping disposable Drizzle bootstrap in production; use the reviewed production baseline procedure."
fi
"${release[@]}" --profile "$color" up -d --wait "web-$color"

active_file="$(read_env CADDY_ACTIVE_UPSTREAM_FILE)"
temporary_file="$data_root/releases/.active-upstream.${revision}.$$"
printf 'reverse_proxy web-%s:3000\n' "$color" > "$temporary_file"
chmod 0644 "$temporary_file"
mv -f "$temporary_file" "$active_file"
"${platform[@]}" exec -T caddy caddy reload --config /etc/caddy/Caddyfile

app_public_url="$(read_env APP_PUBLIC_URL)"
curl --fail --silent --show-error --max-time 15 "$app_public_url/api/health/ready" >/dev/null

manifest="$data_root/releases/${revision}.manifest"
{
  printf 'revision=%s\n' "$revision"
  printf 'color=%s\n' "$color"
  printf 'web_image=%s\n' "$web_image"
  printf 'operator_image=%s\n' "$operator_image"
  printf 'database_image=%s\n' "$database_image"
  printf 'storage_image=%s\n' "$storage_image"
  printf 'studio_image=%s\n' "$studio_image"
  printf 'meta_image=%s\n' "$meta_image"
  sha256sum "$platform_file" "$release_file" "$repository_root/infra/config/caddy/Caddyfile.app-host"
  if [[ "$(read_env ENABLE_OBSERVABILITY)" == "true" ]]; then
    sha256sum "$observability_file"
  fi
  if [[ "$(read_env ENABLE_STUDIO)" == "true" ]]; then
    sha256sum "$studio_file"
  fi
} > "$manifest"
chmod 0640 "$manifest"
echo "Deployed $app_environment revision $revision on $color."
