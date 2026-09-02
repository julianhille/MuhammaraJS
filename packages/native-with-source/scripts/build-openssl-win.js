"use strict";

var childProcess = require("child_process");
var fs = require("fs");
var path = require("path");

var targetArchitectureArgument = process.argv[2] || "";
var targetArchitecture =
  targetArchitectureArgument.replace("--target-architecture=", "") ||
  process.env.OPENSSL_TARGET_ARCH ||
  process.env.npm_config_target_arch ||
  process.env.npm_config_arch ||
  process.arch;
var opensslTargets = {
  x64: "VC-WIN64A",
  ia32: "VC-WIN32",
  arm64: "VC-WIN64-ARM",
};
var visualStudioArchitectures = {
  x64: "x64",
  ia32: "x86",
  arm64: "arm64",
};

function run(command, args, options) {
  var result = childProcess.spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }

  return result;
}

if (!opensslTargets[targetArchitecture]) {
  throw new Error(
    "Unsupported OpenSSL build target: Windows-" + targetArchitecture,
  );
}

var packageRoot = path.resolve(__dirname, "..");
var archive = path.join(packageRoot, "src", "deps", "openssl-3.5.4.tar.gz");
var sourceDirectory = path.join(
  packageRoot,
  "openssl-build",
  targetArchitecture,
);

if (!fs.existsSync(archive)) {
  throw new Error("Bundled OpenSSL source archive not found: " + archive);
}

fs.rmSync(sourceDirectory, { recursive: true, force: true });
fs.mkdirSync(sourceDirectory, { recursive: true });
run("tar.exe", [
  "-xzf",
  archive,
  "--strip-components=1",
  "-C",
  sourceDirectory,
]);

var visualStudioPath =
  process.env.OPENSSL_VS_INSTALL_PATH ||
  process.env.GYP_MSVS_OVERRIDE_PATH ||
  process.env.VSINSTALLDIR;
var msbuildPath = process.env.npm_config_msbuild_path;

if (!visualStudioPath && msbuildPath) {
  visualStudioPath = path.resolve(path.dirname(msbuildPath), "..", "..", "..");
}

if (!visualStudioPath) {
  var vswhere = path.join(
    process.env["ProgramFiles(x86)"],
    "Microsoft Visual Studio",
    "Installer",
    "vswhere.exe",
  );
  var visualStudioResult = childProcess.spawnSync(
    vswhere,
    [
      "-latest",
      "-products",
      "*",
      "-requires",
      "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
      "-property",
      "installationPath",
    ],
    { encoding: "utf8" },
  );

  if (visualStudioResult.error) {
    throw visualStudioResult.error;
  }

  visualStudioPath = visualStudioResult.stdout.trim();
  if (visualStudioResult.status !== 0 || !visualStudioPath) {
    throw new Error("Visual Studio C++ build tools were not found");
  }
}

var vsDevCmd = path.join(visualStudioPath, "Common7", "Tools", "VsDevCmd.bat");
if (!fs.existsSync(vsDevCmd)) {
  throw new Error(
    "Visual Studio C++ build tools were not found at " + visualStudioPath,
  );
}

var toolsetsDirectory = path.join(visualStudioPath, "VC", "Tools", "MSVC");
var toolsets = fs
  .readdirSync(toolsetsDirectory, { withFileTypes: true })
  .filter(function (entry) {
    return entry.isDirectory();
  })
  .map(function (entry) {
    return entry.name;
  })
  .sort()
  .reverse();
var nmake = path.join(
  toolsetsDirectory,
  toolsets[0] || "",
  "bin",
  "Hostx64",
  "x64",
  "nmake.exe",
);

if (!toolsets.length || !fs.existsSync(nmake)) {
  throw new Error("NMake was not found in the Visual Studio C++ build tools");
}

var command =
  'call "' +
  vsDevCmd +
  '" -arch=' +
  visualStudioArchitectures[targetArchitecture] +
  ' -host_arch=x64 && cd /d "' +
  sourceDirectory +
  '" && perl Configure ' +
  opensslTargets[targetArchitecture] +
  ' no-asm no-shared no-apps no-tests && call "' +
  nmake +
  '" build_libs';

run("cmd.exe", ["/v:on", "/d", "/s", "/c", command]);
