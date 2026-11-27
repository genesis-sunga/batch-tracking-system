param(
  [string]$BackupDirectory = $env:DB_BACKUP_DIR
)

$ErrorActionPreference = 'Stop'

$requiredVariables = @('DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE')
foreach ($name in $requiredVariables) {
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
    throw "$name must be set before running a database backup"
  }
}
if ([string]::IsNullOrWhiteSpace($BackupDirectory)) {
  throw 'DB_BACKUP_DIR must point to a protected backup directory'
}

$dumpCommand = Get-Command mysqldump.exe -ErrorAction Stop
[void][System.IO.Directory]::CreateDirectory($BackupDirectory)
$timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfffZ')
$outputPath = Join-Path $BackupDirectory "batch_tracking_$timestamp.sql"
$previousMysqlPassword = $env:MYSQL_PWD
$env:MYSQL_PWD = $env:DB_PASSWORD

try {
  & $dumpCommand.Source `
    "--host=$env:DB_HOST" `
    "--port=$env:DB_PORT" `
    "--user=$env:DB_USERNAME" `
    '--single-transaction' `
    '--routines' `
    '--triggers' `
    "--result-file=$outputPath" `
    '--databases' `
    $env:DB_DATABASE

  if ($LASTEXITCODE -ne 0 -or !(Test-Path -LiteralPath $outputPath) -or (Get-Item -LiteralPath $outputPath).Length -eq 0) {
    if (Test-Path -LiteralPath $outputPath) {
      Remove-Item -LiteralPath $outputPath
    }
    throw "mysqldump failed or produced an empty backup (exit code $LASTEXITCODE)"
  }
} finally {
  if ($null -eq $previousMysqlPassword) {
    Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
  } else {
    $env:MYSQL_PWD = $previousMysqlPassword
  }
}
