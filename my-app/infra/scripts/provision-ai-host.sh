#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this provisioning command as root." >&2
  exit 1
fi

root="/srv/compliancetool/ai"
install -d -o 0 -g 0 -m 0750 "$root"
install -d -o 0 -g 0 -m 0750 "$root/models"
install -d -o 65534 -g 65534 -m 0750 "$root/prometheus"
install -d -o 65534 -g 65534 -m 0750 "$root/metrics"
install -d -o 472 -g 472 -m 0750 "$root/grafana"
install -d -o 10001 -g 10001 -m 0750 "$root/loki"

echo "Provisioned $root. Provision and verify model snapshots before deployment."
