$ErrorActionPreference='Stop'
$pilotRoot=Split-Path -Parent $PSScriptRoot
$workspaceRoot=[IO.Path]::GetFullPath((Join-Path $pilotRoot '../../../..'))
$toolRoot=Join-Path $workspaceRoot '.tools'
$env:JAVA_HOME='C:/Program Files/Java/jdk-22'
$env:GRADLE_USER_HOME=Join-Path $toolRoot 'gradle-home'
$adb=Join-Path $toolRoot 'android-sdk/platform-tools/adb.exe'
$devices=@(& $adb devices | Select-String '\sdevice$')
if($devices.Count-ne 1) { throw 'Connect exactly one authorized test phone.' }
$lock=& $adb shell dumpsys window policy
if($lock -match 'showing=true|mIsShowing=true|mShowingLockscreen=true') { throw 'Unlock the phone yourself before running UI tests. This script never unlocks it.' }
Push-Location $pilotRoot
try {
  # Install explicitly: connectedDebugAndroidTest removes the pilot and its screenshots afterwards.
  & (Join-Path $toolRoot 'gradle-8.13/bin/gradle.bat') ':app:assembleDebug' ':app:assembleDebugAndroidTest' '--console' 'plain'
  if($LASTEXITCODE-ne 0) { throw 'Instrumentation build failed.' }
  & $adb install -r (Join-Path $pilotRoot 'app/build/outputs/apk/debug/app-debug.apk')
  if($LASTEXITCODE-ne 0) { throw 'Pilot installation failed.' }
  & $adb install -r -t (Join-Path $pilotRoot 'app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk')
  if($LASTEXITCODE-ne 0) { throw 'Test APK installation failed.' }
  $instrumentationOutput=& $adb shell am instrument -w -r 'kr.co.waboranggae.nativepilot.test/androidx.test.runner.AndroidJUnitRunner'
  $instrumentationOutput | Write-Output
  $screens=Join-Path $pilotRoot '../.runtime/native-pilot/device-screens'
  New-Item -ItemType Directory -Force -Path $screens | Out-Null
  & $adb pull '/sdcard/Android/data/kr.co.waboranggae.nativepilot/files/native-pilot-screens/.' $screens
  if(($instrumentationOutput -join "`n") -notmatch 'OK \(\d+ tests?\)') { throw 'Device UI test failed. Inspect the output and device-screens/99-failure.png.' }
} finally { Pop-Location }
