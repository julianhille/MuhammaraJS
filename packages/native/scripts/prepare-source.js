"use strict";

var fs = require("fs");
var path = require("path");

var packageRoot = path.resolve(__dirname, "..");
var packageSource = path.join(packageRoot, "src");
var repositoryRoot = path.resolve(packageRoot, "../..");
var repositorySource = path.join(repositoryRoot, "src");
var repositoryPackage = path.join(repositoryRoot, "package.json");

if (
  fs.existsSync(repositoryPackage) &&
  require(repositoryPackage).name === "muhammara-monorepo"
) {
  fs.rmSync(packageSource, { force: true, recursive: true });
  fs.cpSync(repositorySource, packageSource, { recursive: true });
}
