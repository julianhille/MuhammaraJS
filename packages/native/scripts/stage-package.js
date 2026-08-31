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

function stagePackage(name, directory) {
  fs.rmSync(directory, { force: true, recursive: true });
  fs.mkdirSync(directory, { recursive: true });
  packageFiles.forEach(function (file) {
    fs.cpSync(path.join(packageRoot, file), path.join(directory, file), {
      recursive: true,
    });
  });
  fs.cpSync(path.join(repositoryRoot, "src"), path.join(directory, "src"), {
    dereference: true,
    recursive: true,
  });
  fs.copyFileSync(
    path.join(repositoryRoot, "LICENSE"),
    path.join(directory, "LICENSE"),
  );
  var manifest = { ...packageManifest, name };
  if (name === "muhammara") {
    manifest.description =
      "Compatibility package for @muhammara/native; create, read, and modify PDF files and streams";
  }
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
  if (/^muhammara(?:-native)?-.+\.tgz$/.test(filename)) {
    fs.rmSync(path.join(buildRoot, filename), { force: true });
  }
});

stagePackage("muhammara", path.join(buildRoot, "release-package"));
stagePackage(
  "@muhammara/native",
  path.join(buildRoot, "release-package-scoped"),
);
