param([switch]$AcceptAndroidSdkLicense)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$pilotRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = [IO.Path]::GetFullPath((Join-Path $pilotRoot '../../../..'))
$toolRoot = Join-Path $workspaceRoot '.tools'
$sdkRoot = Join-Path $toolRoot 'android-sdk'
New-Item -ItemType Directory -Force -Path $toolRoot, $sdkRoot | Out-Null
function Receive-VerifiedArchive([string]$Uri, [string]$Target, [string]$Sha256) {
  if (!(Test-Path -LiteralPath $Target)) { Invoke-WebRequest -UseBasicParsing -Uri $Uri -OutFile $Target }
  if ((Get-FileHash -LiteralPath $Target -Algorithm SHA256).Hash -ne $Sha256) { throw "Checksum mismatch: $Target" }
}
$sdkZip = Join-Path $toolRoot 'commandlinetools-win-15859902.zip'
$sdkManager = Join-Path $sdkRoot 'cmdline-tools/latest/bin/sdkmanager.bat'
if (!(Test-Path -LiteralPath $sdkManager)) {
  Receive-VerifiedArchive 'https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip' $sdkZip '90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a'
  $extractRoot = Join-Path $toolRoot 'sdk-cli-extracted'
  Expand-Archive -LiteralPath $sdkZip -DestinationPath $extractRoot -Force
  New-Item -ItemType Directory -Force -Path (Join-Path $sdkRoot 'cmdline-tools/latest') | Out-Null
  Copy-Item -Path (Join-Path $extractRoot 'cmdline-tools/*') -Destination (Join-Path $sdkRoot 'cmdline-tools/latest') -Recurse -Force
}
$gradleZip = Join-Path $toolRoot 'gradle-8.13-bin.zip'
$shaContent = (Invoke-WebRequest -UseBasicParsing 'https://services.gradle.org/distributions/gradle-8.13-bin.zip.sha256').Content
$gradleSha = if ($shaContent -is [byte[]]) { [Text.Encoding]::UTF8.GetString($shaContent).Trim() } else { [string]$shaContent.Trim() }
Receive-VerifiedArchive 'https://services.gradle.org/distributions/gradle-8.13-bin.zip' $gradleZip $gradleSha
if (!(Test-Path -LiteralPath (Join-Path $toolRoot 'gradle-8.13/bin/gradle.bat'))) { Expand-Archive -LiteralPath $gradleZip -DestinationPath $toolRoot }
if (!$AcceptAndroidSdkLicense) { throw 'Run again with -AcceptAndroidSdkLicense only after explicitly accepting the Google Android SDK license.' }
$env:JAVA_HOME = 'C:/Program Files/Java/jdk-22'
$env:ANDROID_HOME = $sdkRoot
# Only accept licenses needed by these three explicitly requested Android packages.
1..3 | ForEach-Object { 'y' } | & $sdkManager "--sdk_root=$sdkRoot" 'platform-tools' 'platforms;android-36' 'build-tools;36.0.0'
if ($LASTEXITCODE -ne 0) { throw 'Android SDK installation failed.' }
Write-Host "Android SDK ready: $sdkRoot"
