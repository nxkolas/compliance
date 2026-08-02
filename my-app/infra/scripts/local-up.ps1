param(
  [ValidateSet("full", "infra", "test")]
  [string]$Mode = "full",
  [switch]$Admin,
  [switch]$Docling,
  [switch]$Observability,
  [switch]$ConstrainedMemory,
  [switch]$UsePrebuiltImages
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$environmentName = if ($Mode -eq "test") { "test" } else { "local" }
$projectName = if ($Mode -eq "test") { "compliancetool-test" } else { "compliancetool-local" }
$environmentFile = Join-Path $repositoryRoot ".env.docker.$environmentName"
if (-not (Test-Path -LiteralPath $environmentFile)) {
  throw "Run local-bootstrap.ps1 first; generated environment file is missing."
}
if ($Mode -eq "test" -and $projectName -ne "compliancetool-test") {
  throw "The isolated test project name must be exactly compliancetool-test."
}

$dockerOs = & docker info --format "{{.OSType}}"
if ($LASTEXITCODE -ne 0 -or $dockerOs -ne "linux") {
  throw "Docker Desktop must be running Linux containers."
}
$memoryBytes = [int64](& docker info --format "{{.MemTotal}}")
$minimumMemory = if ($ConstrainedMemory) { 15GB } else { 24GB }
if ($memoryBytes -lt $minimumMemory) {
  $modeName = if ($ConstrainedMemory) { "constrained-memory" } else { "standard" }
  throw "Docker has $([math]::Round($memoryBytes / 1GB, 1)) GB; $modeName mode requires at least $([math]::Round($minimumMemory / 1GB)) GB."
}
$freeBytes = (Get-PSDrive -Name ([IO.Path]::GetPathRoot($repositoryRoot).TrimEnd('\').TrimEnd(':'))).Free
$minimumFreeDisk = if ($ConstrainedMemory) { 30GB } else { 40GB }
if ($freeBytes -lt $minimumFreeDisk) {
  throw "At least $([math]::Round($minimumFreeDisk / 1GB)) GB of free disk is required for images and model volumes."
}

$arguments = @(
  "compose",
  "--project-name", $projectName,
  "--env-file", (Join-Path $repositoryRoot "infra/versions.env"),
  "--env-file", $environmentFile,
  "-f", (Join-Path $repositoryRoot "infra/compose/local/compose.yml")
)
$profiles = @()
if ($Mode -eq "infra") {
  $arguments += @("-f", (Join-Path $repositoryRoot "infra/compose/local/compose.infra.yml"))
}
if ($Admin) {
  $arguments += @("-f", (Join-Path $repositoryRoot "infra/compose/local/compose.studio.yml"))
  $profiles += @("--profile", "admin")
}
if ($Docling) {
  $arguments += @("-f", (Join-Path $repositoryRoot "infra/compose/local/compose.docling.yml"))
  $profiles += @("--profile", "docling")
}
if ($Observability) {
  $arguments += @("-f", (Join-Path $repositoryRoot "infra/compose/local/compose.observability.yml"))
  $profiles += @("--profile", "observability")
}
if ($ConstrainedMemory) {
  $arguments += @("-f", (Join-Path $repositoryRoot "infra/compose/local/compose.constrained-memory.yml"))
}

& docker @arguments @profiles config --quiet
if ($LASTEXITCODE -ne 0) { throw "Compose validation failed" }
$rendered = (& docker @arguments @profiles config --format json) | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "Could not inspect rendered Compose configuration" }
foreach ($collection in @($rendered.volumes, $rendered.networks)) {
  foreach ($resource in $collection.PSObject.Properties) {
    if (-not $resource.Value.name.StartsWith("${projectName}_")) {
      throw "Rendered resource escaped the project prefix: $($resource.Value.name)"
    }
  }
}

$existingContainers = @(
  & docker ps --all --quiet --filter "label=com.docker.compose.project=$projectName"
)
if ($existingContainers.Count -eq 0) {
  $requiredPorts = if ($Mode -eq "infra") {
    @(54322, 8000, 8025)
  } else {
    @(3000, 8000, 8025)
  }
  if ($Admin) { $requiredPorts += 54323 }
  if ($Observability) { $requiredPorts += 3001 }
  foreach ($port in $requiredPorts | Sort-Object -Unique) {
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $port)
    try {
      $listener.Start()
    } catch {
      throw "Required loopback port is already in use: $port"
    } finally {
      $listener.Stop()
    }
  }
}

Write-Output "Deployment target: project=$projectName mode=$Mode constrainedMemory=$ConstrainedMemory"
foreach ($service in $rendered.services.PSObject.Properties | Sort-Object Name) {
  $publishedPorts = @($service.Value.ports | ForEach-Object {
    "$($_.host_ip):$($_.published)"
  }) -join ","
  Write-Output "service=$($service.Name) image=$($service.Value.image) ports=$publishedPorts"
}

if ($Mode -eq "test") {
  $existing = @(& docker volume ls --quiet --filter "label=com.docker.compose.project=$projectName")
  if ($existing.Count -gt 0) {
    throw "The isolated test project already has volumes. Use local-down.ps1 -Mode test -RemoveVolumes before a fresh run."
  }
}

if ($Mode -eq "infra") {
  $services = @(
    "db", "rustfs", "rustfs-init", "mailpit", "auth", "rest", "storage",
    "kong", "ollama", "ollama-model-init", "litellm", "database-bootstrap",
    "supabase-bootstrap"
  )
  $buildOption = if ($UsePrebuiltImages) { "--no-build" } else { "--build" }
  & docker @arguments @profiles up $buildOption --detach --wait @services
} else {
  $buildOption = if ($UsePrebuiltImages) { "--no-build" } else { "--build" }
  & docker @arguments @profiles up $buildOption --detach --wait
}
if ($LASTEXITCODE -ne 0) { throw "Compose startup failed" }

$resolvedResources = @(
  & docker volume ls --format "{{.Name}}" --filter "label=com.docker.compose.project=$projectName"
  & docker network ls --format "{{.Name}}" --filter "label=com.docker.compose.project=$projectName"
)
foreach ($resource in $resolvedResources) {
  if ($resource -and -not $resource.StartsWith("${projectName}_")) {
    throw "Resolved resource escaped the project prefix: $resource"
  }
}

Write-Output "Deployment is healthy: project=$projectName mode=$Mode"
