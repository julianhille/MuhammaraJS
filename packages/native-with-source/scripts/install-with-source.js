"use strict";

var childProcess = require("child_process");
var fs = require("fs");
var path = require("path");

var packageRoot = path.resolve(__dirname, "..");
var builtAddon = path.join(packageRoot, "build", "Release", "muhammara.node");
var addonExisted = fs.existsSync(builtAddon);
var extraFlags = process.env.EXTRA_NODE_PRE_GYP_FLAGS
  ? process.env.EXTRA_NODE_PRE_GYP_FLAGS.trim().split(/\s+/)
  : [];
var buildFlags = ["--jobs=max"].concat(extraFlags);
var nodePreGyp = require.resolve("@mapbox/node-pre-gyp/bin/node-pre-gyp");
var forceSourceBuild =
  extraFlags.includes("--build-from-source") ||
  process.env.npm_config_build_from_source === "true";
var ccache =
  process.platform === "win32"
    ? null
    : childProcess.spawnSync("ccache", ["--version"], { stdio: "ignore" });

if (
  ccache &&
  !ccache.error &&
  ccache.status === 0 &&
  !process.env.CC &&
  !process.env.CXX
) {
  process.env.CC = "ccache cc";
  process.env.CXX = "ccache c++";
}

var result = forceSourceBuild
  ? { status: 1 }
  : childProcess.spawnSync(process.execPath, [nodePreGyp, "install"], {
      stdio: "inherit",
    });

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  var opensslBuilder = path.join(
    __dirname,
    process.platform === "win32" ? "build-openssl.ps1" : "build-openssl.sh",
  );
  var opensslResult = childProcess.spawnSync(
    process.platform === "win32" ? "powershell.exe" : "sh",
    process.platform === "win32"
      ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", opensslBuilder]
      : [opensslBuilder],
    { stdio: "inherit" },
  );
  if (opensslResult.error) {
    throw opensslResult.error;
  }
  if (opensslResult.status !== 0) {
    process.exit(opensslResult.status || 1);
  }
  result = childProcess.spawnSync(
    process.execPath,
    [nodePreGyp, "install", "--fallback-to-build"].concat(buildFlags),
    { stdio: "inherit" },
  );
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

if (!addonExisted && fs.existsSync(builtAddon)) {
  console.log(
    "MuhammaraJS compiled from source. After verifying the addon, run " +
      "muhammara-clean-source before packaging your application to remove src/.",
  );
}
