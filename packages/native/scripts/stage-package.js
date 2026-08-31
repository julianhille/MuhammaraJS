"use strict";

var childProcess = require("child_process");
var fs = require("fs");
var path = require("path");

var packageRoot = path.resolve(__dirname, "..");
var repositoryRoot = path.resolve(packageRoot, "../..");
var buildRoot = path.join(packageRoot, "build");
var packageManifest = require(path.join(packageRoot, "package.json"));
var packageFiles = [
  "binding.gyp",
  "fonts",
  "lib",
  "scripts",
  "muhammara.d.ts",
  "THIRD_PARTY_NOTICES.md",
  "README.md",
];

function stagePackage(manifest, directory, includeSource) {
  fs.rmSync(directory, { force: true, recursive: true });
  fs.mkdirSync(directory, { recursive: true });
  packageFiles.forEach(function (file) {
    fs.cpSync(path.join(packageRoot, file), path.join(directory, file), {
      recursive: true,
    });
  });
  if (includeSource) {
    fs.cpSync(path.join(repositoryRoot, "src"), path.join(directory, "src"), {
      dereference: true,
      recursive: true,
    });
  }
  fs.copyFileSync(
    path.join(repositoryRoot, "LICENSE"),
    path.join(directory, "LICENSE"),
  );
  fs.writeFileSync(
    path.join(directory, "package.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  childProcess.execFileSync(
    "npm",
    ["pack", "--ignore-scripts", "--pack-destination", buildRoot, directory],
    { cwd: repositoryRoot, stdio: "inherit" },
  );
}

fs.mkdirSync(buildRoot, { recursive: true });
childProcess.execFileSync("node", ["scripts/prepare-source.js"], {
  cwd: packageRoot,
  stdio: "inherit",
});
fs.readdirSync(buildRoot).forEach(function (filename) {
  if (/^muhammara-native(?:-with-source)?-.+\.tgz$/.test(filename)) {
    fs.rmSync(path.join(buildRoot, filename), { force: true });
  }
});

stagePackage(
  packageManifest,
  path.join(buildRoot, "release-package-with-source"),
  true,
);

var slimManifest = {
  ...packageManifest,
  name: "@muhammara/native",
  description:
    "Native prebuilt binaries for creating, reading, and modifying PDF files and streams",
  files: [
    "scripts/install-prebuilt.js",
    "scripts/copy-openssl-dlls.js",
    "lib",
    "fonts",
    "muhammara.d.ts",
    "THIRD_PARTY_NOTICES.md",
  ],
  scripts: {
    install: "node scripts/install-prebuilt.js",
    postinstall: "node scripts/copy-openssl-dlls.js",
  },
  bin: undefined,
};

stagePackage(slimManifest, path.join(buildRoot, "release-package"), false);
