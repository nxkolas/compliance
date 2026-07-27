#!/usr/bin/env bash
set -euo pipefail
umask 022

output_input="${1:?usage: wireguard-metrics.sh <textfile-directory>}"
[[ "$(id -u)" -eq 0 ]] || { echo "WireGuard metric collection must run as root." >&2; exit 1; }
output_dir="$(realpath -e "$output_input")"
case "$output_dir" in
  /srv/compliancetool/*/metrics|/srv/compliancetool/*/backups/metrics) ;;
  *) echo "Metric directory is outside an approved deployment root." >&2; exit 1 ;;
esac

latest="$(
  wg show wg0 latest-handshakes |
    awk 'BEGIN { latest=0 } $2 > latest { latest=$2 } END { print latest }'
)"
[[ "$latest" =~ ^[0-9]+$ ]] || { echo "WireGuard returned an invalid handshake timestamp." >&2; exit 1; }

temporary="$(mktemp "$output_dir/.wireguard.prom.XXXXXX")"
trap 'rm -f "$temporary"' EXIT
{
  printf '# HELP wireguard_latest_handshake_seconds Unix timestamp of the newest wg0 peer handshake.\n'
  printf '# TYPE wireguard_latest_handshake_seconds gauge\n'
  printf 'wireguard_latest_handshake_seconds %s\n' "$latest"
} > "$temporary"
chown 65534:65534 "$temporary"
chmod 0644 "$temporary"
mv -f "$temporary" "$output_dir/wireguard.prom"
trap - EXIT
