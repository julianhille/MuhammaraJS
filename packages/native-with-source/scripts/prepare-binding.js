"use strict";

var childProcess = require("child_process");
var fs = require("fs");
var path = require("path");

var packageRoot = path.resolve(__dirname, "..");
var setup = require("@muhammara/native-core/scripts/copy-openssl-dlls")(
  packageRoot,
);

if (setup && setup.opensslBinDirectory) {
  var openssl = path.join(setup.opensslBinDirectory, "openssl.exe");
  var result = fs.existsSync(openssl)
    ? childProcess.spawnSync(openssl, ["version"], { encoding: "utf8" })
    : childProcess.spawnSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          "(Get-Item -LiteralPath '" +
            path
              .join(setup.bindingDirectory, setup.dlls[0])
              .replace(/'/g, "''") +
            "').VersionInfo.ProductVersion",
        ],
        { encoding: "utf8" },
      );

  var version = result.status === 0 ? result.stdout.trim() : "";
  if (!version) {
    throw new Error("Unable to determine the bundled OpenSSL version");
  }
  fs.writeFileSync(
    path.join(setup.bindingDirectory, "OPENSSL_VERSION.txt"),
    version + "\n",
  );
}
