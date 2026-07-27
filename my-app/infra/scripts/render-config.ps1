param(
  [ValidateSet("local", "test")]
  [string]$Environment = "local",
  [string[]]$AdditionalFiles = @()
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$projectName = if ($Environment -eq "test") { "compliancetool-test" } else { "compliancetool-local" }
$environmentFile = Join-Path $repositoryRoot ".env.docker.$Environment"
if (-not (Test-Path -LiteralPath $environmentFile)) {
  throw "Missing generated environment file: $environmentFile"
}

$arguments = @(
  "compose",
  "--project-name", $projectName,
  "--env-file", (Join-Path $repositoryRoot "infra/versions.env"),
  "--env-file", $environmentFile,
  "-f", (Join-Path $repositoryRoot "infra/compose/local/compose.yml")
)
foreach ($file in $AdditionalFiles) {
  $arguments += @("-f", (Join-Path $repositoryRoot $file))
}

& docker @arguments config --quiet
if ($LASTEXITCODE -ne 0) { throw "Compose configuration validation failed" }

$configuration = (& docker @arguments config --format json | ConvertFrom-Json)
if ($LASTEXITCODE -ne 0) { throw "Compose configuration rendering failed" }
$configuration.services.PSObject.Properties | Sort-Object Name | ForEach-Object {
  $service = $_.Value
  $ports = @($service.ports | ForEach-Object {
    "$($_.host_ip):$($_.published)->$($_.target)"
  }) -join ","
  [pscustomobject]@{
    Service = $_.Name
    Image = $service.image
    Ports = $ports
  }
} | Format-Table -AutoSize
