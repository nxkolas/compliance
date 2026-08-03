param(
  [switch]$Admin,
  [switch]$Docling,
  [switch]$Observability,
  [switch]$ConstrainedMemory,
  [switch]$SkipStaticGate
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$projectName = "compliancetool-test"
$environmentFile = Join-Path $repositoryRoot ".env.docker.test"
$versionsFile = Join-Path $repositoryRoot "infra/versions.env"
$baseCompose = Join-Path $repositoryRoot "infra/compose/local/compose.yml"
$startedAt = Get-Date
$revision = (& git -C $repositoryRoot rev-parse HEAD).Trim()
$evidenceName = "docker-deployment-$((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH-mm-ssZ')).md"
$evidencePath = Join-Path $repositoryRoot "docs/qa/$evidenceName"
$results = New-Object System.Collections.Generic.List[object]

function Record-Result {
  param([string]$Name, [string]$Status, [string]$Detail)
  $results.Add([pscustomobject]@{
    Name = $Name
    Status = $Status
    Detail = $Detail
  })
}

function Invoke-Gate {
  param([string]$Name, [scriptblock]$Command)
  $watch = [Diagnostics.Stopwatch]::StartNew()
  try {
    & $Command
    if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
      throw "$Name exited with code $LASTEXITCODE"
    }
    $watch.Stop()
    Record-Result $Name "passed" "$([math]::Round($watch.Elapsed.TotalSeconds, 1))s"
  } catch {
    $watch.Stop()
    Record-Result $Name "failed" "$([math]::Round($watch.Elapsed.TotalSeconds, 1))s"
    Write-Evidence
    throw
  }
}

function Get-EnvironmentValue {
  param([string]$Name)
  $prefix = "$Name="
  $line = Get-Content -LiteralPath $environmentFile |
    Where-Object { $_.StartsWith($prefix, [StringComparison]::Ordinal) } |
    Select-Object -First 1
  if (-not $line) {
    throw "Required environment variable is missing: $Name"
  }
  return $line.Substring($prefix.Length)
}

function Get-VersionValue {
  param([string]$Name)
  $prefix = "$Name="
  $line = Get-Content -LiteralPath $versionsFile |
    Where-Object { $_.StartsWith($prefix, [StringComparison]::Ordinal) } |
    Select-Object -First 1
  if (-not $line) {
    throw "Required version variable is missing: $Name"
  }
  return $line.Substring($prefix.Length)
}

function Get-ComposeArguments {
  $arguments = @(
    "compose",
    "--project-name", $projectName,
    "--env-file", $versionsFile,
    "--env-file", $environmentFile,
    "-f", $baseCompose
  )
  if ($Admin) {
    $arguments += @("-f", (Join-Path $repositoryRoot "infra/compose/local/compose.studio.yml"))
  }
  if ($Docling) {
    $arguments += @("-f", (Join-Path $repositoryRoot "infra/compose/local/compose.docling.yml"))
  }
  if ($Observability) {
    $arguments += @("-f", (Join-Path $repositoryRoot "infra/compose/local/compose.observability.yml"))
  }
  if ($ConstrainedMemory) {
    $arguments += @("-f", (Join-Path $repositoryRoot "infra/compose/local/compose.constrained-memory.yml"))
  }
  return $arguments
}

function Write-Evidence {
  $finishedAt = Get-Date
  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add("# Docker deployment acceptance evidence")
  $lines.Add("")
  $lines.Add("- Git revision: ``$revision``")
  $lines.Add("- Compose project: ``$projectName``")
  $lines.Add("- Started (UTC): ``$($startedAt.ToUniversalTime().ToString('o'))``")
  $lines.Add("- Updated (UTC): ``$($finishedAt.ToUniversalTime().ToString('o'))``")
  $lines.Add("- Duration: $([math]::Round(($finishedAt - $startedAt).TotalMinutes, 1)) minutes")
  $lines.Add("- Optional profiles: admin=$Admin, docling=$Docling, observability=$Observability")
  $lines.Add("- Constrained-memory mode: $ConstrainedMemory")
  $lines.Add("")
  $lines.Add("## Gate results")
  $lines.Add("")
  $lines.Add("| Gate | Status | Duration/detail |")
  $lines.Add("| --- | --- | --- |")
  foreach ($result in $results) {
    $safeDetail = $result.Detail.Replace("|", "\|")
    $lines.Add("| $($result.Name) | $($result.Status) | $safeDetail |")
  }
  $lines.Add("")
  $lines.Add("This report intentionally omits secrets, cookies, signed URLs, prompts, document contents, and personal data.")
  $lines | Set-Content -LiteralPath $evidencePath -Encoding UTF8
}

