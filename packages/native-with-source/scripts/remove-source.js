#!/usr/bin/env node
"use strict";

var fs = require("fs");
var path = require("path");

var packageRoot = path.join(__dirname, "..");
var sourceDirectory = path.join(packageRoot, "src");
var addonPaths = [
  path.join(packageRoot, "binding", "muhammara.node"),
  path.join(packageRoot, "build", "Release", "muhammara.node"),
];

if (!addonPaths.some(fs.existsSync)) {
  throw new Error(
    "Cannot remove C++ sources before MuhammaraJS has been built or installed",
  );
}

if (fs.existsSync(sourceDirectory)) {
  fs.rmSync(sourceDirectory, { force: true, recursive: true });
  console.log("Removed MuhammaraJS C++ sources: " + sourceDirectory);
} else {
  console.log("MuhammaraJS C++ sources are already absent.");
}
