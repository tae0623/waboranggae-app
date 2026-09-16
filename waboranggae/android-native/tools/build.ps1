param([switch]$Install, [switch]$Test, [switch]$CloudDevice)
$ErrorActionPreference='Stop'
$pilotRoot=Split-Path -Parent $PSScriptRoot
$workspaceRoot=[IO.Path]::GetFullPath((Join-Path $pilotRoot '../../../..'))
$toolRoot=Join-Path $workspaceRoot '.tools'
$env:JAVA_HOME='C:/Program Files/Java/jdk-22'
$env:GRADLE_USER_HOME=Join-Path $toolRoot 'gradle-home'
$env:ANDROID_HOME=Join-Path $toolRoot 'android-sdk'
$gradle=Join-Path $toolRoot 'gradle-8.13/bin/gradle.bat'
$configureArgs=@((Join-Path $PSScriptRoot 'configure.mjs'))
if($CloudDevice){$configureArgs+='--cloud-device'}
& node @configureArgs
if($LASTEXITCODE -ne 0) { throw 'Native configuration failed.' }
& node (Join-Path $PSScriptRoot 'sync-web-art.mjs')
if($LASTEXITCODE -ne 0) { throw 'Original web artwork export failed.' }
Push-Location $pilotRoot
try {
  $tasks=@(':app:assembleDebug')
  if($Test) { $tasks+= ':app:testDebugUnitTest'; $tasks+=':app:lintDebug' }
  & $gradle @tasks '--console' 'plain'
  if($LASTEXITCODE -ne 0) { throw 'Native build failed.' }
  $apk=Join-Path $pilotRoot 'app/build/outputs/apk/debug/app-debug.apk'
  Write-Host "APK: $apk"
  if($Install) {
    $adb=Join-Path $env:ANDROID_HOME 'platform-tools/adb.exe'
    $connected=@(& $adb devices | Select-String '\sdevice$')
    if($connected.Count -ne 1) { throw 'Connect exactly one authorized phone before installing.' }
    & $adb install -r $apk
    if($LASTEXITCODE -ne 0) { throw 'APK installation failed.' }
    & $adb shell am start -n 'kr.co.waboranggae.nativepilot/.MainActivity'
  }
} finally { Pop-Location }
