param(
  [ValidateSet("full", "infra", "test")]
  [string]$Mode = "full",
  [switch]$Admin,
  [switch]$Docling,
  [switch]$Observability,
  [switch]$ConstrainedMemory
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$environmentName = if ($Mode -eq "test") { "test" } else { "local" }
$projectName = if ($Mode -eq "test") { "compliancetool-test" } else { "compliancetool-local" }
$environmentFile = Join-Path $repositoryRoot ".env.docker.$environmentName"

if (-not (Test-Path -LiteralPath $environmentFile)) {
  & node (Join-Path $PSScriptRoot "generate-local-env.mjs") $environmentFile $projectName
  if ($LASTEXITCODE -ne 0) { throw "Environment generation failed" }
}

& (Join-Path $PSScriptRoot "local-up.ps1") -Mode $Mode -Admin:$Admin -Docling:$Docling -Observability:$Observability -ConstrainedMemory:$ConstrainedMemory
