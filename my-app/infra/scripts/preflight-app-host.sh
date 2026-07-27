#!/usr/bin/env bash
set -euo pipefail

environment_file="${1:?usage: preflight-app-host.sh <environment-file>}"
[[ -f "$environment_file" ]] || { echo "Environment file not found" >&2; exit 1; }

read_env() {
  local name="$1"
  awk -F= -v key="$name" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$environment_file"
}

app_environment="$(read_env APP_ENV)"
root="$(read_env APP_DATA_ROOT)"
expected="/srv/compliancetool/${app_environment}"
resolved="$(realpath -m "$root")"
[[ "$app_environment" == "staging" || "$app_environment" == "production" ]] || {
  echo "APP_ENV must be staging or production" >&2; exit 1;
}
[[ "$resolved" == "$expected" ]] || {
  echo "APP_DATA_ROOT resolved outside the environment root" >&2; exit 1;
}
[[ "$(stat -c '%u' "$environment_file")" == "0" ]] || {
  echo "Environment file must be root-owned" >&2; exit 1;
}
mode="$(stat -c '%a' "$environment_file")"
[[ "$mode" == "600" || "$mode" == "640" ]] || {
  echo "Environment file mode must be 0600 or 0640" >&2; exit 1;
}

declare -A owners=(
  ["postgres/data"]="999:999"
  ["postgres/config"]="999:999"
  ["caddy/data"]="1000:1000"
  ["caddy/config"]="1000:1000"
  ["caddy/logs"]="1000:1000"
  ["prometheus"]="65534:65534"
  ["grafana"]="472:472"
  ["loki"]="10001:10001"
  ["backups"]="10001:10001"
  ["backups/metrics"]="65534:65534"
  ["releases"]="0:0"
)
for relative_path in "${!owners[@]}"; do
  path="$(realpath -m "$root/$relative_path")"
  [[ "$path" == "$root/"* ]] || { echo "Path escaped environment root: $path" >&2; exit 1; }
  [[ -d "$path" ]] || { echo "Required directory missing: $path" >&2; exit 1; }
  actual="$(stat -c '%u:%g' "$path")"
  [[ "$actual" == "${owners[$relative_path]}" ]] || {
    echo "Unexpected owner for $path: $actual" >&2; exit 1;
  }
done

available_kb="$(df -Pk "$root" | awk 'NR == 2 {print $4}')"
(( available_kb >= 100 * 1024 * 1024 )) || {
  echo "Less than 100 GB free under APP_DATA_ROOT" >&2; exit 1;
}

if [[ "$(read_env ENABLE_OBSERVABILITY)" == "true" ]]; then
  webhook_file="$(read_env ALERTMANAGER_WEBHOOK_FILE)"
  [[ -f "$webhook_file" && "$(stat -c '%u' "$webhook_file")" == "0" ]] || {
    echo "Alertmanager webhook file must exist and be root-owned" >&2; exit 1;
  }
  webhook_mode="$(stat -c '%a' "$webhook_file")"
  [[ "$webhook_mode" == "600" || "$webhook_mode" == "640" ]] || {
    echo "Alertmanager webhook file mode must be 0600 or 0640" >&2; exit 1;
  }
fi

docker info >/dev/null
docker compose version >/dev/null
echo "Application-host preflight passed for $app_environment."
