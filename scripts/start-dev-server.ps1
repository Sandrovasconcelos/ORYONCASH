param(
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

$workspacePath = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$logOut = Join-Path $workspacePath ".codex-dev-out.log"
$logErr = Join-Path $workspacePath ".codex-dev-err.log"

$nextProcesses = Get-CimInstance Win32_Process -Filter "name = 'node.exe'" |
  Where-Object {
    $_.CommandLine -like "*node_modules\next\dist\bin\next*" -and
    $_.CommandLine -like "*$workspacePath*"
  }

foreach ($process in $nextProcesses) {
  Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
}

Remove-Item -LiteralPath $logOut, $logErr -Force -ErrorAction SilentlyContinue

$processPath = [Environment]::GetEnvironmentVariable("Path", "Process")
[Environment]::SetEnvironmentVariable("PATH", $null, "Process")
[Environment]::SetEnvironmentVariable("Path", $processPath, "Process")

$nodePath = "C:\Program Files\nodejs\node.exe"
$nextPath = Join-Path $workspacePath "node_modules\next\dist\bin\next"

Start-Process `
  -FilePath $nodePath `
  -ArgumentList @("`"$nextPath`"", "dev", "--port", $Port) `
  -WorkingDirectory $workspacePath `
  -WindowStyle Hidden `
  -RedirectStandardOutput $logOut `
  -RedirectStandardError $logErr

Start-Sleep -Seconds 4

try {
  $response = Invoke-WebRequest -Uri "http://localhost:$Port/login" -UseBasicParsing -MaximumRedirection 0
  [pscustomobject]@{
    Status = "ready"
    Port = $Port
    HttpStatus = $response.StatusCode
    Url = "http://localhost:$Port"
  }
} catch {
  [pscustomobject]@{
    Status = "failed"
    Port = $Port
    Error = $_.Exception.Message
    Stdout = if (Test-Path -LiteralPath $logOut) { Get-Content -LiteralPath $logOut -Raw } else { "" }
    Stderr = if (Test-Path -LiteralPath $logErr) { Get-Content -LiteralPath $logErr -Raw } else { "" }
  }
}
