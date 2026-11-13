param(
  [Parameter(Position=0)][string]$Url = $env:APP_URL
)
$ErrorActionPreference = 'Stop'
if (-not $Url) {
  Write-Host "Usage: .\tools\apk-generator\generate-apk.ps1 <https://your-app-url>"
  Write-Host "Env: APP_URL, APP_NAME, APP_ID, OUT_DIR, VERSION_CODE, VERSION_NAME, KEYSTORE, KS_ALIAS, KS_PASS, KEY_PASS"
  exit 1
}
$bash = Get-Command bash -ErrorAction SilentlyContinue
if (-not $bash) {
  Write-Error "bash not found. Install Git Bash or WSL, or run on Linux/macOS: bash tools/apk-generator/generate-apk.sh <URL>"
  exit 1
}
$env:APP_URL = $Url
& $bash.Source "tools/apk-generator/generate-apk.sh" $Url
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
