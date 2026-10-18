$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$clusterRoot = Join-Path $repoRoot ".local\postgres"
$dataDirectory = Join-Path $clusterRoot "data"
$logFile = Join-Path $clusterRoot "postgres.log"
$initdb = (Get-Command initdb.exe -ErrorAction Stop).Source
$pgCtl = (Get-Command pg_ctl.exe -ErrorAction Stop).Source
$pgIsReady = (Get-Command pg_isready.exe -ErrorAction Stop).Source
$psql = (Get-Command psql.exe -ErrorAction Stop).Source
$hostAddress = "127.0.0.1"
$port = 55432

New-Item -ItemType Directory -Force -Path $clusterRoot | Out-Null

if (-not (Test-Path (Join-Path $dataDirectory "PG_VERSION"))) {
  & $initdb -D $dataDirectory -U payrail --auth-local=trust --auth-host=trust --encoding=UTF8 --no-locale
  if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL initdb failed with exit code $LASTEXITCODE."
  }

  Add-Content -LiteralPath (Join-Path $dataDirectory "postgresql.conf") -Value "`n# PayRail isolated local development cluster`nlisten_addresses = '127.0.0.1'`nport = $port`nmax_connections = 30"
}

& $pgCtl -D $dataDirectory status *> $null
if ($LASTEXITCODE -ne 0) {
  & $pgCtl -D $dataDirectory -l $logFile -w start
  if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL failed to start. See $logFile for local diagnostics."
  }
}

$deadline = [DateTimeOffset]::UtcNow.AddSeconds(15)
do {
  & $pgIsReady -h $hostAddress -p $port -U payrail *> $null
  if ($LASTEXITCODE -eq 0) {
    break
  }
  Start-Sleep -Milliseconds 250
} while ([DateTimeOffset]::UtcNow -lt $deadline)

if ($LASTEXITCODE -ne 0) {
  throw "The isolated PostgreSQL cluster did not become ready on $hostAddress`:$port."
}

$databaseExists = & $psql -h $hostAddress -p $port -U payrail -d postgres -Atqc "SELECT 1 FROM pg_database WHERE datname = 'payrail_local'"
if ($LASTEXITCODE -ne 0) {
  throw "Could not inspect the isolated PostgreSQL cluster."
}

if ([string]$databaseExists -ne "1") {
  & $psql -h $hostAddress -p $port -U payrail -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE payrail_local"
  if ($LASTEXITCODE -ne 0) {
    throw "Could not create the local PayRail database."
  }
}

Write-Output "Isolated PostgreSQL is ready at postgresql://payrail@${hostAddress}:$port/payrail_local"
