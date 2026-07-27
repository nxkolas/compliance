#!/usr/bin/env bash
set -euo pipefail

environment_name="${1:?usage: provision-app-host.sh <staging|production>}"
case "$environment_name" in
  staging|production) ;;
  *) echo "Unsupported environment" >&2; exit 2 ;;
esac
if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this provisioning command as root." >&2
  exit 1
fi

root="/srv/compliancetool/${environment_name}"
install -d -o 0 -g 0 -m 0750 "$root"
install -d -o 999 -g 999 -m 0700 "$root/postgres/data" "$root/postgres/config"
install -d -o 1000 -g 1000 -m 0750 "$root/caddy/data" "$root/caddy/config" "$root/caddy/logs"
install -d -o 65534 -g 65534 -m 0750 "$root/prometheus"
install -d -o 472 -g 472 -m 0750 "$root/grafana"
install -d -o 10001 -g 10001 -m 0750 "$root/loki" "$root/backups"
install -d -o 65534 -g 65534 -m 0750 "$root/backups/metrics"
install -d -o 0 -g 0 -m 0750 "$root/releases"

active="$root/releases/active-upstream.caddy"
if [[ ! -e "$active" ]]; then
  printf 'respond "No application release is active" 503\n' > "$active"
  chmod 0644 "$active"
fi

echo "Provisioned $root. Populate /etc/compliancetool/$environment_name separately with root-owned mode 0640 secrets."
