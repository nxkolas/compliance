param(
  [ValidateSet("full", "infra", "test")]
  [string]$Mode = "full"
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$environmentName = if ($Mode -eq "test") { "test" } else { "local" }
$projectName = if ($Mode -eq "test") { "compliancetool-test" } else { "compliancetool-local" }
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
& docker @arguments ps
