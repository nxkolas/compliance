param(
  [ValidateSet("full", "infra", "test")]
  [string]$Mode = "full",
  [switch]$RemoveVolumes
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$environmentName = if ($Mode -eq "test") { "test" } else { "local" }
$projectName = if ($Mode -eq "test") { "compliancetool-test" } else { "compliancetool-local" }
if (-not $projectName.StartsWith("compliancetool-")) {
  throw "Refusing to stop a project outside the compliancetool prefix."
}
$arguments = @(
  "compose",
  "--project-name", $projectName,
  "--env-file", (Join-Path $repositoryRoot "infra/versions.env"),
  "--env-file", (Join-Path $repositoryRoot ".env.docker.$environmentName"),
  "-f", (Join-Path $repositoryRoot "infra/compose/local/compose.yml")
)
if ($Mode -eq "infra") {
  $arguments += @("-f", (Join-Path $repositoryRoot "infra/compose/local/compose.infra.yml"))
}
$downArguments = @("down", "--remove-orphans")
if ($RemoveVolumes) {
  $downArguments += "--volumes"
}
& docker @arguments @downArguments
if ($LASTEXITCODE -ne 0) { throw "Compose shutdown failed" }
if ($RemoveVolumes) {
  Write-Output "Removed volumes for the isolated project $projectName; Docker volume deletion is not recoverable."
} else {
  Write-Output "Stopped $projectName and preserved its volumes."
}
