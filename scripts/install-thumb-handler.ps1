<#
.SYNOPSIS
  Install / uninstall the RePic Explorer thumbnail handler (shell/repic-thumbs).

.DESCRIPTION
  Copies the built repic_thumbs.dll to a stable per-user location
  (%LOCALAPPDATA%\RePic\shell) and registers it with regsvr32 so Windows
  Explorer shows the real image for .repic files that carry an embedded thumb.
  Registration is per-user (HKCU) and needs no elevation.

.PARAMETER Build
  Build the DLL in release mode first (requires Rust/cargo).

.PARAMETER Uninstall
  Unregister the handler and remove the installed DLL.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\install-thumb-handler.ps1 -Build
  powershell -ExecutionPolicy Bypass -File scripts\install-thumb-handler.ps1 -Uninstall
#>
param(
    [switch]$Build,
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$crateDir = Join-Path $repoRoot 'shell\repic-thumbs'
$builtDll = Join-Path $crateDir 'target\release\repic_thumbs.dll'
$installDir = Join-Path $env:LOCALAPPDATA 'RePic\shell'
$installedDll = Join-Path $installDir 'repic_thumbs.dll'

# The .repic extension maps to this ProgID (set by electron-builder fileAssociations).
# Explorer resolves ProgID\ShellEx before extension\ShellEx, so register both.
$progId = 'Repic Virtual Image'
$thumbClsid = '{7E3D9A1C-2B4F-4C6E-9F80-1A2B3C4D5E6F}'
$thumbShellExGuid = '{e357fccd-a995-4576-b01f-234630154e96}'
$progIdShellEx = "HKCU:\Software\Classes\$progId\ShellEx\$thumbShellExGuid"

function Set-ProgIdThumbHandler {
    New-Item -Path $progIdShellEx -Force | Out-Null
    Set-ItemProperty -Path $progIdShellEx -Name '(default)' -Value $thumbClsid
}

function Remove-ProgIdThumbHandler {
    if (Test-Path $progIdShellEx) { Remove-Item $progIdShellEx -Recurse -Force -ErrorAction SilentlyContinue }
}

function Invoke-RegSvr($dllPath, [switch]$Unregister) {
    $regArgs = @('/s')
    if ($Unregister) { $regArgs += '/u' }
    $regArgs += $dllPath
    $p = Start-Process -FilePath 'regsvr32.exe' -ArgumentList $regArgs -Wait -PassThru
    return $p.ExitCode
}

if ($Uninstall) {
    if (Test-Path $installedDll) {
        [void](Invoke-RegSvr $installedDll -Unregister)
        Write-Host "Unregistered $installedDll"
    }
    # Also clear a possible dev-path registration from the PoC.
    if (Test-Path $builtDll) { [void](Invoke-RegSvr $builtDll -Unregister) }
    if (Test-Path $installedDll) { Remove-Item $installedDll -Force }
    Remove-ProgIdThumbHandler
    Write-Host 'RePic thumbnail handler uninstalled.'
    return
}

if ($Build) {
    Write-Host 'Building repic_thumbs.dll (release)...'
    $cargo = Join-Path $env:USERPROFILE '.cargo\bin\cargo.exe'
    if (-not (Test-Path $cargo)) { $cargo = 'cargo' }
    Push-Location $crateDir
    try {
        & $cargo build --release
        if ($LASTEXITCODE -ne 0) { throw "cargo build failed ($LASTEXITCODE)" }
    } finally {
        Pop-Location
    }
}

if (-not (Test-Path $builtDll)) {
    throw "DLL not found: $builtDll  (run with -Build, or 'cargo build --release' in $crateDir)"
}

# Clear any prior dev-path registration so only the stable copy remains active.
[void](Invoke-RegSvr $builtDll -Unregister)

New-Item -ItemType Directory -Force -Path $installDir | Out-Null
Copy-Item $builtDll $installedDll -Force
Write-Host "Installed DLL -> $installedDll"

$code = Invoke-RegSvr $installedDll
if ($code -ne 0) { throw "regsvr32 registration failed (exit $code)" }
Set-ProgIdThumbHandler
Write-Host 'RePic thumbnail handler registered (extension + ProgID).'
Write-Host 'If existing .repic files still show the logo, clear the thumbnail cache:'
Write-Host '  Stop-Process -Name explorer -Force; Remove-Item "$env:LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache_*.db" -Force -EA SilentlyContinue; Start-Process explorer'
