$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$toolDir = Join-Path $projectRoot '.tools/edge'
New-Item -ItemType Directory -Path $toolDir -Force | Out-Null
$downloads = @(
  @{ Name='deno.zip'; Url='https://github.com/denoland/deno/releases/download/v2.9.6/deno-x86_64-pc-windows-msvc.zip'; Hash='15e5300b0ba3c3695a7621d90160a746ec9e710228cee639afa9d580f6e3cd11'; Binary='deno.exe' },
  @{ Name='supabase.tar.gz'; Url='https://github.com/supabase/cli/releases/download/v2.117.0/supabase_windows_amd64.tar.gz'; Hash='84dbb4b75466065d4458eeda1cd6a95fff31ff33202ffcd8edac41819d0ce496'; Binary='supabase.exe' }
)
foreach ($item in $downloads) {
  $archivePath = Join-Path $toolDir $item.Name
  if (-not (Test-Path -LiteralPath $archivePath)) { Invoke-WebRequest -Uri $item.Url -OutFile $archivePath }
  if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $item.Hash) { throw 'Official archive checksum mismatch; extraction cancelled.' }
  if (-not (Test-Path -LiteralPath (Join-Path $toolDir $item.Binary))) {
    if ($item.Name.EndsWith('.zip')) { Expand-Archive -LiteralPath $archivePath -DestinationPath $toolDir }
    else { & tar.exe -xzf $archivePath -C $toolDir supabase.exe; if ($LASTEXITCODE -ne 0) { throw 'CLI extraction failed' } }
  }
}
& (Join-Path $toolDir 'deno.exe') --version
& (Join-Path $toolDir 'supabase.exe') --version
