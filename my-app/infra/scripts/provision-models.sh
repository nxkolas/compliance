#!/usr/bin/env bash
set -euo pipefail
umask 027

environment_file="${1:?usage: provision-models.sh <ai-host-environment-file>}"
[[ -f "$environment_file" ]] || { echo "Environment file not found" >&2; exit 1; }
[[ "$(id -u)" -eq 0 ]] || { echo "Run model provisioning as root." >&2; exit 1; }
command -v hf >/dev/null || { echo "The Hugging Face hf CLI is required" >&2; exit 1; }
command -v clamscan >/dev/null || { echo "ClamAV clamscan is required" >&2; exit 1; }

read_env() {
  local name="$1"
  awk -F= -v key="$name" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$environment_file"
}

root="$(read_env AI_DATA_ROOT)"
[[ "$(realpath -m "$root")" == "/srv/compliancetool/ai" ]] || {
  echo "AI_DATA_ROOT must resolve to /srv/compliancetool/ai" >&2; exit 1;
}
staging="$(mktemp -d "$root/.model-provision.XXXXXX")"
trap 'rm -rf "$staging"' EXIT

provision() {
  local label="$1" repository="$2" revision="$3" destination="$4"
  local download="$staging/$label"
  local resolved_destination
  [[ "$repository" =~ ^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$ ]] || {
    echo "Invalid model repository: $repository" >&2
    exit 1
  }
  [[ "$revision" =~ ^[0-9a-f]{40}$ ]] || {
    echo "Model revision must be a full commit: $revision" >&2
    exit 1
  }
  resolved_destination="$(realpath -m "$destination")"
  [[ "$resolved_destination" == "$root/models/"* ]] || {
    echo "Model destination escaped the offline model root: $destination" >&2
    exit 1
  }
  mkdir -p "$download"
  HF_HUB_DISABLE_TELEMETRY=1 hf download "$repository" \
    --revision "$revision" \
    --local-dir "$download"
  {
    printf 'repository=%s\n' "$repository"
    printf 'revision=%s\n' "$revision"
    printf 'provisioned_at=%s\n' "$(date --utc --iso-8601=seconds)"
  } > "$download/PROVENANCE"
  clamscan --recursive --infected "$download"
  (
    cd "$download"
    find . -type f ! -name SHA256SUMS -print0 \
      | sort -z \
      | xargs -0 sha256sum > SHA256SUMS
  )
  find "$download" -type d -exec chmod 0750 {} +
  find "$download" -type f -exec chmod 0440 {} +
  if [[ -e "$destination" ]]; then
    echo "Destination already exists; refusing mutable replacement: $destination" >&2
    exit 1
  fi
  mv "$download" "$destination"
}

mkdir -p "$root/models"
provision chat \
  "$(read_env CHAT_MODEL_REPOSITORY)" \
  "$(read_env CHAT_MODEL_REVISION)" \
  "$(read_env CHAT_MODEL_PATH)"
provision embedding \
  "$(read_env EMBEDDING_MODEL_REPOSITORY)" \
  "$(read_env EMBEDDING_MODEL_REVISION)" \
  "$(read_env EMBEDDING_MODEL_PATH)"
echo "Pinned model snapshots were scanned, hashed, and installed read-only."
