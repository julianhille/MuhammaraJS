$ErrorActionPreference = "Stop"

$opensslVersion = $env:OPENSSL_VERSION
$targetArchitecture = $env:OPENSSL_TARGET_ARCH
if ([string]::IsNullOrWhiteSpace($opensslVersion) -or [string]::IsNullOrWhiteSpace($targetArchitecture)) {
  throw "OPENSSL_VERSION and OPENSSL_TARGET_ARCH are required"
}

$archive = Join-Path $PWD "packages\native-with-source\src\deps\openssl-$opensslVersion.tar.gz"
$sourceDirectory = Join-Path $PWD "build\openssl"

if (-not (Test-Path $archive -PathType Leaf)) {
  throw "Vendored OpenSSL source archive not found: $archive"
}

Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $sourceDirectory
New-Item -ItemType Directory -Force -Path $sourceDirectory | Out-Null
tar -xzf $archive --strip-components=1 -C $sourceDirectory

$opensslTarget = switch ($targetArchitecture) {
  "x64" { "VC-WIN64A" }
  "ia32" { "VC-WIN32" }
  "arm64" { "VC-WIN64-ARM" }
  default { throw "Unsupported OpenSSL build target: Windows-$targetArchitecture" }
}

$visualStudioArchitecture = switch ($targetArchitecture) {
  "ia32" { "x86" }
  default { $targetArchitecture }
}

$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$visualStudioPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if ([string]::IsNullOrWhiteSpace($visualStudioPath)) {
  throw "Visual Studio C++ build tools were not found"
}

$vsDevCmd = Join-Path $visualStudioPath "Common7\Tools\VsDevCmd.bat"
$msvcToolset = Get-ChildItem -Path (Join-Path $visualStudioPath "VC\Tools\MSVC") -Directory | Sort-Object Name -Descending | Select-Object -First 1 -ExpandProperty FullName
$nmakePath = Join-Path $msvcToolset "bin\Hostx64\x64\nmake.exe"
if (-not (Test-Path $nmakePath -PathType Leaf)) {
  throw "NMake was not found in the Visual Studio C++ build tools"
}

$command = "call `"$vsDevCmd`" -arch=$visualStudioArchitecture -host_arch=x64 && cd /d `"$sourceDirectory`" && perl Configure $opensslTarget no-asm no-shared no-apps no-tests && call `"$nmakePath`" build_libs"
& cmd.exe /v:on /d /s /c $command
if ($LASTEXITCODE -ne 0) {
  throw "OpenSSL build failed"
}

Add-Content -Path $env:GITHUB_ENV -Value "OPENSSL_LIB_DIR=$sourceDirectory"
