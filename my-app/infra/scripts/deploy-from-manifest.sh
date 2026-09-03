#!/usr/bin/env bash
set -euo pipefail
umask 077

manifest="${1:?usage: deploy-from-manifest.sh <release-manifest> <environment-file>}"
environment_file="${2:?usage: deploy-from-manifest.sh <release-manifest> <environment-file>}"
[[ "$(id -u)" -eq 0 ]] || { echo "Run through the narrow deployment sudo rule." >&2; exit 1; }
[[ -f "$manifest" && -f "$environment_file" ]] || { echo "Manifest or environment file missing" >&2; exit 1; }

read_file_value() {
  local file="$1" name="$2"
  awk -F= -v key="$name" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$file"
}

revision="$(read_file_value "$manifest" RELEASE_REVISION)"
web_image="$(read_file_value "$manifest" WEB_IMAGE)"
operator_image="$(read_file_value "$manifest" OPERATOR_IMAGE)"
database_image="$(read_file_value "$manifest" COMPLIANCETOOL_DB_IMAGE)"
storage_image="$(read_file_value "$manifest" COMPLIANCETOOL_STORAGE_IMAGE)"
studio_image="$(read_file_value "$manifest" COMPLIANCETOOL_STUDIO_IMAGE)"
meta_image="$(read_file_value "$manifest" COMPLIANCETOOL_META_IMAGE)"
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || { echo "Manifest revision is invalid" >&2; exit 1; }
digest_pattern='@sha256:[0-9a-f]{64}$'
[[ "$web_image" =~ $digest_pattern && "$operator_image" =~ $digest_pattern &&
   "$database_image" =~ $digest_pattern && "$storage_image" =~ $digest_pattern &&
   "$studio_image" =~ $digest_pattern && "$meta_image" =~ $digest_pattern ]] || {
  echo "Manifest images must use immutable digests" >&2; exit 1;
}

temporary="$(mktemp "$(dirname "$environment_file")/.application.env.XXXXXX")"
trap 'rm -f "$temporary"' EXIT
awk -F= \
  -v web="$web_image" \
  -v operator="$operator_image" \
  -v database="$database_image" \
  -v storage="$storage_image" \
  -v studio="$studio_image" \
  -v meta="$meta_image" \
  -v revision="$revision" '
    $1 == "WEB_IMAGE" { print "WEB_IMAGE=" web; seen_web=1; next }
    $1 == "OPERATOR_IMAGE" { print "OPERATOR_IMAGE=" operator; seen_operator=1; next }
    $1 == "COMPLIANCETOOL_DB_IMAGE" { print "COMPLIANCETOOL_DB_IMAGE=" database; seen_database=1; next }
    $1 == "COMPLIANCETOOL_STORAGE_IMAGE" { print "COMPLIANCETOOL_STORAGE_IMAGE=" storage; seen_storage=1; next }
    $1 == "COMPLIANCETOOL_STUDIO_IMAGE" { print "COMPLIANCETOOL_STUDIO_IMAGE=" studio; seen_studio=1; next }
    $1 == "COMPLIANCETOOL_META_IMAGE" { print "COMPLIANCETOOL_META_IMAGE=" meta; seen_meta=1; next }
    $1 == "RELEASE_REVISION" { print "RELEASE_REVISION=" revision; seen_revision=1; next }
    { print }
    END {
      if (!seen_web) print "WEB_IMAGE=" web
      if (!seen_operator) print "OPERATOR_IMAGE=" operator
      if (!seen_database) print "COMPLIANCETOOL_DB_IMAGE=" database
      if (!seen_storage) print "COMPLIANCETOOL_STORAGE_IMAGE=" storage
      if (!seen_studio) print "COMPLIANCETOOL_STUDIO_IMAGE=" studio
      if (!seen_meta) print "COMPLIANCETOOL_META_IMAGE=" meta
      if (!seen_revision) print "RELEASE_REVISION=" revision
    }
  ' "$environment_file" > "$temporary"
chown --reference="$environment_file" "$temporary"
chmod --reference="$environment_file" "$temporary"
mv -f "$temporary" "$environment_file"
trap - EXIT

active_file="$(read_file_value "$environment_file" CADDY_ACTIVE_UPSTREAM_FILE)"
active_color="$(sed -n 's/.*web-\(blue\|green\).*/\1/p' "$active_file" 2>/dev/null | head -n1 || true)"
if [[ "$active_color" == "blue" ]]; then
  target_color="green"
else
  target_color="blue"
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$script_dir/deploy-app-host.sh" "$target_color" "$environment_file"
