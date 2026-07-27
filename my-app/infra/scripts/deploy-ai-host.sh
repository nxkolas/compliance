#!/usr/bin/env bash
set -euo pipefail

environment_file="${1:?usage: deploy-ai-host.sh <ai-host-environment-file>}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd "$script_dir/../.." && pwd)"

read_env() {
  local name="$1"
  awk -F= -v key="$name" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$environment_file"
}

[[ -f "$environment_file" ]] || { echo "Environment file not found" >&2; exit 1; }
[[ "$(stat -c %u "$environment_file")" == "0" ]] || { echo "Environment file must be root-owned" >&2; exit 1; }
environment_mode="$(stat -c %a "$environment_file")"
[[ "$environment_mode" == "600" || "$environment_mode" == "640" ]] || {
  echo "Environment file mode must be 0600 or 0640" >&2; exit 1;
}
[[ "$(realpath -m "$(read_env AI_DATA_ROOT)")" == "/srv/compliancetool/ai" ]] || {
  echo "Unexpected AI_DATA_ROOT" >&2; exit 1;
}
root="$(read_env AI_DATA_ROOT)"
declare -A owners=(
  ["."]="0:0"
  ["models"]="0:0"
  ["prometheus"]="65534:65534"
  ["metrics"]="65534:65534"
  ["grafana"]="472:472"
  ["loki"]="10001:10001"
)
for relative_path in "${!owners[@]}"; do
  if [[ "$relative_path" == "." ]]; then
    path="$root"
  else
    path="$(realpath -m "$root/$relative_path")"
  fi
  [[ "$path" == "$root" || "$path" == "$root/"* ]] || {
    echo "AI path escaped the deployment root: $path" >&2; exit 1;
  }
  [[ -d "$path" ]] || { echo "Required AI directory missing: $path" >&2; exit 1; }
  actual="$(stat -c '%u:%g' "$path")"
  [[ "$actual" == "${owners[$relative_path]}" ]] || {
    echo "Unexpected owner for $path: $actual" >&2; exit 1;
  }
done
available_kb="$(df -Pk "$root" | awk 'NR == 2 {print $4}')"
(( available_kb >= 300 * 1024 * 1024 )) || {
  echo "Less than 300 GB free under AI_DATA_ROOT" >&2; exit 1;
}
if [[ "$(read_env ENABLE_OBSERVABILITY)" == "true" ]]; then
  webhook_file="$(read_env ALERTMANAGER_WEBHOOK_FILE)"
  [[ -f "$webhook_file" && "$(stat -c %u "$webhook_file")" == "0" ]] || {
    echo "Alertmanager webhook file must exist and be root-owned" >&2; exit 1;
  }
  webhook_mode="$(stat -c %a "$webhook_file")"
  [[ "$webhook_mode" == "600" || "$webhook_mode" == "640" ]] || {
    echo "Alertmanager webhook file mode must be 0600 or 0640" >&2; exit 1;
  }
fi

nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits \
  | awk -F, '
      {
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", $1)
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2)
      }
      $1 ~ /^NVIDIA H100/ && ($2 + 0) >= 80000 { found=1 }
      END { exit found ? 0 : 1 }
    ' || {
    echo "The qualified NVIDIA H100 80 GB device is not available" >&2; exit 1;
  }
docker info --format '{{json .Runtimes}}' | grep -q nvidia || {
  echo "The NVIDIA Container Toolkit runtime is unavailable" >&2; exit 1;
}

for specification in \
  "CHAT_MODEL_PATH:CHAT_MODEL_REPOSITORY:CHAT_MODEL_REVISION" \
  "EMBEDDING_MODEL_PATH:EMBEDDING_MODEL_REPOSITORY:EMBEDDING_MODEL_REVISION"; do
  IFS=: read -r path_variable repository_variable revision_variable \
    <<< "$specification"
  path="$(read_env "$path_variable")"
  expected_repository="$(read_env "$repository_variable")"
  expected_revision="$(read_env "$revision_variable")"
  resolved="$(realpath -e "$path")"
  [[ "$resolved" == "$root/models/"* ]] || {
    echo "Model path escaped the offline model root: $path" >&2; exit 1;
  }
  [[ -f "$path/SHA256SUMS" && -f "$path/PROVENANCE" ]] || {
    echo "Verified model metadata missing at $path" >&2; exit 1;
  }
  (cd "$path" && sha256sum --check --quiet SHA256SUMS)
  grep -Fxq "repository=$expected_repository" "$path/PROVENANCE" || {
    echo "Model repository provenance does not match $repository_variable" >&2
    exit 1
  }
  grep -Fxq "revision=$expected_revision" "$path/PROVENANCE" || {
    echo "Model revision provenance does not match $revision_variable" >&2
    exit 1
  }
  find "$path" -perm /007 -print -quit | grep -q . && {
    echo "Model store grants access to other users: $path" >&2; exit 1;
  }
  find "$path" ! -user root -print -quit | grep -q . && {
    echo "Model store contains a non-root-owned path: $path" >&2; exit 1;
  }
done

compose=(
  docker compose
  --env-file "$repository_root/infra/versions.env"
  --env-file "$environment_file"
  -f "$repository_root/infra/compose/ai-host/compose.yml"
)
if [[ "$(read_env ENABLE_OBSERVABILITY)" == "true" ]]; then
  compose+=(-f "$repository_root/infra/compose/ai-host/compose.observability.yml")
fi
"${compose[@]}" config --quiet
"${compose[@]}" pull
"${compose[@]}" up -d --wait

bind_address="$(read_env WIREGUARD_BIND_ADDRESS)"
application_key="$(read_env LITELLM_APPLICATION_KEY)"
curl --fail --silent --show-error --max-time 15 \
  -H "Authorization: Bearer $application_key" \
  "http://$bind_address:4000/v1/models" >/dev/null
echo "AI host is healthy on its WireGuard listener."
