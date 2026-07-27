param(
  [string]$EnvironmentFile = ".env.docker.test",
  [string]$ProjectName = "compliancetool-test",
  [switch]$ConstrainedMemory
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$arguments = @(
  "compose",
  "--project-name", $ProjectName,
  "--env-file", (Join-Path $repositoryRoot "infra/versions.env"),
  "--env-file", (Join-Path $repositoryRoot $EnvironmentFile),
  "-f", (Join-Path $repositoryRoot "infra/compose/local/compose.yml")
)
if ($ConstrainedMemory) {
  $arguments += @("-f", (Join-Path $repositoryRoot "infra/compose/local/compose.constrained-memory.yml"))
}

$rendered = (& docker @arguments config --format json) | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) {
  throw "Could not render local Compose security policy."
}
$caddy = $rendered.services.caddy
if (@($caddy.cap_drop) -notcontains "ALL") {
  throw "Local Caddy must drop the default capability set."
}
if (@($caddy.cap_add).Count -ne 1 -or @($caddy.cap_add) -notcontains "NET_BIND_SERVICE") {
  throw "Local Caddy must add back only NET_BIND_SERVICE so the pinned capability-bearing binary can execute."
}
if (@($caddy.security_opt) -notcontains "no-new-privileges:true") {
  throw "Local Caddy must retain no-new-privileges."
}
foreach ($port in @($caddy.ports)) {
  if ($port.host_ip -ne "127.0.0.1") {
    throw "Local Caddy ports must remain loopback-only."
  }
}

Write-Output "Local Compose Caddy security policy passed."
