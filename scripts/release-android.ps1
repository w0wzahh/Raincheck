$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$version = (Get-Content -Raw VERSION).Trim()
if ($version -notmatch '^\d+\.\d+\.\d+$') {
    throw "VERSION must be MAJOR.MINOR.PATCH, got '$version'"
}

$required = @(
    'ANDROID_KEYSTORE_PATH',
    'ANDROID_KEYSTORE_PASSWORD',
    'ANDROID_KEY_ALIAS',
    'ANDROID_KEY_PASSWORD'
)
foreach ($name in $required) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
        throw "Missing signing environment variable: $name"
    }
}

Write-Host "Building signed RainCheck V$version..." -ForegroundColor Cyan

npm run version:sync
if ($LASTEXITCODE -ne 0) { throw 'Version metadata sync failed.' }

npm run build
if ($LASTEXITCODE -ne 0) { throw 'Web build failed.' }

npx cap sync android
if ($LASTEXITCODE -ne 0) { throw 'Capacitor Android sync failed.' }

npm run verify
if ($LASTEXITCODE -ne 0) { throw 'Release verification failed.' }

Push-Location android
try {
    .\gradlew.bat clean assembleRelease
    if ($LASTEXITCODE -ne 0) { throw 'Gradle release build failed.' }
} finally {
    Pop-Location
}

$apk = Join-Path $root 'android\app\build\outputs\apk\release\Raincheck.apk'
if (-not (Test-Path $apk)) {
    throw "Expected signed APK was not produced: $apk"
}

$releaseDir = Join-Path $root 'release'
New-Item -ItemType Directory -Force $releaseDir | Out-Null
$destination = Join-Path $releaseDir 'Raincheck.apk'
Copy-Item $apk $destination -Force

Write-Host "`nRelease ready:" -ForegroundColor Green
Write-Host "  Version : V$version"
Write-Host "  APK     : $destination"
Write-Host "  Output  : Raincheck.apk"