try {
  if ($projectName -ne "compliancetool-test") {
    throw "The acceptance project must be exactly compliancetool-test."
  }
  $dockerOs = & docker info --format "{{.OSType}}"
  if ($LASTEXITCODE -ne 0 -or $dockerOs -ne "linux") {
    throw "Docker Desktop must be running Linux containers."
  }
  $memoryBytes = [int64](& docker info --format "{{.MemTotal}}")
  $minimumMemory = if ($ConstrainedMemory) { 15GB } else { 24GB }
  if ($memoryBytes -lt $minimumMemory) {
    $modeName = if ($ConstrainedMemory) { "constrained-memory acceptance" } else { "standard acceptance" }
    throw "Docker has $([math]::Round($memoryBytes / 1GB, 1)) GB; $modeName requires at least $([math]::Round($minimumMemory / 1GB)) GB."
  }
  $freeBytes = (Get-PSDrive -Name ([IO.Path]::GetPathRoot($repositoryRoot).TrimEnd('\').TrimEnd(':'))).Free
  $minimumFreeDisk = if ($ConstrainedMemory) { 30GB } else { 40GB }
  if ($freeBytes -lt $minimumFreeDisk) {
    throw "Acceptance requires at least $([math]::Round($minimumFreeDisk / 1GB)) GB of free disk."
  }
  Record-Result "preflight" "passed" "Linux containers; $([math]::Round($memoryBytes / 1GB, 1)) GB Docker memory; constrained=$ConstrainedMemory; disk gate passed"

  if (-not (Test-Path -LiteralPath $environmentFile)) {
    & node (Join-Path $PSScriptRoot "generate-local-env.mjs") $environmentFile $projectName
    if ($LASTEXITCODE -ne 0) { throw "Could not generate the isolated environment." }
  }

  $existingVolumes = @(& docker volume ls --quiet --filter "label=com.docker.compose.project=$projectName")
  if ($existingVolumes.Count -gt 0) {
    throw "The isolated project already has volumes. Explicitly remove only that project before a fresh acceptance run."
  }
  $existingContainers = @(& docker ps --all --quiet --filter "label=com.docker.compose.project=$projectName")
  $existingNetworks = @(& docker network ls --quiet --filter "label=com.docker.compose.project=$projectName")
  if ($existingContainers.Count -gt 0 -or $existingNetworks.Count -gt 0) {
    throw "The isolated project already has containers or networks; refusing to reuse it."
  }

  if (-not $SkipStaticGate) {
    Invoke-Gate "npm ci" { & npm ci }
    Invoke-Gate "npm run verify" { & npm run verify }
    Invoke-Gate "npm run test:worker" { & npm run test:worker }
    Invoke-Gate "npm run test:routes" { & npm run test:routes }
    Invoke-Gate "npm run test:ai" { & npm run test:ai }
    Invoke-Gate "npm run build" { & npm run build }
  }

  Invoke-Gate "web image build 1" {
    & docker build --provenance=false --platform linux/amd64 --target web --build-arg "VCS_REF=$revision" -t "compliancetool-web:acceptance-1" $repositoryRoot
  }
  Invoke-Gate "worker image build 1" {
    & docker build --provenance=false --platform linux/amd64 --target worker --build-arg "VCS_REF=$revision" -t "compliancetool-worker:acceptance-1" $repositoryRoot
  }
  Invoke-Gate "web image build 2" {
    & docker build --provenance=false --platform linux/amd64 --target web --build-arg "VCS_REF=$revision" -t "compliancetool-web:acceptance-2" $repositoryRoot
  }
  Invoke-Gate "worker image build 2" {
    & docker build --provenance=false --platform linux/amd64 --target worker --build-arg "VCS_REF=$revision" -t "compliancetool-worker:acceptance-2" $repositoryRoot
  }
  Invoke-Gate "hardened Storage image build" {
    & docker build --provenance=false --platform linux/amd64 --target storage -t "compliancetool/storage:local" $repositoryRoot
  }
  Invoke-Gate "WAL-G-enabled database image build" {
    & docker build --provenance=false --platform linux/amd64 --target database -t "compliancetool/database:local" $repositoryRoot
  }
  Invoke-Gate "hardened Studio image build" {
    & docker build --provenance=false --platform linux/amd64 --target studio -t "compliancetool/studio:local" $repositoryRoot
  }
  Invoke-Gate "hardened postgres-meta image build" {
    & docker build --provenance=false --platform linux/amd64 --target postgres-meta -t "compliancetool/postgres-meta:local" $repositoryRoot
  }
  foreach ($target in @("web", "worker")) {
    $first = (& docker image inspect "compliancetool-${target}:acceptance-1" --format "{{.Id}}").Trim()
    $second = (& docker image inspect "compliancetool-${target}:acceptance-2" --format "{{.Id}}").Trim()
    if ($first -ne $second) { throw "$target image builds are not reproducible." }
    Record-Result "$target image reproducibility" "passed" $first
  }
  & docker tag "compliancetool-web:acceptance-1" (Get-EnvironmentValue "COMPLIANCETOOL_WEB_IMAGE")
  if ($LASTEXITCODE -ne 0) { throw "Could not tag the accepted web image." }
  & docker tag "compliancetool-worker:acceptance-1" (Get-EnvironmentValue "COMPLIANCETOOL_WORKER_IMAGE")
  if ($LASTEXITCODE -ne 0) { throw "Could not tag the accepted worker image." }
  $trivyImage = Get-VersionValue "TRIVY_IMAGE"
  foreach ($image in @(
      "compliancetool-web:acceptance-1",
      "compliancetool-worker:acceptance-1",
      "compliancetool/database:local",
      "compliancetool/studio:local",
      "compliancetool/postgres-meta:local",
      "compliancetool/storage:local"
    )) {
    Invoke-Gate "critical scan ($image)" {
      & docker run --rm -v /var/run/docker.sock:/var/run/docker.sock $trivyImage `
        image --quiet --scanners vuln --severity CRITICAL --ignore-unfixed `
        --exit-code 1 $image
    }
    Invoke-Gate "SBOM generation ($image)" {
      & docker run --rm -v /var/run/docker.sock:/var/run/docker.sock $trivyImage `
        image --quiet --format spdx-json --output /dev/null $image
    }
  }

  $combinations = @(
    @(),
    @("infra/compose/local/compose.infra.yml"),
    @("infra/compose/local/compose.studio.yml"),
    @("infra/compose/local/compose.docling.yml"),
    @("infra/compose/local/compose.observability.yml"),
    @("infra/compose/local/compose.constrained-memory.yml"),
    @(
      "infra/compose/local/compose.docling.yml",
      "infra/compose/local/compose.constrained-memory.yml"
    ),
    @(
      "infra/compose/local/compose.studio.yml",
      "infra/compose/local/compose.docling.yml",
      "infra/compose/local/compose.observability.yml"
    )
  )
  foreach ($combination in $combinations) {
    $configArguments = @(
      "compose", "--project-name", $projectName,
      "--env-file", $versionsFile, "--env-file", $environmentFile,
      "-f", $baseCompose
    )
    foreach ($relativeFile in $combination) {
      $configArguments += @("-f", (Join-Path $repositoryRoot $relativeFile))
    }
    Invoke-Gate "Compose config ($($combination -join ', '))" {
      & docker @configArguments --profile admin --profile docling --profile observability config --quiet
    }
  }
  Invoke-Gate "local Compose Caddy security policy" {
    & (Join-Path $PSScriptRoot "validate-local-compose-security.ps1") `
      -EnvironmentFile ".env.docker.test" `
      -ProjectName $projectName `
      -ConstrainedMemory:$ConstrainedMemory
  }

  Invoke-Gate "isolated stack bootstrap" {
    $bootstrapDocling = $Docling -and -not $ConstrainedMemory
    & (Join-Path $PSScriptRoot "local-up.ps1") -Mode test -Admin:$Admin -Docling:$bootstrapDocling -Observability:$Observability -ConstrainedMemory:$ConstrainedMemory -UsePrebuiltImages
  }
  $composeArguments = Get-ComposeArguments

  Invoke-Gate "web liveness" {
    $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 15 -Uri "http://127.0.0.1:3000/api/health/live"
    if ($response.StatusCode -ne 200) { throw "Web liveness failed." }
  }
  Invoke-Gate "web readiness" {
    $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 15 -Uri "http://127.0.0.1:3000/api/health/ready"
    if ($response.StatusCode -ne 200) { throw "Web readiness failed." }
  }
  Invoke-Gate "Supabase Auth through Caddy" {
    $response = Invoke-WebRequest `
      -UseBasicParsing `
      -TimeoutSec 15 `
      -Headers @{ apikey = Get-EnvironmentValue "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" } `
      -Uri "http://127.0.0.1:8000/auth/v1/health"
    if ($response.StatusCode -ne 200) { throw "Supabase Auth health failed." }
  }
  Invoke-Gate "database migration history" {
    & docker @composeArguments exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "select count(*) from app_private.deployment_sql_history;" -c "select extversion from pg_extension where extname='vector';"
  }
  Invoke-Gate "Storage bootstrap idempotence" {
    & docker @composeArguments run --rm database-bootstrap
  }
  Invoke-Gate "functional Auth/Storage/AI/retrieval acceptance" {
    & docker @composeArguments exec -T worker node node_modules/tsx/dist/cli.mjs scripts/docker-functional-acceptance.ts
  }
  if ($Docling) {
    Invoke-Gate "Docling controlled PDF extraction" {
      if ($ConstrainedMemory) {
        & docker @composeArguments stop --timeout 30 litellm ollama
        if ($LASTEXITCODE -ne 0) { throw "Could not suspend local AI for the Docling phase." }
      }
      try {
        if ($ConstrainedMemory) {
          & docker @composeArguments up -d --wait docling
          if ($LASTEXITCODE -ne 0) { throw "Could not start the constrained Docling phase." }
        }
        & docker @composeArguments exec -T `
          -e DOCLING_SERVICE_URL=http://docling:5001 `
          worker node node_modules/tsx/dist/cli.mjs scripts/docling-live-qualification.ts
        if ($LASTEXITCODE -ne 0) { throw "Docling extraction failed." }
      } finally {
        if ($ConstrainedMemory) {
          & docker @composeArguments stop --timeout 30 docling
          if ($LASTEXITCODE -ne 0) { throw "Could not stop the constrained Docling phase." }
          & docker @composeArguments up -d --wait ollama litellm
          if ($LASTEXITCODE -ne 0) { throw "Could not restore local AI after the Docling phase." }
        }
      }
    }
  }

  Invoke-Gate "web restart persistence" {
    & docker @composeArguments restart web
    & docker @composeArguments up -d --wait web
    $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 15 -Uri "http://127.0.0.1:3000/api/health/ready"
    if ($response.StatusCode -ne 200) { throw "Web readiness failed after restart." }
  }
  Invoke-Gate "worker restart readiness" {
    & docker @composeArguments restart worker
    & docker @composeArguments up -d --wait worker
  }
  Invoke-Gate "expired worker lease retry and idempotent completion" {
    & docker @composeArguments stop --timeout 30 worker
    if ($LASTEXITCODE -ne 0) { throw "Could not stop the worker." }
    $leaseFixtureSql = @"
with candidate as (
  select id from background_jobs
  where kind = 'cleanup' and state = 'queued'
  order by created_at
  limit 1
)
update background_jobs
set state = 'running',
    attempt_count = greatest(attempt_count, 1),
    lease_owner = 'acceptance-dead-worker',
    lease_expires_at = now() - interval '1 second',
    heartbeat_at = now() - interval '61 seconds',
    started_at = coalesce(started_at, now() - interval '61 seconds'),
    run_after = now(),
    updated_at = now()
where id = (select id from candidate)
returning id;
"@
    $jobId = @(
      & docker @composeArguments exec -T db psql -U postgres -d postgres `
        -v ON_ERROR_STOP=1 -Atc $leaseFixtureSql |
        Where-Object { $_ -match '^[0-9a-f-]{36}$' }
    ) | Select-Object -First 1
    if ($LASTEXITCODE -ne 0 -or -not $jobId) {
      throw "Could not create the expired lease fixture."
    }
    & docker @composeArguments up -d --wait worker
    if ($LASTEXITCODE -ne 0) { throw "Could not restart the worker." }
    $recovered = $false
    for ($attempt = 0; $attempt -lt 90; $attempt += 1) {
      $jobState = (
        & docker @composeArguments exec -T db psql -U postgres -d postgres `
          -Atc "select state || '|' || attempt_count from background_jobs where id = '$jobId'::uuid"
      ).Trim()
      if ($jobState -match '^succeeded\|([2-9]|[1-9][0-9]+)$') {
        $recovered = $true
        break
      }
      Start-Sleep -Seconds 1
    }
    if (-not $recovered) {
      throw "The expired worker lease was not retried to idempotent completion."
    }
  }
  Invoke-Gate "bounded AI dependency outage" {
    & docker @composeArguments stop --timeout 30 ollama
    if ($LASTEXITCODE -ne 0) { throw "Could not stop Ollama." }
    try {
      $outageProbe = @'
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 125000);
try {
  const response = await fetch(`${process.env.SELF_HOSTED_AI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.SELF_HOSTED_AI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.SELF_HOSTED_AI_MODEL,
      messages: [{ role: "user", content: "dependency outage probe" }],
      max_tokens: 1,
    }),
    signal: controller.signal,
  });
  if (response.ok) process.exit(2);
} catch (error) {
  // A provider error or the outer deadline are both safe bounded outcomes.
} finally {
  clearTimeout(timer);
}
'@
      & docker @composeArguments exec -T worker node --input-type=module -e $outageProbe
      if ($LASTEXITCODE -ne 0) {
        throw "The AI dependency outage was not safely bounded."
      }
    } finally {
      & docker @composeArguments up -d --wait ollama
      if ($LASTEXITCODE -ne 0) { throw "Could not restore Ollama." }
    }
  }
  Invoke-Gate "Storage restart persistence" {
    & docker @composeArguments restart storage
    & docker @composeArguments up -d --wait storage
    & docker @composeArguments run --rm database-bootstrap
  }
  Invoke-Gate "whole-project restart persistence" {
    & docker @composeArguments stop
    & docker @composeArguments up -d --wait
  }

  $published = (& docker @composeArguments config --format json | ConvertFrom-Json).services.PSObject.Properties |
    ForEach-Object { $_.Value.ports } |
    Where-Object { $_ }
  foreach ($port in $published) {
    if ($port.host_ip -ne "127.0.0.1") {
      throw "A local port is not loopback-bound: $($port.published)"
    }
  }
  Record-Result "private port exposure" "passed" "All published local ports are loopback-bound"
  Write-Evidence
  Write-Output "Acceptance passed. Evidence: $evidencePath"
} catch {
  Record-Result "acceptance" "failed" $_.Exception.Message
  Write-Evidence
  throw
}
