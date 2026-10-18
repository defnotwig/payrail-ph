$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$dataDirectory = Join-Path $repoRoot ".local\postgres\data"
if (-not (Test-Path (Join-Path $dataDirectory "PG_VERSION"))) {
  Write-Output "No isolated PayRail PostgreSQL cluster exists."
  exit 0
}

$pgCtl = (Get-Command pg_ctl.exe -ErrorAction Stop).Source
& $pgCtl -D $dataDirectory status *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Output "The isolated PayRail PostgreSQL cluster is already stopped."
  exit 0
}

& $pgCtl -D $dataDirectory -m fast -w stop
if ($LASTEXITCODE -ne 0) {
  throw "Could not stop the isolated PayRail PostgreSQL cluster."
}

Write-Output "Isolated PayRail PostgreSQL stopped."
