param([switch]$NoBrowser, [int]$Port = 3327)
$ErrorActionPreference = 'Stop'
$policyProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$policyUrl = "http://127.0.0.1:$Port"
function Get-PolicyState {
    try { return Invoke-RestMethod -Uri "$policyUrl/health" -TimeoutSec 2 }
    catch { return $null }
}
$policyState = Get-PolicyState
if ($policyState -and ($policyState.app -ne 'AgriMatch Policy' -or $policyState.version -ne '2.7.0-policy.9')) {
    throw "Port $Port is in use by another application. Choose another port using -Port."
}
if (-not $policyState) {
    $policyNodeCandidates = @()
    $policyNodeCommand = Get-Command node -CommandType Application -ErrorAction SilentlyContinue
    if ($policyNodeCommand) { $policyNodeCandidates += $policyNodeCommand.Source }
    $policyNodePath = $policyNodeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not $policyNodePath) { throw 'Node.js 22.13 or newer is required.' }
    $policyLogDir = Join-Path $policyProjectDir '.work'
    New-Item -ItemType Directory -Path $policyLogDir -Force | Out-Null
    $env:PORT = [string]$Port
    $policyServerPath = Join-Path $policyProjectDir 'server.mjs'
    $policyServerArgs = @('--env-file-if-exists=.env', ('"' + $policyServerPath + '"'))
    $policyProcess = Start-Process -FilePath $policyNodePath -ArgumentList $policyServerArgs -WorkingDirectory $policyProjectDir -WindowStyle Hidden -RedirectStandardOutput (Join-Path $policyLogDir 'server-out.log') -RedirectStandardError (Join-Path $policyLogDir 'server-error.log') -PassThru
    for ($policyAttempt = 0; $policyAttempt -lt 30; $policyAttempt++) {
        Start-Sleep -Milliseconds 300
        $policyState = Get-PolicyState
        if ($policyState -and $policyState.app -eq 'AgriMatch Policy') { break }
        if ($policyProcess.HasExited) { throw 'The server exited. See .work/server-error.log.' }
    }
}
if (-not $policyState -or $policyState.app -ne 'AgriMatch Policy') { throw 'The local policy server did not become ready.' }
if (-not $NoBrowser) { Start-Process $policyUrl }
Write-Output $policyUrl
