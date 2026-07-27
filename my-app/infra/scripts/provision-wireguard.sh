#!/usr/bin/env bash
set -euo pipefail
umask 077

role="${1:?usage: provision-wireguard.sh <app|ai> <environment-file> --apply}"
environment_file="${2:?usage: provision-wireguard.sh <app|ai> <environment-file> --apply}"
confirmation="${3:-}"
[[ "$role" == "app" || "$role" == "ai" ]] || { echo "Role must be app or ai" >&2; exit 2; }
[[ "$confirmation" == "--apply" ]] || { echo "Refusing host network changes without --apply" >&2; exit 2; }
[[ "$(id -u)" -eq 0 ]] || { echo "Run as root from a recoverable console session." >&2; exit 1; }
[[ -f "$environment_file" ]] || { echo "Environment file not found" >&2; exit 1; }

read_env() {
  local name="$1"
  awk -F= -v key="$name" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$environment_file"
}

private_key_file="$(read_env WIREGUARD_PRIVATE_KEY_FILE)"
[[ -f "$private_key_file" && "$(stat -c %u "$private_key_file")" == "0" ]] || {
  echo "WireGuard private key must exist and be root-owned" >&2; exit 1;
}
private_key_mode="$(stat -c %a "$private_key_file")"
[[ "$private_key_mode" == "400" || "$private_key_mode" == "600" ]] || {
  echo "WireGuard private key mode must be 0400 or 0600" >&2; exit 1;
}
private_key="$(tr -d '\r\n' < "$private_key_file")"
[[ -n "$private_key" ]] || { echo "WireGuard private key is empty" >&2; exit 1; }

interface_address="$(read_env WIREGUARD_INTERFACE_ADDRESS)"
listen_port="$(read_env WIREGUARD_LISTEN_PORT)"
peer_public_key="$(read_env WIREGUARD_PEER_PUBLIC_KEY)"
peer_allowed_ip="$(read_env WIREGUARD_PEER_ALLOWED_IP)"
peer_endpoint="$(read_env WIREGUARD_PEER_ENDPOINT)"
for value in "$interface_address" "$listen_port" "$peer_public_key" "$peer_allowed_ip" "$peer_endpoint"; do
  [[ -n "$value" && "$value" != replace* ]] || { echo "WireGuard configuration is incomplete" >&2; exit 1; }
done

install -d -o 0 -g 0 -m 0700 /etc/wireguard
temporary="$(mktemp /etc/wireguard/.wg0.XXXXXX)"
trap 'rm -f "$temporary"' EXIT
{
  printf '[Interface]\nAddress = %s\nListenPort = %s\nPrivateKey = %s\n\n' \
    "$interface_address" "$listen_port" "$private_key"
  printf '[Peer]\nPublicKey = %s\nAllowedIPs = %s\nEndpoint = %s\nPersistentKeepalive = 25\n' \
    "$peer_public_key" "$peer_allowed_ip" "$peer_endpoint"
} > "$temporary"
chmod 0600 "$temporary"
mv -f "$temporary" /etc/wireguard/wg0.conf
trap - EXIT

systemctl enable --now wg-quick@wg0

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
install -D -o 0 -g 0 -m 0755 \
  "$script_dir/wireguard-metrics.sh" \
  /usr/local/libexec/compliancetool/wireguard-metrics
if [[ "$role" == "ai" ]]; then
  metrics_dir="$(read_env AI_DATA_ROOT)/metrics"
else
  metrics_dir="$(read_env APP_DATA_ROOT)/backups/metrics"
fi
[[ -d "$metrics_dir" ]] || {
  echo "Provision the host metrics directory before WireGuard." >&2
  exit 1
}
cat > /etc/systemd/system/compliancetool-wireguard-metrics.service <<EOF
[Unit]
Description=Export Compliance Tool WireGuard handshake metric
After=wg-quick@wg0.service
Requires=wg-quick@wg0.service

[Service]
Type=oneshot
ExecStart=/usr/local/libexec/compliancetool/wireguard-metrics $metrics_dir
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=$metrics_dir
EOF
cat > /etc/systemd/system/compliancetool-wireguard-metrics.timer <<'EOF'
[Unit]
Description=Refresh Compliance Tool WireGuard handshake metric

[Timer]
OnBootSec=30s
OnUnitActiveSec=30s
AccuracySec=5s
Unit=compliancetool-wireguard-metrics.service

[Install]
WantedBy=timers.target
EOF
chmod 0644 \
  /etc/systemd/system/compliancetool-wireguard-metrics.service \
  /etc/systemd/system/compliancetool-wireguard-metrics.timer
systemctl daemon-reload
systemctl enable --now compliancetool-wireguard-metrics.timer
systemctl start compliancetool-wireguard-metrics.service

ufw allow OpenSSH
ufw allow "${listen_port}/udp"
if [[ "$role" == "app" ]]; then
  ufw allow 80/tcp
  ufw allow 443/tcp
else
  app_peer="${peer_allowed_ip%/*}"
  ufw allow in on wg0 from "$app_peer" to any port 4000 proto tcp
  ufw deny 4000/tcp
fi
ufw default deny incoming
ufw default allow outgoing
ufw --force enable

wg show wg0 >/dev/null
echo "WireGuard and the $role host firewall policy are active."
