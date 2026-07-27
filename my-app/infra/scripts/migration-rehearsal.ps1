param(
  [string]$EnvironmentFile = ".env.docker.test"
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$environmentPath = (Resolve-Path (Join-Path $repositoryRoot $EnvironmentFile)).Path
$versionsPath = Join-Path $repositoryRoot "infra/versions.env"
$composePath = Join-Path $repositoryRoot "infra/compose/local/compose.yml"

function Get-StringHash {
  param([string]$Value)
  $algorithm = [Security.Cryptography.SHA256]::Create()
  try {
    $bytes = $algorithm.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value))
  } finally {
    $algorithm.Dispose()
  }
  return ([BitConverter]::ToString($bytes)).Replace("-", "").ToLowerInvariant()
}

function Invoke-Rehearsal {
  param([ValidateSet("a", "b")][string]$Suffix)
  $project = "compliancetool-migration-rehearsal-$Suffix"
  $arguments = @(
    "compose",
    "--project-name", $project,
    "--env-file", $versionsPath,
    "--env-file", $environmentPath,
    "-f", $composePath
  )
  $existing = @(& docker volume ls --quiet --filter "label=com.docker.compose.project=$project")
  if ($existing.Count -gt 0) {
    throw "$project is not empty; refusing to reuse its volumes."
  }

  try {
    & docker @arguments up --build -d --wait storage | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "$project prerequisites failed." }
    & docker @arguments run --rm migrate | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "$project migration failed." }
    & docker @arguments run --rm migrate | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "$project idempotence check failed." }

    $history = @(
      & docker @arguments exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc (
        "select kind || '|' || filename || '|' || checksum_sha256 " +
        "from app_private.deployment_sql_history order by kind, filename"
      )
    )
    if ($LASTEXITCODE -ne 0) { throw "$project history query failed." }

    $schema = @(
      & docker @arguments exec -T db pg_dump -U postgres -d postgres `
        --schema-only --no-owner --no-privileges
    )
    if ($LASTEXITCODE -ne 0) { throw "$project schema dump failed." }
    $normalizedSchema = (
      $schema |
        Where-Object {
          $_ -notmatch "^\\(un)?restrict " -and
          $_ -notmatch "^-- Dumped"
        }
    ) -join "`n"

    return [pscustomobject]@{
      Project = $project
      HistoryCount = $history.Count
      HistoryHash = Get-StringHash ($history -join "`n")
      SchemaHash = Get-StringHash $normalizedSchema
    }
  } finally {
    $resources = @(
      & docker volume ls --quiet --filter "label=com.docker.compose.project=$project"
    )
    foreach ($resource in $resources) {
      if (-not $resource.StartsWith("${project}_")) {
        throw "Resolved volume escaped the rehearsal prefix: $resource"
      }
    }
    & docker @arguments down --remove-orphans --volumes | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "Could not clean $project." }
  }
}

$first = Invoke-Rehearsal -Suffix a
$second = Invoke-Rehearsal -Suffix b
if (
  $first.HistoryCount -ne $second.HistoryCount -or
  $first.HistoryHash -ne $second.HistoryHash -or
  $first.SchemaHash -ne $second.SchemaHash
) {
  throw "Independent migration rehearsals produced different schemas or histories."
}

Write-Output (
  "Migration rehearsal passed twice: history={0}, historySha256={1}, schemaSha256={2}" -f
  $first.HistoryCount,
  $first.HistoryHash,
  $first.SchemaHash
)
